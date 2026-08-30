export type PatternId =
  | "template-fill"
  | "few-shot"
  | "decomposition"
  | "critique"
  | "guardrail"
  | "boundary"
  | "audience-adaptation"
  | "meta-prompt"
  | "evidence-grounding"
  | "hypothesis-test";

export type TaskType =
  | "extraction"
  | "classification"
  | "research"
  | "planning"
  | "coding"
  | "debugging"
  | "review"
  | "deployment";

export type ArcPhase = "explore" | "analyze" | "research" | "plan" | "implement" | "verify" | "deploy";
export type ReliabilityTier = "exploratory" | "standard" | "high-assurance";
export type Risk = "low" | "medium" | "high" | "critical";
export type TargetMode = "automatic" | "explicit";
export type OutputShape = "text" | "structured" | "code" | "tool-call" | "mixed";
export type Ambiguity = "none" | "low" | "medium" | "high";
export type PromptFragmentKind = "instruction" | "context" | "format" | "verification" | "constraint";

export interface PatternDefinition {
  readonly id: PatternId;
  readonly name: string;
  readonly description: string;
}

export type Target =
  | { readonly mode: TargetMode; readonly model?: string }
  | { readonly mode?: never; readonly model: string };

export interface Budget {
  readonly maxTokens?: number;
  readonly maxLatencyMs?: number;
}

export interface PromptPatternInput {
  readonly taskType: TaskType;
  readonly arcPhase: ArcPhase;
  readonly reliabilityTier: ReliabilityTier;
  readonly risk: Risk;
  readonly target: Target;
  readonly outputShape: OutputShape;
  readonly ambiguity: Ambiguity;
  readonly budget: Budget;
}

export interface PromptFragment {
  readonly kind: PromptFragmentKind;
  readonly text: string;
}

export interface LifecycleGuidance {
  readonly phase: ArcPhase;
  readonly guidance: string;
}

export interface PromptPatternOutput {
  readonly primaryPattern: PatternId;
  readonly overlays: readonly PatternId[];
  readonly promptFragments: readonly PromptFragment[];
  readonly lifecycleGuidance: readonly LifecycleGuidance[];
  readonly warnings: readonly string[];
  readonly rationale: string;
  readonly confidence: number;
}

export interface ValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type JsonSchema = Readonly<Record<string, unknown>>;

export type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";
export type ModelProfileId =
  | "claude-fable-5"
  | "gpt-5.6-sol"
  | "gpt-5.6-luna"
  | "gpt-5.5"
  | "claude-opus-5"
  | "claude-opus-4-8"
  | "cursor-grok-4.6-high"
  | "kimi-k3"
  | "MiniMax-M3"
  | "composer-2.5";

export interface ModelProfile {
  readonly id: string;
  readonly name: string;
  readonly verified: boolean;
  readonly schemaOutput: Readonly<{ supported: boolean }>;
  readonly toolUse: Readonly<{ supported: boolean }>;
  readonly reasoning: Readonly<{
    supported: boolean;
    effortLevels: readonly ReasoningEffort[];
  }>;
  readonly sampling: Readonly<{
    temperature: boolean;
    topP: boolean;
  }>;
  readonly contextLimits: Readonly<{
    contextWindowTokens: number;
    maxOutputTokens: number;
  }>;
  readonly verifiedPatternNotes: Readonly<Partial<Record<PatternId, string>>>;
}

export const PATTERN_IDS: readonly [
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
];
export const CATALOG_IDS: typeof PATTERN_IDS;
export const PATTERN_CATALOG: readonly PatternDefinition[];
export const CATALOG: typeof PATTERN_CATALOG;
export const PATTERN_CATALOG_BY_ID: Readonly<Record<PatternId, PatternDefinition>>;
export function isPatternId(value: unknown): value is PatternId;

export const TASK_TYPES: readonly TaskType[];
export const ARC_PHASES: readonly ArcPhase[];
export const RELIABILITY_TIERS: readonly ReliabilityTier[];
export const RISKS: readonly Risk[];
export const TARGET_MODES: readonly TargetMode[];
export const OUTPUT_SHAPES: readonly OutputShape[];
export const AMBIGUITIES: readonly Ambiguity[];
export const PROMPT_FRAGMENT_KINDS: readonly PromptFragmentKind[];
export const INPUT_FIELDS: readonly [
  "taskType",
  "arcPhase",
  "reliabilityTier",
  "risk",
  "target",
  "outputShape",
  "ambiguity",
  "budget"
];
export const OUTPUT_FIELDS: readonly [
  "primaryPattern",
  "overlays",
  "promptFragments",
  "lifecycleGuidance",
  "warnings",
  "rationale",
  "confidence"
];

export const CONTRACT_LIMITS: Readonly<{
  maxTokens: 1000000;
  maxLatencyMs: 86400000;
  maxLifecycleGuidanceEntries: 16;
  maxLifecycleGuidanceLength: 1000;
  maxRationaleLength: 2000;
}>;
export const LIMITS: typeof CONTRACT_LIMITS;

export const INPUT_SCHEMA: JsonSchema;
export const OUTPUT_SCHEMA: JsonSchema;
export const RECOMMENDATION_INPUT_SCHEMA: typeof INPUT_SCHEMA;
export const RECOMMENDATION_OUTPUT_SCHEMA: typeof OUTPUT_SCHEMA;

export class ContractValidationError extends TypeError {
  constructor(issues: readonly ValidationIssue[]);
  readonly issues: readonly ValidationIssue[];
}

export function normalizeInput(input: unknown): Readonly<PromptPatternInput>;
export function normalizeOutput(output: unknown): Readonly<PromptPatternOutput>;
export const validateInput: typeof normalizeInput;
export const validateOutput: typeof normalizeOutput;
export const parseInput: typeof normalizeInput;
export const parseOutput: typeof normalizeOutput;
export const assertInput: typeof normalizeInput;
export const assertOutput: typeof normalizeOutput;
export function isValidInput(input: unknown): input is PromptPatternInput;
export function isValidOutput(output: unknown): output is PromptPatternOutput;

export const REASONING_EFFORTS: readonly ["low", "medium", "high", "xhigh", "max", "ultra"];
export const MODEL_PROFILE_SCHEMA: JsonSchema;
export const MODEL_PROFILE_IDS: readonly ModelProfileId[];
export const MODEL_PROFILES: readonly Readonly<ModelProfile>[];
export const MODEL_PROFILE_FIXTURES: typeof MODEL_PROFILES;
export const MODEL_PROFILES_BY_ID: Readonly<Record<ModelProfileId, Readonly<ModelProfile>>>;
export const MODEL_PROFILE_BINDINGS: Readonly<Record<string, ModelProfileId>>;
export const MODEL_PROFILE_ALIASES: typeof MODEL_PROFILE_BINDINGS;
export const SUPPORTED_MODEL_BINDINGS: typeof MODEL_PROFILE_BINDINGS;
export const UNKNOWN_MODEL_PROFILE: Readonly<ModelProfile>;

export class ModelProfileValidationError extends TypeError {
  constructor(issues: readonly ValidationIssue[]);
  readonly issues: readonly ValidationIssue[];
}

export function normalizeModelProfile(profile: unknown): Readonly<ModelProfile>;
export const validateModelProfile: typeof normalizeModelProfile;
export const parseModelProfile: typeof normalizeModelProfile;
export const assertModelProfile: typeof normalizeModelProfile;
export function isValidModelProfile(profile: unknown): profile is ModelProfile;
export function resolveModelProfile(model: unknown): Readonly<ModelProfile>;
