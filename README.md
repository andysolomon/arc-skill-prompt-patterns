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

The contract intentionally has no fields for `route`, `workload`, `authorization`, `visible-chain-of-thought`, `accuracy-guarantee`, or `mandatory-temperature`. These execution concerns, model profiles, and recommendation-selection rules remain outside this package. No selector implementation is included.

## Development

```sh
npm test
```

The package has no runtime dependencies and its validators do not access the filesystem, process state, network, providers, or UI.
