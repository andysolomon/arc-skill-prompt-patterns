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
  lifecycleGuidance, warnings, rationale, confidence,
  needsOperator
}
```

`overlays` contain unique catalog IDs and cannot repeat `primaryPattern`. Prompt fragments use `{ kind, text }`, lifecycle guidance uses unique `{ phase, guidance }` entries, and `confidence` is a finite number from `0` through `1`. Guidance and rationale have exported length bounds.

`needsOperator` is required. It is `null` for an ordinary recommendation, or `{ reasons, alternatives, question }` when exact top scores tie, confidence is below the exported `LOW_CONFIDENCE_THRESHOLD` (`0.60`), or both. Reasons are a unique subset of `tie` and `low-confidence`. Alternatives contain 2–5 unique ranked `PatternId` values, include `primaryPattern`, and match the question's option labels in order.

The nested `question` can be passed directly to `arc_ask_operator`: it has one bounded `single_select` question and context, 2–5 `{ label, description }` options, the primary as its named recommendation, `blocking: true`, and a stable `prompt-pattern-selection:v1:<sha256>` semantic key.

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

The pure rule engine considers every input dimension. It selects a primary from the fixed catalog, ranks compatible overlays, and supplies prompt fragments, phase guidance, warnings, rationale, and confidence. Equal scores still use catalog order as a stable primary fallback, while `needsOperator` exposes the tie for an operator decision. Tight token or latency budgets reduce optional guidance and add descriptive warnings; they do not reduce operator alternatives or trigger external behavior.

Operator alternatives preserve deterministic ranking independently of overlay truncation. Semantic keys hash decision-relevant normalized input. Because automatic target mode ignores optional model hints for both recommendation behavior and semantic identity, adding or changing an automatic-mode hint does not change the recommendation or key.

### Reliability tiers

`reliabilityTier` selects one deterministic acceptance fragment (`kind: "verification"`) that becomes stricter with each tier:

| Tier | Result structure | Evidence | Focused tests | Independent Verify | Independent Code Review |
| --- | --- | --- | --- | --- | --- |
| `exploratory` | Result plus the open questions it still depends on | Unverified claims labeled provisional | One focused check that would confirm or refute the result | Optional at the parent's discretion | Not expected unless the parent requests it |
| `standard` | Complete requested structure with material assumptions stated | Evidence cited for each material claim | Focused tests or checks run, with observed outcomes reported | Expected before the result is accepted | Optional at the parent's discretion |
| `high-assurance` | Every required field, with assumptions, edge cases, and residual uncertainty named | Verifiable evidence for every material claim | Focused tests with exact commands and observed results | Expected before the result is relied on | Recommended option |

The fragment is emitted early so tight budgets cannot truncate it. High-assurance additionally keeps a `verify` entry in `lifecycleGuidance`.

High-assurance fails closed: when `ambiguity` is `medium` or `high`, or a non-automatic target (explicit or model-only) supplies no `model` or resolves to an unverified profile, `warnings` includes an entry naming the unresolved assumptions and the required operator decisions to settle before the result is relied on. Lower tiers never emit that warning.

These tiers describe result structure, evidence, and acceptance expectations. They do not run Verify or Code Review, change confidence, or affect Decision Ledger records, Implement authorization, or Deploy authorization.

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

## Command-line interface

The dependency-free `arc-prompt recommend` command exposes the same recommender for shell scripts and operators. A flag-based invocation defaults to deterministic human-readable output:

```sh
arc-prompt recommend \
  --task-type research \
  --arc-phase research \
  --reliability-tier high-assurance \
  --risk medium \
  --target-mode automatic \
  --output-shape structured \
  --ambiguity low \
  --max-tokens 4096 \
  --max-latency-ms 10000
```

Use `--format json` (or `--json`) for stable JSON output. Scripts can supply the complete strict contract as JSON instead of individual input flags:

```sh
arc-prompt recommend --format json --input-json '{
  "taskType": "research",
  "arcPhase": "research",
  "reliabilityTier": "high-assurance",
  "risk": "medium",
  "target": { "mode": "explicit", "model": "sol" },
  "outputShape": "structured",
  "ambiguity": "low",
  "budget": { "maxTokens": 4096, "maxLatencyMs": 10000 }
}'
```

`--target-model` is optional when `--target-mode` is provided, and it may also be used by itself because the public contract accepts model-only targets. JSON input cannot be mixed with recommendation input flags. Unknown options, malformed JSON, missing fields, and invalid contract values produce a diagnostic on stderr and a nonzero exit.

The command only selects and explains prompt patterns. It does not execute tasks, call workers, providers, or networks, write project files, select routes or workloads, grant authorization, or infer execution-policy settings.

Human output renders whether an operator decision is needed and, when present, every reason, alternative, option, and semantic-key field. JSON output preserves the canonical object for direct integration.

## Orchestration integration guidance

Package-owned guidance for ARC Pi parents lives in:

- `skills/arc-orchestrator/SKILL.md` — when to request a read-only recommendation during local Analyze, how to apply primary pattern, overlays, fragments, lifecycle guidance, warnings, rationale, and confidence, and how to convert that advice into a bounded worker contract.
- `prompts/orchestrate.md` — the same integration rules in prompt form for orchestration sessions.

Recommendations remain descriptive parent-local advice. Workers receive a finalized bounded contract and never choose their own pattern, route, workload, or authorization.

When `needsOperator` is non-null, the parent queries `arc_decisions` using `needsOperator.question.semantic_key`. It may reuse exactly one effective answer only when the selected label is still one of `needsOperator.alternatives`; otherwise it passes `needsOperator.question` directly to `arc_ask_operator`. A recorded, reused, unresolved, or cancelled pattern decision never grants Implement or Deploy authorization.

## Development

```sh
npm test
```

The package has no runtime dependencies and its validators do not access the filesystem, process state, network, providers, or UI.
