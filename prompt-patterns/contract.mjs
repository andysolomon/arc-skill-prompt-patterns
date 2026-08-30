import { PATTERN_IDS } from "./catalog.mjs";

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

const freezeList = (values) => Object.freeze([...values]);

export const TASK_TYPES = freezeList([
  "extraction",
  "classification",
  "research",
  "planning",
  "coding",
  "debugging",
  "review",
  "deployment"
]);

export const ARC_PHASES = freezeList([
  "explore",
  "analyze",
  "research",
  "plan",
  "implement",
  "verify",
  "deploy"
]);

export const RELIABILITY_TIERS = freezeList([
  "exploratory",
  "standard",
  "high-assurance"
]);

export const RISKS = freezeList(["low", "medium", "high", "critical"]);
export const TARGET_MODES = freezeList(["automatic", "explicit"]);
export const OUTPUT_SHAPES = freezeList(["text", "structured", "code", "tool-call", "mixed"]);
export const AMBIGUITIES = freezeList(["none", "low", "medium", "high"]);
export const PROMPT_FRAGMENT_KINDS = freezeList([
  "instruction",
  "context",
  "format",
  "verification",
  "constraint"
]);

export const INPUT_FIELDS = freezeList([
  "taskType",
  "arcPhase",
  "reliabilityTier",
  "risk",
  "target",
  "outputShape",
  "ambiguity",
  "budget"
]);

export const OUTPUT_FIELDS = freezeList([
  "primaryPattern",
  "overlays",
  "promptFragments",
  "lifecycleGuidance",
  "warnings",
  "rationale",
  "confidence"
]);

export const CONTRACT_LIMITS = deepFreeze({
  maxTokens: 1_000_000,
  maxLatencyMs: 86_400_000,
  maxLifecycleGuidanceEntries: 16,
  maxLifecycleGuidanceLength: 1_000,
  maxRationaleLength: 2_000
});

export const LIMITS = CONTRACT_LIMITS;

const schemaEnum = (values) => Object.freeze([...values]);

export const INPUT_SCHEMA = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [...INPUT_FIELDS],
  properties: {
    taskType: { type: "string", enum: schemaEnum(TASK_TYPES) },
    arcPhase: { type: "string", enum: schemaEnum(ARC_PHASES) },
    reliabilityTier: { type: "string", enum: schemaEnum(RELIABILITY_TIERS) },
    risk: { type: "string", enum: schemaEnum(RISKS) },
    target: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { type: "string", enum: schemaEnum(TARGET_MODES) },
        model: { type: "string", minLength: 1, pattern: "\\S" }
      },
      minProperties: 1
    },
    outputShape: { type: "string", enum: schemaEnum(OUTPUT_SHAPES) },
    ambiguity: { type: "string", enum: schemaEnum(AMBIGUITIES) },
    budget: {
      type: "object",
      additionalProperties: false,
      properties: {
        maxTokens: {
          type: "integer",
          minimum: 1,
          maximum: CONTRACT_LIMITS.maxTokens
        },
        maxLatencyMs: {
          type: "integer",
          minimum: 1,
          maximum: CONTRACT_LIMITS.maxLatencyMs
        }
      }
    }
  }
});

export const OUTPUT_SCHEMA = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [...OUTPUT_FIELDS],
  properties: {
    primaryPattern: { type: "string", enum: schemaEnum(PATTERN_IDS) },
    overlays: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", enum: schemaEnum(PATTERN_IDS) }
    },
    promptFragments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "text"],
        properties: {
          kind: { type: "string", enum: schemaEnum(PROMPT_FRAGMENT_KINDS) },
          text: { type: "string", minLength: 1, pattern: "\\S" }
        }
      }
    },
    lifecycleGuidance: {
      type: "array",
      maxItems: CONTRACT_LIMITS.maxLifecycleGuidanceEntries,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["phase", "guidance"],
        properties: {
          phase: { type: "string", enum: schemaEnum(ARC_PHASES) },
          guidance: {
            type: "string",
            minLength: 1,
            pattern: "\\S",
            maxLength: CONTRACT_LIMITS.maxLifecycleGuidanceLength
          }
        }
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    rationale: {
      type: "string",
      minLength: 1,
      pattern: "\\S",
      maxLength: CONTRACT_LIMITS.maxRationaleLength
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    }
  }
});

