#!/usr/bin/env bun

/* global Bun */

import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { access, appendFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { finished } from "node:stream/promises";
import {
  cleanChunk,
  cleanLogText,
  findMatchingRun,
  flushCleanText,
  getLatestLogPath,
  getLogPaths,
  getRunIndexPath,
  getRunRecord,
  hasInterruptByte,
  parseArgs,
  type RunRecord,
  type TailOptions,
} from "./shared";

if (process.platform === "win32") {
  console.error("ol currently requires a POSIX terminal (macOS/Linux).");
  process.exit(1);
}

const supervisionScript = `
import os
import signal
import subprocess
import sys
import time

tracked = set()
child = subprocess.Popen(sys.argv[1:], stdin=sys.stdin, stdout=sys.stdout, stderr=sys.stderr)

def snapshot_descendants():
    if child.poll() is not None:
        return

    output = subprocess.check_output(["ps", "-axo", "pid=,ppid="], text=True)
    children = {}
    for line in output.splitlines():
        pid_str, ppid_str = line.split()
        children.setdefault(int(ppid_str), []).append(int(pid_str))

    stack = [child.pid]
    while stack:
        current = stack.pop()
        for descendant in children.get(current, []):
            if descendant not in tracked:
                tracked.add(descendant)
                stack.append(descendant)

def living_pids():
    pids = [child.pid, *tracked]
    living = []
    for pid in pids:
        try:
            os.kill(pid, 0)
            living.append(pid)
        except ProcessLookupError:
            pass
    return living

def terminate_tracked(signum):
    snapshot_descendants()
    for pid in reversed(living_pids()):
        try:
            os.kill(pid, signum)
        except ProcessLookupError:
            pass

    deadline = time.time() + (10 if signum == signal.SIGINT else 1)
    while time.time() < deadline:
        if child.poll() is not None:
            break
        time.sleep(0.05)

    deadline = time.time() + 1
    while time.time() < deadline:
        if not living_pids():
            return
        time.sleep(0.05)

    for pid in reversed(living_pids()):
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

def handle_signal(signum, _frame):
    terminate_tracked(signum)
    raise SystemExit(128 + signum)

for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
    signal.signal(signum, handle_signal)

while child.poll() is None:
    snapshot_descendants()
    time.sleep(0.05)

terminate_tracked(signal.SIGTERM)
raise SystemExit(child.returncode)
`;

try {
  process.exit(await main());
} catch (error) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    Number.isFinite(Number(error.code))
      ? Number(error.code)
      : 1;
  const write = code === 0 ? console.log : console.error;
  write(error instanceof Error ? error.message : String(error));
  process.exit(code);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.kind === "tail") {
    return runTail(parsed.options);
  }

  const { options } = parsed;
  const command = normalizeCommandForEnvironment(options.command);
  const normalizedOptions = { ...options, command };
  const paths = getLogPaths(normalizedOptions);
  const run = getRunRecord(normalizedOptions, paths);
  await mkdir(normalizedOptions.outDir, { recursive: true });
  await Promise.all(
    [
      ...new Set([paths.captureRawPath, ...paths.rawPaths, ...paths.textPaths]),
    ].map((path) => Bun.write(path, ""))
  );
  await appendRunRecord(run);

  const captureStream = createWriteStream(paths.captureRawPath);
  const rawStreams = paths.rawPaths.map((path) => createWriteStream(path));
  const textStreams = paths.textPaths.map((path) => createWriteStream(path));
  const decoder = new TextDecoder();
  const writeChunk = (chunk: Uint8Array) => {
    process.stdout.write(chunk);
    captureStream.write(chunk);
    for (const stream of rawStreams) {
      stream.write(chunk);
    }
    const cleaned = cleanChunk(chunk, decoder);
    if (cleaned) {
      for (const stream of textStreams) {
        stream.write(cleaned);
      }
    }
  };
  const proc = Bun.spawn(
    ["python3", "-c", supervisionScript, ...normalizedOptions.command],
    {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const teardown = setupProcessHandlers(proc);
  const outputPump = Promise.all([
    pumpProcessOutput(proc.stdout, writeChunk),
    pumpProcessOutput(proc.stderr, writeChunk),
  ]);

  if (normalizedOptions.printPaths) {
    printPaths(paths.rawPaths, paths.textPaths);
  }

  try {
    const [exitCode] = await Promise.all([proc.exited, outputPump]);
    return exitCode;
  } finally {
    const flushed = flushCleanText(decoder);
    if (flushed) {
      for (const stream of textStreams) {
        stream.write(flushed);
      }
    }

    await teardown();
    await closeStreams(captureStream, rawStreams, textStreams);
    await rewriteTextLogs(paths.captureRawPath, paths.textPaths);
    await rm(paths.captureRawPath, { force: true });
  }
}

async function runTail(options: TailOptions) {
  const path = await resolveTailPath(options);
  try {
    await access(path);
  } catch {
    throw Object.assign(
      new Error(
        options.query
          ? `No log found for ${JSON.stringify(
              options.query
            )} in ${options.outDir}. Run your command with "openlogs <command>" first, or pass --name to make it easier to find.`
          : `No log found at ${path}. Run your command with "openlogs <command>" first, or pass --out-dir if your logs live elsewhere.`
      ),
      { code: 1 }
    );
  }

  const proc = Bun.spawn(["tail", ...options.tailArgs, path], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  return await proc.exited;
}

async function resolveTailPath(options: TailOptions) {
  if (!options.query) {
    return getLatestLogPath(options);
  }

  const match = findMatchingRun(
    await loadRunRecords(options.outDir),
    options.query
  );
  return (
    match?.[options.raw ? "rawPath" : "textPath"] ?? getLatestLogPath(options)
  );
}

function setupProcessHandlers(proc: Bun.Subprocess) {
  let rawModeEnabled = false;
  const onInput = (data: Buffer) => {
    if (hasInterruptByte(data)) {
      if (!proc.killed) {
        proc.kill("SIGINT");
      }
      return;
    }
    proc.stdin?.write(data);
  };
  const signalHandlers = ["SIGINT", "SIGTERM", "SIGHUP"].map((signal) => {
    const handler = () => {
      if (!proc.killed) {
        proc.kill(signal);
      }
    };
    process.on(signal, handler);
    return [signal, handler] as const;
  });

  if (process.stdin.isTTY) {
    process.stdin.setRawMode?.(true);
    rawModeEnabled = true;
  }

  process.stdin.resume();
  process.stdin.on("data", onInput);

  return () => {
    process.stdin.off("data", onInput);
    process.stdin.pause();
    proc.stdin?.end();

    for (const [signal, handler] of signalHandlers) {
      process.off(signal, handler);
    }

    if (rawModeEnabled) {
      process.stdin.setRawMode?.(false);
    }

    if (!proc.killed && proc.exitCode === null) {
      proc.kill("SIGTERM");
    }
  };
}

function normalizeCommandForEnvironment(command: string[]) {
  const normalized = stripElideLineArgs(command);
  const expanded = expandBunScriptIfNeeded(normalized);
  return expanded ?? normalized;
}

async function pumpProcessOutput(
  stream: ReadableStream<Uint8Array> | null,
  onChunk: (chunk: Uint8Array) => void
) {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value) {
        onChunk(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function stripElideLineArgs(command: string[]) {
  const normalized: string[] = [];
  for (let i = 0; i < command.length; i += 1) {
    const arg = command[i];
    if (arg.startsWith("--elide-lines=")) {
      continue;
    }
    if (arg === "--elide-lines") {
      i += 1;
      continue;
    }
    normalized.push(arg);
  }
  return normalized;
}

function expandBunScriptIfNeeded(command: string[]) {
  if (command.length !== 2 || command[0] !== "bun") {
    return null;
  }

  const scriptName = command[1];
  if (scriptName.startsWith("-")) {
    return null;
  }

  const packageJsonPath = findNearestPackageJson(process.cwd());
  if (!packageJsonPath) {
    return null;
  }

  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8")
  ) as { scripts?: Record<string, string> };
  const script = packageJson.scripts?.[scriptName];
  if (!script || !script.includes("--elide-lines")) {
    return null;
  }

  const sanitized = sanitizeScriptCommand(script);
  if (!sanitized) {
    return null;
  }

  return ["sh", "-lc", sanitized];
}

function sanitizeScriptCommand(script: string) {
  return script
    .replace(/(^|\s)--elide-lines=\S+(?=\s|$)/g, " ")
    .replace(/(^|\s)--elide-lines\s+\S+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findNearestPackageJson(startDir: string) {
  let current = startDir;
  while (true) {
    const candidate = join(current, "package.json");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function closeStreams(
  captureStream: ReturnType<typeof createWriteStream>,
  rawStreams: ReturnType<typeof createWriteStream>[],
  textStreams: ReturnType<typeof createWriteStream>[]
) {
  for (const stream of [captureStream, ...rawStreams, ...textStreams]) {
    stream.end();
  }

  await Promise.all(
    [captureStream, ...rawStreams, ...textStreams].map((stream) =>
      finished(stream)
    )
  );
}

async function rewriteTextLogs(captureRawPath: string, textPaths: string[]) {
  if (textPaths.length === 0) {
    return;
  }

  const cleaned = cleanLogText(await Bun.file(captureRawPath).text());
  await Promise.all(textPaths.map((path) => Bun.write(path, cleaned)));
}

async function appendRunRecord(record: RunRecord) {
  await appendFile(
    getRunIndexPath(record.outDir),
    `${JSON.stringify(record)}\n`
  );
}

async function loadRunRecords(outDir: string) {
  const path = getRunIndexPath(outDir);
  try {
    const lines = (await Bun.file(path).text())
      .trim()
      .split("\n")
      .filter(Boolean);
    return lines.map((line) => JSON.parse(line) as RunRecord);
  } catch {
    return [];
  }
}

function printPaths(rawPaths: string[], textPaths: string[]) {
  for (const path of [...rawPaths, ...textPaths]) {
    console.error(`ol: ${path}`);
  }
}
