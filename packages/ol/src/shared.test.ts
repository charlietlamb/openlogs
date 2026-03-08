import { expect, test } from "bun:test";
import {
  cleanChunk,
  cleanLogText,
  getLogPaths,
  hasInterruptByte,
  parseCliArgs,
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
    name: "latest",
    outDir: ".openlogs",
    printPaths: true,
    writeRaw: true,
    writeText: true,
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
        name: "latest",
        outDir: ".openlogs",
        printPaths: false,
        writeRaw: true,
        writeText: true,
      },
      new Date("2026-03-08T10:45:12.000Z")
    )
  ).toEqual({
    captureRawPath: ".openlogs/.latest.2026-03-08T10-45-12Z.raw.log",
    rawPaths: [
      ".openlogs/latest.raw.log",
      ".openlogs/latest.2026-03-08T10-45-12Z.raw.log",
    ],
    textPaths: [
      ".openlogs/latest.txt",
      ".openlogs/latest.2026-03-08T10-45-12Z.txt",
    ],
  });
});
