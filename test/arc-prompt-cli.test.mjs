import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseRecommendArgs,
  renderHuman,
  renderJson,
  runCli,
  USAGE
} from "../bin/arc-prompt.mjs";
import { recommend } from "../prompt-patterns/index.mjs";

const root = new URL("../", import.meta.url);
const executable = new URL("../bin/arc-prompt.mjs", import.meta.url);
const executablePath = fileURLToPath(executable);

const fixture = {
  taskType: "debugging",
  arcPhase: "verify",
  reliabilityTier: "high-assurance",
  risk: "high",
  target: { mode: "explicit", model: "sol" },
  outputShape: "structured",
  ambiguity: "high",
  budget: { maxTokens: 4096, maxLatencyMs: 10000 }
};

const flagArgs = [
  "--task-type", fixture.taskType,
  "--arc-phase", fixture.arcPhase,
  "--reliability-tier", fixture.reliabilityTier,
  "--risk", fixture.risk,
  "--target-mode", fixture.target.mode,
  "--target-model", fixture.target.model,
  "--output-shape", fixture.outputShape,
  "--ambiguity", fixture.ambiguity,
  "--max-tokens", String(fixture.budget.maxTokens),
  "--max-latency-ms", String(fixture.budget.maxLatencyMs)
];

const invoke = (args) => {
  let stdout = "";
  let stderr = "";
  const status = runCli(args, {
    writeOut: (text) => { stdout += text; },
    writeError: (text) => { stderr += text; }
  });
  return { status, stdout, stderr };
};

const withFlagValue = (args, flag, value) => {
  const replaced = [...args];
  replaced[replaced.indexOf(flag) + 1] = value;
  return replaced;
};

const fileState = async (directory = root, prefix = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const state = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      state.push(...await fileState(path, `${relative}/`));
    } else {
      const metadata = await stat(path);
      state.push([relative, metadata.size, metadata.mtimeMs]);
    }
  }
  return state;
};

test("parses flags and JSON input into the same canonical recommendation", () => {
  const flags = parseRecommendArgs([...flagArgs, "--format=json"]);
  const json = parseRecommendArgs(["--input-json", JSON.stringify(fixture), "--json"]);

  assert.deepEqual(flags.input, fixture);
  assert.deepEqual(json.input, fixture);
  assert.equal(flags.format, "json");
  assert.equal(json.format, "json");
  assert.deepEqual(recommend(flags.input), recommend(json.input));
});

test("renders deterministic JSON and human output with recommendation parity", () => {
  const expected = recommend(fixture);
  const json = invoke(["recommend", ...flagArgs, "--format", "json"]);
  const human = invoke(["recommend", "--input-json", JSON.stringify(fixture)]);

  assert.equal(json.status, 0);
  assert.equal(human.status, 0);
  assert.equal(json.stderr, "");
  assert.equal(human.stderr, "");
  assert.deepEqual(JSON.parse(json.stdout), expected);
  assert.equal(json.stdout, renderJson(expected));
  assert.equal(human.stdout, renderHuman(expected));
  assert.match(human.stdout, /^Primary pattern: hypothesis-test$/m);
  assert.match(human.stdout, /^Overlays:\n  - /m);
  assert.match(human.stdout, /^Prompt fragments:\n  - \[instruction\] /m);
  assert.match(human.stdout, /^Lifecycle guidance:\n  - \[verify\] /m);
  assert.match(human.stdout, /^Warnings:\n  - /m);
  assert.match(human.stdout, new RegExp(`^Rationale: ${expected.rationale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  assert.match(human.stdout, new RegExp(`^Confidence: ${expected.confidence}$`, "m"));
});

test("has stable human formatting for empty lists", () => {
  const output = recommend({
    taskType: "extraction",
    arcPhase: "implement",
    reliabilityTier: "standard",
    risk: "low",
    target: { mode: "automatic" },
    outputShape: "text",
    ambiguity: "none",
    budget: {}
  });
  const rendered = renderHuman(output);

  assert.match(rendered, /^Warnings:\n  \(none\)$/m);
  assert.equal(rendered.endsWith("\n"), true);
  assert.equal(rendered, renderHuman(output));
});

test("rejects missing, malformed, unknown, duplicate, and contradictory input", () => {
  const cases = [
    { args: ["recommend", "--task-type", "research"], message: "Required field is missing" },
    { args: ["recommend", "--input-json", "{"], message: "invalid JSON" },
    { args: ["recommend", ...flagArgs, "--unknown", "value"], message: "Unknown option" },
    { args: ["recommend", ...flagArgs, "--risk", "low"], message: "may only be provided once" },
    { args: ["recommend", ...flagArgs, "--format", "yaml"], message: "human or json" },
    { args: ["recommend", ...withFlagValue(flagArgs, "--max-tokens", "1.5")], message: "decimal integer" },
    { args: ["recommend", ...withFlagValue(flagArgs, "--risk", "unsafe")], message: "allowed enum" },
    { args: ["recommend", "--input-json", JSON.stringify(fixture), "--risk", "low"], message: "cannot be combined" },
    { args: ["recommend", ...flagArgs, "--json", "--format", "human"], message: "cannot be combined" },
    { args: ["unknown"], message: "Unknown command" }
  ];

  for (const { args, message } of cases) {
    const result = invoke(args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "");
    assert.match(result.stderr, new RegExp(message));
    assert.match(result.stderr, /recommend --help/);
  }
});

test("prints help and usage successfully", () => {
  for (const args of [[], ["--help"], ["recommend", "--help"]]) {
    const result = invoke(args);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, `${USAGE}\n`);
    assert.match(result.stdout, /--input-json/);
    assert.match(result.stdout, /--max-latency-ms/);
  }
});

test("executable boundary returns process-level success and failure statuses", (context) => {
  const success = spawnSync(process.execPath, [executablePath, "recommend", ...flagArgs, "--json"], {
    encoding: "utf8"
  });
  if (success.error?.code === "EPERM") {
    context.skip("process spawning is blocked by the test sandbox");
    return;
  }
  const failure = spawnSync(process.execPath, [executablePath, "recommend", "--input-json", "null"], {
    encoding: "utf8"
  });

  assert.ifError(success.error);
  assert.equal(success.status, 0);
  assert.deepEqual(JSON.parse(success.stdout), recommend(fixture));
  assert.equal(success.stderr, "");
  assert.ifError(failure.error);
  assert.equal(failure.status, 2);
  assert.equal(failure.stdout, "");
  assert.match(failure.stderr, /Expected a plain object/);
});

test("package declares and includes the executable binary", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const metadata = await stat(executable);

  assert.equal(packageJson.bin["arc-prompt"], "./bin/arc-prompt.mjs");
  assert.equal(packageJson.files.includes("bin"), true);
  assert.notEqual(metadata.mode & 0o111, 0);
});

test("importable runner is execution-neutral and does not mutate project files", async () => {
  const source = await readFile(executable, "utf8");
  const before = await fileState();
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = () => {
    networkCalls += 1;
    throw new Error("network access is forbidden");
  };

  try {
    const result = invoke(["recommend", ...flagArgs, "--json"]);
    assert.equal(result.status, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(networkCalls, 0);
  assert.deepEqual(await fileState(), before);
  assert.doesNotMatch(source, /node:(?:child_process|fs|http|https|net|tls|worker_threads)/);
  assert.doesNotMatch(source, /arc-orchestrator|provider|authorization|workload|route/i);
});
