#!/usr/bin/env bun

/* global Bun */

import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import process from "node:process";
import { finished } from "node:stream/promises";
import {
  cleanChunk,
  cleanLogText,
  flushCleanText,
  getLogPaths,
  hasInterruptByte,
  parseCliArgs,
} from "./shared";

if (process.platform === "win32") {
  console.error("ol currently requires a POSIX terminal (macOS/Linux).");
  process.exit(1);
}

try {
  process.exit(await main());
} catch (error) {
  const code =
    typeof error === "object" && error && "code" in error
      ? Number(error.code)
      : 1;
  const write = code === 0 ? console.log : console.error;
  write(error instanceof Error ? error.message : String(error));
  process.exit(code);
}

async function main() {
  const options = parseCliArgs(process.argv.slice(2));
  const paths = getLogPaths(options);
  await mkdir(options.outDir, { recursive: true });

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

  const proc = Bun.spawn(options.command, { terminal });
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

function printPaths(rawPaths: string[], textPaths: string[]) {
  for (const path of [...rawPaths, ...textPaths]) {
    console.error(`ol: ${path}`);
  }
}
