/* global Bun */

import { afterEach, expect, test } from "bun:test";
import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const outDir = join(process.cwd(), ".tmp-openlogs");
const historyRawFile = /^latest\.\d{4}-\d{2}-\d{2}T.+\.raw\.log$/;

afterEach(async () => {
  await rm(outDir, { force: true, recursive: true });
});

test("cli writes raw and cleaned log files", async () => {
  const proc = Bun.spawn(
    [
      "bun",
      "packages/ol/src/cli.ts",
      "--out-dir",
      outDir,
      "bun",
      "--eval",
      "process.stdout.write(`\\u001b[32mhello\\u001b[0m\\n`)",
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(0);
  expect(
    (await Bun.file(join(outDir, "latest.raw.log")).text()).includes("hello")
  ).toBe(true);
  expect(await Bun.file(join(outDir, "latest.txt")).text()).toBe("hello\n");
  expect((await stat(join(outDir, "latest.raw.log"))).size).toBeGreaterThan(0);
  expect(
    (await readdir(outDir)).some((name) => historyRawFile.test(name))
  ).toBe(true);
});

test("cli can skip history and print paths", async () => {
  const proc = Bun.spawn(
    [
      "bun",
      "packages/ol/src/cli.ts",
      "--out-dir",
      outDir,
      "--no-history",
      "--print-paths",
      "bun",
      "--eval",
      "process.stdout.write(`hi\\n`)",
    ],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(0);
  expect(await Bun.file(join(outDir, "latest.txt")).text()).toBe("hi\n");
  expect((await proc.stderr.text()).includes("ol:")).toBe(true);
  expect(
    (await readdir(outDir)).filter((name) => name.includes(".raw.log")).length
  ).toBe(1);
});
