#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { recommend } from "../prompt-patterns/index.mjs";

const VALUE_FLAGS = Object.freeze({
  "--task-type": ["taskType"],
  "--arc-phase": ["arcPhase"],
  "--reliability-tier": ["reliabilityTier"],
  "--risk": ["risk"],
  "--target-mode": ["target", "mode"],
  "--target-model": ["target", "model"],
  "--output-shape": ["outputShape"],
  "--ambiguity": ["ambiguity"],
  "--max-tokens": ["budget", "maxTokens"],
  "--max-latency-ms": ["budget", "maxLatencyMs"]
});

const INPUT_FLAGS = new Set(Object.keys(VALUE_FLAGS));
const INTEGER_FLAGS = new Set(["--max-tokens", "--max-latency-ms"]);
const FORMATS = new Set(["human", "json"]);

export const USAGE = `Usage:
  arc-prompt recommend [options]
  arc-prompt recommend --input-json '<json>' [--format human|json]

Required flag input:
  --task-type <type>             Task type
  --arc-phase <phase>            ARC lifecycle phase
  --reliability-tier <tier>      Reliability tier
  --risk <risk>                  Risk level
  --target-mode <mode>           Target mode (automatic or explicit)
  --target-model <model>         Optional model name; may be used without --target-mode
  --output-shape <shape>         Requested output shape
  --ambiguity <level>            Ambiguity level

Optional:
  --max-tokens <integer>         Token budget
  --max-latency-ms <integer>     Latency budget in milliseconds
  --input-json <json>            Complete recommendation input as JSON
  --format <human|json>          Output format (default: human)
  --json                         Alias for --format json
  -h, --help                     Show this help

JSON input cannot be combined with recommendation input flags.`;

const fail = (message) => {
  throw new TypeError(message);
};

const splitArgument = (argument) => {
  const equalsIndex = argument.indexOf("=");
  if (equalsIndex === -1) {
    return [argument, undefined];
  }
  return [argument.slice(0, equalsIndex), argument.slice(equalsIndex + 1)];
};

const parseInteger = (flag, value) => {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    fail(`${flag} must be a decimal integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    fail(`${flag} must be a safe integer.`);
  }
  return parsed;
};

const setPath = (target, path, value) => {
  if (path.length === 1) {
    target[path[0]] = value;
    return;
  }
  target[path[0]] ??= {};
  target[path[0]][path[1]] = value;
};

const readValue = (argv, index, flag, inlineValue) => {
  if (inlineValue !== undefined) {
    if (inlineValue.length === 0) fail(`${flag} requires a value.`);
    return { value: inlineValue, nextIndex: index };
  }
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    fail(`${flag} requires a value.`);
  }
  return { value, nextIndex: index + 1 };
};

export function parseRecommendArgs(argv) {
  const input = { target: {}, budget: {} };
  const seen = new Set();
  let inputJson;
  let format = "human";
  let formatWasSet = false;
  let jsonAlias = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inlineValue] = splitArgument(argument);

    if (flag === "-h" || flag === "--help") {
      if (inlineValue !== undefined) fail(`${flag} does not accept a value.`);
      return { help: true };
    }

    if (flag === "--json") {
      if (inlineValue !== undefined) fail("--json does not accept a value.");
      if (jsonAlias) fail("--json may only be provided once.");
      jsonAlias = true;
      continue;
    }

    if (flag === "--format" || flag === "--input-json" || INPUT_FLAGS.has(flag)) {
      if (seen.has(flag)) fail(`${flag} may only be provided once.`);
      seen.add(flag);
      const read = readValue(argv, index, flag, inlineValue);
      index = read.nextIndex;

      if (flag === "--format") {
        if (!FORMATS.has(read.value)) fail("--format must be human or json.");
        format = read.value;
        formatWasSet = true;
      } else if (flag === "--input-json") {
        inputJson = read.value;
      } else {
        const value = INTEGER_FLAGS.has(flag) ? parseInteger(flag, read.value) : read.value;
        setPath(input, VALUE_FLAGS[flag], value);
      }
      continue;
    }

    fail(`Unknown option: ${argument}`);
  }

  if (jsonAlias && formatWasSet && format !== "json") {
    fail("--json cannot be combined with --format human.");
  }
  if (jsonAlias) format = "json";

  if (inputJson !== undefined) {
    if ([...seen].some((flag) => INPUT_FLAGS.has(flag))) {
      fail("--input-json cannot be combined with recommendation input flags.");
    }
    let parsed;
    try {
      parsed = JSON.parse(inputJson);
    } catch (error) {
      fail(`--input-json contains invalid JSON: ${error.message}`);
    }
    return { help: false, input: parsed, format };
  }

  return { help: false, input, format };
}

export function renderJson(recommendation) {
  return `${JSON.stringify(recommendation, null, 2)}\n`;
}

const renderEntries = (entries, renderEntry) =>
  entries.length === 0 ? "  (none)" : entries.map((entry) => `  - ${renderEntry(entry)}`).join("\n");

export function renderHuman(recommendation) {
  return [
    `Primary pattern: ${recommendation.primaryPattern}`,
    "Overlays:",
    renderEntries(recommendation.overlays, (overlay) => overlay),
    "Prompt fragments:",
    renderEntries(recommendation.promptFragments, ({ kind, text }) => `[${kind}] ${text}`),
    "Lifecycle guidance:",
    renderEntries(recommendation.lifecycleGuidance, ({ phase, guidance }) => `[${phase}] ${guidance}`),
    "Warnings:",
    renderEntries(recommendation.warnings, (warning) => warning),
    `Rationale: ${recommendation.rationale}`,
    `Confidence: ${recommendation.confidence}`,
    ""
  ].join("\n");
}

export function runCli(
  argv,
  {
    writeOut = (text) => process.stdout.write(text),
    writeError = (text) => process.stderr.write(text)
  } = {}
) {
  try {
    if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
      writeOut(`${USAGE}\n`);
      return 0;
    }
    if (argv[0] !== "recommend") {
      fail(`Unknown command: ${argv[0]}`);
    }

    const parsed = parseRecommendArgs(argv.slice(1));
    if (parsed.help) {
      writeOut(`${USAGE}\n`);
      return 0;
    }

    const recommendation = recommend(parsed.input);
    writeOut(parsed.format === "json" ? renderJson(recommendation) : renderHuman(recommendation));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(`arc-prompt: ${message}\nTry 'arc-prompt recommend --help' for usage.\n`);
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  process.exitCode = runCli(process.argv.slice(2));
}