export const RECOMMENDATION_INPUT_SCHEMA = INPUT_SCHEMA;
export const RECOMMENDATION_OUTPUT_SCHEMA = OUTPUT_SCHEMA;

const inputRequiredFields = INPUT_FIELDS;
const outputRequiredFields = OUTPUT_FIELDS;
const targetFields = ["mode", "model"];
const budgetFields = ["maxTokens", "maxLatencyMs"];
const fragmentFields = ["kind", "text"];
const lifecycleGuidanceFields = ["phase", "guidance"];

const isRecord = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const pathForKey = (path, key) => `${path}.${key}`;

const addIssue = (issues, path, code, message) => {
  issues.push({ path, code, message });
};

const inspectOwnDescriptors = (value, path, issues) => {
  const descriptors = new Map();
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    descriptors.set(key, descriptor);
    if (descriptor !== undefined && !hasDataDescriptor(descriptor)) {
      const renderedKey = typeof key === "symbol" ? key.toString() : key;
      addIssue(issues, pathForKey(path, renderedKey), "accessor", "Accessor properties are not allowed.");
    }
  }
  return descriptors;
};

const readOwnData = (descriptors, key) => {
  if (!descriptors.has(key)) {
    return { present: false, readable: true, value: undefined };
  }

  const descriptor = descriptors.get(key);
  if (!hasDataDescriptor(descriptor)) {
    return { present: true, readable: false, value: undefined };
  }
  return { present: true, readable: true, value: descriptor.value };
};

const readOwnDataProperty = (value, key) => {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return { present: false, readable: false, value: undefined };
  }

  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) {
    return { present: false, readable: true, value: undefined };
  }
  if (!hasDataDescriptor(descriptor)) {
    return { present: true, readable: false, value: undefined };
  }
  return { present: true, readable: true, value: descriptor.value };
};

const readOwnDataValue = (value, key) => readOwnDataProperty(value, key).value;

const copyOwnDataProperty = (source, target, key) => {
  const property = readOwnDataProperty(source, key);
  if (property.present && property.readable) {
    target[key] = property.value;
  }
};

const copyArray = (source, copyValue) => {
  const length = readOwnDataValue(source, "length");
  const copy = [];
  for (let index = 0; index < length; index += 1) {
    copy.push(copyValue(source, index));
  }
  return copy;
};

const checkRecord = (value, path, allowedKeys, requiredKeys, issues) => {
  if (!isRecord(value)) {
    addIssue(issues, path, "type", "Expected a plain object.");
    return false;
  }

  const descriptors = inspectOwnDescriptors(value, path, issues);
  const allowed = new Set(allowedKeys);
  for (const key of descriptors.keys()) {
    if (typeof key !== "string" || !allowed.has(key)) {
      const renderedKey = typeof key === "symbol" ? key.toString() : key;
      addIssue(issues, pathForKey(path, renderedKey), "unknown-key", "Unknown key is not allowed.");
    }
  }

  for (const key of requiredKeys) {
    if (!descriptors.has(key)) {
      addIssue(issues, pathForKey(path, key), "missing", "Required field is missing.");
    }
  }
  return descriptors;
};

const checkArray = (value, path, issues) => {
  if (!Array.isArray(value)) {
    addIssue(issues, path, "type", "Expected an array.");
    return false;
  }

  const descriptors = inspectOwnDescriptors(value, path, issues);
  const lengthProperty = readOwnData(descriptors, "length");
  if (!lengthProperty.readable || !Number.isSafeInteger(lengthProperty.value) || lengthProperty.value < 0) {
    return { descriptors, length: 0, readable: false };
  }

  for (const key of descriptors.keys()) {
    if (key === "length") {
      continue;
    }
    if (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= lengthProperty.value) {
      const renderedKey = typeof key === "symbol" ? key.toString() : key;
      addIssue(issues, pathForKey(path, renderedKey), "unknown-key", "Unknown array property is not allowed.");
    }
  }
  return { descriptors, length: lengthProperty.value, readable: true };
};

const checkString = (value, path, issues, { nonEmpty = false, maxLength } = {}) => {
  if (typeof value !== "string") {
    addIssue(issues, path, "type", "Expected a string.");
    return false;
  }
  if (nonEmpty && value.trim().length === 0) {
    addIssue(issues, path, "empty", "Expected a non-empty string.");
  }
  if (maxLength !== undefined && value.length > maxLength) {
    addIssue(issues, path, "bounded", `String must be at most ${maxLength} characters.`);
  }
  return true;
};

