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

const PROFILE_FIELDS = Object.freeze([
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

export const REASONING_EFFORTS = Object.freeze([
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra"
]);

const patternNoteProperties = Object.fromEntries(
  PATTERN_IDS.map((id) => [id, { type: "string", minLength: 1, pattern: "\\S" }])
);

export const MODEL_PROFILE_SCHEMA = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [...PROFILE_FIELDS],
  properties: {
    id: { type: "string", minLength: 1, pattern: "\\S" },
    name: { type: "string", minLength: 1, pattern: "\\S" },
    verified: { type: "boolean" },
    schemaOutput: {
      type: "object",
      additionalProperties: false,
      required: ["supported"],
      properties: { supported: { type: "boolean" } }
    },
    toolUse: {
      type: "object",
      additionalProperties: false,
      required: ["supported"],
      properties: { supported: { type: "boolean" } }
    },
    reasoning: {
      type: "object",
      additionalProperties: false,
      required: ["supported", "effortLevels"],
      properties: {
        supported: { type: "boolean" },
        effortLevels: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", enum: [...REASONING_EFFORTS] }
        }
      }
    },
    sampling: {
      type: "object",
      additionalProperties: false,
      required: ["temperature", "topP"],
      properties: {
        temperature: { type: "boolean" },
        topP: { type: "boolean" }
      }
    },
    contextLimits: {
      type: "object",
      additionalProperties: false,
      required: ["contextWindowTokens", "maxOutputTokens"],
      properties: {
        contextWindowTokens: { type: "integer", minimum: 1 },
        maxOutputTokens: { type: "integer", minimum: 1 }
      }
    },
    verifiedPatternNotes: {
      type: "object",
      additionalProperties: false,
      properties: patternNoteProperties
    }
  }
});

const issue = (issues, path, code, message) => {
  issues.push({ path, code, message });
};

const isPlainObject = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizeFromSchema = (value, schema, path, issues) => {
  if (schema.type === "object") {
    if (!isPlainObject(value)) {
      issue(issues, path, "type", "Expected a plain object.");
      return undefined;
    }

    const descriptors = new Map();
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      descriptors.set(key, descriptor);
      if (!hasDataDescriptor(descriptor)) {
        issue(issues, `${path}.${String(key)}`, "accessor", "Accessor properties are not allowed.");
      }
      if (typeof key !== "string" || !Object.hasOwn(schema.properties, key)) {
        issue(issues, `${path}.${String(key)}`, "unknown-key", "Unknown key is not allowed.");
      }
    }

    for (const key of schema.required ?? []) {
      if (!descriptors.has(key)) {
        issue(issues, `${path}.${key}`, "missing", "Required field is missing.");
      }
    }

    const normalized = {};
    for (const key of Object.keys(schema.properties)) {
      const descriptor = descriptors.get(key);
      if (hasDataDescriptor(descriptor)) {
        normalized[key] = normalizeFromSchema(descriptor.value, schema.properties[key], `${path}.${key}`, issues);
      }
    }
    return normalized;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      issue(issues, path, "type", "Expected an array.");
      return undefined;
    }

    const descriptors = new Map();
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      descriptors.set(key, descriptor);
      if (key !== "length" && !hasDataDescriptor(descriptor)) {
        issue(issues, `${path}.${String(key)}`, "accessor", "Accessor properties are not allowed.");
      }
      if (
        key !== "length" &&
        (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)
      ) {
        issue(issues, `${path}.${String(key)}`, "unknown-key", "Unknown array property is not allowed.");
      }
    }

    const normalized = [];
    const comparable = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (!descriptor) {
        issue(issues, `${path}.${index}`, "missing", "Sparse arrays are not allowed.");
        continue;
      }
      if (!hasDataDescriptor(descriptor)) {
        continue;
      }
      normalized.push(normalizeFromSchema(descriptor.value, schema.items, `${path}.${index}`, issues));
      comparable.push(descriptor.value);
    }
    if (schema.uniqueItems && new Set(comparable).size !== comparable.length) {
      issue(issues, path, "unique", "Array values must be unique.");
    }
    return normalized;
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      issue(issues, path, "type", "Expected a string.");
      return value;
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issue(issues, path, "length", "String is too short.");
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      issue(issues, path, "pattern", "String must contain a non-whitespace character.");
    }
    if (schema.enum !== undefined && !schema.enum.includes(value)) {
      issue(issues, path, "enum", "Unsupported string value.");
    }
    return value;
  }

  if (schema.type === "boolean") {
    if (typeof value !== "boolean") {
      issue(issues, path, "type", "Expected a boolean.");
    }
    return value;
  }

  if (schema.type === "integer") {
    if (!Number.isSafeInteger(value)) {
      issue(issues, path, "type", "Expected a safe integer.");
    } else if (schema.minimum !== undefined && value < schema.minimum) {
      issue(issues, path, "minimum", `Expected a value of at least ${schema.minimum}.`);
    }
    return value;
  }

  issue(issues, path, "schema", "Unsupported schema node.");
  return value;
};

