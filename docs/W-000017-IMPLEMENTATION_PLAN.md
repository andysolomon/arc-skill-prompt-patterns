## Implementation Plan

**Story:** [W-000017] Add offline prompt-pattern evaluation fixtures
**Branch:** `feat/W-000017-add-offline-prompt-pattern-evaluation-fixtures`

### Product goal and scope boundaries

Add a checked-in, deterministic regression corpus for `recommend(input)`. The corpus must make recommendation drift visible without provider credentials, network access, model calls, or ARC worker execution. This story owns fixture data, fixture-index validation, and the offline evaluation test; it does not change recommendation rules, contract semantics, model profiles, routing, or authorization.

### Current baseline

- `prompt-patterns/recommender.mjs` exposes a pure deterministic recommender over the existing catalog and strict contract.
- `prompt-patterns/index.mjs` exports `recommend`, contract validators, enums, and model-profile helpers.
- The repository uses Node's built-in test runner through `npm test` and has no fixture-driven evaluation corpus.
- The source contract enumerates extraction, classification, research, planning, coding, debugging, review, and deployment task types, plus the ARC lifecycle phases.

### Missing capabilities

- Static expected recommendation cases organized into source-guide task coverage and ARC lifecycle coverage.
- An index validator that rejects duplicate or malformed fixtures and proves coverage of required categories, reliability tiers, and automatic/explicit target modes.
- A standalone evaluation test that compares expected primary pattern, overlays, warnings, and confidence against fresh recommendations and proves the evaluation remains offline and side-effect free.

### Milestones / phases

#### Phase 1 — Fixture corpus and index

- **Goal:** Define reviewable, static fixture cases with clear category ownership.
- **Deliverables:** `test/fixtures/prompt-patterns/source-guide.mjs`, `test/fixtures/prompt-patterns/arc-lifecycle.mjs`, and `test/fixtures/prompt-patterns/index.mjs` (or an equivalent split that preserves these category names and a single public index). Every fixture contains a stable ID, category, strict recommendation input, and literal expected fields; expected values must not be computed from `recommend` at load time.
- **Dependencies:** Existing contract enums, catalog IDs, model-profile bindings, and recommender output.
- **Risks:** A corpus that only checks shape can miss selection drift; use representative expected values and include all source task types plus ARC-specific research, planning, implementation, debugging, verification, and deployment cases.
- **Acceptance criteria:** The index validates unique fixture IDs, valid inputs, expected pattern IDs, unique overlays, warning/confidence shapes, and required category coverage. Cases collectively cover exploratory, standard, and high-assurance reliability and both automatic and explicit target-model modes.

#### Phase 2 — Offline evaluation test

- **Goal:** Turn the corpus into a deterministic regression gate.
- **Deliverables:** `test/prompt-patterns-evaluation.test.mjs` loading only the local fixture index and package library. It validates the index, evaluates every fixture, and compares primary pattern, overlays, warnings, and confidence (with stable diagnostics that identify the fixture on drift).
- **Dependencies:** Phase 1 fixture exports and the public recommender API.
- **Risks:** Assertions must remain independent of provider behavior; do not replace literal expected values with snapshots generated during the test run.
- **Acceptance criteria:** `node --test test/prompt-patterns-evaluation.test.mjs` passes with provider credentials unavailable, exercises all fixtures, and reports deterministic mismatches rather than silently updating expectations.

#### Phase 3 — Side-effect and matrix evidence

- **Goal:** Demonstrate that evaluation is offline and execution-neutral.
- **Deliverables:** Focused tests in the evaluation file that guard child-process, network, and filesystem-write surfaces (or statically verify the imported implementation has no such dependencies), and that assert no execution-policy fields appear in recommendations.
- **Dependencies:** Phases 1–2.
- **Risks:** The test harness itself may use process APIs to launch Node; scope the spy to the recommender/evaluation path and distinguish test-runner setup from library behavior.
- **Acceptance criteria:** The evaluation invokes no worker, provider, network, or project-file mutation path and does not make unsupported accuracy claims.

### Out-of-scope / deferred

- Changes to `prompt-patterns/recommender.mjs`, the input/output contract, catalog, profiles, or public routing policy.
- Live model evaluations, accuracy percentages, token spending, network calls, provider credentials, ARC Pi integration, or CLI work from W-000018.
- A new runtime dependency or a generated fixture format that recomputes expectations from the implementation under test.

### Immediate next steps

1. Add the source-guide and ARC lifecycle fixture modules with literal expected results.
2. Add the public fixture index and strict coverage/shape validation.
3. Add `test/prompt-patterns-evaluation.test.mjs`, run the focused command and full `npm test`, then inspect the story-scoped diff.
4. After verification, commit with a Conventional Commit containing `Closes #4` and open the PR; archive the plan/progress files only after merge.