const checkEnum = (value, path, values, issues) => {
  if (!checkString(value, path, issues)) {
    return false;
  }
  if (!values.includes(value)) {
    addIssue(issues, path, "enum", "Value is not in the allowed enum.");
    return false;
  }
  return true;
};

const checkBoundedPositiveInteger = (value, path, maximum, issues) => {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    addIssue(issues, path, "bounded-integer", `Expected a positive integer no greater than ${maximum}.`);
    return false;
  }
  return true;
};

const validateInputValue = (input) => {
  const issues = [];
  const inputDescriptors = checkRecord(input, "$", inputRequiredFields, inputRequiredFields, issues);
  if (!inputDescriptors) {
    return issues;
  }

  const taskType = readOwnData(inputDescriptors, "taskType");
  const arcPhase = readOwnData(inputDescriptors, "arcPhase");
  const reliabilityTier = readOwnData(inputDescriptors, "reliabilityTier");
  const risk = readOwnData(inputDescriptors, "risk");
  const outputShape = readOwnData(inputDescriptors, "outputShape");
  const ambiguity = readOwnData(inputDescriptors, "ambiguity");
  if (taskType.readable) {
    checkEnum(taskType.value, "$.taskType", TASK_TYPES, issues);
  }
  if (arcPhase.readable) {
    checkEnum(arcPhase.value, "$.arcPhase", ARC_PHASES, issues);
  }
  if (reliabilityTier.readable) {
    checkEnum(reliabilityTier.value, "$.reliabilityTier", RELIABILITY_TIERS, issues);
  }
  if (risk.readable) {
    checkEnum(risk.value, "$.risk", RISKS, issues);
  }
  if (outputShape.readable) {
    checkEnum(outputShape.value, "$.outputShape", OUTPUT_SHAPES, issues);
  }
  if (ambiguity.readable) {
    checkEnum(ambiguity.value, "$.ambiguity", AMBIGUITIES, issues);
  }

  const targetValue = readOwnData(inputDescriptors, "target");
  const targetDescriptors = targetValue.readable
    ? checkRecord(targetValue.value, "$.target", targetFields, [], issues)
    : false;
  if (targetDescriptors) {
    const mode = readOwnData(targetDescriptors, "mode");
    const model = readOwnData(targetDescriptors, "model");
    const hasMode = mode.present;
    const hasModel = model.present;
    if (!hasMode && !hasModel) {
      addIssue(issues, "$.target", "missing", "Target must provide mode, model, or both.");
    }
    if (hasMode && mode.readable) {
      checkEnum(mode.value, "$.target.mode", TARGET_MODES, issues);
    }
    if (hasModel && model.readable) {
      checkString(model.value, "$.target.model", issues, { nonEmpty: true });
    }
  }

  const budgetValue = readOwnData(inputDescriptors, "budget");
  const budgetDescriptors = budgetValue.readable
    ? checkRecord(budgetValue.value, "$.budget", budgetFields, [], issues)
    : false;
  if (budgetDescriptors) {
    const maxTokens = readOwnData(budgetDescriptors, "maxTokens");
    const maxLatencyMs = readOwnData(budgetDescriptors, "maxLatencyMs");
    if (maxTokens.present && maxTokens.readable) {
      checkBoundedPositiveInteger(
        maxTokens.value,
        "$.budget.maxTokens",
        CONTRACT_LIMITS.maxTokens,
        issues
      );
    }
    if (maxLatencyMs.present && maxLatencyMs.readable) {
      checkBoundedPositiveInteger(
        maxLatencyMs.value,
        "$.budget.maxLatencyMs",
        CONTRACT_LIMITS.maxLatencyMs,
        issues
      );
    }
  }

  return issues;
};

