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

test("delegates strict input rejection to the public contract", () => {
  assert.throws(() => recommend({ ...input(), extra: true }), /Unknown key is not allowed/);
  assert.throws(() => recommend(input({ budget: { maxTokens: 0 } })), /positive integer/);
});
