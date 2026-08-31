import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as promptPatterns from "../prompt-patterns/index.mjs";
import {
  isValidModelProfile,
  MODEL_PROFILE_BINDINGS,
  MODEL_PROFILE_FIXTURES,
  MODEL_PROFILE_SCHEMA,
  MODEL_PROFILES_BY_ID,
  ModelProfileValidationError,
  normalizeModelProfile,
  PATTERN_IDS,
  resolveModelProfile,
  UNKNOWN_MODEL_PROFILE
} from "../prompt-patterns/index.mjs";

const assertDeepFrozen = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.hasOwn(descriptor, "value")) {
      assertDeepFrozen(descriptor.value, seen);
    }
  }
};

test("profile fixtures satisfy the strict frozen capability schema", () => {
  assert.deepEqual(MODEL_PROFILE_SCHEMA.required, [
    "id",
    "name",
    "verified",
    "schemaOutput",
    "toolUse",
    "reasoning",
    "sampling",
    "contextLimits",
    "verifiedPatternNotes"
  ]);
  assert.equal(MODEL_PROFILE_SCHEMA.additionalProperties, false);
  assertDeepFrozen(MODEL_PROFILE_SCHEMA);

  for (const profile of [...MODEL_PROFILE_FIXTURES, UNKNOWN_MODEL_PROFILE]) {
    assert.equal(isValidModelProfile(profile), true, profile.id);
    assert.deepEqual(Object.keys(profile), MODEL_PROFILE_SCHEMA.required);
    assert.equal(typeof profile.schemaOutput.supported, "boolean");
    assert.equal(typeof profile.toolUse.supported, "boolean");
    assert.equal(typeof profile.reasoning.supported, "boolean");
    assert.equal(Array.isArray(profile.reasoning.effortLevels), true);
    assert.equal(typeof profile.sampling.temperature, "boolean");
    assert.equal(typeof profile.sampling.topP, "boolean");
    assert.equal(profile.contextLimits.contextWindowTokens > 0, true);
    assert.equal(profile.contextLimits.maxOutputTokens > 0, true);
    assert.equal(Object.keys(profile.verifiedPatternNotes).every((id) => PATTERN_IDS.includes(id)), true);
    assertDeepFrozen(profile);
  }
});

test("every supported base and stable model binding resolves canonically", () => {
  const requested = [
    "fable", "fable-5", "sol", "gpt-5.6-sol", "luna", "gpt-5.6-luna", "gpt-5.5",
    "opus", "opus-5", "opus-4.8", "grok", "grok-4.6", "kimi", "kimi-k3", "minimax",
    "minimax-m3", "composer", "composer-2.5", "claude-fable-5", "claude-opus-5",
    "claude-opus-4-8", "cursor-grok-4.6-high", "MiniMax-M3"
  ];

  assert.deepEqual(new Set(requested.map((alias) => alias.toLowerCase())), new Set(Object.keys(MODEL_PROFILE_BINDINGS)));
  for (const alias of requested) {
    const resolved = resolveModelProfile(`  ${alias.toUpperCase()}  `);
    assert.notEqual(resolved, UNKNOWN_MODEL_PROFILE, alias);
    assert.equal(resolved, MODEL_PROFILES_BY_ID[MODEL_PROFILE_BINDINGS[alias.toLowerCase()]]);
    assertDeepFrozen(resolved);
  }
});

test("inherited binding keys resolve to the frozen unknown profile", () => {
  for (const value of ["constructor", "__proto__", "toString"]) {
    assert.equal(resolveModelProfile(`  ${value.toUpperCase()}  `), UNKNOWN_MODEL_PROFILE, value);
  }
  assertDeepFrozen(UNKNOWN_MODEL_PROFILE);
});

test("resolution is conservative for unknown values and route suffixes", () => {
  for (const value of [undefined, null, 7, {}, "", "unknown", "sol-fast", "fable-5:implement"]) {
    assert.equal(resolveModelProfile(value), UNKNOWN_MODEL_PROFILE);
  }
  assert.deepEqual(UNKNOWN_MODEL_PROFILE, {
    id: "unknown",
    name: "Unknown model",
    verified: false,
    schemaOutput: { supported: false },
    toolUse: { supported: false },
    reasoning: { supported: false, effortLevels: [] },
    sampling: { temperature: false, topP: false },
    contextLimits: { contextWindowTokens: 1, maxOutputTokens: 1 },
    verifiedPatternNotes: {}
  });
});

test("normalization copies data and rejects unknown keys and accessors without reading them", () => {
  const source = structuredClone(MODEL_PROFILE_FIXTURES[0]);
  const normalized = normalizeModelProfile(source);
  assert.deepEqual(normalized, source);
  assert.notEqual(normalized, source);
  assert.notEqual(normalized.reasoning, source.reasoning);
  assert.notEqual(normalized.reasoning.effortLevels, source.reasoning.effortLevels);

  assert.throws(
    () => normalizeModelProfile({ ...source, extra: true }),
    (error) => error instanceof ModelProfileValidationError && error.issues.some(({ path }) => path === "$.extra")
  );

  let reads = 0;
  Object.defineProperty(source.schemaOutput, "supported", {
    enumerable: true,
    get() {
      reads += 1;
      return true;
    }
  });
  assert.throws(
    () => normalizeModelProfile(source),
    (error) => error instanceof ModelProfileValidationError &&
      error.issues.some(({ path, code }) => path === "$.schemaOutput.supported" && code === "accessor")
  );
  assert.equal(reads, 0);
});

test("profiles remain isolated from execution policy", async () => {
  const prohibited = [
    "route",
    "workload",
    "authorization",
    "visibleChainOfThought",
    "accuracyGuarantee",
    "mandatoryTemperature"
  ];
  const publicProfileData = [MODEL_PROFILE_SCHEMA, MODEL_PROFILE_FIXTURES, MODEL_PROFILE_BINDINGS, UNKNOWN_MODEL_PROFILE];
  for (const value of publicProfileData) {
    const serialized = JSON.stringify(value);
    for (const key of prohibited) {
      assert.equal(serialized.includes(key), false, key);
    }
  }
  assert.equal(typeof promptPatterns.recommend, "function");

  const declarations = await readFile(new URL("../prompt-patterns/index.d.ts", import.meta.url), "utf8");
  for (const name of Object.keys(promptPatterns)) {
    assert.match(declarations, new RegExp(`(?:const|class|function) ${name}\\b`), name);
  }
});
