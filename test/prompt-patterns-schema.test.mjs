import assert from "node:assert/strict";
import test from "node:test";

import * as promptPatterns from "../prompt-patterns/index.mjs";

const {
  ARC_PHASES,
  CONTRACT_LIMITS,
  ContractValidationError,
  INPUT_FIELDS,
  INPUT_SCHEMA,
  OUTPUT_FIELDS,
  OUTPUT_SCHEMA,
  PATTERN_CATALOG,
  PATTERN_CATALOG_BY_ID,
  PATTERN_IDS,
  isValidInput,
  isValidOutput,
  normalizeInput,
  normalizeOutput
} = promptPatterns;

const validInput = () => ({
  taskType: "research",
  arcPhase: "analyze",
  reliabilityTier: "standard",
  risk: "medium",
  target: { mode: "automatic", model: "gpt-5" },
  outputShape: "structured",
  ambiguity: "low",
  budget: { maxTokens: 4096, maxLatencyMs: 10_000 }
});

const validOutput = () => ({
  primaryPattern: "evidence-grounding",
  overlays: ["few-shot", "boundary"],
  promptFragments: [
    { kind: "instruction", text: "Use the supplied evidence." },
    { kind: "verification", text: "Separate supported claims from uncertainty." }
  ],
  lifecycleGuidance: [
    { phase: "research", guidance: "Collect and inspect the relevant evidence." },
    { phase: "verify", guidance: "Check each claim against the evidence." }
  ],
  warnings: ["Evidence quality may limit confidence."],
  rationale: "Grounding keeps research claims tied to available evidence.",
  confidence: 0.86
});

const assertDeepFrozen = (value) => {
  assert.equal(Object.isFrozen(value), true);
  if (value !== null && typeof value === "object") {
    for (const key of Reflect.ownKeys(value)) {
      assertDeepFrozen(value[key]);
    }
  }
};

const assertInvalid = (factory, expectedPath) => {
  assert.throws(factory, (error) => {
    assert.equal(error instanceof ContractValidationError, true);
    if (expectedPath) {
      assert.equal(error.issues.some((issue) => issue.path === expectedPath), true);
    }
    return true;
  });
};

const assertAccessorRejected = (factory, expectedPath, reads) => {
  assert.throws(factory, (error) => {
    assert.equal(error instanceof ContractValidationError, true);
    assert.equal(error.issues.some((issue) => issue.path === expectedPath && issue.code === "accessor"), true);
    return true;
  });
  assert.equal(reads(), 0);
};

test("exports the exact stable ten-pattern catalog", () => {
  assert.deepEqual(PATTERN_IDS, [
    "template-fill",
    "few-shot",
    "decomposition",
    "critique",
    "guardrail",
    "boundary",
    "audience-adaptation",
    "meta-prompt",
    "evidence-grounding",
    "hypothesis-test"
  ]);
  assert.deepEqual(PATTERN_CATALOG.map(({ id }) => id), PATTERN_IDS);
  assert.deepEqual(Object.keys(PATTERN_CATALOG_BY_ID), PATTERN_IDS);
  for (const pattern of PATTERN_CATALOG) {
    assert.equal(PATTERN_CATALOG_BY_ID[pattern.id], pattern);
    assert.equal(typeof pattern.name, "string");
    assert.equal(typeof pattern.description, "string");
  }
});

test("schemas require exact top-level fields and strict nested objects", () => {
  assert.deepEqual(INPUT_SCHEMA.required, INPUT_FIELDS);
  assert.deepEqual(OUTPUT_SCHEMA.required, OUTPUT_FIELDS);
  assert.equal(INPUT_SCHEMA.additionalProperties, false);
  assert.equal(OUTPUT_SCHEMA.additionalProperties, false);
  assert.equal(INPUT_SCHEMA.properties.target.additionalProperties, false);
  assert.equal(INPUT_SCHEMA.properties.target.minProperties, 1);
  assert.equal(INPUT_SCHEMA.properties.budget.additionalProperties, false);
  assert.equal(OUTPUT_SCHEMA.properties.promptFragments.items.additionalProperties, false);
  assert.equal(OUTPUT_SCHEMA.properties.lifecycleGuidance.items.additionalProperties, false);
  assert.equal(INPUT_SCHEMA.properties.target.properties.model.pattern, "\\S");
  assert.equal(OUTPUT_SCHEMA.properties.promptFragments.items.properties.text.pattern, "\\S");
  assert.equal(OUTPUT_SCHEMA.properties.lifecycleGuidance.items.properties.guidance.pattern, "\\S");
  assert.equal(OUTPUT_SCHEMA.properties.lifecycleGuidance.maxItems, CONTRACT_LIMITS.maxLifecycleGuidanceEntries);
  assert.equal(OUTPUT_SCHEMA.properties.rationale.pattern, "\\S");
  assert.equal(INPUT_SCHEMA.properties.budget.properties.maxTokens.maximum, CONTRACT_LIMITS.maxTokens);
  assert.equal(
    OUTPUT_SCHEMA.properties.lifecycleGuidance.items.properties.guidance.maxLength,
    CONTRACT_LIMITS.maxLifecycleGuidanceLength
  );
});

