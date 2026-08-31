# arc-skill-prompt-patterns

Dependency-free ESM catalog, typed contract, and deterministic prompt-pattern recommender for ARC workflows. Recommendations are descriptive; this package does not execute tasks or make execution-policy decisions.

## Catalog

The stable catalog order is:

`template-fill`, `few-shot`, `decomposition`, `critique`, `guardrail`, `boundary`, `audience-adaptation`, `meta-prompt`, `evidence-grounding`, `hypothesis-test`.

Each catalog entry is frozen and contains an ID, display name, and descriptive guidance. The exported `PATTERN_IDS`, `PATTERN_CATALOG`, and `PATTERN_CATALOG_BY_ID` values are immutable.

## Contract

The input shape has exactly these top-level fields:

```js
{
  taskType, arcPhase, reliabilityTier, risk,
  target: { mode?, model? },
  outputShape, ambiguity,
  budget: { maxTokens?, maxLatencyMs? }
}
```

`target` must provide `mode`, `model`, or both. `model` must be a non-empty string. `budget` may be `{}`; when present, each numeric limit is a positive bounded integer. The enum constants are exported from the package.

The output shape has exactly these top-level fields:

```js
{
  primaryPattern, overlays, promptFragments,
  lifecycleGuidance, warnings, rationale, confidence
}
```

`overlays` contain unique catalog IDs and cannot repeat `primaryPattern`. Prompt fragments use `{ kind, text }`, lifecycle guidance uses unique `{ phase, guidance }` entries, and `confidence` is a finite number from `0` through `1`. Guidance and rationale have exported length bounds.

`normalizeInput` and `normalizeOutput` strictly validate and return deeply frozen copies. `isValidInput` and `isValidOutput` provide boolean checks. Unknown keys are rejected recursively, including keys on nested contract objects; input values are not mutated.

Input and output values must be inert JSON-compatible data made from plain objects, arrays, and supported scalar values. Accessor properties, including getters and setters, are rejected by inspecting own property descriptors and are never invoked.

The contract intentionally has no fields for `route`, `workload`, `authorization`, `visible-chain-of-thought`, `accuracy-guarantee`, or `mandatory-temperature`. These execution concerns remain outside the contract.

## Recommender

`recommend(input)` validates the strict input contract and returns a valid, deeply frozen recommendation:

```js
import { recommend } from "arc-skill-prompt-patterns";

const recommendation = recommend({
  taskType: "research",
  arcPhase: "research",
  reliabilityTier: "high-assurance",
  risk: "medium",
  target: { mode: "automatic" },
  outputShape: "structured",
  ambiguity: "low",
  budget: { maxTokens: 4096, maxLatencyMs: 10_000 }
});
```

The pure rule engine considers every input dimension. It selects a primary from the fixed catalog, ranks compatible overlays, and supplies prompt fragments, phase guidance, warnings, rationale, and confidence. Equal scores use catalog order as a stable tie-break. Tight token or latency budgets reduce optional guidance and add descriptive warnings; they do not trigger any external behavior.

In `automatic` target mode, an optional model hint is deliberately ignored, so identical task inputs remain model-neutral. In explicit or model-only targets, known profiles can add capability guidance for schema output, tool-use shapes, or reasoning controls. Unknown profiles use conservative warnings. These adjustments describe prompting only and never choose a model or authorize an action.

Calls are deterministic for equivalent data, do not mutate input values, and return fresh deeply frozen output copies. Invalid inputs raise `ContractValidationError` through the same strict normalization API used by the public contract.

## Model profiles

The standalone `profiles.mjs` surface records capability-only, schema-validated profiles for the model aliases supported by ARC route bindings. Profiles describe schema output, tool use, reasoning-effort controls, sampling controls, positive context limits, and notes keyed only by catalog pattern IDs. They are immutable and have exactly these fields:

```js
{
  id, name, verified, schemaOutput, toolUse, reasoning,
  sampling, contextLimits, verifiedPatternNotes
}
```

`resolveModelProfile(model)` trims and case-folds a model alias, then returns its canonical frozen profile. Unrecognized and non-string inputs return the frozen, conservative `UNKNOWN_MODEL_PROFILE`. Only base aliases and stable/provider model IDs are bindings; complete route names with execution suffixes are intentionally not model aliases.

`MODEL_PROFILE_SCHEMA`, the profile fixtures, ID/map/binding constants, and the normalization and validation helpers are exported from the package. Profile validation is strict: unknown keys and accessors are rejected recursively, and normalized values are deeply frozen.

Profiles are descriptive capability data consumed by explicit-target recommendations. ARC Pi continues to own route, workload, authorization, and task-execution decisions; resolving a profile does not authorize or select execution.

## Development

```sh
npm test
```

The package has no runtime dependencies and its validators do not access the filesystem, process state, network, providers, or UI.
