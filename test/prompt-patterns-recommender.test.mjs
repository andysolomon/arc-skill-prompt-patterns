import assert from "node:assert/strict";
import test from "node:test";

import {
  AMBIGUITIES,
  ARC_PHASES,
  isValidOutput,
  OUTPUT_FIELDS,
  OUTPUT_SHAPES,
  recommend,
  RELIABILITY_TIERS,
  RISKS,
  TASK_TYPES
} from "../prompt-patterns/index.mjs";

const input = (overrides = {}) => ({
  taskType: "research",
  arcPhase: "research",
  reliabilityTier: "standard",
  risk: "medium",
  target: { mode: "automatic" },
  outputShape: "text",
  ambiguity: "low",
  budget: {},
  ...overrides
});

const assertDeepFrozen = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) {
    assertDeepFrozen(value[key], seen);
  }
};

test("selects representative primaries for every task type", () => {
  const expected = {
    extraction: "template-fill",
    classification: "few-shot",
    research: "evidence-grounding",
    planning: "decomposition",
    coding: "decomposition",
    debugging: "hypothesis-test",
    review: "critique",
    deployment: "guardrail"
  };

  const phaseForTask = {
    extraction: "analyze",
    classification: "analyze",
    research: "research",
    planning: "plan",
    coding: "implement",
    debugging: "analyze",
    review: "verify",
    deployment: "deploy"
  };

  for (const taskType of TASK_TYPES) {
    const output = recommend(input({
      taskType,
      arcPhase: phaseForTask[taskType],
      outputShape: taskType === "coding" ? "code" : "text"
    }));
    assert.equal(output.primaryPattern, expected[taskType], taskType);
  }
});

test("returns a valid recommendation across the complete rule matrix", () => {
  let count = 0;
  for (const taskType of TASK_TYPES) {
    for (const arcPhase of ARC_PHASES) {
      for (const reliabilityTier of RELIABILITY_TIERS) {
        for (const risk of RISKS) {
          for (const outputShape of OUTPUT_SHAPES) {
            for (const ambiguity of AMBIGUITIES) {
              const output = recommend(input({
                taskType,
                arcPhase,
                reliabilityTier,
                risk,
                outputShape,
                ambiguity
              }));
              assert.equal(isValidOutput(output), true);
              assert.deepEqual(Object.keys(output), OUTPUT_FIELDS);
              assert.equal(output.lifecycleGuidance[0].phase, arcPhase);
              count += 1;
            }
          }
        }
      }
    }
  }
  assert.equal(count, 13_440);
});

test("is deterministic for repeated and deep-cloned inputs without mutating input", () => {
  const source = input({
    taskType: "debugging",
    arcPhase: "verify",
    reliabilityTier: "high-assurance",
    risk: "high",
    target: { mode: "explicit", model: "sol" },
    outputShape: "structured",
    ambiguity: "high",
    budget: { maxTokens: 4_096, maxLatencyMs: 10_000 }
  });
  const before = structuredClone(source);
  const first = recommend(source);
  const second = recommend(source);
  const cloned = recommend(structuredClone(source));

  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.notEqual(first, second);
  assert.notEqual(first.overlays, second.overlays);
  assertDeepFrozen(first);
});

test("uses stable catalog order to break equal scores", () => {
  const tied = input({
    taskType: "coding",
    arcPhase: "implement",
    reliabilityTier: "standard",
    risk: "low",
    outputShape: "text",
    ambiguity: "none"
  });
  const output = recommend(tied);

  assert.equal(output.primaryPattern, "template-fill");
  assert.equal(output.overlays[0], "decomposition");
  assert.deepEqual(output, recommend(structuredClone(tied)));
});

test("applies risk, reliability, ambiguity, shape, and phase guidance", () => {
  const output = recommend(input({
    taskType: "planning",
    arcPhase: "plan",
    reliabilityTier: "high-assurance",
    risk: "critical",
    outputShape: "structured",
    ambiguity: "high"
  }));

  assert.equal(output.overlays.includes("guardrail"), true);
  assert.equal(output.promptFragments.some(({ kind }) => kind === "verification"), true);
  assert.equal(output.promptFragments.some(({ kind }) => kind === "constraint"), true);
  assert.equal(output.promptFragments.some(({ kind }) => kind === "context"), true);
  assert.equal(output.promptFragments.some(({ kind, text }) => kind === "format" && text.includes("structured")), true);
  assert.deepEqual(output.lifecycleGuidance.map(({ phase }) => phase), ["plan", "verify"]);
  assert.equal(output.warnings.some((warning) => warning.includes("ambiguity")), true);
  assert.equal(output.warnings.some((warning) => warning.includes("Critical risk")), true);
});