test("accepts valid input variants and preserves both target fields", () => {
  const normalized = normalizeInput(validInput());
  assert.deepEqual(normalized, validInput());
  assert.deepEqual(normalizeInput({ ...validInput(), target: { mode: "explicit" } }).target, {
    mode: "explicit"
  });
  assert.deepEqual(normalizeInput({ ...validInput(), target: { model: "custom-model" } }).target, {
    model: "custom-model"
  });
  assert.deepEqual(normalizeInput({ ...validInput(), budget: {} }).budget, {});
  assert.equal(isValidInput(validInput()), true);
});

test("rejects missing, invalid, and unbounded input values", () => {
  const missing = validInput();
  delete missing.risk;
  assertInvalid(() => normalizeInput(missing), "$.risk");

  assertInvalid(() => normalizeInput({}), "$.taskType");
  assertInvalid(() => normalizeInput({ ...validInput(), taskType: "unknown" }), "$.taskType");
  assertInvalid(() => normalizeInput({ ...validInput(), target: {} }), "$.target");
  assertInvalid(() => normalizeInput({ ...validInput(), target: { model: "   " } }), "$.target.model");
  assertInvalid(() => normalizeInput({ ...validInput(), budget: { maxTokens: 0 } }), "$.budget.maxTokens");
  assertInvalid(
    () => normalizeInput({ ...validInput(), budget: { maxLatencyMs: CONTRACT_LIMITS.maxLatencyMs + 1 } }),
    "$.budget.maxLatencyMs"
  );
  assertInvalid(() => normalizeInput({ ...validInput(), budget: { maxTokens: 1.5 } }), "$.budget.maxTokens");
  assert.equal(isValidInput({ ...validInput(), target: null }), false);
});

test("accepts a valid output and returns an immutable normalized copy", () => {
  const source = validOutput();
  const normalized = normalizeOutput(source);
  assert.deepEqual(normalized, source);
  assert.notEqual(normalized, source);
  assert.notEqual(normalized.overlays, source.overlays);
  assert.notEqual(normalized.promptFragments, source.promptFragments);
  assert.notEqual(normalized.lifecycleGuidance, source.lifecycleGuidance);
  assert.notEqual(normalized.warnings, source.warnings);
  assert.equal(isValidOutput(source), true);
  assertDeepFrozen(normalized);
  assertDeepFrozen(PATTERN_CATALOG);
  assertDeepFrozen(PATTERN_IDS);
  assertDeepFrozen(INPUT_SCHEMA);
  assertDeepFrozen(OUTPUT_SCHEMA);
});

test("rejects output relationship, shape, and bound violations", () => {
  assertInvalid(
    () => normalizeOutput({ ...validOutput(), overlays: ["boundary", "boundary"] }),
    "$.overlays.1"
  );
  assertInvalid(
    () => normalizeOutput({ ...validOutput(), overlays: ["evidence-grounding"] }),
    "$.overlays.0"
  );
  assertInvalid(
    () => normalizeOutput({ ...validOutput(), promptFragments: [{ kind: "instruction", text: " " }] }),
    "$.promptFragments.0.text"
  );
  assertInvalid(
    () => normalizeOutput({
      ...validOutput(),
      lifecycleGuidance: [{ phase: "verify", guidance: "\t\n" }]
    }),
    "$.lifecycleGuidance.0.guidance"
  );
  assertInvalid(() => normalizeOutput({ ...validOutput(), rationale: " \t" }), "$.rationale");
  assertInvalid(
    () => normalizeOutput({ ...validOutput(), promptFragments: [{ kind: "unknown", text: "text" }] }),
    "$.promptFragments.0.kind"
  );
  assertInvalid(
    () => normalizeOutput({
      ...validOutput(),
      lifecycleGuidance: [
        { phase: "research", guidance: "First." },
        { phase: "research", guidance: "Again." }
      ]
    }),
    "$.lifecycleGuidance.1.phase"
  );
  assertInvalid(
    () => normalizeOutput({
      ...validOutput(),
      lifecycleGuidance: [{ phase: "verify", guidance: "x".repeat(CONTRACT_LIMITS.maxLifecycleGuidanceLength + 1) }]
    }),
    "$.lifecycleGuidance.0.guidance"
  );
  assertInvalid(
    () => normalizeOutput({ ...validOutput(), rationale: "x".repeat(CONTRACT_LIMITS.maxRationaleLength + 1) }),
    "$.rationale"
  );
  assertInvalid(
    () => normalizeOutput({
      ...validOutput(),
      lifecycleGuidance: Array.from({ length: CONTRACT_LIMITS.maxLifecycleGuidanceEntries + 1 }, (_, index) => ({
        phase: ARC_PHASES[index % ARC_PHASES.length],
        guidance: `Guidance ${index}.`
      }))
    }),
    "$.lifecycleGuidance"
  );
  assertInvalid(() => normalizeOutput({ ...validOutput(), confidence: Number.NaN }), "$.confidence");
  assertInvalid(() => normalizeOutput({ ...validOutput(), confidence: 1.01 }), "$.confidence");
  assert.equal(isValidOutput({ ...validOutput(), confidence: Infinity }), false);
});

