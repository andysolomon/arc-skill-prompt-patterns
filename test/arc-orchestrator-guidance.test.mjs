import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { recommend } from "../prompt-patterns/index.mjs";

const root = new URL("../", import.meta.url);
const skillPath = new URL("../skills/arc-orchestrator/SKILL.md", import.meta.url);
const promptPath = new URL("../prompts/orchestrate.md", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);

const read = async (url) => readFile(fileURLToPath(url), "utf8");

const requiredSections = [
  "Authority boundary",
  "When to request a recommendation",
  "How to apply",
  "worker contract",
  "Examples",
  "Prohibitions"
];

const requiredFields = [
  "primaryPattern",
  "overlays",
  "promptFragments",
  "lifecycleGuidance",
  "warnings",
  "rationale",
  "confidence"
];

const exampleMarkers = [
  "Implementation",
  "Debugging",
  "Research",
  "High-assurance"
];

const harmfulDeliberationInstructions = [
  /workers should expose/i,
  /include (?:your|their) chain-of-thought/i,
  /show (?:your|their) (?:reasoning|deliberation)/i,
  /visible[- ]chain[- ]of[- ]thought/i
];

const executionNeutralDenials = [
  /never select routes/i,
  /never select routes, workloads/i,
  /do not treat recommendations as route/i,
  /remain authoritative/i
];

test("package ships orchestration guidance files", async () => {
  const packageJson = JSON.parse(await read(packagePath));
  const skill = await read(skillPath);
  const prompt = await read(promptPath);

  assert.match(skill, /^---\nname: arc-orchestrator\n/);
  assert.match(prompt, /^---\ndescription:/);
  assert.equal(packageJson.files.includes("skills"), true);
  assert.equal(packageJson.files.includes("prompts"), true);
});

test("skill documents Analyze-time recommendation flow and contract conversion", async () => {
  const skill = await read(skillPath);

  for (const section of requiredSections) {
    assert.match(skill, new RegExp(section, "i"), section);
  }
  for (const field of requiredFields) {
    assert.match(skill, new RegExp(`\`${field}\``, "i"), field);
  }
  for (const marker of exampleMarkers) {
    assert.match(skill, new RegExp(marker, "i"), marker);
  }

  assert.match(skill, /local \*\*Analyze\*\*/i);
  assert.match(skill, /read-only/i);
  assert.match(skill, /arc-prompt recommend/i);
  assert.match(skill, /`arc_delegate`/);
  assert.match(skill, /`outcome`/);
  assert.match(skill, /`verification`/);
  assert.match(skill, /`implement_authorized: true`/);
});

test("prompt mirrors integration guidance for orchestration parents", async () => {
  const prompt = await read(promptPath);

  assert.match(prompt, /\$ARGUMENTS/);
  assert.match(prompt, /Analyze only/i);
  assert.match(prompt, /read-only/i);
  assert.match(prompt, /primaryPattern/);
  assert.match(prompt, /worker contract/i);
  for (const marker of exampleMarkers) {
    assert.match(prompt, new RegExp(marker, "i"), marker);
  }
});

test("prompt carries concrete worker-contract safety prohibitions", async () => {
  const prompt = await read(promptPath);

  assert.match(prompt, /Worker `prohibitions`/);
  assert.match(prompt, /no scope expansion/i);
  assert.match(prompt, /no commit or push unless explicitly authorized by the governing workflow/i);
  assert.match(prompt, /no exposed internal deliberation/i);
});

test("guidance replaces deliberation exposure with evidence and verification", async () => {
  const sources = await Promise.all([read(skillPath), read(promptPath)]);
  const combined = sources.join("\n");

  assert.match(combined, /concise rationale/i);
  assert.match(combined, /cited evidence/i);
  assert.match(combined, /verification artifacts/i);
  assert.match(combined, /never paste hidden reasoning/i);
  assert.match(combined, /never ask workers to expose/i);
  for (const pattern of harmfulDeliberationInstructions) {
    assert.doesNotMatch(combined, pattern);
  }
});

test("guidance keeps recommendations execution-neutral", async () => {
  const sources = await Promise.all([read(skillPath), read(promptPath)]);
  const combined = sources.join("\n");

  for (const pattern of executionNeutralDenials) {
    assert.match(combined, pattern);
  }

  assert.match(combined, /Decision Ledger/i);
  assert.match(combined, /workload classification/i);
  assert.match(combined, /Implement authorization/i);
  assert.match(combined, /Deploy authorization/i);
  assert.doesNotMatch(combined, /recommend\(\)\s+(?:grants?|sets?|requires?)\s+authorization/i);
  assert.doesNotMatch(combined, /set `route`/i);
  assert.doesNotMatch(combined, /workers must select routes/i);
});

const documentedHighAssuranceInput = {
  taskType: "coding",
  arcPhase: "analyze",
  reliabilityTier: "high-assurance",
  risk: "critical",
  target: { mode: "automatic" },
  outputShape: "code",
  ambiguity: "low",
  budget: { maxTokens: 4096 }
};

test("documented high-assurance recommendation matches recommender output", () => {
  const output = recommend(documentedHighAssuranceInput);

  assert.equal(output.primaryPattern, "decomposition");
  assert.deepEqual(output.overlays, ["critique", "guardrail", "boundary"]);
  assert.equal(output.confidence, 0.75);
});

test("examples document Analyze-time inputs with later delegation phases", async () => {
  const skill = await read(skillPath);
  const prompt = await read(promptPath);
  const combined = `${skill}\n${prompt}`;

  assert.match(combined, /arcPhase: "analyze"/);
  assert.match(combined, /delegate with `phase: implement`/i);
  assert.match(combined, /delegate with `phase: research`/i);
  assert.doesNotMatch(skill, /arcPhase: "implement"/);
  assert.doesNotMatch(skill, /arcPhase: "research"/);

  const implementation = recommend({
    taskType: "coding",
    arcPhase: "analyze",
    reliabilityTier: "standard",
    risk: "medium",
    target: { mode: "automatic" },
    outputShape: "code",
    ambiguity: "low",
    budget: {}
  });
  assert.equal(implementation.primaryPattern, "decomposition");
  assert.equal(implementation.overlays.includes("critique"), true);
  assert.equal(implementation.overlays.includes("boundary"), true);

  const research = recommend({
    taskType: "research",
    arcPhase: "analyze",
    reliabilityTier: "standard",
    risk: "low",
    target: { mode: "automatic" },
    outputShape: "structured",
    ambiguity: "medium",
    budget: {}
  });
  assert.equal(research.primaryPattern, "evidence-grounding");
  assert.equal(research.overlays.includes("boundary"), true);
});