export class ModelProfileValidationError extends TypeError {
  constructor(issues) {
    super(`Invalid model profile: ${issues.map(({ path, message }) => `${path}: ${message}`).join(" ")}`);
    this.name = "ModelProfileValidationError";
    this.issues = deepFreeze(issues.map((entry) => ({ ...entry })));
  }
}

export function normalizeModelProfile(profile) {
  const issues = [];
  const normalized = normalizeFromSchema(profile, MODEL_PROFILE_SCHEMA, "$", issues);
  if (issues.length > 0) {
    throw new ModelProfileValidationError(issues);
  }

  if (!normalized.reasoning.supported && normalized.reasoning.effortLevels.length > 0) {
    throw new ModelProfileValidationError([
      {
        path: "$.reasoning.effortLevels",
        code: "relationship",
        message: "Effort levels require reasoning support."
      }
    ]);
  }
  return deepFreeze(normalized);
}

export const validateModelProfile = normalizeModelProfile;
export const parseModelProfile = normalizeModelProfile;
export const assertModelProfile = normalizeModelProfile;

export function isValidModelProfile(profile) {
  try {
    normalizeModelProfile(profile);
    return true;
  } catch (error) {
    if (error instanceof ModelProfileValidationError) {
      return false;
    }
    throw error;
  }
}

const makeProfile = (profile) => normalizeModelProfile(profile);

const capabilityNotes = (schemaOutput, toolUse, reasoning) => ({
  ...(schemaOutput
    ? { "template-fill": "Schema output can reinforce a stable structured template." }
    : {}),
  ...(toolUse ? { decomposition: "Tool calls can execute explicitly separated subtasks." } : {}),
  ...(reasoning ? { critique: "Reasoning effort can be raised for demanding review work." } : {})
});

const profile = ({
  id,
  name,
  schemaOutput = true,
  toolUse = true,
  effortLevels,
  temperature,
  topP,
  contextWindowTokens,
  maxOutputTokens
}) =>
  makeProfile({
    id,
    name,
    verified: true,
    schemaOutput: { supported: schemaOutput },
    toolUse: { supported: toolUse },
    reasoning: { supported: effortLevels.length > 0, effortLevels },
    sampling: { temperature, topP },
    contextLimits: { contextWindowTokens, maxOutputTokens },
    verifiedPatternNotes: capabilityNotes(schemaOutput, toolUse, effortLevels.length > 0)
  });