test("honors tight token and latency budgets descriptively", () => {
  const baseline = recommend(input({ taskType: "coding", arcPhase: "implement", outputShape: "code" }));
  const constrained = recommend(input({
    taskType: "coding",
    arcPhase: "implement",
    outputShape: "code",
    budget: { maxTokens: 256, maxLatencyMs: 1_000 }
  }));

  assert.equal(baseline.overlays.length > constrained.overlays.length, true);
  assert.equal(constrained.overlays.length <= 1, true);
  assert.equal(constrained.promptFragments.length <= 3, true);
  assert.equal(constrained.warnings.some((warning) => warning.includes("token budget")), true);
  assert.equal(constrained.warnings.some((warning) => warning.includes("latency budget")), true);
  assert.equal(constrained.confidence < baseline.confidence, true);
});

test("uses explicit model capabilities only for descriptive adjustments", () => {
  const supported = recommend(input({
    target: { mode: "explicit", model: "sol" },
    outputShape: "structured",
    reliabilityTier: "high-assurance"
  }));
  const unknown = recommend(input({
    target: { mode: "explicit", model: "unlisted-model" },
    outputShape: "structured",
    reliabilityTier: "high-assurance"
  }));
  const noModel = recommend(input({ target: { mode: "explicit" } }));
  const modelOnly = recommend(input({ target: { model: "sol" }, outputShape: "structured" }));

  assert.equal(supported.promptFragments.some(({ text }) => text.includes("schema-output capability")), true);
  assert.equal(supported.promptFragments.some(({ text }) => text.includes("reasoning controls")), true);
  assert.equal(unknown.warnings.some((warning) => warning.includes("unverified")), true);
  assert.equal(unknown.confidence < supported.confidence, true);
  assert.equal(noModel.warnings.some((warning) => warning.includes("No model profile")), true);
  assert.equal(modelOnly.promptFragments.some(({ text }) => text.includes("schema-output capability")), true);
});

test("keeps automatic mode model-neutral and omits policy fields", () => {
  const automatic = [
    recommend(input({ target: { mode: "automatic" } })),
    recommend(input({ target: { mode: "automatic", model: "sol" } })),
    recommend(input({ target: { mode: "automatic", model: "unlisted-model" } }))
  ];
  assert.deepEqual(automatic[0], automatic[1]);
  assert.deepEqual(automatic[0], automatic[2]);

  const prohibited = new Set([
    "route", "workload", "authorization", "provider", "execution",
    "visibleChainOfThought", "accuracyGuarantee", "mandatoryTemperature"
  ]);
  const visit = (value) => {
    if (value === null || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      assert.equal(prohibited.has(key), false, key);
      visit(nested);
    }
  };
  for (const output of automatic) visit(output);
});

// Each marker must appear in exactly one tier, so the table proves the tiers are
// distinct and increasingly strict rather than merely non-empty.
const TIER_GUIDANCE_MARKERS = Object.freeze({
  exploratory: Object.freeze({
    structure: "open questions",
    evidence: "label unverified claims as provisional evidence",
    focusedTests: "name one focused check",
    verify: "treat independent Verify as optional at the parent's discretion",
    codeReview: "treat independent Code Review as unnecessary unless the parent requests it"
  }),
  standard: Object.freeze({
    structure: "complete requested structure",
    evidence: "cite the evidence supporting each material claim",
    focusedTests: "report the focused tests or checks that were run",
    verify: "expect independent Verify before the result is accepted",
    codeReview: "treat independent Code Review as optional at the parent's discretion"
  }),
  "high-assurance": Object.freeze({
    structure: "every required field of the requested structure",
    evidence: "cite verifiable evidence for every material claim",
    focusedTests: "report focused tests with exact commands and observed results",
    verify: "expect independent Verify before the result is relied on",
    codeReview: "independent Code Review as a recommended option"
  })
});

const FAIL_CLOSED_PREFIX = "High-assurance acceptance fails closed:";

const tierFragment = (output) =>
  output.promptFragments.find(({ text }) => text.includes("acceptance:"));

