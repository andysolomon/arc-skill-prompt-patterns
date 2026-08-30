const deepFreeze = (value, seen = new WeakSet()) => {
  if (value === null || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze(value[key], seen);
  }
  return Object.freeze(value);
};

const catalog = [
  {
    id: "template-fill",
    name: "Template fill",
    description: "Populate a stable instruction or output template with task-specific values."
  },
  {
    id: "few-shot",
    name: "Few-shot",
    description: "Illustrate the intended behavior with representative input and output examples."
  },
  {
    id: "decomposition",
    name: "Decomposition",
    description: "Break a complex task into explicit, tractable subtasks."
  },
  {
    id: "critique",
    name: "Critique",
    description: "Review a draft or proposed answer against stated criteria and revise it."
  },
  {
    id: "guardrail",
    name: "Guardrail",
    description: "State safety, scope, and refusal constraints that bound the response."
  },
  {
    id: "boundary",
    name: "Boundary",
    description: "Define what is in scope, out of scope, and how edge cases are handled."
  },
  {
    id: "audience-adaptation",
    name: "Audience adaptation",
    description: "Adjust wording, depth, and format for the intended audience."
  },
  {
    id: "meta-prompt",
    name: "Meta-prompt",
    description: "Describe a reusable procedure for constructing or evaluating a prompt."
  },
  {
    id: "evidence-grounding",
    name: "Evidence grounding",
    description: "Tie claims to supplied evidence and distinguish support from uncertainty."
  },
  {
    id: "hypothesis-test",
    name: "Hypothesis test",
    description: "Generate testable hypotheses and identify observations that could confirm or refute them."
  }
];

export const PATTERN_CATALOG = deepFreeze(catalog);
export const PATTERN_IDS = Object.freeze(PATTERN_CATALOG.map(({ id }) => id));

const catalogById = Object.create(null);
for (const pattern of PATTERN_CATALOG) {
  catalogById[pattern.id] = pattern;
}

export const PATTERN_CATALOG_BY_ID = deepFreeze(catalogById);

export const CATALOG = PATTERN_CATALOG;
export const CATALOG_IDS = PATTERN_IDS;

export function isPatternId(value) {
  return typeof value === "string" && PATTERN_IDS.includes(value);
}
