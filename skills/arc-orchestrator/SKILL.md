---
name: arc-orchestrator
description: Integrate descriptive prompt-pattern recommendations into ARC Pi orchestration during local Analyze. Use before drafting a bounded worker contract; recommendations do not route, authorize, or execute.
---

# ARC orchestration prompt-pattern guidance

This package-owned skill tells the ARC Pi parent how to request and apply **read-only** prompt-pattern recommendations during local **Analyze**. Recommendations are descriptive parent-local advice only. Workers receive a finalized bounded `arc_delegate` contract and never choose their own pattern or execution policy.

## Authority boundary

ARC phase routing, canonical workload classification, Decision Ledger records, operator clarification and approval gates, Implement authorization, independent Verify, optional Code Review, and separate Deploy authorization remain authoritative in ARC Pi and the orchestrator extension.

`recommend()` and `arc-prompt recommend` never select routes, workloads, models, authorization, or Decision Ledger actions.

## When to request a recommendation

During local Analyze, request a recommendation when:

1. You are about to delegate Explore, Research, Plan, Implement, or Verify work and want consistent prompting language for the worker contract.
2. The task has meaningful ambiguity, reliability, risk, or output-shape constraints that affect how instructions should be framed.
3. You need concise rationale and verification language for the contract—not exposed internal deliberation.

Skip recommendations for trivial local one-liners, operator-only messaging, or when an approved contract is unchanged.

## How to request (read-only)

Use the library or CLI without mutating project state:

```js
import { recommend } from "arc-skill-prompt-patterns";
```

```sh
arc-prompt recommend --format json --input-json '{ ... }'
```

Map the bounded task to the strict input contract:

- `taskType`: extraction, classification, research, planning, coding, debugging, review, deployment
- `arcPhase`: explore, analyze, research, plan, implement, verify, deploy
- `reliabilityTier`: exploratory, standard, high-assurance
- `risk`: low, medium, high, critical
- `target`: `{ mode: "automatic" }` for model-neutral advice, or explicit `model` only for capability notes
- `outputShape`: text, structured, code, tool-call, mixed
- `ambiguity`: none, low, medium, high
- `budget`: optional `maxTokens` and `maxLatencyMs` for compactness warnings

Use `arcPhase: "analyze"` during local Analyze even when the upcoming delegation phase differs.

## How to apply the recommendation

Treat the output as drafting guidance for the worker contract—not executable policy.

| Field | Parent use |
| --- | --- |
| `primaryPattern` | Name the dominant prompting approach in `outcome` and `scope` |
| `overlays` | Add bounded secondary constraints; keep overlays few when budget warnings appear |
| `promptFragments` | Translate `kind` and `text` into instructions, context, format, verification, or constraints |
| `lifecycleGuidance` | Fold phase-specific guidance into `verification` and `preserved_behavior` |
| `warnings` | Carry forward as contract caveats or parent acceptance notes |
| `rationale` | Use as a concise contract preamble; never paste hidden reasoning or chain-of-thought |
| `confidence` | Inform whether to tighten verification or ask the operator before delegating |

**Replace internal deliberation:** Do not ask workers to expose private reasoning, scratch work, or chain-of-thought. Require concise rationale, cited evidence, tests run, and verification artifacts in the worker return contract instead.

## Convert recommendation to worker contract

After Analyze, translate the recommendation into `arc_delegate` fields:

- `outcome`: what done means, informed by the primary pattern and format fragments
- `scope`: bounded files and actions; overlays become explicit exclusions or guardrails
- `preserved_behavior`: unchanged APIs, routing, auth, and tests from lifecycle guidance
- `verification`: commands, assertions, and evidence requirements; prefer `lifecycleGuidance` for verify phase
- `prohibitions`: include no scope expansion, no commit or push unless authorized, no exposed internal deliberation
- `label`: short safe label for tracing

Workers must not re-run `recommend()` or select routes, workload classes, or models. The parent keeps routing, workload class, and authorization.

## Examples

### Implementation (coding, Analyze then implement)

```js
recommend({
  taskType: "coding",
  arcPhase: "analyze",
  reliabilityTier: "standard",
  risk: "medium",
  target: { mode: "automatic" },
  outputShape: "code",
  ambiguity: "low",
  budget: {}
});
```

Request during local Analyze; delegate with `phase: implement`. Apply `decomposition` by scoping ordered subtasks in `outcome`. Add `critique` and `boundary` overlays as self-review and scope guardrails in `verification`. The contract requires code changes only under named paths, tests to run, and a compact summary with file list—no scratch reasoning.

### Debugging (debugging, analyze then implement)

```js
recommend({
  taskType: "debugging",
  arcPhase: "analyze",
  reliabilityTier: "exploratory",
  risk: "medium",
  target: { mode: "automatic" },
  outputShape: "mixed",
  ambiguity: "high",
  budget: {}
});
```

Use `hypothesis-test` framing in `outcome`: reproduce, hypothesize, test narrowly. High-ambiguity warnings become explicit `prohibitions` against speculative refactors. Delegate with `phase: implement` after Analyze. The worker returns hypothesized cause, evidence, fix, and test output—not internal deliberation traces.

### Research (research, Analyze then research)

```js
recommend({
  taskType: "research",
  arcPhase: "analyze",
  reliabilityTier: "standard",
  risk: "low",
  target: { mode: "automatic" },
  outputShape: "structured",
  ambiguity: "medium",
  budget: {}
});
```

Request during local Analyze; delegate with `phase: research`. Use `evidence-grounding` in `outcome`: cite sources and separate facts from inference. `verification` requires structured findings with references, read-only scope, and no file mutations.

### High-assurance work (coding, Analyze then implement)

```js
recommend({
  taskType: "coding",
  arcPhase: "analyze",
  reliabilityTier: "high-assurance",
  risk: "critical",
  target: { mode: "automatic" },
  outputShape: "code",
  ambiguity: "low",
  budget: { maxTokens: 4096 }
});
```

Request during local Analyze; delegate with `phase: implement`. Expect primary `decomposition` with overlays `critique`, `guardrail`, and `boundary`. Expand `verification` with the full test suite, static checks, and explicit preserved-behavior bullets. Lower `confidence` should trigger operator review of the contract before `implement_authorized: true`.

## Prohibitions

- Do not treat recommendations as route, workload, model, authorization, or Decision Ledger instructions.
- Do not ask workers to expose chain-of-thought, hidden reasoning, or private deliberation.
- Do not let workers invoke `recommend()` or choose execution policy.
- Do not use recommendations to bypass Implement or Deploy approval gates.