const validateOutputValue = (output) => {
  const issues = [];
  const outputDescriptors = checkRecord(output, "$", outputRequiredFields, outputRequiredFields, issues);
  if (!outputDescriptors) {
    return issues;
  }

  const primaryPattern = readOwnData(outputDescriptors, "primaryPattern");
  const primaryPatternIsValid = primaryPattern.readable
    ? checkEnum(primaryPattern.value, "$.primaryPattern", PATTERN_IDS, issues)
    : false;

  const overlaysValue = readOwnData(outputDescriptors, "overlays");
  const overlaysArray = overlaysValue.readable
    ? checkArray(overlaysValue.value, "$.overlays", issues)
    : false;
  if (overlaysArray && overlaysArray.readable) {
    const seenOverlays = new Set();
    for (let index = 0; index < overlaysArray.length; index += 1) {
      const path = `$.overlays.${index}`;
      const overlay = readOwnData(overlaysArray.descriptors, String(index));
      if (!overlay.readable) {
        continue;
      }
      if (checkEnum(overlay.value, path, PATTERN_IDS, issues)) {
        if (seenOverlays.has(overlay.value)) {
          addIssue(issues, path, "duplicate", "Overlays must be unique.");
        }
        if (primaryPatternIsValid && overlay.value === primaryPattern.value) {
          addIssue(issues, path, "primary-repeat", "An overlay cannot repeat the primary pattern.");
        }
        seenOverlays.add(overlay.value);
      }
    }
  }

  const promptFragmentsValue = readOwnData(outputDescriptors, "promptFragments");
  const fragmentsArray = promptFragmentsValue.readable
    ? checkArray(promptFragmentsValue.value, "$.promptFragments", issues)
    : false;
  if (fragmentsArray && fragmentsArray.readable) {
    for (let index = 0; index < fragmentsArray.length; index += 1) {
      const path = `$.promptFragments.${index}`;
      const fragment = readOwnData(fragmentsArray.descriptors, String(index));
      if (!fragment.readable) {
        continue;
      }
      const fragmentDescriptors = checkRecord(fragment.value, path, fragmentFields, fragmentFields, issues);
      if (!fragmentDescriptors) {
        continue;
      }
      const kind = readOwnData(fragmentDescriptors, "kind");
      const text = readOwnData(fragmentDescriptors, "text");
      if (kind.readable) {
        checkEnum(kind.value, `${path}.kind`, PROMPT_FRAGMENT_KINDS, issues);
      }
      if (text.readable) {
        checkString(text.value, `${path}.text`, issues, { nonEmpty: true });
      }
    }
  }

  const lifecycleGuidanceValue = readOwnData(outputDescriptors, "lifecycleGuidance");
  const guidanceArray = lifecycleGuidanceValue.readable
    ? checkArray(lifecycleGuidanceValue.value, "$.lifecycleGuidance", issues)
    : false;
  if (guidanceArray && guidanceArray.readable) {
    if (guidanceArray.length > CONTRACT_LIMITS.maxLifecycleGuidanceEntries) {
      addIssue(
        issues,
        "$.lifecycleGuidance",
        "bounded",
        `Lifecycle guidance cannot contain more than ${CONTRACT_LIMITS.maxLifecycleGuidanceEntries} entries.`
      );
    }
    const seenPhases = new Set();
    for (let index = 0; index < guidanceArray.length; index += 1) {
      const path = `$.lifecycleGuidance.${index}`;
      const guidance = readOwnData(guidanceArray.descriptors, String(index));
      if (!guidance.readable) {
        continue;
      }
      const guidanceDescriptors = checkRecord(
        guidance.value,
        path,
        lifecycleGuidanceFields,
        lifecycleGuidanceFields,
        issues
      );
      if (!guidanceDescriptors) {
        continue;
      }
      const phase = readOwnData(guidanceDescriptors, "phase");
      const guidanceText = readOwnData(guidanceDescriptors, "guidance");
      const phaseIsValid = phase.readable
        ? checkEnum(phase.value, `${path}.phase`, ARC_PHASES, issues)
        : false;
      if (guidanceText.readable) {
        checkString(guidanceText.value, `${path}.guidance`, issues, {
          nonEmpty: true,
          maxLength: CONTRACT_LIMITS.maxLifecycleGuidanceLength
        });
      }
      if (phaseIsValid && seenPhases.has(phase.value)) {
        addIssue(issues, `${path}.phase`, "duplicate", "Lifecycle guidance phases must be unique.");
      }
      if (phaseIsValid) {
        seenPhases.add(phase.value);
      }
    }
  }

  const warningsValue = readOwnData(outputDescriptors, "warnings");
  const warningsArray = warningsValue.readable
    ? checkArray(warningsValue.value, "$.warnings", issues)
    : false;
  if (warningsArray && warningsArray.readable) {
    for (let index = 0; index < warningsArray.length; index += 1) {
      const warning = readOwnData(warningsArray.descriptors, String(index));
      if (warning.readable) {
        checkString(warning.value, `$.warnings.${index}`, issues);
      }
    }
  }

  const rationale = readOwnData(outputDescriptors, "rationale");
  if (rationale.readable) {
    checkString(rationale.value, "$.rationale", issues, {
      nonEmpty: true,
      maxLength: CONTRACT_LIMITS.maxRationaleLength
    });
  }
  const confidence = readOwnData(outputDescriptors, "confidence");
  if (confidence.readable) {
    if (typeof confidence.value !== "number" || !Number.isFinite(confidence.value)) {
      addIssue(issues, "$.confidence", "number", "Confidence must be a finite number from 0 to 1.");
    } else if (confidence.value < 0 || confidence.value > 1) {
      addIssue(issues, "$.confidence", "range", "Confidence must be from 0 to 1.");
    }
  }

  return issues;
};

