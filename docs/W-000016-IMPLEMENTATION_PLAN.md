## Implementation Plan

**Story:** [W-000016] Implement the deterministic prompt-pattern recommendation engine
**Branch:** `feat/W-000016-implement-the-deterministic-prompt-pattern`

### Product goal and scope boundaries

Add a dependency-free, pure `recommend(input)` library API that selects a prompt-pattern primary, compatible overlays, prompt fragments, lifecycle guidance, warnings, rationale, and confidence from the existing contract. The recommendation is descriptive only: ARC Pi continues to own worker routing, workload selection, authorization, and execution.

### Current baseline

- `prompt-patterns/catalog.mjs` provides the frozen ten-pattern catalog and stable catalog order.
- `prompt-patterns/contract.mjs` provides strict input/output schemas, normalization, bounds, and immutable copies.
- `prompt-patterns/profiles.mjs` provides capability-only model profiles and conservative unknown-model fallback.
- `prompt-patterns/index.mjs` and `index.d.ts` are the public runtime/type barrels.
- Existing Node test files cover catalog/contract/profile behavior; no selector exists yet.

### Missing capabilities

- Deterministic rule evaluation across task type, ARC phase, reliability, risk, output shape, ambiguity, and budget.
- Capability-aware but execution-neutral model adjustment.
- Validated, bounded, immutable recommendation output with stable tie-breaking.
- Matrix, determinism, input-isolation, automatic-mode, and execution-policy regression coverage.
- Public documentation and TypeScript declaration for `recommend`.

### Milestones / phases

#### Phase 1 — Recommendation engine foundation

- **Goal:** Implement one pure, dependency-free rule engine over the existing catalog, contract, and profiles.
- **Deliverables:** `prompt-patterns/recommender.mjs` with normalized input handling, frozen rule/content tables, deterministic catalog-order tie-breaking, primary/overlay selection, fragments, lifecycle guidance, warnings, rationale, and confidence.
- **Dependencies:** Existing catalog, contract, and profile APIs; no filesystem, process, provider, network, or UI access.
- **Risks:** Overfitting undocumented examples or leaking execution policy into descriptive output. Keep all scoring and text static, bounded, and output-schema-only.
- **Acceptance criteria:** `recommend(input)` returns a valid output for every supported input combination, preserves the input, and returns no route/workload/authorization or other execution fields.

#### Phase 2 — Public API and type surface

- **Goal:** Make the recommender consumable through the package entry point.
- **Deliverables:** Export `recommend` from `prompt-patterns/index.mjs`; add its TypeScript declaration to `prompt-patterns/index.d.ts`; update `README.md` to document inputs, deterministic behavior, automatic-mode neutrality, and the descriptive boundary.
- **Dependencies:** Phase 1 API and output shape.
- **Risks:** Breaking the established exact export/type conventions or implying that a model profile selects a worker. Preserve existing exports and terminology.
- **Acceptance criteria:** Runtime and declaration surfaces expose the same public recommendation API, and docs no longer claim that no selector implementation exists.

#### Phase 3 — Verification matrix and regression tests

- **Goal:** Demonstrate coverage and immutability without environmental dependencies.
- **Deliverables:** `test/prompt-patterns-recommender.test.mjs` covering all task types and ARC phases, reliability/risk/output/ambiguity combinations, budgets, supported/unknown model aliases, automatic and explicit targets, deterministic repeated/deep-cloned inputs, frozen outputs, valid contract normalization, and prohibited execution keys. Update legacy assertions that intentionally expect `recommend` to be absent.
- **Dependencies:** Phases 1–2.
- **Risks:** Tests that only check shape could miss rule coverage; include representative expected pattern decisions plus Cartesian validity and policy-boundary assertions.
- **Acceptance criteria:** `npm test` passes; repeated identical calls are byte-equivalent after JSON serialization; automatic mode remains cross-model-compatible and never emits route, workload, or authorization data.

### Out-of-scope / deferred

- Selecting an ARC runner, route, workload class, authorization state, provider, or execution mode.
- Calling providers, tools, filesystem, process state, network, UI, or external configuration.
- Adding new catalog patterns, changing the input/output contract, or expanding model-profile capabilities.
- Probabilistic ranking, learned recommendations, user-specific personalization, or accuracy guarantees.

### Immediate next steps

1. Implement `recommender.mjs` against normalized contract values and profile capabilities.
2. Export and type the API, then update the README and legacy policy assertions.
3. Add the recommendation matrix and determinism tests; run `npm test` and inspect the final diff.
4. After acceptance, commit the issue-scoped files with a Conventional Commit containing `Closes #3`, open the PR, and leave the worktree for review.
