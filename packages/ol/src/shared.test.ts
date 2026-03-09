import { expect, test } from "bun:test";
import {
  cleanChunk,
  cleanLogText,
  findMatchingRun,
  getLatestLogPath,
  getLogKey,
  getLogPaths,
  getRunRecord,
  hasInterruptByte,
  parseArgs,
  parseCliArgs,
  parseTailArgs,
} from "./shared";

test("parseCliArgs parses wrapper options before the command", () => {
  expect(
    parseCliArgs([
      "--out-dir",
      "logs",
      "--name",
      "dev",
      "--text-only",
      "bun",
      "dev",
    ])
  ).toEqual({
    command: ["bun", "dev"],
    history: true,
    name: "dev",
    outDir: "logs",
    printPaths: false,
    writeRaw: false,
    writeText: true,
  });
});

test("parseCliArgs supports history and path flags", () => {
  expect(
    parseCliArgs(["--no-history", "--print-paths", "--", "bun", "--watch"])
  ).toEqual({
    command: ["bun", "--watch"],
    history: false,
    name: undefined,
    outDir: ".openlogs",
    printPaths: true,
    writeRaw: true,
    writeText: true,
  });
});

test("parseArgs detects the tail subcommand", () => {
  expect(parseArgs(["tail", "--raw", "-n", "50"])).toEqual({
    kind: "tail",
    options: {
      outDir: ".openlogs",
      query: undefined,
      raw: true,
      tailArgs: ["-n", "50"],
    },
  });
});

test("parseTailArgs supports wrapper flags before tail args", () => {
  expect(
    parseTailArgs(["--out-dir", "logs", "--raw", "dev", "--", "-n", "25"])
  ).toEqual({
    outDir: "logs",
    query: "dev",
    raw: true,
    tailArgs: ["-n", "25"],
  });
});

test("cleanChunk strips ANSI codes and normalizes carriage returns", () => {
  const decoder = new TextDecoder();
  const chunk = new TextEncoder().encode("\u001B[31mred\u001B[0m\rnext\r\n");

  expect(cleanChunk(chunk, decoder)).toBe("red\nnext\n");
});

test("cleanLogText cleans a full terminal transcript", () => {
  expect(cleanLogText("\u001B[32mhello\u001B[0m\rworld\r\n")).toBe(
    "hello\nworld\n"
  );
});

test("hasInterruptByte detects ctrl c input", () => {
  expect(hasInterruptByte(Uint8Array.from([3]))).toBe(true);
  expect(hasInterruptByte(Uint8Array.from([97, 98, 99]))).toBe(false);
});

test("getLogPaths returns latest and history paths by default", () => {
  expect(
    getLogPaths(
      {
        command: ["bun", "dev"],
        history: true,
        name: undefined,
        outDir: ".openlogs",
        printPaths: false,
        writeRaw: true,
        writeText: true,
      },
      new Date("2026-03-08T10:45:12.000Z")
    )
  ).toEqual({
    captureRawPath: ".openlogs/.bun-dev.2026-03-08T10-45-12Z.raw.log",
    key: "bun-dev",
    rawPath: ".openlogs/bun-dev.raw.log",
    rawPaths: [
      ".openlogs/latest.raw.log",
      ".openlogs/bun-dev.raw.log",
      ".openlogs/bun-dev.2026-03-08T10-45-12Z.raw.log",
    ],
    textPath: ".openlogs/bun-dev.txt",
    textPaths: [
      ".openlogs/latest.txt",
      ".openlogs/bun-dev.txt",
      ".openlogs/bun-dev.2026-03-08T10-45-12Z.txt",
    ],
  });
});

test("getLatestLogPath returns the latest text and raw paths", () => {
  expect(
    getLatestLogPath({
      outDir: ".openlogs",
      query: undefined,
      raw: false,
      tailArgs: [],
    })
  ).toBe(".openlogs/latest.txt");
  expect(
    getLatestLogPath({
      outDir: ".openlogs",
      query: undefined,
      raw: true,
      tailArgs: [],
    })
  ).toBe(".openlogs/latest.raw.log");
});

test("getLogKey derives a stable command key", () => {
  expect(
    getLogKey({ command: ["npm", "run", "dev:server"], name: undefined })
  ).toBe("npm-run-dev-server");
  expect(getLogKey({ command: ["npm", "run", "dev"], name: "web" })).toBe(
    "web"
  );
});

test("getRunRecord stores command metadata for later lookup", () => {
  expect(
    getRunRecord(
      {
        command: ["npm", "run", "dev"],
        history: true,
        name: undefined,
        outDir: ".openlogs",
        printPaths: false,
        writeRaw: true,
        writeText: true,
      },
      {
        captureRawPath: ".openlogs/.npm-run-dev.2026-03-08T10-45-12Z.raw.log",
        key: "npm-run-dev",
        rawPath: ".openlogs/npm-run-dev.raw.log",
        rawPaths: [],
        textPath: ".openlogs/npm-run-dev.txt",
        textPaths: [],
      },
      new Date("2026-03-08T10:45:12.000Z")
    )
  ).toEqual({
    command: "npm run dev",
    key: "npm-run-dev",
    name: undefined,
    outDir: ".openlogs",
    rawPath: ".openlogs/npm-run-dev.raw.log",
    startedAt: "2026-03-08T10:45:12.000Z",
    textPath: ".openlogs/npm-run-dev.txt",
  });
});

test("findMatchingRun returns the most recent matching record", () => {
  const match = findMatchingRun(
    [
      {
        command: "npm run dev",
        key: "npm-run-dev",
        outDir: ".openlogs",
        rawPath: ".openlogs/npm-run-dev.raw.log",
        startedAt: "2026-03-08T10:45:12.000Z",
        textPath: ".openlogs/npm-run-dev.txt",
      },
      {
        command: "npm run dev:server",
        key: "npm-run-dev-server",
        outDir: ".openlogs",
        rawPath: ".openlogs/npm-run-dev-server.raw.log",
        startedAt: "2026-03-08T10:50:12.000Z",
        textPath: ".openlogs/npm-run-dev-server.txt",
      },
    ],
    "server"
  );

  expect(match?.key).toBe("npm-run-dev-server");
});