const freezeNormalizedInput = (input) => {
  const target = {};
  const targetSource = readOwnDataValue(input, "target");
  copyOwnDataProperty(targetSource, target, "mode");
  copyOwnDataProperty(targetSource, target, "model");

  const budget = {};
  const budgetSource = readOwnDataValue(input, "budget");
  copyOwnDataProperty(budgetSource, budget, "maxTokens");
  copyOwnDataProperty(budgetSource, budget, "maxLatencyMs");

  return deepFreeze({
    taskType: readOwnDataValue(input, "taskType"),
    arcPhase: readOwnDataValue(input, "arcPhase"),
    reliabilityTier: readOwnDataValue(input, "reliabilityTier"),
    risk: readOwnDataValue(input, "risk"),
    target,
    outputShape: readOwnDataValue(input, "outputShape"),
    ambiguity: readOwnDataValue(input, "ambiguity"),
    budget
  });
};

const freezeNormalizedOutput = (output) => {
  const overlaysSource = readOwnDataValue(output, "overlays");
  const promptFragmentsSource = readOwnDataValue(output, "promptFragments");
  const lifecycleGuidanceSource = readOwnDataValue(output, "lifecycleGuidance");
  const warningsSource = readOwnDataValue(output, "warnings");

  return deepFreeze({
    primaryPattern: readOwnDataValue(output, "primaryPattern"),
    overlays: copyArray(overlaysSource, (source, index) => readOwnDataValue(source, String(index))),
    promptFragments: copyArray(promptFragmentsSource, (source, index) => {
      const fragment = readOwnDataValue(source, String(index));
      return {
        kind: readOwnDataValue(fragment, "kind"),
        text: readOwnDataValue(fragment, "text")
      };
    }),
    lifecycleGuidance: copyArray(lifecycleGuidanceSource, (source, index) => {
      const guidance = readOwnDataValue(source, String(index));
      return {
        phase: readOwnDataValue(guidance, "phase"),
        guidance: readOwnDataValue(guidance, "guidance")
      };
    }),
    warnings: copyArray(warningsSource, (source, index) => readOwnDataValue(source, String(index))),
    rationale: readOwnDataValue(output, "rationale"),
    confidence: readOwnDataValue(output, "confidence")
  });
};

export class ContractValidationError extends TypeError {
  constructor(issues) {
    const frozenIssues = deepFreeze(issues.map((issue) => ({ ...issue })));
    super(frozenIssues.map(({ path, message }) => `${path}: ${message}`).join(" "));
    this.name = "ContractValidationError";
    this.issues = frozenIssues;
  }
}

export function normalizeInput(input) {
  const issues = validateInputValue(input);
  if (issues.length > 0) {
    throw new ContractValidationError(issues);
  }
  return freezeNormalizedInput(input);
}

export function normalizeOutput(output) {
  const issues = validateOutputValue(output);
  if (issues.length > 0) {
    throw new ContractValidationError(issues);
  }
  return freezeNormalizedOutput(output);
}

export const validateInput = normalizeInput;
export const validateOutput = normalizeOutput;
export const parseInput = normalizeInput;
export const parseOutput = normalizeOutput;
export const assertInput = normalizeInput;
export const assertOutput = normalizeOutput;

export function isValidInput(input) {
  try {
    normalizeInput(input);
    return true;
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return false;
    }
    throw error;
  }
}

export function isValidOutput(output) {
  try {
    normalizeOutput(output);
    return true;
  } catch (error) {
    if (error instanceof ContractValidationError) {
      return false;
    }
    throw error;
  }
}
