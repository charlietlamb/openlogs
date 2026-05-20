#!/usr/bin/env bun

/* global Bun */

import { createWriteStream } from "node:fs";
import { access, appendFile, mkdir, rm } from "node:fs/promises";
import process from "node:process";
import { finished } from "node:stream/promises";
import { runCollector } from "./collector";
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
import signal

pending_signal = None

def handle_early_signal(signum, _frame):
    global pending_signal
    pending_signal = signum

for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
    signal.signal(signum, handle_early_signal)

import os
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

if pending_signal is not None:
    handle_signal(pending_signal, None)

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
  if (parsed.kind === "collector") {
    return runCollector(parsed.options);
  }
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
  let collector: Bun.Subprocess | undefined;
  const proc = Bun.spawn(
    ["python3", "-c", supervisionScript, ...options.command],
    {
      terminal: {
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
      },
    }
  );
  const teardown = setupTerminalHandlers(proc);

  if (options.printPaths) {
    printPaths(paths.rawPaths, paths.textPaths);
  }

  try {
    collector = await startCollector(options.outDir);
    return await proc.exited;
  } finally {
    const flushed = flushCleanText(decoder);
    if (flushed) {
      for (const stream of textStreams) {
        stream.write(flushed);
      }
    }

    await teardown();
    await stopCollector(collector);
    await closeStreams(captureStream, rawStreams, textStreams);
    await rewriteTextLogs(paths.captureRawPath, paths.textPaths);
    await rm(paths.captureRawPath, { force: true });
  }
}

async function stopCollector(proc: Bun.Subprocess | undefined) {
  if (!proc) {
    return;
  }
  proc.kill("SIGTERM");
  await proc.exited;
}

async function startCollector(outDir: string) {
  const host = "127.0.0.1";
  const port = Number(Bun.env.OPENLOGS_COLLECTOR_PORT ?? 4318);
  if (await isCollectorHealthy(host, port, outDir)) {
    return;
  }

  const proc = Bun.spawn(
    [
      "bun",
      process.argv[1],
      "collector",
      "--out-dir",
      outDir,
      "--host",
      host,
      "--port",
      String(port),
    ],
    { stderr: "pipe", stdin: "ignore", stdout: "ignore" }
  );

  for (let i = 0; i < 40; i += 1) {
    if (await isCollectorHealthy(host, port, outDir)) {
      return proc;
    }
    if (proc.exitCode !== null) {
      break;
    }
    await Bun.sleep(50);
  }

  proc.kill("SIGTERM");
  const detail = proc.stderr
    ? `\n${await new Response(proc.stderr).text()}`
    : "";
  throw new Error(
    `Failed to start the openlogs collector on http://${host}:${port}.${detail}`
  );
}

async function isCollectorHealthy(host: string, port: number, outDir: string) {
  try {
    const health = await fetch(`http://${host}:${port}/health`);
    const record = await health.json();
    return health.ok && record?.ok === true && record?.outDir === outDir;
  } catch {
    return false;
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

function setupTerminalHandlers(proc: Bun.Subprocess) {
  const { terminal } = proc;
  if (!terminal) {
    throw new Error("Failed to create PTY terminal.");
  }

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
