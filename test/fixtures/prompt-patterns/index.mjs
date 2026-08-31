import {
  ARC_PHASES,
  ContractValidationError,
  normalizeInput,
  PATTERN_IDS,
  RELIABILITY_TIERS,
  TARGET_MODES,
  TASK_TYPES
} from "../../../prompt-patterns/index.mjs";
import { ARC_LIFECYCLE_FIXTURES } from "./arc-lifecycle.mjs";
import { SOURCE_GUIDE_FIXTURES } from "./source-guide.mjs";

export const FIXTURE_CATEGORIES = Object.freeze(["source-guide", "arc-lifecycle"]);
export const FIXTURE_FIELDS = Object.freeze(["id", "category", "input", "expected"]);
export const EXPECTED_FIELDS = Object.freeze([
  "primaryPattern",
  "overlays",
  "warnings",
  "confidence"
]);

export const REQUIRED_SOURCE_TASK_TYPES = Object.freeze([...TASK_TYPES]);
export const REQUIRED_RELIABILITY_TIERS = Object.freeze([...RELIABILITY_TIERS]);
export const REQUIRED_TARGET_MODES = Object.freeze([...TARGET_MODES]);
export const REQUIRED_ARC_PHASES = Object.freeze([...ARC_PHASES]);
export const REQUIRED_ARC_LIFECYCLE_CASES = Object.freeze([
  Object.freeze({ taskType: "research", arcPhase: "research" }),
  Object.freeze({ taskType: "planning", arcPhase: "plan" }),
  Object.freeze({ taskType: "coding", arcPhase: "implement" }),
  Object.freeze({ taskType: "debugging", arcPhase: "analyze" }),
  Object.freeze({ taskType: "review", arcPhase: "verify" }),
  Object.freeze({ taskType: "deployment", arcPhase: "deploy" })
]);

const hasDataDescriptor = (descriptor) =>
  descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, "value");

const deepFreeze = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (hasDataDescriptor(descriptor)) {
      deepFreeze(descriptor.value, seen);
    }
  }
  return Object.freeze(value);
};

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const addIssue = (issues, path, code, message) => {
  issues.push({ path, code, message });
};

const inspectRecord = (value, path, allowedKeys, requiredKeys, issues) => {
  if (!isPlainObject(value)) {
    addIssue(issues, path, "type", "Expected a plain object.");
    return undefined;
  }

  const descriptors = new Map();
  const allowed = new Set(allowedKeys);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    descriptors.set(key, descriptor);
    if (!hasDataDescriptor(descriptor)) {
      addIssue(issues, `${path}.${String(key)}`, "accessor", "Accessor properties are not allowed.");
    }
    if (typeof key !== "string" || !allowed.has(key)) {
      addIssue(issues, `${path}.${String(key)}`, "unknown-key", "Unknown key is not allowed.");
    }
  }

  for (const key of requiredKeys) {
    if (!descriptors.has(key)) {
      addIssue(issues, `${path}.${key}`, "missing", "Required field is missing.");
    }
  }
  return descriptors;
};

const readData = (descriptors, key) => {
  if (!descriptors.has(key)) {
    return { present: false, readable: true, value: undefined };
  }
  const descriptor = descriptors.get(key);
  if (!hasDataDescriptor(descriptor)) {
    return { present: true, readable: false, value: undefined };
  }
  return { present: true, readable: true, value: descriptor.value };
};

const inspectArray = (value, path, issues) => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "type", "Expected an array.");
    return undefined;
  }

  const descriptors = new Map();
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    descriptors.set(key, descriptor);
    if (key !== "length" && !hasDataDescriptor(descriptor)) {
      addIssue(issues, `${path}.${String(key)}`, "accessor", "Accessor properties are not allowed.");
    }
    if (
      key !== "length" &&
      (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)
    ) {
      addIssue(issues, `${path}.${String(key)}`, "unknown-key", "Unknown array property is not allowed.");
    }
  }

  const lengthDescriptor = descriptors.get("length");
  if (!hasDataDescriptor(lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value)) {
    addIssue(issues, `${path}.length`, "type", "Array length must be a safe integer.");
    return undefined;
  }
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    if (!descriptors.has(String(index))) {
      addIssue(issues, `${path}.${index}`, "missing", "Sparse arrays are not allowed.");
    }
  }
  return { descriptors, length: lengthDescriptor.value };
};

const checkNonEmptyString = (value, path, issues) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, path, "string", "Expected a non-empty string.");
    return false;
  }
  return true;
};

const checkPattern = (value, path, issues) => {
  if (typeof value !== "string" || !PATTERN_IDS.includes(value)) {
    addIssue(issues, path, "pattern", "Expected a catalog pattern ID.");
    return false;
  }
  return true;
};

