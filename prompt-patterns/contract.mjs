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
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
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
  "confidence",
  "needsOperator"
]);

export const CONTRACT_LIMITS = deepFreeze({
  maxTokens: 1_000_000,
  maxLatencyMs: 86_400_000,
  maxLifecycleGuidanceEntries: 16,
  maxLifecycleGuidanceLength: 1_000,
  maxRationaleLength: 2_000,
  minOperatorAlternatives: 2,
  maxOperatorAlternatives: 5,
  maxOperatorQuestionLength: 500,
  maxOperatorContextLength: 1_000,
  maxOperatorOptionDescriptionLength: 1_000
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
    },
    needsOperator: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          required: ["reasons", "alternatives", "question"],
          properties: {
            reasons: {
              type: "array",
              minItems: 1,
              maxItems: 2,
              uniqueItems: true,
              items: { type: "string", enum: ["tie", "low-confidence"] }
            },
            alternatives: {
              type: "array",
              minItems: CONTRACT_LIMITS.minOperatorAlternatives,
              maxItems: CONTRACT_LIMITS.maxOperatorAlternatives,
              uniqueItems: true,
              items: { type: "string", enum: schemaEnum(PATTERN_IDS) }
            },
            question: {
              type: "object",
              additionalProperties: false,
              required: [
                "question",
                "question_type",
                "context",
                "options",
                "recommendation",
                "blocking",
                "semantic_key"
              ],
              properties: {
                question: {
                  type: "string",
                  minLength: 1,
                  pattern: "\\S",
                  maxLength: CONTRACT_LIMITS.maxOperatorQuestionLength
                },
                question_type: { const: "single_select" },
                context: {
                  type: "object",
                  minProperties: 1,
                  additionalProperties: {
                    oneOf: [
                      {
                        type: "string",
                        minLength: 1,
                        pattern: "\\S",
                        maxLength: CONTRACT_LIMITS.maxOperatorContextLength
                      },
                      {
                        type: "array",
                        minItems: 1,
                        items: {
                          type: "string",
                          minLength: 1,
                          pattern: "\\S",
                          maxLength: CONTRACT_LIMITS.maxOperatorContextLength
                        }
                      }
                    ]
                  }
                },
                options: {
                  type: "array",
                  minItems: CONTRACT_LIMITS.minOperatorAlternatives,
                  maxItems: CONTRACT_LIMITS.maxOperatorAlternatives,
                  uniqueItems: true,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["label", "description"],
                    properties: {
                      label: { type: "string", enum: schemaEnum(PATTERN_IDS) },
                      description: {
                        type: "string",
                        minLength: 1,
                        pattern: "\\S",
                        maxLength: CONTRACT_LIMITS.maxOperatorOptionDescriptionLength
                      }
                    }
                  }
                },
                recommendation: { type: "string", enum: schemaEnum(PATTERN_IDS) },
                blocking: { const: true },
                semantic_key: {
                  type: "string",
                  pattern: "^prompt-pattern-selection:v1:[a-f0-9]{64}$"
                }
              }
            }
          }
        }
      ]
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
const needsOperatorFields = ["reasons", "alternatives", "question"];
const operatorQuestionFields = [
  "question",
  "question_type",
  "context",
  "options",
  "recommendation",
  "blocking",
  "semantic_key"
];
const operatorOptionFields = ["label", "description"];
const operatorReasons = ["tie", "low-confidence"];

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

const assignOwnDataProperty = (target, key, value) => {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
};

