# W-000022 Implementation Plan — Prompt-pattern package

## Product goal and scope boundaries

Expose deterministic operator tie-break data whenever a prompt-pattern recommendation is tied or low-confidence, so the ARC Pi parent can use its existing `arc_decisions` and `arc_ask_operator` tools without making an unexplained selection.

This repository owns ambiguity detection, deterministic alternatives, a strict/deep-frozen `needsOperator` output, stable semantic-key derivation, package tests, and package guidance. It does not read or write the Decision Ledger, display a dialog, launch a worker, select execution policy, or grant implementation/deployment authorization.

## Current baseline

- `prompt-patterns/recommender.mjs` deterministically scores all patterns and silently resolves equal top scores by catalog order.
- `prompt-patterns/contract.mjs` strictly validates and deeply freezes recommendation output with no operator-decision field.
- `prompt-patterns/index.d.ts` exposes the canonical typed output.
- Existing tests cover one tied ranking, low confidence, full rule-matrix validity, determinism, strict schemas, fixtures, and execution neutrality.
- ARC Pi currently pins a package commit and passes the canonical recommendation through `arc_prompt_recommend` without reading or writing the Decision Ledger.

## Missing capabilities

- An explicit `needsOperator` result for tied or confidence-below-0.60 recommendations.
- Two to five deterministic, unique pattern-ID alternatives suitable for a single-select operator decision.
- One bounded question whose shape can be passed directly to `arc_ask_operator`.
- A stable semantic key that lets the parent retrieve an effective Decision Ledger choice for the same decision-relevant input.
- Tie/low-confidence fixtures and contract tests proving these additions remain pure and non-authorizing.

## Milestones and phases

### Phase 1 — Canonical ambiguity contract

**Goal:** Extend the strict public output contract without weakening validation or immutability.

**Deliverables:**

- Add required `needsOperator` output: `null` or `{ reasons, alternatives, question }`.
- `reasons` is a unique non-empty subset of `tie` and `low-confidence`.
- `alternatives` contains 2–5 unique `PatternId` values in deterministic ranking order and includes the current `primaryPattern`.
- `question` matches `arc_ask_operator` input exactly: one non-empty question, `question_type: "single_select"`, bounded context, 2–5 unique option objects, a recommendation naming an option, `blocking: true`, and a non-empty `semantic_key`.
- Export `LOW_CONFIDENCE_THRESHOLD = 0.6` and update TypeScript declarations/schema metadata.

**Dependencies:** Existing catalog IDs and strict normalizers.

**Risks:** Nested validation must reject unknown keys/accessors without invoking them; automatic model hints must not alter semantic identity.

**Acceptance criteria:** Valid ambiguity output normalizes to a fresh deeply frozen value; malformed options, keys, relationships, and bounds fail closed.

### Phase 2 — Deterministic tie and low-confidence generation

**Goal:** Replace silent tie-breaking with transparent operator-ready alternatives.

**Deliverables:**

- Detect exact top-score ties before catalog-order fallback.
- Trigger `needsOperator` when scores tie, confidence is below 0.60, or both.
- Select 2–5 alternatives independently of overlay/token-budget truncation, preserving ranked order and catalog-order determinism.
- Build option labels from canonical pattern IDs and descriptions from the catalog so a recorded answer maps directly back to a `PatternId`.
- Derive `prompt-pattern-selection:v1:<sha256>` from canonical decision-relevant normalized input; omit ignored model hints in automatic mode.
- Keep `primaryPattern` deterministic as the recommendation shown to the operator, not as an unexplained final choice.

**Dependencies:** Phase 1 contract.

**Risks:** Semantic-key drift would prevent ledger reuse; tie alternatives must remain bounded if future scoring creates more than five co-leaders.

**Acceptance criteria:** Repeated and cloned inputs return byte-equivalent ambiguity data; known tie and low-confidence cases return valid unique alternatives and one stable question; ordinary recommendations return `needsOperator: null`.

### Phase 3 — Fixtures, documentation, and package verification

**Goal:** Lock the behavior into the public package surface and explain the ARC authority boundary.

**Deliverables:**

- Extend recommender, schema, fixture/evaluation, CLI, and package metadata tests for the new field.
- Add tie, low-confidence, combined-reason, no-ambiguity, semantic-key, automatic-model-neutrality, malformed-contract, and deep-freeze coverage.
- Update `README.md`, `skills/arc-orchestrator/SKILL.md`, and `prompts/orchestrate.md` to describe the parent flow: query `arc_decisions`, reuse one effective valid answer, otherwise call `arc_ask_operator` with `needsOperator.question`.
- State explicitly that recorded, unresolved, cancelled, and reused decisions never authorize Implement or Deploy.

**Dependencies:** Phases 1–2 and the coordinated ARC Pi integration plan.

**Risks:** Literal fixture outputs and CLI human rendering will require narrow updates; release automation is currently failing and is not repaired by this story.

**Acceptance criteria:** `npm test` and `git diff --check` pass; package output contains no route, workload, execution, provider, or authorization fields.

## Acceptance criteria mapping

| Source criterion | Phase(s) | Verification |
| --- | --- | --- |
| Low-confidence or tied recommendations return 2–5 named alternatives and one bounded clarification question | 1–3 | Contract tests, tied/low-confidence unit cases, and literal fixtures assert bounds, uniqueness, deterministic order, and direct `arc_ask_operator` shape |
| Parent can record under a semantic key and reuse the effective decision | 2–3 plus ARC Pi plan | Stable-key tests here; coordinated ARC Pi integration tests record and retrieve the selected pattern using the returned key |
| Cancellation, unresolved answers, and operator decisions never authorize implementation/deployment | 3 plus ARC Pi plan | Package execution-neutral assertions and ARC Pi Decision Ledger cancellation/unresolved/authorization tests |

## Out of scope and deferred

- Reading or writing ARC Pi session state or Decision Ledger records.
- Automatically invoking `arc_ask_operator` from the package.
- Changing ARC routes, workload classes, worker execution, Implement approval, Verify, Code Review, or Deploy approval.
- Repairing semantic-release or creating a release tag; ARC Pi may pin the merged package commit as it does today.
- Changing the catalog or unrelated ranking weights.

## Immediate next steps

1. Implement and test the canonical `needsOperator` contract.
2. Add deterministic tie/low-confidence generation and semantic-key derivation.
3. Update fixtures, CLI/docs, and run the package test gate.
4. Open the package PR first; after it merges, pin that merge commit in the coordinated ARC Pi PR.