const checkExpected = (value, path, issues) => {
  const descriptors = inspectRecord(value, path, EXPECTED_FIELDS, EXPECTED_FIELDS, issues);
  if (!descriptors) {
    return undefined;
  }

  const primary = readData(descriptors, "primaryPattern");
  const primaryValid = primary.readable && checkPattern(primary.value, `${path}.primaryPattern`, issues);

  const overlaysValue = readData(descriptors, "overlays");
  const overlaysArray = overlaysValue.readable
    ? inspectArray(overlaysValue.value, `${path}.overlays`, issues)
    : undefined;
  const overlays = [];
  const seenOverlays = new Set();
  if (overlaysArray) {
    for (let index = 0; index < overlaysArray.length; index += 1) {
      const overlay = readData(overlaysArray.descriptors, String(index));
      if (!overlay.readable) {
        continue;
      }
      if (checkPattern(overlay.value, `${path}.overlays.${index}`, issues)) {
        if (seenOverlays.has(overlay.value)) {
          addIssue(issues, `${path}.overlays.${index}`, "duplicate", "Overlays must be unique.");
        }
        if (primaryValid && overlay.value === primary.value) {
          addIssue(
            issues,
            `${path}.overlays.${index}`,
            "primary-repeat",
            "An overlay cannot repeat the primary pattern."
          );
        }
        seenOverlays.add(overlay.value);
        overlays.push(overlay.value);
      }
    }
  }

  const warningsValue = readData(descriptors, "warnings");
  const warningsArray = warningsValue.readable
    ? inspectArray(warningsValue.value, `${path}.warnings`, issues)
    : undefined;
  const warnings = [];
  if (warningsArray) {
    for (let index = 0; index < warningsArray.length; index += 1) {
      const warning = readData(warningsArray.descriptors, String(index));
      if (!warning.readable) {
        continue;
      }
      if (typeof warning.value !== "string") {
        addIssue(issues, `${path}.warnings.${index}`, "string", "Expected a string.");
      } else {
        warnings.push(warning.value);
      }
    }
  }

  const confidence = readData(descriptors, "confidence");
  const confidenceValid =
    confidence.readable &&
    typeof confidence.value === "number" &&
    Number.isFinite(confidence.value) &&
    confidence.value >= 0 &&
    confidence.value <= 1;
  if (!confidenceValid) {
    addIssue(issues, `${path}.confidence`, "confidence", "Expected a finite number from 0 to 1.");
  }

  if (!primaryValid || !overlaysArray || !warningsArray || !confidenceValid) {
    return undefined;
  }
  return {
    primaryPattern: primary.value,
    overlays,
    warnings,
    confidence: confidence.value
  };
};

const inputIssuePath = (path, issuePath) => `${path}${issuePath === "$" ? "" : issuePath.slice(1)}`;

const checkInput = (value, path, issues) => {
  try {
    return normalizeInput(value);
  } catch (error) {
    if (!(error instanceof ContractValidationError)) {
      throw error;
    }
    for (const issue of error.issues) {
      addIssue(issues, inputIssuePath(path, issue.path), issue.code, issue.message);
    }
    return undefined;
  }
};

const checkFixture = (value, index, issues) => {
  const path = `$.fixtures.${index}`;
  const descriptors = inspectRecord(value, path, FIXTURE_FIELDS, FIXTURE_FIELDS, issues);
  if (!descriptors) {
    return undefined;
  }

  const id = readData(descriptors, "id");
  const category = readData(descriptors, "category");
  const input = readData(descriptors, "input");
  const expected = readData(descriptors, "expected");
  const idValid = id.readable && checkNonEmptyString(id.value, `${path}.id`, issues);
  const categoryValid =
    category.readable &&
    typeof category.value === "string" &&
    FIXTURE_CATEGORIES.includes(category.value);
  if (!categoryValid) {
    addIssue(issues, `${path}.category`, "category", "Expected a known fixture category.");
  }
  const normalizedInput = input.readable ? checkInput(input.value, `${path}.input`, issues) : undefined;
  const normalizedExpected = expected.readable
    ? checkExpected(expected.value, `${path}.expected`, issues)
    : undefined;

  if (!idValid || !categoryValid || !normalizedInput || !normalizedExpected) {
    return undefined;
  }
  return {
    id: id.value,
    category: category.value,
    input: normalizedInput,
    expected: normalizedExpected
  };
};

const pairKey = ({ taskType, arcPhase }) => `${taskType}:${arcPhase}`;

