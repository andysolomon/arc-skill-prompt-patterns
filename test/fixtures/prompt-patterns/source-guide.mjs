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
      confidence: 0.84,
      needsOperator: null
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
      confidence: 0.82,
      needsOperator: null
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
      warnings: [
        "High-assurance acceptance fails closed: resolve the unresolved assumptions that could change the result, and name each unresolved assumption or required operator decision before relying on this result."
      ],
      confidence: 0.73,
      needsOperator: null
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
      confidence: 0.5,
      needsOperator: {
        reasons: ["low-confidence"],
        alternatives: ["boundary", "decomposition", "guardrail", "template-fill", "critique"],
        question: {
          question: "Which prompt pattern should be primary for this task?",
          question_type: "single_select",
          context: {
            reason: "Recommendation confidence is below the package threshold.",
            action: "Select one bounded pattern alternative before continuing."
          },
          options: [
            { label: "boundary", description: "Define what is in scope, out of scope, and how edge cases are handled." },
            { label: "decomposition", description: "Break a complex task into explicit, tractable subtasks." },
            { label: "guardrail", description: "State safety, scope, and refusal constraints that bound the response." },
            { label: "template-fill", description: "Populate a stable instruction or output template with task-specific values." },
            { label: "critique", description: "Review a draft or proposed answer against stated criteria and revise it." }
          ],
          recommendation: "boundary",
          blocking: true,
          semantic_key: "prompt-pattern-selection:v1:417bebbb48c68fa43be2e18fa9caa9995f7ed99ad6ed7bb9ffcabd021d7b4bbc"
        }
      }
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
      confidence: 0.74,
      needsOperator: null
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
      confidence: 0.51,
      needsOperator: {
        reasons: ["low-confidence"],
        alternatives: ["hypothesis-test", "decomposition", "boundary", "guardrail", "evidence-grounding"],
        question: {
          question: "Which prompt pattern should be primary for this task?",
          question_type: "single_select",
          context: {
            reason: "Recommendation confidence is below the package threshold.",
            action: "Select one bounded pattern alternative before continuing."
          },
          options: [
            { label: "hypothesis-test", description: "Generate testable hypotheses and identify observations that could confirm or refute them." },
            { label: "decomposition", description: "Break a complex task into explicit, tractable subtasks." },
            { label: "boundary", description: "Define what is in scope, out of scope, and how edge cases are handled." },
            { label: "guardrail", description: "State safety, scope, and refusal constraints that bound the response." },
            { label: "evidence-grounding", description: "Tie claims to supplied evidence and distinguish support from uncertainty." }
          ],
          recommendation: "hypothesis-test",
          blocking: true,
          semantic_key: "prompt-pattern-selection:v1:fc305bc1bff236a2a087befd29919b8f14ad468bccecb180b312061dcd34cb55"
        }
      }
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
      confidence: 0.86,
      needsOperator: null
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
        "Critical risk requires independent review and explicit checks outside this descriptive recommendation.",
        "High-assurance acceptance fails closed: resolve the unresolved assumptions that could change the result, and name each unresolved assumption or required operator decision before relying on this result."
      ],
      confidence: 0.61,
      needsOperator: null
    }
  },
  {
    id: "source-guide-exact-tie",
    category: "source-guide",
    input: {
      taskType: "coding",
      arcPhase: "implement",
      reliabilityTier: "standard",
      risk: "low",
      target: { mode: "automatic" },
      outputShape: "text",
      ambiguity: "none",
      budget: {}
    },
    expected: {
      primaryPattern: "template-fill",
      overlays: ["decomposition", "critique", "boundary"],
      warnings: [],
      confidence: 0.87,
      needsOperator: {
        reasons: ["tie"],
        alternatives: ["template-fill", "decomposition", "critique", "boundary", "audience-adaptation"],
        question: {
          question: "Which prompt pattern should be primary for this task?",
          question_type: "single_select",
          context: {
            reason: "The top recommendation score is tied.",
            action: "Select one bounded pattern alternative before continuing."
          },
          options: [
            { label: "template-fill", description: "Populate a stable instruction or output template with task-specific values." },
            { label: "decomposition", description: "Break a complex task into explicit, tractable subtasks." },
            { label: "critique", description: "Review a draft or proposed answer against stated criteria and revise it." },
            { label: "boundary", description: "Define what is in scope, out of scope, and how edge cases are handled." },
            { label: "audience-adaptation", description: "Adjust wording, depth, and format for the intended audience." }
          ],
          recommendation: "template-fill",
          blocking: true,
          semantic_key: "prompt-pattern-selection:v1:7c291632d5ce8a6f542d774f7034c8e670443f649d9108236044a80e363133f0"
        }
      }
    }
  },
  {
    id: "source-guide-tie-and-low-confidence",
    category: "source-guide",
    input: {
      taskType: "extraction",
      arcPhase: "explore",
      reliabilityTier: "exploratory",
      risk: "critical",
      target: { mode: "automatic" },
      outputShape: "structured",
      ambiguity: "high",
      budget: {}
    },
    expected: {
      primaryPattern: "template-fill",
      overlays: ["boundary", "hypothesis-test", "guardrail"],
      warnings: [
        "High ambiguity lowers confidence; resolve outcome-changing assumptions before relying on the result.",
        "Critical risk requires independent review and explicit checks outside this descriptive recommendation."
      ],
      confidence: 0.54,
      needsOperator: {
        reasons: ["tie", "low-confidence"],
        alternatives: ["template-fill", "boundary", "hypothesis-test", "guardrail", "few-shot"],
        question: {
          question: "Which prompt pattern should be primary for this task?",
          question_type: "single_select",
          context: {
            reason: "The top score is tied and recommendation confidence is below the package threshold.",
            action: "Select one bounded pattern alternative before continuing."
          },
          options: [
            { label: "template-fill", description: "Populate a stable instruction or output template with task-specific values." },
            { label: "boundary", description: "Define what is in scope, out of scope, and how edge cases are handled." },
            { label: "hypothesis-test", description: "Generate testable hypotheses and identify observations that could confirm or refute them." },
            { label: "guardrail", description: "State safety, scope, and refusal constraints that bound the response." },
            { label: "few-shot", description: "Illustrate the intended behavior with representative input and output examples." }
          ],
          recommendation: "template-fill",
          blocking: true,
          semantic_key: "prompt-pattern-selection:v1:4884d8dee644ab1fc7eadc3d569ec83c95bf64762193fc199d90b54d509633c8"
        }
      }
    }
  }
];
