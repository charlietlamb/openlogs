#!/usr/bin/env bun

/* global Bun */

import { createWriteStream } from "node:fs";
import { access, appendFile, mkdir, rm } from "node:fs/promises";
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
  const paths = getLogPaths(options);
  const run = getRunRecord(options, paths);
  await mkdir(options.outDir, { recursive: true });
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
  const terminal = new Bun.Terminal({
    cols: process.stdout.columns ?? 80,
    rows: process.stdout.rows ?? 24,
    data(_, data) {
      process.stdout.write(data);
      captureStream.write(data);
      for (const stream of rawStreams) {
        stream.write(data);
      }
      const cleaned = cleanChunk(data, decoder);
      if (cleaned) {
        for (const stream of textStreams) {
          stream.write(cleaned);
        }
      }
    },
  });

  const proc = Bun.spawn(
    ["python3", "-c", supervisionScript, ...options.command],
    {
      terminal,
    }
  );
  const teardown = setupTerminalHandlers(proc, terminal);

  if (options.printPaths) {
    printPaths(paths.rawPaths, paths.textPaths);
  }

  try {
    return await proc.exited;
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

function setupTerminalHandlers(proc: Bun.Subprocess, terminal: Bun.Terminal) {
  let rawModeEnabled = false;
  const onInput = (data: Buffer) => {
    if (hasInterruptByte(data)) {
      if (!proc.killed) {
        proc.kill("SIGINT");
      }
      return;
    }

    terminal.write(data);
  };
  const onResize = () => {
    terminal.resize(process.stdout.columns ?? 80, process.stdout.rows ?? 24);
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
  process.stdout.on("resize", onResize);

  return () => {
    process.stdin.off("data", onInput);
    process.stdout.off("resize", onResize);
    process.stdin.pause();

    for (const [signal, handler] of signalHandlers) {
      process.off(signal, handler);
    }

    if (rawModeEnabled) {
      process.stdin.setRawMode?.(false);
    }

    if (!proc.killed && proc.exitCode === null) {
      proc.kill("SIGTERM");
    }

    terminal.close();
  };
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