test("maps every reliability tier to distinct, increasingly strict acceptance guidance", () => {
  const texts = new Map();

  for (const reliabilityTier of RELIABILITY_TIERS) {
    const output = recommend(input({ reliabilityTier }));
    const fragment = tierFragment(output);

    assert.notEqual(fragment, undefined, reliabilityTier);
    assert.equal(fragment.kind, "verification", reliabilityTier);
    // Placed early so tight budgets cannot truncate the acceptance requirements.
    assert.equal(output.promptFragments.indexOf(fragment) <= 2, true, reliabilityTier);

    for (const [dimension, marker] of Object.entries(TIER_GUIDANCE_MARKERS[reliabilityTier])) {
      assert.equal(fragment.text.includes(marker), true, `${reliabilityTier}: ${dimension}`);
    }
    texts.set(reliabilityTier, fragment.text);
  }

  assert.equal(new Set(texts.values()).size, RELIABILITY_TIERS.length);
  for (const [tier, markers] of Object.entries(TIER_GUIDANCE_MARKERS)) {
    for (const [otherTier, text] of texts) {
      if (otherTier === tier) continue;
      for (const [dimension, marker] of Object.entries(markers)) {
        assert.equal(text.includes(marker), false, `${otherTier} leaked ${tier}.${dimension}`);
      }
    }
  }

  // Only high-assurance withholds acceptance while uncertainty is unresolved.
  assert.equal(texts.get("high-assurance").includes("withhold acceptance"), true);
  assert.equal(texts.get("standard").includes("withhold acceptance"), false);
  assert.equal(texts.get("exploratory").includes("withhold acceptance"), false);
});

test("keeps tier acceptance guidance deterministic and budget-resilient", () => {
  for (const reliabilityTier of RELIABILITY_TIERS) {
    const source = input({ reliabilityTier, budget: { maxTokens: 256, maxLatencyMs: 1_000 } });
    const first = recommend(source);
    const second = recommend(structuredClone(source));

    assert.deepEqual(first, second, reliabilityTier);
    assert.equal(first.promptFragments.length <= 3, true, reliabilityTier);
    assert.notEqual(tierFragment(first), undefined, reliabilityTier);
    assertDeepFrozen(first);
  }
});

test("preserves independent Verify lifecycle guidance for high-assurance only", () => {
  const highAssurance = recommend(input({ reliabilityTier: "high-assurance", arcPhase: "implement" }));
  const standard = recommend(input({ reliabilityTier: "standard", arcPhase: "implement" }));
  const exploratory = recommend(input({ reliabilityTier: "exploratory", arcPhase: "implement" }));
  const alreadyVerifying = recommend(input({ reliabilityTier: "high-assurance", arcPhase: "verify" }));

  assert.deepEqual(highAssurance.lifecycleGuidance.map(({ phase }) => phase), ["implement", "verify"]);
  assert.deepEqual(standard.lifecycleGuidance.map(({ phase }) => phase), ["implement"]);
  assert.deepEqual(exploratory.lifecycleGuidance.map(({ phase }) => phase), ["implement"]);
  assert.deepEqual(alreadyVerifying.lifecycleGuidance.map(({ phase }) => phase), ["verify"]);
});

test("fails high-assurance closed on unresolved assumptions", () => {
  for (const ambiguity of ["medium", "high"]) {
    const output = recommend(input({ reliabilityTier: "high-assurance", ambiguity }));
    const failClosed = output.warnings.filter((warning) => warning.startsWith(FAIL_CLOSED_PREFIX));

    assert.equal(failClosed.length, 1, ambiguity);
    assert.equal(failClosed[0].includes("the unresolved assumptions that could change the result"), true, ambiguity);
    assert.equal(failClosed[0].includes("required operator decision"), true, ambiguity);
  }

  for (const ambiguity of ["none", "low"]) {
    const output = recommend(input({ reliabilityTier: "high-assurance", ambiguity }));
    assert.equal(output.warnings.some((warning) => warning.startsWith(FAIL_CLOSED_PREFIX)), false, ambiguity);
  }
});

