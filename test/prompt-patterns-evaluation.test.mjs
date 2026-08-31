import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidOutput,
  recommend
} from "../prompt-patterns/index.mjs";
import {
  FIXTURES,
  FIXTURE_CATEGORIES,
  FIXTURE_COUNT,
  FixtureValidationError,
  isValidFixtureIndex,
  validateFixtureIndex
} from "./fixtures/prompt-patterns/index.mjs";

const EXPECTED_FIELDS = ["primaryPattern", "overlays", "warnings", "confidence"];
const EXECUTION_POLICY_KEYS = new Set([
  "route",
  "workload",
  "authorization",
  "provider",
  "execution",
  "visibleChainOfThought",
  "accuracyGuarantee",
  "mandatoryTemperature",
  "visible-chain-of-thought",
  "accuracy-guarantee",
  "mandatory-temperature"
]);

const visitKeys = (value, visitor) => {
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    visitor(key);
    visitKeys(nested, visitor);
  }
};

test("validates the fixture index and required coverage", () => {
  assert.deepEqual(FIXTURE_CATEGORIES, ["source-guide", "arc-lifecycle"]);
  assert.equal(FIXTURE_COUNT, 14);
  assert.equal(isValidFixtureIndex(), true);
  assert.doesNotThrow(() => validateFixtureIndex());

  const duplicate = structuredClone(FIXTURES);
  duplicate[1].id = duplicate[0].id;
  assert.throws(
    () => validateFixtureIndex(duplicate),
    (error) => error instanceof FixtureValidationError &&
      error.issues.some(({ code }) => code === "duplicate")
  );

  const invalidExpected = structuredClone(FIXTURES);
  invalidExpected[0].expected.overlays[0] = invalidExpected[0].expected.primaryPattern;
  assert.throws(
    () => validateFixtureIndex(invalidExpected),
    (error) => error instanceof FixtureValidationError &&
      error.issues.some(({ code }) => code === "primary-repeat")
  );

  const missingCoverage = FIXTURES.filter(({ id }) => id !== "source-guide-deployment");
  assert.throws(
    () => validateFixtureIndex(missingCoverage),
    (error) => error instanceof FixtureValidationError &&
      error.issues.some(({ code }) => code === "task-type")
  );
});

test("matches every literal expected recommendation deterministically", () => {
  let evaluated = 0;
  for (const fixture of FIXTURES) {
    const before = structuredClone(fixture.input);
    const first = recommend(fixture.input);
    const second = recommend(structuredClone(fixture.input));

    assert.equal(isValidOutput(first), true, fixture.id);
    assert.deepEqual(fixture.input, before, `${fixture.id}: input mutated`);
    assert.deepEqual(first, second, `${fixture.id}: recommendation was not deterministic`);
    assert.deepEqual(
      Object.fromEntries(EXPECTED_FIELDS.map((field) => [field, first[field]])),
      fixture.expected,
      fixture.id
    );
    evaluated += 1;
  }
  assert.equal(evaluated, FIXTURE_COUNT);
});

test("keeps evaluation offline and recommendations execution-neutral", () => {
  for (const fixture of FIXTURES) {
    const output = recommend(fixture.input);
    visitKeys(output, (key) => {
      assert.equal(EXECUTION_POLICY_KEYS.has(key), false, `${fixture.id}: ${key}`);
    });
  }
});
