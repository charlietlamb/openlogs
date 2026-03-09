/* global Bun */

import { afterEach, expect, test } from "bun:test";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const cliPath = join(process.cwd(), "packages/ol/src/cli.ts");
const outDir = join(process.cwd(), ".tmp-openlogs");
const historyRawFile = /\.\d{4}-\d{2}-\d{2}T.+\.raw\.log$/;

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

async function waitFor<T>(
  load: () => Promise<T> | T,
  ready: (value: T) => boolean,
  timeoutMs = 2000
) {
  const start = Date.now();
  let value = await load();

  while (!ready(value)) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error("Timed out waiting for test condition");
    }
    await Bun.sleep(50);
    value = await load();
  }

  return value;
}

function pidExists(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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
  ).toBe(2);
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

test("cli writes command-specific latest logs by default", async () => {
  const proc = spawnCli(["sleep", "0"]);

  expect(await proc.exited).toBe(0);
  expect((await readdir(outDir)).includes("sleep-0.txt")).toBe(true);
  expect((await readdir(outDir)).includes("latest.txt")).toBe(true);
});

test("cli tail can resolve the most recent matching run", async () => {
  await mkdir(outDir, { recursive: true });
  await Bun.write(join(outDir, "dev.txt"), "dev\n");
  await Bun.write(join(outDir, "dev-server.txt"), "server\n");
  await Bun.write(
    join(outDir, "runs.jsonl"),
    [
      JSON.stringify({
        command: "npm run dev",
        key: "dev",
        outDir,
        rawPath: join(outDir, "dev.raw.log"),
        startedAt: "2026-03-08T10:45:12.000Z",
        textPath: join(outDir, "dev.txt"),
      }),
      JSON.stringify({
        command: "npm run dev:server",
        key: "dev-server",
        outDir,
        rawPath: join(outDir, "dev-server.raw.log"),
        startedAt: "2026-03-08T10:50:12.000Z",
        textPath: join(outDir, "dev-server.txt"),
      }),
      "",
    ].join("\n")
  );

  const proc = Bun.spawn(
    ["bun", cliPath, "tail", "--out-dir", outDir, "server", "-n", "1"],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(0);
  expect(await new Response(proc.stdout).text()).toBe("server\n");
});

test("cli tail shows a friendly error when no matching log exists", async () => {
  await mkdir(outDir, { recursive: true });

  const proc = Bun.spawn(
    ["bun", cliPath, "tail", "--out-dir", outDir, "server", "-n", "10"],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(1);
  expect(await new Response(proc.stderr).text()).toContain(
    'No log found for "server"'
  );
});

test("cli tail shows a friendly error when no log exists", async () => {
  const proc = Bun.spawn(
    ["bun", cliPath, "tail", "--out-dir", outDir, "-n", "10"],
    {
      cwd: process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  expect(await proc.exited).toBe(1);
  expect(await new Response(proc.stderr).text()).toContain(
    `No log found at ${join(outDir, "latest.txt")}.`
  );
});

test("cli terminates the wrapped command when the wrapper is terminated", async () => {
  const pidFile = join(outDir, "child.pid");
  await mkdir(outDir, { recursive: true });
  await Bun.write(pidFile, "");

  const childCommand =
    `printf %s $$ > "${pidFile}"; ` +
    `trap "exit 0" TERM INT HUP; ` +
    "while :; do sleep 1; done";
  const proc = spawnCli(["sh", "-lc", childCommand]);
  const childPid = Number(
    await waitFor(
      async () => (await Bun.file(pidFile).text()).trim(),
      (value) => value.length > 0
    )
  );

  proc.kill("SIGTERM");

  expect(await proc.exited).toBe(143);
  await waitFor(
    () => pidExists(childPid),
    (alive) => !alive
  );
});

test("cli reaps surviving descendants before exiting", async () => {
  const pidFile = join(outDir, "orphan.pid");
  await mkdir(outDir, { recursive: true });
  await Bun.write(pidFile, "");

  const proc = spawnCli([
    "python3",
    "-c",
    [
      "import os, time",
      "pid = os.fork()",
      "if pid == 0:",
      "    os.setsid()",
      `    open(${JSON.stringify(pidFile)}, "w").write(str(os.getpid()))`,
      "    while True: time.sleep(1)",
      "time.sleep(0.2)",
    ].join("\n"),
  ]);
  const childPid = Number(
    await waitFor(
      async () => (await Bun.file(pidFile).text()).trim(),
      (value) => value.length > 0
    )
  );

  expect(await proc.exited).toBe(0);
  await waitFor(
    () => pidExists(childPid),
    (alive) => !alive
  );
});
