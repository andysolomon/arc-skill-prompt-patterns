export const ARC_LIFECYCLE_FIXTURES = [
  {
    id: "arc-lifecycle-research",
    category: "arc-lifecycle",
    input: {
      taskType: "research",
      arcPhase: "research",
      reliabilityTier: "exploratory",
      risk: "medium",
      target: { mode: "automatic" },
      outputShape: "text",
      ambiguity: "medium",
      budget: {}
    },
    expected: {
      primaryPattern: "evidence-grounding",
      overlays: ["hypothesis-test", "boundary", "decomposition"],
      warnings: [],
      confidence: 0.7,
      needsOperator: null
    }
  },
  {
    id: "arc-lifecycle-planning",
    category: "arc-lifecycle",
    input: {
      taskType: "planning",
      arcPhase: "plan",
      reliabilityTier: "standard",
      risk: "high",
      target: { mode: "explicit", model: "fable" },
      outputShape: "structured",
      ambiguity: "low",
      budget: { maxTokens: 4096 }
    },
    expected: {
      primaryPattern: "decomposition",
      overlays: ["boundary", "template-fill", "critique"],
      warnings: [],
      confidence: 0.78,
      needsOperator: null
    }
  },
  {
    id: "arc-lifecycle-implementation",
    category: "arc-lifecycle",
    input: {
      taskType: "coding",
      arcPhase: "implement",
      reliabilityTier: "high-assurance",
      risk: "high",
      target: { mode: "explicit", model: "sol" },
      outputShape: "code",
      ambiguity: "low",
      budget: { maxTokens: 512 }
    },
    expected: {
      primaryPattern: "decomposition",
      overlays: ["template-fill", "critique"],
      warnings: [
        "The token budget is tight; keep instructions compact and prioritize the primary pattern."
      ],
      confidence: 0.78,
      needsOperator: null
    }
  },
  {
    id: "arc-lifecycle-debugging",
    category: "arc-lifecycle",
    input: {
      taskType: "debugging",
      arcPhase: "analyze",
      reliabilityTier: "exploratory",
      risk: "medium",
      target: { mode: "explicit", model: "grok" },
      outputShape: "mixed",
      ambiguity: "high",
      budget: { maxLatencyMs: 1000 }
    },
    expected: {
      primaryPattern: "hypothesis-test",
      overlays: ["decomposition"],
      warnings: [
        "High ambiguity lowers confidence; resolve outcome-changing assumptions before relying on the result.",
        "The latency budget is tight; avoid optional iterative prompt passes."
      ],
      confidence: 0.6,
      needsOperator: null
    }
  },
  {
    id: "arc-lifecycle-verification",
    category: "arc-lifecycle",
    input: {
      taskType: "review",
      arcPhase: "verify",
      reliabilityTier: "high-assurance",
      risk: "critical",
      target: { mode: "automatic" },
      outputShape: "structured",
      ambiguity: "medium",
      budget: { maxTokens: 4096 }
    },
    expected: {
      primaryPattern: "critique",
      overlays: ["boundary", "guardrail", "evidence-grounding"],
      warnings: [
        "Critical risk requires independent review and explicit checks outside this descriptive recommendation.",
        "High-assurance acceptance fails closed: resolve the unresolved assumptions that could change the result, and name each unresolved assumption or required operator decision before relying on this result."
      ],
      confidence: 0.68,
      needsOperator: null
    }
  },
  {
    id: "arc-lifecycle-deployment",
    category: "arc-lifecycle",
    input: {
      taskType: "deployment",
      arcPhase: "deploy",
      reliabilityTier: "standard",
      risk: "high",
      target: { mode: "explicit", model: "unlisted-model" },
      outputShape: "tool-call",
      ambiguity: "none",
      budget: {}
    },
    expected: {
      primaryPattern: "guardrail",
      overlays: ["boundary", "template-fill", "critique"],
      warnings: [
        "The model profile is unverified; do not assume structured output, tool use, or reasoning controls."
      ],
      confidence: 0.72,
      needsOperator: null
    }
  }
];
