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
- `needsOperator` is `null` for an ordinary recommendation or carries the blocking tie/below-0.60 pattern decision

## Resolve `needsOperator`

When `needsOperator` is non-null, query `arc_decisions` with `needsOperator.question.semantic_key`. Reuse a choice only when exactly one effective valid answer exists and its label is still in `needsOperator.alternatives`. Otherwise pass `needsOperator.question` directly to `arc_ask_operator`; it is one bounded `single_select` question with context, 2–5 unique labeled options, a named recommendation, `blocking: true`, and a stable semantic key.

Do not infer a choice from an unresolved or cancelled question. A recorded or reused choice selects only the prompt pattern. Recorded, reused, unresolved, and cancelled decisions never grant Implement authorization or Deploy authorization.

## Reliability tiers

`reliabilityTier` produces a deterministic acceptance fragment that tightens result structure, evidence, focused tests, independent Verify, and optional independent Code Review with each tier:

- `exploratory` — result plus its open questions; unverified claims labeled provisional; one focused check named; independent Verify optional; independent Code Review not expected unless you request it.
- `standard` — complete requested structure with assumptions stated; evidence cited for each material claim; focused tests run with observed outcomes; independent Verify expected before acceptance; independent Code Review optional.
- `high-assurance` — every required field with assumptions, edge cases, and residual uncertainty named; verifiable evidence for every material claim; focused tests with exact commands and observed results; independent Verify expected before reliance; independent Code Review a recommended option.

**High-assurance fails closed.** With `medium`/`high` ambiguity, or a non-automatic target (explicit or model-only) that has no `model` or an unverified profile, `warnings` names the unresolved assumptions and required operator decisions. Carry it into the contract as an acceptance blocker and resolve it with the operator before relying on the result.

Tiers prescribe evidence and acceptance expectations only. Decision Ledger records, Implement authorization, running independent Verify, choosing optional Code Review, and Deploy authorization stay outside this package.

**Replace internal deliberation:** never ask workers to expose private reasoning, scratch work, or chain-of-thought. Require concise rationale, cited evidence, tests run, and verification artifacts instead.

## Worker contract

Translate the recommendation into `arc_delegate` fields (`outcome`, `scope`, `preserved_behavior`, `verification`, `prohibitions`, `label`). Workers receive the finalized contract and must not re-run `recommend()` or choose routes, workload classes, models, or authorization.

Worker `prohibitions` include no scope expansion, no commit or push unless explicitly authorized by the governing workflow, and no exposed internal deliberation.

ARC phase routing, workload classification, Decision Ledger records, operator gates, Implement authorization, Verify, optional Code Review, and Deploy authorization remain authoritative outside this package.

## Quick examples

All examples request recommendations during local Analyze with `arcPhase: "analyze"`; bounded delegation may use a later phase.

**Implementation:** `taskType: "coding"`, `arcPhase: "analyze"`, `outputShape: "code"` — delegate with `phase: implement`; scope ordered subtasks, require tests and a compact file summary.

**Debugging:** `taskType: "debugging"`, `arcPhase: "analyze"`, `ambiguity: "high"` — delegate with `phase: implement`; require reproduce, hypothesize, test narrowly; prohibit speculative refactors.

**Research:** `taskType: "research"`, `arcPhase: "analyze"`, `outputShape: "structured"` — delegate with `phase: research`; require cited findings, read-only scope, no mutations.

**High-assurance:** `taskType: "coding"`, `arcPhase: "analyze"`, `reliabilityTier: "high-assurance"`, `risk: "critical"` — delegate with `phase: implement`; expect `decomposition` with overlays `critique`, `guardrail`, and `boundary`; expand verification, preserve behavior explicitly, review the contract with the operator before `implement_authorized: true`.
