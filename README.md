# arc-skill-prompt-patterns

Dependency-free ESM catalog and typed contract for describing prompt-pattern recommendations in ARC workflows. Pattern guidance is descriptive; this package does not select a pattern or execute a task.

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

The contract intentionally has no fields for `route`, `workload`, `authorization`, `visible-chain-of-thought`, `accuracy-guarantee`, or `mandatory-temperature`. These execution concerns and recommendation-selection rules remain outside the contract. No selector implementation is included.

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

Profiles are descriptive capability data, not a recommender. ARC Pi continues to own route, workload, authorization, and task-execution decisions; resolving a profile does not authorize or select execution.

## Development

```sh
npm test
```

The package has no runtime dependencies and its validators do not access the filesystem, process state, network, providers, or UI.