const profiles = [
  profile({
    id: "claude-fable-5",
    name: "Claude Fable 5",
    effortLevels: ["low", "medium", "high", "xhigh"],
    temperature: true,
    topP: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 64_000
  }),
  profile({
    id: "gpt-5.6-sol",
    name: "GPT-5.6 Sol",
    effortLevels: ["low", "medium", "high", "xhigh", "max", "ultra"],
    temperature: false,
    topP: false,
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000
  }),
  profile({
    id: "gpt-5.6-luna",
    name: "GPT-5.6 Luna",
    effortLevels: ["low", "medium", "high", "xhigh", "max"],
    temperature: false,
    topP: false,
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000
  }),
  profile({
    id: "gpt-5.5",
    name: "GPT-5.5",
    effortLevels: ["low", "medium", "high", "xhigh"],
    temperature: false,
    topP: false,
    contextWindowTokens: 400_000,
    maxOutputTokens: 128_000
  }),
  profile({
    id: "claude-opus-5",
    name: "Claude Opus 5",
    effortLevels: ["low", "medium", "high", "xhigh"],
    temperature: true,
    topP: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 64_000
  }),
  profile({
    id: "claude-opus-4-8",
    name: "Claude Opus 4.8",
    effortLevels: ["low", "medium", "high"],
    temperature: true,
    topP: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 64_000
  }),
  profile({
    id: "cursor-grok-4.6-high",
    name: "Grok 4.6 High",
    effortLevels: ["high"],
    temperature: true,
    topP: true,
    contextWindowTokens: 256_000,
    maxOutputTokens: 64_000
  }),
  profile({
    id: "kimi-k3",
    name: "Kimi K3",
    effortLevels: ["low", "medium", "high"],
    temperature: true,
    topP: true,
    contextWindowTokens: 256_000,
    maxOutputTokens: 64_000
  }),
  profile({
    id: "MiniMax-M3",
    name: "MiniMax M3",
    effortLevels: ["low", "medium", "high"],
    temperature: true,
    topP: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 64_000
  }),
  profile({
    id: "composer-2.5",
    name: "Composer 2.5",
    effortLevels: ["low", "medium", "high"],
    temperature: true,
    topP: true,
    contextWindowTokens: 200_000,
    maxOutputTokens: 64_000
  })
];

export const MODEL_PROFILES = deepFreeze(profiles);
export const MODEL_PROFILE_FIXTURES = MODEL_PROFILES;
export const MODEL_PROFILE_IDS = Object.freeze(MODEL_PROFILES.map(({ id }) => id));

const profilesById = Object.create(null);
for (const entry of MODEL_PROFILES) {
  profilesById[entry.id] = entry;
}
export const MODEL_PROFILES_BY_ID = deepFreeze(profilesById);

const bindings = {
  fable: "claude-fable-5",
  "fable-5": "claude-fable-5",
  "claude-fable-5": "claude-fable-5",
  sol: "gpt-5.6-sol",
  "gpt-5.6-sol": "gpt-5.6-sol",
  luna: "gpt-5.6-luna",
  "gpt-5.6-luna": "gpt-5.6-luna",
  "gpt-5.5": "gpt-5.5",
  opus: "claude-opus-5",
  "opus-5": "claude-opus-5",
  "claude-opus-5": "claude-opus-5",
  "opus-4.8": "claude-opus-4-8",
  "claude-opus-4-8": "claude-opus-4-8",
  grok: "cursor-grok-4.6-high",
  "grok-4.6": "cursor-grok-4.6-high",
  "cursor-grok-4.6-high": "cursor-grok-4.6-high",
  kimi: "kimi-k3",
  "kimi-k3": "kimi-k3",
  minimax: "MiniMax-M3",
  "minimax-m3": "MiniMax-M3",
  composer: "composer-2.5",
  "composer-2.5": "composer-2.5"
};

export const MODEL_PROFILE_BINDINGS = deepFreeze({ ...bindings });
export const MODEL_PROFILE_ALIASES = MODEL_PROFILE_BINDINGS;
export const SUPPORTED_MODEL_BINDINGS = MODEL_PROFILE_BINDINGS;

export const UNKNOWN_MODEL_PROFILE = makeProfile({
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

export function resolveModelProfile(model) {
  if (typeof model !== "string") {
    return UNKNOWN_MODEL_PROFILE;
  }
  const normalizedBinding = model.trim().toLocaleLowerCase("en-US");
  if (!Object.hasOwn(MODEL_PROFILE_BINDINGS, normalizedBinding)) {
    return UNKNOWN_MODEL_PROFILE;
  }
  return MODEL_PROFILES_BY_ID[MODEL_PROFILE_BINDINGS[normalizedBinding]];
}
