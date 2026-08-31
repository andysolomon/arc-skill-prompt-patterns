export const SOURCE_GUIDE_FIXTURES = [
  {
    id: "source-guide-extraction",
    category: "source-guide",
    input: {
      taskType: "extraction",
      arcPhase: "analyze",
      reliabilityTier: "exploratory",
      risk: "low",
      target: { mode: "automatic" },
      outputShape: "structured",
      ambiguity: "none",
      budget: {}
    },
    expected: {
      primaryPattern: "template-fill",
      overlays: ["few-shot", "decomposition", "boundary"],
      warnings: [],
      confidence: 0.84
    }
  },
  {
    id: "source-guide-classification",
    category: "source-guide",
    input: {
      taskType: "classification",
      arcPhase: "explore",
      reliabilityTier: "standard",
      risk: "medium",
      target: { mode: "explicit", model: "fable" },
      outputShape: "structured",
      ambiguity: "low",
      budget: {}
    },
    expected: {
      primaryPattern: "few-shot",
      overlays: ["template-fill", "boundary", "hypothesis-test"],
      warnings: [],
      confidence: 0.82
    }
  },
  {
    id: "source-guide-research",
    category: "source-guide",
    input: {
      taskType: "research",
      arcPhase: "research",
      reliabilityTier: "high-assurance",
      risk: "high",
      target: { mode: "automatic" },
      outputShape: "mixed",
      ambiguity: "medium",
      budget: { maxTokens: 4096 }
    },
    expected: {
      primaryPattern: "evidence-grounding",
      overlays: ["boundary", "decomposition", "guardrail"],
      warnings: [],
      confidence: 0.73
    }
  },
  {
    id: "source-guide-planning",
    category: "source-guide",
    input: {
      taskType: "planning",
      arcPhase: "plan",
      reliabilityTier: "standard",
      risk: "critical",
      target: { mode: "explicit", model: "sol" },
      outputShape: "tool-call",
      ambiguity: "high",
      budget: { maxTokens: 512, maxLatencyMs: 1000 }
    },
    expected: {
      primaryPattern: "boundary",
      overlays: ["decomposition"],
      warnings: [
        "High ambiguity lowers confidence; resolve outcome-changing assumptions before relying on the result.",
        "Critical risk requires independent review and explicit checks outside this descriptive recommendation.",
        "The token budget is tight; keep instructions compact and prioritize the primary pattern.",
        "The latency budget is tight; avoid optional iterative prompt passes."
      ],
      confidence: 0.5
    }
  },
  {
    id: "source-guide-coding",
    category: "source-guide",
    input: {
      taskType: "coding",
      arcPhase: "implement",
      reliabilityTier: "standard",
      risk: "low",
      target: { mode: "automatic" },
      outputShape: "code",
      ambiguity: "none",
      budget: { maxTokens: 256, maxLatencyMs: 1000 }
    },
    expected: {
      primaryPattern: "template-fill",
      overlays: ["decomposition"],
      warnings: [
        "The token budget is tight; keep instructions compact and prioritize the primary pattern.",
        "The latency budget is tight; avoid optional iterative prompt passes."
      ],
      confidence: 0.74
    }
  },
  {
    id: "source-guide-debugging",
    category: "source-guide",
    input: {
      taskType: "debugging",
      arcPhase: "analyze",
      reliabilityTier: "exploratory",
      risk: "high",
      target: { mode: "explicit", model: "unlisted-model" },
      outputShape: "text",
      ambiguity: "high",
      budget: {}
    },
    expected: {
      primaryPattern: "hypothesis-test",
      overlays: ["decomposition", "boundary", "guardrail"],
      warnings: [
        "High ambiguity lowers confidence; resolve outcome-changing assumptions before relying on the result.",
        "The model profile is unverified; do not assume structured output, tool use, or reasoning controls."
      ],
      confidence: 0.51
    }
  },
  {
    id: "source-guide-review",
    category: "source-guide",
    input: {
      taskType: "review",
      arcPhase: "verify",
      reliabilityTier: "high-assurance",
      risk: "medium",
      target: { mode: "explicit", model: "sol" },
      outputShape: "structured",
      ambiguity: "low",
      budget: { maxLatencyMs: 10000 }
    },
    expected: {
      primaryPattern: "critique",
      overlays: ["evidence-grounding", "boundary", "template-fill"],
      warnings: [],
      confidence: 0.86
    }
  },
  {
    id: "source-guide-deployment",
    category: "source-guide",
    input: {
      taskType: "deployment",
      arcPhase: "deploy",
      reliabilityTier: "high-assurance",
      risk: "critical",
      target: { mode: "automatic" },
      outputShape: "tool-call",
      ambiguity: "high",
      budget: {}
    },
    expected: {
      primaryPattern: "guardrail",
      overlays: ["boundary", "critique", "template-fill"],
      warnings: [
        "High ambiguity lowers confidence; resolve outcome-changing assumptions before relying on the result.",
        "Critical risk requires independent review and explicit checks outside this descriptive recommendation."
      ],
      confidence: 0.61
    }
  }
];
