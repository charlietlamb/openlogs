/* global Bun */

import { afterEach, expect, test } from "bun:test";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";

const cliPath = join(process.cwd(), "packages/ol/src/cli.ts");
const outDir = join(process.cwd(), ".tmp-openlogs");
const historyRawFile = /^latest\.\d{4}-\d{2}-\d{2}T.+\.raw\.log$/;

afterEach(async () => {
  await rm(outDir, { force: true, recursive: true });
});

function spawnCli(command: string[]) {
  return Bun.spawn(["bun", cliPath, "--out-dir", outDir, ...command], {
    cwd: process.cwd(),
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
}

test("cli writes raw and cleaned log files", async () => {
  const proc = spawnCli([
    "bun",
    "--eval",
    "process.stdout.write(`\\u001b[32mhello\\u001b[0m\\n`)",
  ]);

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
      cliPath,
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
      stdin: "pipe",
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

test("cli forwards stdin to the wrapped command", async () => {
  const proc = spawnCli(["sh", "-lc", 'read line; printf "got:%s\\n" "$line"']);

  proc.stdin.write("hello\n");
  proc.stdin.end();

  expect(await proc.exited).toBe(0);
  expect(await Bun.file(join(outDir, "latest.txt")).text()).toContain(
    "got:hello\n"
  );
});

test("cli forwards ctrl c to the wrapped command even with no prior output", async () => {
  const proc = spawnCli([
    "sh",
    "-lc",
    "trap 'exit 130' INT; while :; do sleep 1; done",
  ]);

  await Bun.sleep(100);
  proc.stdin.write(Uint8Array.from([3]));
  proc.stdin.end();

  expect(await proc.exited).toBe(130);
  expect(await Bun.file(join(outDir, "latest.txt")).text()).toBe("");
  expect(await Bun.file(join(outDir, "latest.raw.log")).text()).toBe("");
});

test("cli preserves the wrapped command exit code", async () => {
  const proc = spawnCli(["sh", "-lc", "exit 7"]);

  expect(await proc.exited).toBe(7);
});

test("cli tail prints the latest text log", async () => {
  await mkdir(outDir, { recursive: true });
  await Bun.write(join(outDir, "latest.txt"), "one\ntwo\nthree\n");

  const proc = Bun.spawn(
    ["bun", cliPath, "tail", "--out-dir", outDir, "-n", "2"],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(0);
  expect(await new Response(proc.stdout).text()).toBe("two\nthree\n");
});

test("cli tail can read the latest raw log", async () => {
  await mkdir(outDir, { recursive: true });
  await Bun.write(join(outDir, "latest.raw.log"), "raw-a\nraw-b\n");

  const proc = Bun.spawn(
    ["bun", cliPath, "tail", "--out-dir", outDir, "--raw", "-n", "1"],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(0);
  expect(await new Response(proc.stdout).text()).toBe("raw-b\n");
});