test("rejects unknown keys recursively instead of discarding them", () => {
  const inputUnknown = validInput();
  inputUnknown.extra = true;
  assertInvalid(() => normalizeInput(inputUnknown), "$.extra");

  const targetUnknown = validInput();
  targetUnknown.target.extra = true;
  assertInvalid(() => normalizeInput(targetUnknown), "$.target.extra");

  const budgetUnknown = validInput();
  budgetUnknown.budget.extra = true;
  assertInvalid(() => normalizeInput(budgetUnknown), "$.budget.extra");

  const fragmentUnknown = validOutput();
  fragmentUnknown.promptFragments[0].extra = true;
  assertInvalid(() => normalizeOutput(fragmentUnknown), "$.promptFragments.0.extra");

  const guidanceUnknown = validOutput();
  guidanceUnknown.lifecycleGuidance[0].extra = true;
  assertInvalid(() => normalizeOutput(guidanceUnknown), "$.lifecycleGuidance.0.extra");

  const outputUnknown = validOutput();
  outputUnknown.extra = true;
  assertInvalid(() => normalizeOutput(outputUnknown), "$.extra");
});

test("rejects accessors without invoking top-level, nested, or array properties", () => {
  let topLevelInputReads = 0;
  const topLevelInput = validInput();
  Object.defineProperty(topLevelInput, "taskType", {
    configurable: true,
    enumerable: true,
    get() {
      topLevelInputReads += 1;
      return "research";
    }
  });
  assertAccessorRejected(() => normalizeInput(topLevelInput), "$.taskType", () => topLevelInputReads);

  let nestedInputReads = 0;
  const nestedInput = validInput();
  Object.defineProperty(nestedInput.target, "model", {
    configurable: true,
    enumerable: true,
    get() {
      nestedInputReads += 1;
      return "gpt-5";
    }
  });
  assertAccessorRejected(() => normalizeInput(nestedInput), "$.target.model", () => nestedInputReads);

  let arrayElementReads = 0;
  const arrayElementOutput = validOutput();
  Object.defineProperty(arrayElementOutput.overlays, "0", {
    configurable: true,
    enumerable: true,
    get() {
      arrayElementReads += 1;
      return "few-shot";
    }
  });
  assertAccessorRejected(() => normalizeOutput(arrayElementOutput), "$.overlays.0", () => arrayElementReads);

  let nestedOutputReads = 0;
  const nestedOutput = validOutput();
  Object.defineProperty(nestedOutput.promptFragments[0], "text", {
    configurable: true,
    enumerable: true,
    get() {
      nestedOutputReads += 1;
      return "Use the supplied evidence.";
    }
  });
  assertAccessorRejected(() => normalizeOutput(nestedOutput), "$.promptFragments.0.text", () => nestedOutputReads);
});

test("keeps execution concerns outside the executable contract", () => {
  const prohibitedKeys = [
    "route",
    "workload",
    "authorization",
    "visibleChainOfThought",
    "accuracyGuarantee",
    "mandatoryTemperature"
  ];

  for (const key of prohibitedKeys) {
    const input = validInput();
    input[key] = "prohibited";
    assertInvalid(() => normalizeInput(input), `$.${key}`);

    const output = validOutput();
    output[key] = "prohibited";
    assertInvalid(() => normalizeOutput(output), `$.${key}`);
  }

  assert.equal(typeof promptPatterns.recommend, "function");
  assert.equal(Object.hasOwn(INPUT_SCHEMA.properties, "route"), false);
  assert.equal(Object.hasOwn(OUTPUT_SCHEMA.properties, "workload"), false);
  assert.deepEqual(ARC_PHASES, ["explore", "analyze", "research", "plan", "implement", "verify", "deploy"]);
});

test("freezes public catalog and normalized values", () => {
  assert.throws(() => PATTERN_IDS.push("not-a-pattern"), TypeError);
  assert.throws(() => {
    PATTERN_CATALOG[0].id = "changed";
  }, TypeError);
  assert.throws(() => {
    normalizeInput(validInput()).target.mode = "explicit";
  }, TypeError);
  assert.throws(() => {
    normalizeOutput(validOutput()).promptFragments[0].text = "changed";
  }, TypeError);
});
