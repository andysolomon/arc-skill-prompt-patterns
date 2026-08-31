import { PATTERN_IDS } from "./catalog.mjs";
import { normalizeInput, normalizeOutput } from "./contract.mjs";
import { resolveModelProfile, UNKNOWN_MODEL_PROFILE } from "./profiles.mjs";

const freezeRecord = (value) =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(value).map(([key, entries]) => [key, Object.freeze(entries.map((entry) => Object.freeze([...entry])))])
    )
  );

// Scores express descriptive prompt-pattern fit. PATTERN_IDS order is the final,
// explicit tie-break so adding rules cannot make equal scores unstable.
const TASK_RULES = freezeRecord({
  extraction: [["template-fill", 8], ["few-shot", 3], ["boundary", 2]],
  classification: [["few-shot", 8], ["template-fill", 4], ["boundary", 2]],
  research: [["evidence-grounding", 8], ["hypothesis-test", 3], ["decomposition", 2]],
  planning: [["decomposition", 8], ["boundary", 3], ["critique", 2]],
  coding: [["decomposition", 8], ["template-fill", 3], ["critique", 2]],
  debugging: [["hypothesis-test", 8], ["decomposition", 3], ["evidence-grounding", 2]],
  review: [["critique", 8], ["evidence-grounding", 3], ["boundary", 2]],
  deployment: [["guardrail", 8], ["boundary", 4], ["critique", 2]]
});

const PHASE_RULES = freezeRecord({
  explore: [["hypothesis-test", 4], ["decomposition", 2]],
  analyze: [["decomposition", 4], ["evidence-grounding", 2]],
  research: [["evidence-grounding", 4], ["hypothesis-test", 2]],
  plan: [["decomposition", 4], ["boundary", 2]],
  implement: [["template-fill", 4], ["decomposition", 2]],
  verify: [["critique", 4], ["evidence-grounding", 2]],
  deploy: [["guardrail", 4], ["boundary", 2]]
});

const RELIABILITY_RULES = freezeRecord({
  exploratory: [["hypothesis-test", 2], ["meta-prompt", 1]],
  standard: [["template-fill", 1], ["boundary", 1]],
  "high-assurance": [["critique", 3], ["evidence-grounding", 3], ["guardrail", 2]]
});

const RISK_RULES = freezeRecord({
  low: [["template-fill", 1]],
  medium: [["boundary", 2]],
  high: [["guardrail", 4], ["boundary", 3], ["critique", 2]],
  critical: [["guardrail", 7], ["boundary", 5], ["critique", 3]]
});

const SHAPE_RULES = freezeRecord({
  text: [["audience-adaptation", 2], ["boundary", 1]],
  structured: [["template-fill", 4], ["few-shot", 2]],
  code: [["decomposition", 3], ["critique", 2]],
  "tool-call": [["guardrail", 3], ["template-fill", 3], ["boundary", 2]],
  mixed: [["decomposition", 3], ["boundary", 2]]
});

const AMBIGUITY_RULES = freezeRecord({
  none: [["template-fill", 1]],
  low: [["boundary", 1]],
  medium: [["boundary", 3], ["decomposition", 2]],
  high: [["boundary", 5], ["hypothesis-test", 3], ["decomposition", 2]]
});

const PHASE_GUIDANCE = Object.freeze({
  explore: "List the open questions and test the most informative assumptions first.",
  analyze: "Separate observations, interpretations, and unresolved uncertainty.",
  research: "Collect relevant evidence and preserve the connection between claims and sources.",
  plan: "Define bounded steps, dependencies, acceptance criteria, and explicit exclusions.",
  implement: "Apply the selected pattern within the stated scope and preserve existing constraints.",
  verify: "Check the result against the requested behavior, evidence, and edge cases.",
  deploy: "Confirm safety constraints and rollback considerations before any release action."
});

