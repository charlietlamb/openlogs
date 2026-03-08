import { stripVTControlCharacters } from "node:util";

export interface CliOptions {
  command: string[];
  history: boolean;
  name: string;
  outDir: string;
  printPaths: boolean;
  writeRaw: boolean;
  writeText: boolean;
}

export interface TailOptions {
  outDir: string;
  raw: boolean;
  tailArgs: string[];
}

export type ParsedArgs =
  | { kind: "run"; options: CliOptions }
  | { kind: "tail"; options: TailOptions };

const usage =
  "Usage: ol [--out-dir <path>] [--name <name>] [--raw-only|--text-only] [--no-history] [--print-paths] [--] <command...>";
const tailUsage =
  "Usage: ol tail [--out-dir <path>] [--raw] [--] [tail args...]";
const millisecondsAtEnd = /\.\d{3}Z$/;

export interface LogPaths {
  captureRawPath: string;
  rawPaths: string[];
  textPaths: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] === "tail") {
    return { kind: "tail", options: parseTailArgs(argv.slice(1)) };
  }

  return { kind: "run", options: parseCliArgs(argv) };
}

export function parseCliArgs(argv: string[]): CliOptions {
  let history = true;
  let outDir = ".openlogs";
  let name = "latest";
  let printPaths = false;
  let writeRaw = true;
  let writeText = true;
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      break;
    }

    switch (arg) {
      case "--out-dir":
        outDir = argv[i + 1] ?? fail(`Missing value for ${arg}`);
        i += 2;
        continue;
      case "--name":
        name = argv[i + 1] ?? fail(`Missing value for ${arg}`);
        i += 2;
        continue;
      case "--raw-only":
        writeText = false;
        i += 1;
        continue;
      case "--text-only":
        writeRaw = false;
        i += 1;
        continue;
      case "--no-history":
        history = false;
        i += 1;
        continue;
      case "--print-paths":
        printPaths = true;
        i += 1;
        continue;
      case "--help":
      case "-h":
        return fail(usage, 0);
      default:
        fail(`Unknown option: ${arg}\n${usage}`);
    }
  }

  if (!(writeRaw || writeText)) {
    fail("At least one log output must be enabled.");
  }

  const command = argv.slice(i);
  if (command.length === 0) {
    fail(usage);
  }

  return { command, history, name, outDir, printPaths, writeRaw, writeText };
}

export function parseTailArgs(argv: string[]): TailOptions {
  let outDir = ".openlogs";
  let raw = false;
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--") {
      i += 1;
      break;
    }
    if (!arg.startsWith("-") || arg === "-") {
      break;
    }

    switch (arg) {
      case "--out-dir":
        outDir = argv[i + 1] ?? fail(`Missing value for ${arg}`);
        i += 2;
        continue;
      case "--raw":
        raw = true;
        i += 1;
        continue;
      case "--help":
      case "-h":
        return fail(tailUsage, 0);
      default:
        return { outDir, raw, tailArgs: argv.slice(i) };
    }
  }

  return { outDir, raw, tailArgs: argv.slice(i) };
}

export function cleanChunk(chunk: Uint8Array, decoder: TextDecoder) {
  return normalizeLogText(
    stripVTControlCharacters(decoder.decode(chunk, { stream: true }))
  );
}

export function flushCleanText(decoder: TextDecoder) {
  return normalizeLogText(stripVTControlCharacters(decoder.decode()));
}

export function cleanLogText(text: string) {
  return normalizeLogText(stripVTControlCharacters(text));
}

export function hasInterruptByte(data: Uint8Array) {
  return data.includes(3);
}

export function getLogPaths(options: CliOptions, now = new Date()): LogPaths {
  const captureRawPath = `${options.outDir}/.${options.name}.${getRunId(now)}.raw.log`;
  const historyPrefix = `${options.outDir}/${options.name}.${getRunId(now)}`;
  const latestPrefix = `${options.outDir}/${options.name}`;

  return {
    captureRawPath,
    rawPaths: getVisiblePaths(
      latestPrefix,
      historyPrefix,
      options.history,
      options.writeRaw
    ),
    textPaths: getVisiblePaths(
      latestPrefix,
      historyPrefix,
      options.history,
      options.writeText,
      ".txt"
    ),
  };
}

export function getLatestLogPath(options: TailOptions) {
  return `${options.outDir}/latest${options.raw ? ".raw.log" : ".txt"}`;
}

function normalizeLogText(text: string) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function getVisiblePaths(
  latestPrefix: string,
  historyPrefix: string,
  history: boolean,
  enabled: boolean,
  suffix = ".raw.log"
) {
  if (!enabled) {
    return [];
  }

  return history
    ? [`${latestPrefix}${suffix}`, `${historyPrefix}${suffix}`]
    : [`${latestPrefix}${suffix}`];
}

function getRunId(now: Date) {
  return now.toISOString().replaceAll(":", "-").replace(millisecondsAtEnd, "Z");
}

function fail(message: string, code = 1): never {
  throw Object.assign(new Error(message), { code });
}
