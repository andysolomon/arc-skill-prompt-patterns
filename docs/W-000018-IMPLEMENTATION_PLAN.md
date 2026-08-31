## Implementation Plan

**Story:** [W-000018] Expose recommendations through an arc-prompt CLI
**Branch:** `feat/W-000018-expose-recommendations-through-an-arc-prompt-cli`

### Product goal and scope boundaries

Expose the pure recommendation library through a stable `arc-prompt recommend` executable for operators and scripts outside Pi. The command parses inputs, calls `recommend`, and renders the same canonical result as JSON or deterministic human-readable text. It is an explainer/selector only: it must not import `arc-orchestrator`, launch workers, select routes or workload classes, grant authorization, access providers, or mutate project files.

### Current baseline

- `package.json` is an ESM package with an exports map for `prompt-patterns/index.mjs`, a Node >=20 engine, and a built-in `npm test` script.
- `prompt-patterns/index.mjs` exports `recommend` and the strict input/output contract constants and validators.
- There is no `bin/` directory, package `bin` mapping, CLI parser, or CLI-specific test.
- `README.md` documents the library API but does not document a command-line interface.

### Missing capabilities

- A dependency-free executable that supports the `recommend` subcommand and all required recommendation dimensions: task type, ARC phase, reliability tier, risk, target mode/model, output shape, ambiguity, and optional budgets.
- Stable JSON and human-readable renderers sharing one recommendation object and consistent error handling.
- Package metadata/docs/tests proving the binary is installable, invalid input fails nonzero, and the CLI remains execution-neutral.

### Milestones / phases

#### Phase 1 — CLI parser and executable

- **Goal:** Build a small ESM command with no runtime dependencies beyond the package library.
- **Deliverables:** `bin/arc-prompt.mjs` registered as `arc-prompt` in `package.json` (and included by the package `files` allowlist if needed). Support `arc-prompt recommend` with documented kebab-case flags for every required input, optional `--max-tokens`/`--max-latency-ms`, explicit target model or mode, and a JSON-input form for scripts. Reject unknown, missing, malformed, and contradictory arguments through the same strict contract validation path.
- **Dependencies:** Existing public `recommend` API and contract enums.
- **Risks:** A CLI that duplicates recommendation logic can drift from the library; construct one canonical input and call `recommend` exactly once per invocation. Keep process exit handling at the boundary so the core runner is importable/testable.
- **Acceptance criteria:** Flag-based and JSON-input examples return successfully for `recommend`; invalid inputs return a nonzero exit code and a concise stderr diagnostic.

#### Phase 2 — Stable output and documentation

- **Goal:** Make output usable by both scripts and operators.
- **Deliverables:** Deterministic `--format json`/`--json` output using the canonical recommendation serialization, plus a stable human-readable renderer that exposes the same primary, overlays, fragments, lifecycle guidance, warnings, rationale, and confidence. Update `README.md` with both invocation forms, target-mode behavior, and the descriptive/no-execution boundary.
- **Dependencies:** Phase 1 parser and output schema.
- **Risks:** Human formatting must not silently omit warnings or confidence; tests should compare both formats for the same fixture and preserve ordering.
- **Acceptance criteria:** The documented JSON and flag examples succeed, and JSON/human invocations have equivalent recommendation semantics.

#### Phase 3 — CLI regression and safety tests

- **Goal:** Verify behavior without changing the repository or invoking ARC.
- **Deliverables:** `test/arc-prompt-cli.test.mjs` covering valid flags, JSON input, JSON/human output parity, stable output snapshots, missing/invalid values, nonzero exits, help/usage, and side-effect guards for child processes, network/provider calls, and filesystem writes. Include a package smoke check for the declared binary target.
- **Dependencies:** Phases 1–2.
- **Risks:** Process-level tests should not confuse the test harness's own Node child with a worker launch; exercise an importable runner with injected argv/stdio for side-effect assertions and add one real executable smoke test.
- **Acceptance criteria:** Invalid-input tests assert a nonzero result, and the CLI imports only local recommendation code while never launching a worker or mutating project files.

### Out-of-scope / deferred

- Any `arc-orchestrator` integration, worker delegation, route/workload selection, Decision Ledger writes, operator authorization, provider calls, network access, or project-file generation.
- A general-purpose command framework, runtime dependencies, live evaluation, or changes to recommendation semantics.
- Merging or auto-merging the PR; this run uses PR-first shipping.

### Immediate next steps

1. Implement the importable CLI runner and executable boundary in `bin/arc-prompt.mjs`.
2. Register/package the binary, add deterministic JSON/human rendering, and document both forms in `README.md`.
3. Add CLI tests, run focused CLI tests and full `npm test`, then inspect the story-scoped diff and package contents.
4. After verification, commit with a Conventional Commit containing `Closes #5` and open the PR; archive the plan/progress files only after merge.
