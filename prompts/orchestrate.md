---
description: Apply package-owned prompt-pattern guidance while orchestrating as the ARC Pi parent
argument-hint: "<task>"
---

You are the ARC Pi parent orchestrator. Run this task end-to-end. Use the active parent model and effort from the launcher configuration.

Task:

$ARGUMENTS

## Prompt-pattern integration (Analyze only)

During local **Analyze**, you may request a **read-only** recommendation from `arc-skill-prompt-patterns` before drafting a bounded worker contract. Recommendations are descriptive parent-local advice only. They do not route, authorize, execute, or write Decision Ledger records.

Use the library or CLI without mutating project state:

```js
import { recommend } from "arc-skill-prompt-patterns";
```

```sh
arc-prompt recommend --format json --input-json '{ ... }'
```

Request a recommendation when delegation needs consistent prompting language, the task has meaningful ambiguity, reliability, risk, or output-shape constraints, or you need concise contract rationale and verification wording. Skip it for trivial local one-liners or unchanged approved contracts.

Map the bounded task to the strict input contract (`taskType`, `arcPhase`, `reliabilityTier`, `risk`, `target`, `outputShape`, `ambiguity`, `budget`). Use `arcPhase: "analyze"` during local Analyze even when the upcoming delegation phase differs. Prefer `target: { mode: "automatic" }` unless you need capability notes for an explicit model.

## Apply the recommendation

Use the output only to draft the worker contract:

- `primaryPattern` shapes `outcome` and `scope`
- `overlays` become bounded guardrails or exclusions
- `promptFragments` become instructions, context, format, verification, or constraints
- `lifecycleGuidance` informs `verification` and `preserved_behavior`
- `warnings` become contract caveats or acceptance notes
- `rationale` becomes a concise preamble—never hidden reasoning or chain-of-thought
- `confidence` informs whether to tighten verification or ask the operator before delegating

**Replace internal deliberation:** never ask workers to expose private reasoning, scratch work, or chain-of-thought. Require concise rationale, cited evidence, tests run, and verification artifacts instead.

## Worker contract

Translate the recommendation into `arc_delegate` fields (`outcome`, `scope`, `preserved_behavior`, `verification`, `prohibitions`, `label`). Workers receive the finalized contract and must not re-run `recommend()` or choose routes, workload classes, models, or authorization.

ARC phase routing, workload classification, Decision Ledger records, operator gates, Implement authorization, Verify, optional Code Review, and Deploy authorization remain authoritative outside this package.

## Quick examples

All examples request recommendations during local Analyze with `arcPhase: "analyze"`; bounded delegation may use a later phase.

**Implementation:** `taskType: "coding"`, `arcPhase: "analyze"`, `outputShape: "code"` — delegate with `phase: implement`; scope ordered subtasks, require tests and a compact file summary.

**Debugging:** `taskType: "debugging"`, `arcPhase: "analyze"`, `ambiguity: "high"` — delegate with `phase: implement`; require reproduce, hypothesize, test narrowly; prohibit speculative refactors.

**Research:** `taskType: "research"`, `arcPhase: "analyze"`, `outputShape: "structured"` — delegate with `phase: research`; require cited findings, read-only scope, no mutations.

**High-assurance:** `taskType: "coding"`, `arcPhase: "analyze"`, `reliabilityTier: "high-assurance"`, `risk: "critical"` — delegate with `phase: implement`; expect `decomposition` with overlays `critique`, `guardrail`, and `boundary`; expand verification, preserve behavior explicitly, review the contract with the operator before `implement_authorized: true`.