test("fails high-assurance closed on missing or unverified model evidence for explicit and model-only targets", () => {
  const missing = recommend(input({ reliabilityTier: "high-assurance", target: { mode: "explicit" } }));
  const unverified = recommend(input({
    reliabilityTier: "high-assurance",
    target: { mode: "explicit", model: "unlisted-model" }
  }));
  const verified = recommend(input({
    reliabilityTier: "high-assurance",
    target: { mode: "explicit", model: "sol" }
  }));
  const both = recommend(input({
    reliabilityTier: "high-assurance",
    ambiguity: "high",
    target: { mode: "explicit", model: "unlisted-model" }
  }));

  assert.equal(
    missing.warnings.some((warning) =>
      warning.startsWith(FAIL_CLOSED_PREFIX) &&
      warning.includes("the missing capability evidence for the model target")),
    true
  );
  assert.equal(
    unverified.warnings.some((warning) =>
      warning.startsWith(FAIL_CLOSED_PREFIX) &&
      warning.includes("the unverified capability evidence for the model target")),
    true
  );
  assert.equal(verified.warnings.some((warning) => warning.startsWith(FAIL_CLOSED_PREFIX)), false);

  const combined = both.warnings.filter((warning) => warning.startsWith(FAIL_CLOSED_PREFIX));
  assert.equal(combined.length, 1);
  assert.equal(
    combined[0].includes(
      "the unresolved assumptions that could change the result and the unverified capability evidence for the model target"
    ),
    true
  );
});

test("fails high-assurance closed on model-only targets like explicit targets", () => {
  // Regression: model-only targets (no mode) previously bypassed the gate.
  const unverified = recommend(input({
    reliabilityTier: "high-assurance",
    target: { model: "unlisted-model" }
  }));
  const verified = recommend(input({ reliabilityTier: "high-assurance", target: { model: "sol" } }));
  const withAssumptions = recommend(input({
    reliabilityTier: "high-assurance",
    ambiguity: "medium",
    target: { model: "unlisted-model" }
  }));

  const failClosed = unverified.warnings.filter((warning) => warning.startsWith(FAIL_CLOSED_PREFIX));
  assert.equal(failClosed.length, 1);
  assert.equal(
    failClosed[0].includes("the unverified capability evidence for the model target"),
    true
  );
  assert.equal(
    verified.warnings.some((warning) => warning.startsWith(FAIL_CLOSED_PREFIX)),
    false
  );

  const combined = withAssumptions.warnings.filter((warning) => warning.startsWith(FAIL_CLOSED_PREFIX));
  assert.equal(combined.length, 1);
  assert.equal(
    combined[0].includes(
      "the unresolved assumptions that could change the result and the unverified capability evidence for the model target"
    ),
    true
  );
});

test("never fails closed below the high-assurance tier", () => {
  for (const reliabilityTier of ["exploratory", "standard"]) {
    for (const ambiguity of AMBIGUITIES) {
      for (const target of [
        { mode: "automatic" },
        { mode: "explicit" },
        { mode: "explicit", model: "unlisted-model" },
        { model: "unlisted-model" }
      ]) {
        const output = recommend(input({ reliabilityTier, ambiguity, target }));
        assert.equal(
          output.warnings.some((warning) => warning.startsWith(FAIL_CLOSED_PREFIX)),
          false,
          `${reliabilityTier}/${ambiguity}/${target.mode}`
        );
      }
    }
  }
});

test("keeps tier guidance parent-local without execution or authorization language", () => {
  const forbidden = [
    /authoriz/i,
    /decision ledger/i,
    /\broutes?\b/i,
    /\bworkloads?\b/i,
    /\blaunch/i,
    /implement_authorized/i
  ];

  for (const reliabilityTier of RELIABILITY_TIERS) {
    for (const ambiguity of AMBIGUITIES) {
      for (const risk of RISKS) {
        for (const target of [{ mode: "automatic" }, { mode: "explicit" }, { mode: "explicit", model: "sol" }, { model: "sol" }, { model: "unlisted-model" }]) {
          const output = recommend(input({ reliabilityTier, ambiguity, risk, target }));
          const text = [
            ...output.promptFragments.map(({ text: value }) => value),
            ...output.lifecycleGuidance.map(({ guidance }) => guidance),
            ...output.warnings,
            output.rationale
          ].join("\n");

          for (const pattern of forbidden) {
            assert.doesNotMatch(text, pattern, `${reliabilityTier}/${ambiguity}/${risk}/${target.mode}`);
          }
        }
      }
    }
  }
});

test("delegates strict input rejection to the public contract", () => {
  assert.throws(() => recommend({ ...input(), extra: true }), /Unknown key is not allowed/);
  assert.throws(() => recommend(input({ budget: { maxTokens: 0 } })), /positive integer/);
});