const validateCoverage = (fixtures, issues) => {
  const categories = new Set(fixtures.map(({ category }) => category));
  for (const category of FIXTURE_CATEGORIES) {
    if (!categories.has(category)) {
      addIssue(issues, "$.coverage", "category", `Missing fixture category: ${category}.`);
    }
  }

  const sourceTaskTypes = new Set(
    fixtures.filter(({ category }) => category === "source-guide").map(({ input }) => input.taskType)
  );
  for (const taskType of REQUIRED_SOURCE_TASK_TYPES) {
    if (!sourceTaskTypes.has(taskType)) {
      addIssue(issues, "$.coverage.source-guide", "task-type", `Missing source-guide task type: ${taskType}.`);
    }
  }

  const arcPairs = new Set(
    fixtures
      .filter(({ category }) => category === "arc-lifecycle")
      .map(({ input }) => pairKey(input))
  );
  for (const requiredCase of REQUIRED_ARC_LIFECYCLE_CASES) {
    if (!arcPairs.has(pairKey(requiredCase))) {
      addIssue(
        issues,
        "$.coverage.arc-lifecycle",
        "arc-case",
        `Missing ARC lifecycle case: ${requiredCase.taskType}/${requiredCase.arcPhase}.`
      );
    }
  }

  const reliabilityTiers = new Set(fixtures.map(({ input }) => input.reliabilityTier));
  for (const tier of REQUIRED_RELIABILITY_TIERS) {
    if (!reliabilityTiers.has(tier)) {
      addIssue(issues, "$.coverage", "reliability", `Missing reliability tier: ${tier}.`);
    }
  }

  const targetModes = new Set(fixtures.map(({ input }) => input.target.mode));
  for (const mode of REQUIRED_TARGET_MODES) {
    if (!targetModes.has(mode)) {
      addIssue(issues, "$.coverage", "target-mode", `Missing target mode: ${mode}.`);
    }
  }
  if (
    !fixtures.some(
      ({ input }) => input.target.mode === "explicit" && typeof input.target.model === "string"
    )
  ) {
    addIssue(issues, "$.coverage", "target-model", "An explicit target-model fixture is required.");
  }

  const arcPhases = new Set(fixtures.map(({ input }) => input.arcPhase));
  for (const phase of REQUIRED_ARC_PHASES) {
    if (!arcPhases.has(phase)) {
      addIssue(issues, "$.coverage", "arc-phase", `Missing ARC phase: ${phase}.`);
    }
  }
};

const normalizeFixtureArray = (fixtures) => {
  const issues = [];
  const array = inspectArray(fixtures, "$.fixtures", issues);
  if (!array) {
    throw new FixtureValidationError(issues);
  }

  const normalized = [];
  const seenIds = new Set();
  for (let index = 0; index < array.length; index += 1) {
    const fixture = readData(array.descriptors, String(index));
    if (!fixture.readable) {
      continue;
    }
    const normalizedFixture = checkFixture(fixture.value, index, issues);
    if (!normalizedFixture) {
      continue;
    }
    if (seenIds.has(normalizedFixture.id)) {
      addIssue(issues, `$.fixtures.${index}.id`, "duplicate", "Fixture IDs must be unique.");
    }
    seenIds.add(normalizedFixture.id);
    normalized.push(normalizedFixture);
  }

  if (issues.length === 0) {
    validateCoverage(normalized, issues);
  }
  if (issues.length > 0) {
    throw new FixtureValidationError(issues);
  }
  return deepFreeze(normalized);
};

export class FixtureValidationError extends TypeError {
  constructor(issues) {
    const frozenIssues = deepFreeze(issues.map((issue) => ({ ...issue })));
    super(frozenIssues.map(({ path, message }) => `${path}: ${message}`).join(" "));
    this.name = "FixtureValidationError";
    this.issues = frozenIssues;
  }
}

export function validateFixtureIndex(fixtures = RAW_FIXTURES) {
  return normalizeFixtureArray(fixtures);
}

export const assertFixtureIndex = validateFixtureIndex;
export const validateFixtures = validateFixtureIndex;

export function isValidFixtureIndex(fixtures = RAW_FIXTURES) {
  try {
    validateFixtureIndex(fixtures);
    return true;
  } catch (error) {
    if (error instanceof FixtureValidationError) {
      return false;
    }
    throw error;
  }
}

const RAW_FIXTURES = Object.freeze([...SOURCE_GUIDE_FIXTURES, ...ARC_LIFECYCLE_FIXTURES]);

export const FIXTURES = validateFixtureIndex(RAW_FIXTURES);
export const PROMPT_PATTERN_FIXTURES = FIXTURES;
export const FIXTURE_INDEX = FIXTURES;
export const ALL_FIXTURES = FIXTURES;
export const FIXTURE_COUNT = FIXTURES.length;