const PRIMARY_INSTRUCTIONS = Object.freeze({
  "template-fill": "Use a fixed template and populate every required field with task-specific content.",
  "few-shot": "Use representative examples to establish the intended distinctions and response behavior.",
  decomposition: "Break the task into explicit, ordered subtasks and integrate their results.",
  critique: "Evaluate the proposed result against stated criteria, then correct identified weaknesses.",
  guardrail: "State the safety and scope constraints before producing the requested result.",
  boundary: "Define what is in scope, out of scope, and how uncertain edge cases are handled.",
  "audience-adaptation": "Match the wording, depth, and organization to the intended reader.",
  "meta-prompt": "Use a reusable procedure to construct and assess the task prompt.",
  "evidence-grounding": "Tie material claims to available evidence and label unsupported uncertainty.",
  "hypothesis-test": "Form testable hypotheses and identify observations that would confirm or refute them."
});

const OUTPUT_INSTRUCTIONS = Object.freeze({
  text: "Return concise prose with clearly separated conclusions and qualifications.",
  structured: "Return a consistent structured shape and include every required field.",
  code: "Return code plus the minimum explanation and verification needed to assess it.",
  "tool-call": "Return only a well-formed descriptive tool-call shape with explicit arguments.",
  mixed: "Clearly separate structured data, code, and explanatory prose."
});

const applyRules = (scores, rules) => {
  for (const [id, weight] of rules) {
    scores.set(id, scores.get(id) + weight);
  }
};