const copyOwnDataProperty = (source, target, key) => {
  const property = readOwnDataProperty(source, key);
  if (property.present && property.readable) {
    assignOwnDataProperty(target, key, property.value);
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

const checkClarificationContext = (value, path, issues) => {
  if (!isRecord(value)) {
    addIssue(issues, path, "type", "Expected a plain object.");
    return false;
  }

  const descriptors = inspectOwnDescriptors(value, path, issues);
  let entryCount = 0;
  for (const key of descriptors.keys()) {
    const renderedKey = typeof key === "symbol" ? key.toString() : key;
    if (typeof key !== "string" || key.trim().length === 0) {
      addIssue(issues, pathForKey(path, renderedKey), "empty-key", "Context keys must be non-empty strings.");
      continue;
    }

    const item = readOwnData(descriptors, key);
    if (!item.readable) {
      continue;
    }
    entryCount += 1;
    const itemPath = pathForKey(path, key);
    if (typeof item.value === "string") {
      checkString(item.value, itemPath, issues, {
        nonEmpty: true,
        maxLength: CONTRACT_LIMITS.maxOperatorContextLength
      });
      continue;
    }
    if (Array.isArray(item.value)) {
      const array = checkArray(item.value, itemPath, issues);
      if (!array || !array.readable) {
        continue;
      }
      if (array.length === 0) {
        addIssue(issues, itemPath, "empty", "Context array values must be non-empty.");
      }
      for (let index = 0; index < array.length; index += 1) {
        const part = readOwnData(array.descriptors, String(index));
        if (part.readable) {
          checkString(part.value, `${itemPath}.${index}`, issues, {
            nonEmpty: true,
            maxLength: CONTRACT_LIMITS.maxOperatorContextLength
          });
        }
      }
      continue;
    }
    addIssue(issues, itemPath, "type", "Context values must be non-empty strings or string arrays.");
  }

  if (entryCount === 0) {
    addIssue(issues, path, "empty", "Context must contain at least one entry.");
  }
  return descriptors;
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

  const needsOperator = readOwnData(outputDescriptors, "needsOperator");
  if (needsOperator.readable && needsOperator.value !== null) {
    const needsOperatorDescriptors = checkRecord(
      needsOperator.value,
      "$.needsOperator",
      needsOperatorFields,
      needsOperatorFields,
      issues
    );
    if (needsOperatorDescriptors) {
      const reasonsValue = readOwnData(needsOperatorDescriptors, "reasons");
      const reasonsArray = reasonsValue.readable
        ? checkArray(reasonsValue.value, "$.needsOperator.reasons", issues)
        : false;
      if (reasonsArray && reasonsArray.readable) {
        if (reasonsArray.length < 1 || reasonsArray.length > operatorReasons.length) {
          addIssue(issues, "$.needsOperator.reasons", "bounded", "Operator reasons must contain one or two entries.");
        }
        const seenReasons = new Set();
        for (let index = 0; index < reasonsArray.length; index += 1) {
          const path = `$.needsOperator.reasons.${index}`;
          const reason = readOwnData(reasonsArray.descriptors, String(index));
          if (reason.readable && checkEnum(reason.value, path, operatorReasons, issues)) {
            if (seenReasons.has(reason.value)) {
              addIssue(issues, path, "duplicate", "Operator reasons must be unique.");
            }
            seenReasons.add(reason.value);
          }
        }
      }

      const alternativesValue = readOwnData(needsOperatorDescriptors, "alternatives");
      const alternativesArray = alternativesValue.readable
        ? checkArray(alternativesValue.value, "$.needsOperator.alternatives", issues)
        : false;
      const alternatives = [];
      if (alternativesArray && alternativesArray.readable) {
        if (
          alternativesArray.length < CONTRACT_LIMITS.minOperatorAlternatives ||
          alternativesArray.length > CONTRACT_LIMITS.maxOperatorAlternatives
        ) {
          addIssue(
            issues,
            "$.needsOperator.alternatives",
            "bounded",
            `Operator alternatives must contain ${CONTRACT_LIMITS.minOperatorAlternatives} to ${CONTRACT_LIMITS.maxOperatorAlternatives} entries.`
          );
        }
        const seenAlternatives = new Set();
        for (let index = 0; index < alternativesArray.length; index += 1) {
          const path = `$.needsOperator.alternatives.${index}`;
          const alternative = readOwnData(alternativesArray.descriptors, String(index));
          if (alternative.readable && checkEnum(alternative.value, path, PATTERN_IDS, issues)) {
            if (seenAlternatives.has(alternative.value)) {
              addIssue(issues, path, "duplicate", "Operator alternatives must be unique.");
            }
            seenAlternatives.add(alternative.value);
            alternatives.push(alternative.value);
          }
        }
        if (primaryPatternIsValid && !seenAlternatives.has(primaryPattern.value)) {
          addIssue(
            issues,
            "$.needsOperator.alternatives",
            "primary-missing",
            "Operator alternatives must include the primary pattern."
          );
        }
      }

      const questionValue = readOwnData(needsOperatorDescriptors, "question");
      const questionDescriptors = questionValue.readable
        ? checkRecord(
            questionValue.value,
            "$.needsOperator.question",
            operatorQuestionFields,
            operatorQuestionFields,
            issues
          )
        : false;
      if (questionDescriptors) {
        const question = readOwnData(questionDescriptors, "question");
        const questionType = readOwnData(questionDescriptors, "question_type");
        const context = readOwnData(questionDescriptors, "context");
        const optionsValue = readOwnData(questionDescriptors, "options");
        const recommendation = readOwnData(questionDescriptors, "recommendation");
        const blocking = readOwnData(questionDescriptors, "blocking");
        const semanticKey = readOwnData(questionDescriptors, "semantic_key");

        if (question.readable) {
          checkString(question.value, "$.needsOperator.question.question", issues, {
            nonEmpty: true,
            maxLength: CONTRACT_LIMITS.maxOperatorQuestionLength
          });
        }
        if (questionType.readable && questionType.value !== "single_select") {
          addIssue(issues, "$.needsOperator.question.question_type", "const", "Question type must be single_select.");
        }
        if (context.readable) {
          checkClarificationContext(context.value, "$.needsOperator.question.context", issues);
        }

        const optionsArray = optionsValue.readable
          ? checkArray(optionsValue.value, "$.needsOperator.question.options", issues)
          : false;
        const optionLabels = [];
        if (optionsArray && optionsArray.readable) {
          if (
            optionsArray.length < CONTRACT_LIMITS.minOperatorAlternatives ||
            optionsArray.length > CONTRACT_LIMITS.maxOperatorAlternatives
          ) {
            addIssue(
              issues,
              "$.needsOperator.question.options",
              "bounded",
              `Question options must contain ${CONTRACT_LIMITS.minOperatorAlternatives} to ${CONTRACT_LIMITS.maxOperatorAlternatives} entries.`
            );
          }
          const seenLabels = new Set();
          for (let index = 0; index < optionsArray.length; index += 1) {
            const path = `$.needsOperator.question.options.${index}`;
            const option = readOwnData(optionsArray.descriptors, String(index));
            if (!option.readable) {
              continue;
            }
            const optionDescriptors = checkRecord(
              option.value,
              path,
              operatorOptionFields,
              operatorOptionFields,
              issues
            );
            if (!optionDescriptors) {
              continue;
            }
            const label = readOwnData(optionDescriptors, "label");
            const description = readOwnData(optionDescriptors, "description");
            if (label.readable && checkEnum(label.value, `${path}.label`, PATTERN_IDS, issues)) {
              if (seenLabels.has(label.value)) {
                addIssue(issues, `${path}.label`, "duplicate", "Question option labels must be unique.");
              }
              seenLabels.add(label.value);
              optionLabels.push(label.value);
            }
            if (description.readable) {
              checkString(description.value, `${path}.description`, issues, {
                nonEmpty: true,
                maxLength: CONTRACT_LIMITS.maxOperatorOptionDescriptionLength
              });
            }
          }
        }

        if (
          alternativesArray && alternativesArray.readable &&
          optionsArray && optionsArray.readable &&
          (alternatives.length !== optionLabels.length ||
            alternatives.some((alternative, index) => optionLabels[index] !== alternative))
        ) {
          addIssue(
            issues,
            "$.needsOperator.question.options",
            "relationship",
            "Question option labels must match alternatives in order."
          );
        }
        if (recommendation.readable && checkEnum(
          recommendation.value,
          "$.needsOperator.question.recommendation",
          PATTERN_IDS,
          issues
        )) {
          if (!optionLabels.includes(recommendation.value)) {
            addIssue(
              issues,
              "$.needsOperator.question.recommendation",
              "relationship",
              "Question recommendation must name an option."
            );
          }
          if (primaryPatternIsValid && recommendation.value !== primaryPattern.value) {
            addIssue(
              issues,
              "$.needsOperator.question.recommendation",
              "relationship",
              "Question recommendation must name the primary pattern."
            );
          }
        }
        if (blocking.readable && blocking.value !== true) {
          addIssue(issues, "$.needsOperator.question.blocking", "const", "Operator question must be blocking.");
        }
        if (semanticKey.readable) {
          if (!checkString(semanticKey.value, "$.needsOperator.question.semantic_key", issues, { nonEmpty: true }) ||
            !/^prompt-pattern-selection:v1:[a-f0-9]{64}$/.test(semanticKey.value)) {
            addIssue(
              issues,
              "$.needsOperator.question.semantic_key",
              "format",
              "Semantic key must use the prompt-pattern-selection:v1 SHA-256 format."
            );
          }
        }
      }
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

const copyClarificationContext = (source) => {
  const copy = Object.create(null);
  for (const key of Reflect.ownKeys(source)) {
    const value = readOwnDataValue(source, key);
    assignOwnDataProperty(
      copy,
      key,
      Array.isArray(value)
        ? copyArray(value, (array, index) => readOwnDataValue(array, String(index)))
        : value
    );
  }
  return copy;
};

const freezeNormalizedOutput = (output) => {
  const overlaysSource = readOwnDataValue(output, "overlays");
  const promptFragmentsSource = readOwnDataValue(output, "promptFragments");
  const lifecycleGuidanceSource = readOwnDataValue(output, "lifecycleGuidance");
  const warningsSource = readOwnDataValue(output, "warnings");
  const needsOperatorSource = readOwnDataValue(output, "needsOperator");

  let needsOperator = null;
  if (needsOperatorSource !== null) {
    const reasonsSource = readOwnDataValue(needsOperatorSource, "reasons");
    const alternativesSource = readOwnDataValue(needsOperatorSource, "alternatives");
    const questionSource = readOwnDataValue(needsOperatorSource, "question");
    const optionsSource = readOwnDataValue(questionSource, "options");
    needsOperator = {
      reasons: copyArray(reasonsSource, (source, index) => readOwnDataValue(source, String(index))),
      alternatives: copyArray(alternativesSource, (source, index) => readOwnDataValue(source, String(index))),
      question: {
        question: readOwnDataValue(questionSource, "question"),
        question_type: readOwnDataValue(questionSource, "question_type"),
        context: copyClarificationContext(readOwnDataValue(questionSource, "context")),
        options: copyArray(optionsSource, (source, index) => {
          const option = readOwnDataValue(source, String(index));
          return {
            label: readOwnDataValue(option, "label"),
            description: readOwnDataValue(option, "description")
          };
        }),
        recommendation: readOwnDataValue(questionSource, "recommendation"),
        blocking: readOwnDataValue(questionSource, "blocking"),
        semantic_key: readOwnDataValue(questionSource, "semantic_key")
      }
    };
  }

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
    confidence: readOwnDataValue(output, "confidence"),
    needsOperator
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
