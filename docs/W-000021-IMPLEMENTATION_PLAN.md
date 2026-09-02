# W-000021 Implementation Plan

## Product goal and scope boundaries

Map the three reliability tiers to deterministic, increasingly strict acceptance guidance in the existing recommendation output: defined output structure, evidence expectations, focused tests, independent Verify, and optional independent Code Review. High-assurance results must fail closed when material uncertainty or missing capability evidence remains by naming unresolved assumptions or required operator decisions.

The change remains descriptive and parent-local. It must not add execution-policy fields, launch workers or Verify, write the Decision Ledger, select routes/workloads/models, grant authorization, or claim fixed accuracy percentages.

## Current baseline

- `prompt-patterns/recommender.mjs` scores reliability tiers and gives high-assurance a generic verification fragment plus Verify lifecycle guidance.
- Ambiguity, critical risk, and unverified explicit model profiles already produce warnings, but the output does not provide a complete tier matrix or high-assurance fail-closed rule.
- `test/prompt-patterns-recommender.test.mjs` covers the full input matrix, determinism, policy-key omission, and representative high-assurance behavior.
- Offline fixtures cover all reliability tiers, while package-owned ARC guidance preserves routing, Decision Ledger, Verify, Code Review, and authorization authority outside the recommender.

## Missing capabilities

- Explicit tier-specific guidance for result structure, evidence, focused checks, Verify, and optional Code Review.
- A deterministic high-assurance warning that identifies unresolved assumptions or missing capability evidence and requires parent/operator resolution before reliance.
- Focused tier-matrix and integration tests proving stronger guidance without execution or authorization side effects.
- Documentation that explains how parents apply each tier while retaining ARC authority.

## Milestones / phases

### Phase 1 — Deterministic reliability guidance

- **Goal:** Encode reliability tiers as descriptive guidance and acceptance requirements using the existing output schema.
- **Deliverables:**
  - Add an immutable tier-guidance table in `prompt-patterns/recommender.mjs`.
  - Emit one budget-resilient tier fragment that differentiates exploratory, standard, and high-assurance structure, evidence, and focused-test expectations.
  - Preserve high-assurance independent Verify lifecycle guidance and add explicit optional independent Code Review wording without triggering either action.
  - Add fail-closed warnings for high-assurance inputs with medium/high ambiguity or missing/unverified explicit model evidence; warnings must identify assumptions or operator decisions to resolve.
- **Dependencies:** Existing strict contract and deterministic output normalization.
- **Risks:** Tight fragment budgets can truncate guidance; insert the tier fragment early. Warning changes may require literal fixture updates. Do not change ranking scores or confidence.
- **Acceptance criteria:** Every supported tier yields distinct, deterministic guidance; high-assurance uncertainty produces an explicit warning and verification requirements while low-ambiguity supported inputs remain usable.

### Phase 2 — Tier matrix, fail-closed, and authority tests

- **Goal:** Prove all issue acceptance criteria with focused and integration coverage.
- **Deliverables:**
  - Extend `test/prompt-patterns-recommender.test.mjs` with a three-tier table asserting structure, evidence, focused tests, Verify, and optional Code Review guidance.
  - Add high-assurance cases for unresolved assumptions and missing/unverified explicit model evidence; assert warnings and verification steps.
  - Strengthen execution-neutral assertions to prove recommendations contain no route, workload, authorization, provider, or execution keys and do not invoke external behavior.
  - Update/add literal cases in `test/fixtures/prompt-patterns/*.mjs` and `test/prompt-patterns-evaluation.test.mjs` only where expected warnings or high-assurance evidence checks change.
- **Dependencies:** Phase 1 output wording.
- **Risks:** Broad snapshots would obscure intent; use named assertions and literal warnings. Keep the 13,440-input validity matrix green.
- **Acceptance criteria:** Focused tests cover all tiers, high-assurance missing-evidence fixtures fail closed, and integration tests prove parent-local/non-authorizing behavior.

### Phase 3 — Parent guidance and shipping verification

- **Goal:** Explain the tier semantics without changing ARC lifecycle authority.
- **Deliverables:**
  - Update `README.md`, `skills/arc-orchestrator/SKILL.md`, and `prompts/orchestrate.md` with a concise reliability-tier matrix.
  - State that recommendations prescribe evidence and acceptance guidance only; ARC owns Decision Ledger decisions, Implement authorization, independent Verify execution, optional Code Review choice, and Deploy authorization.
  - Run focused tests, full `npm test`, `git diff --check`, and scope inspection.
- **Dependencies:** Phases 1–2.
- **Risks:** Wording that sounds executable could weaken authority boundaries; tests must reject such drift.
- **Acceptance criteria:** Documentation and tests agree on tier behavior; all checks pass with no contract/type/CLI authority expansion.

## Acceptance criteria mapping

| Source criterion | Tasks | Verification |
| --- | --- | --- |
| Tiers map to structured output, evidence, focused tests, independent Verify, and optional independent Code Review | Phases 1–3 | Three-tier table test plus ARC guidance tests |
| High-assurance fails closed on uncertainty and identifies assumptions/operator decisions | Phases 1–2 | High-assurance ambiguity and missing-profile fixtures assert warnings and verification steps |
| Recommendations do not launch Verify or alter authorization gates | Phases 1–3 | Execution-neutral integration assertions, unchanged output schema, guidance authority tests |

## Test strategy

- `node --test test/prompt-patterns-recommender.test.mjs`
- `node --test test/prompt-patterns-evaluation.test.mjs`
- `node --test test/arc-orchestrator-guidance.test.mjs`
- `node --test test/prompt-patterns-schema.test.mjs test/arc-prompt-cli.test.mjs`
- `npm test`
- `git diff --check` and issue-scoped diff/status review

## Out-of-scope / deferred

- New public input/output fields or changes to `contract.mjs` / `index.d.ts`.
- Route, workload, model, Decision Ledger, operator-gate, authorization, Verify-launch, Code Review-launch, or Deploy behavior.
- Provider calls, learned scoring, accuracy percentages, new catalog patterns, or unrelated profile changes.

## Immediate next steps

1. Obtain operator approval for this exact implementation scope and the proposed `medium-medium` workload class.
2. Implement the bounded recommender, tests/fixtures, and documentation changes in the W-000021 worktree.
3. Run independent Verify and parent inspection.
4. Commit with `feat: map W-000021 reliability verification guidance` and `Closes #8`, then open a PR and leave the worktree for review (`--ship pr`).