const rankPatterns = (input) => {
  const scores = new Map(PATTERN_IDS.map((id) => [id, 0]));
  applyRules(scores, TASK_RULES[input.taskType]);
  applyRules(scores, PHASE_RULES[input.arcPhase]);
  applyRules(scores, RELIABILITY_RULES[input.reliabilityTier]);
  applyRules(scores, RISK_RULES[input.risk]);
  applyRules(scores, SHAPE_RULES[input.outputShape]);
  applyRules(scores, AMBIGUITY_RULES[input.ambiguity]);

  if (input.budget.maxTokens !== undefined && input.budget.maxTokens <= 512) {
    applyRules(scores, [["template-fill", 3], ["boundary", 1]]);
  }
  if (input.budget.maxLatencyMs !== undefined && input.budget.maxLatencyMs <= 1_000) {
    applyRules(scores, [["template-fill", 2], ["decomposition", -1], ["critique", -1]]);
  }

  return PATTERN_IDS.map((id, index) => ({ id, index, score: scores.get(id) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
};

const capabilityAdjustment = (input) => {
  // Automatic targets intentionally ignore an optional model hint: recommendations
  // must remain portable while another layer chooses the model.
  if (input.target.mode === "automatic") {
    return { fragments: [], warnings: [], confidenceDelta: 0 };
  }

  if (input.target.model === undefined) {
    return {
      fragments: [],
      warnings: ["No model profile was supplied; capability-specific guidance was omitted."],
      confidenceDelta: -0.03
    };
  }

  const profile = resolveModelProfile(input.target.model);
  if (profile === UNKNOWN_MODEL_PROFILE) {
    return {
      fragments: [],
      warnings: ["The model profile is unverified; do not assume structured output, tool use, or reasoning controls."],
      confidenceDelta: -0.08
    };
  }

  const fragments = [];
  const warnings = [];
  if (input.outputShape === "structured") {
    if (profile.schemaOutput.supported) {
      fragments.push({ kind: "format", text: "Use the model's supported schema-output capability to reinforce the requested structure." });
    } else {
      warnings.push("The selected model profile does not verify schema-output support; validate the structure independently.");
    }
  }
  if (input.outputShape === "tool-call" && !profile.toolUse.supported) {
    warnings.push("The selected model profile does not verify tool-use support; treat the requested shape as descriptive data.");
  }
  if (input.reliabilityTier === "high-assurance" && profile.reasoning.supported) {
    fragments.push({ kind: "verification", text: "Use available reasoning controls for internal review, while returning only the requested result and concise rationale." });
  }
  return { fragments, warnings, confidenceDelta: profile.verified ? 0.02 : 0 };
};

const budgetAdjustment = (input) => {
  const warnings = [];
  let overlayLimit = 3;
  let fragmentLimit = 6;
  let confidenceDelta = 0;

  if (input.budget.maxTokens !== undefined && input.budget.maxTokens <= 512) {
    overlayLimit = 2;
    fragmentLimit = 4;
    confidenceDelta -= 0.04;
    warnings.push("The token budget is tight; keep instructions compact and prioritize the primary pattern.");
  }
  if (input.budget.maxTokens !== undefined && input.budget.maxTokens <= 256) {
    overlayLimit = 1;
    fragmentLimit = 3;
    confidenceDelta -= 0.04;
  }
  if (input.budget.maxLatencyMs !== undefined && input.budget.maxLatencyMs <= 1_000) {
    overlayLimit = Math.min(overlayLimit, 1);
    fragmentLimit = Math.min(fragmentLimit, 3);
    confidenceDelta -= 0.05;
    warnings.push("The latency budget is tight; avoid optional iterative prompt passes.");
  }
  return { warnings, overlayLimit, fragmentLimit, confidenceDelta };
};

const confidenceFor = (input, deltas) => {
  const ambiguityDelta = { none: 0.06, low: 0.02, medium: -0.05, high: -0.12 }[input.ambiguity];
  const reliabilityDelta = { exploratory: -0.03, standard: 0, "high-assurance": 0.04 }[input.reliabilityTier];
  const riskDelta = { low: 0.03, medium: 0, high: -0.04, critical: -0.09 }[input.risk];
  const value = 0.78 + ambiguityDelta + reliabilityDelta + riskDelta + deltas;
  return Math.round(Math.max(0.4, Math.min(0.95, value)) * 100) / 100;
};

const rationaleFor = (input, primaryPattern, overlays) => {
  const overlayText = overlays.length > 0 ? ` Compatible overlays add ${overlays.join(", ")}.` : "";
  return `${primaryPattern} has the strongest deterministic fit for ${input.taskType} during the ${input.arcPhase} phase, with ${input.reliabilityTier} reliability, ${input.risk} risk, ${input.outputShape} output, and ${input.ambiguity} ambiguity.${overlayText}`;
};

/**
 * Return a deterministic, descriptive prompt-pattern recommendation.
 * Input normalization supplies isolation; output normalization validates and
 * deeply freezes a fresh result.
 */
export function recommend(input) {
  const normalized = normalizeInput(input);
  const ranked = rankPatterns(normalized);
  const budget = budgetAdjustment(normalized);
  const capability = capabilityAdjustment(normalized);
  const primaryPattern = ranked[0].id;
  const overlays = ranked
    .filter(({ id, score }) => id !== primaryPattern && score > 0)
    .slice(0, budget.overlayLimit)
    .map(({ id }) => id);

  const promptFragments = [
    { kind: "instruction", text: PRIMARY_INSTRUCTIONS[primaryPattern] },
    { kind: "format", text: OUTPUT_INSTRUCTIONS[normalized.outputShape] },
    ...(normalized.ambiguity === "medium" || normalized.ambiguity === "high"
      ? [{ kind: "context", text: "State material assumptions and isolate questions whose answers could change the result." }]
      : []),
    ...(normalized.risk === "high" || normalized.risk === "critical"
      ? [{ kind: "constraint", text: "Do not exceed the stated scope; flag unsafe or irreversible implications for independent review." }]
      : []),
    ...(normalized.reliabilityTier === "high-assurance"
      ? [{ kind: "verification", text: "Check the final result against requirements, evidence, edge cases, and stated constraints." }]
      : []),
    ...capability.fragments
  ].slice(0, budget.fragmentLimit);

  const lifecycleGuidance = [
    { phase: normalized.arcPhase, guidance: PHASE_GUIDANCE[normalized.arcPhase] },
    ...(normalized.reliabilityTier === "high-assurance" && normalized.arcPhase !== "verify"
      ? [{ phase: "verify", guidance: PHASE_GUIDANCE.verify }]
      : [])
  ];

  const warnings = [
    ...(normalized.ambiguity === "high"
      ? ["High ambiguity lowers confidence; resolve outcome-changing assumptions before relying on the result."]
      : []),
    ...(normalized.risk === "critical"
      ? ["Critical risk requires independent review and explicit checks outside this descriptive recommendation."]
      : []),
    ...budget.warnings,
    ...capability.warnings
  ];

  return normalizeOutput({
    primaryPattern,
    overlays,
    promptFragments,
    lifecycleGuidance,
    warnings,
    rationale: rationaleFor(normalized, primaryPattern, overlays),
    confidence: confidenceFor(normalized, budget.confidenceDelta + capability.confidenceDelta)
  });
}
