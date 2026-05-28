/* global Bun */

import { appendFile, mkdir, rm } from "node:fs/promises";
import process from "node:process";
import {
  type CollectorRecord,
  getBrowserLogPaths,
  getBrowserRunRecord,
  getCollectorPath,
  getRunIndexPath,
  type LogPaths,
  type ServeOptions,
} from "./shared";

interface BrowserEvent {
  args?: unknown[];
  kind?: string;
  level?: string;
  message?: string;
  meta?: Record<string, unknown>;
  source?: string;
  stack?: string;
  ts?: string;
  url?: string;
}

interface BrowserBatch {
  events?: BrowserEvent[];
}

interface BrowserSource {
  paths: LogPaths;
  source?: string;
}

const corsHeaders = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-origin": "*",
} satisfies Record<string, string>;

export async function runCollector(options: ServeOptions) {
  await mkdir(options.outDir, { recursive: true });
  const sources = new Map<string, BrowserSource>();
  const recordBase = {
    host: options.host,
    outDir: options.outDir,
    pid: process.pid,
    projectRoot: process.cwd(),
    startedAt: new Date().toISOString(),
  } satisfies Omit<CollectorRecord, "port">;

  let server: ReturnType<typeof Bun.serve>;
  const fetch = async (request: Request) => {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json(
        { ok: true, ...recordBase, port: server.port },
        { headers: corsHeaders }
      );
    }
    if (request.method !== "POST" || url.pathname !== "/ingest") {
      return new Response("Not found", { status: 404 });
    }

    const payload = await request.json().catch(() => null);
    let events: BrowserEvent[] = [];
    if (Array.isArray((payload as BrowserBatch | null)?.events)) {
      events = (payload as BrowserBatch).events ?? [];
    } else if (Array.isArray(payload)) {
      events = payload as BrowserEvent[];
    }

    await Promise.all(
      events.map((event) => appendBrowserEvent(event, sources, options.outDir))
    );
    return new Response(null, { headers: corsHeaders, status: 204 });
  };

  server = listenOnAvailablePort(options.host, options.port, fetch);

  const record = { ...recordBase, port: server.port } satisfies CollectorRecord;
  await Bun.write(
    getCollectorPath(options.outDir),
    `${JSON.stringify(record, null, 2)}\n`
  );

  let closing = false;
  let parentWatch: ReturnType<typeof setInterval> | undefined;
  const cleanup = async () => {
    if (closing) {
      return;
    }
    closing = true;
    clearInterval(parentWatch);
    server.stop(true);
    const current = await loadCollectorRecord(options.outDir);
    if (current?.pid === process.pid) {
      await rm(getCollectorPath(options.outDir), { force: true });
    }
  };

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      cleanup().finally(() => process.exit(0));
    });
  }

  // Exit if the launching process dies, so collectors never linger and squat
  // the port (which would block future runs, e.g. across git worktrees).
  const parentPid = process.ppid;
  parentWatch = setInterval(() => {
    if (process.ppid !== parentPid || !isProcessAlive(parentPid)) {
      cleanup().finally(() => process.exit(0));
    }
  }, 500);

  await new Promise(() => undefined);
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listenOnAvailablePort(
  host: string,
  startPort: number,
  fetch: (request: Request) => Response | Promise<Response>
) {
  const maxAttempts = 64;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return Bun.serve({ fetch, hostname: host, port: startPort + attempt });
    } catch (error) {
      lastError = error;
      if (!isAddressInUse(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}

function isAddressInUse(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = "code" in error ? String(error.code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return code === "EADDRINUSE" || /eaddrinuse|in use/i.test(message);
}

export async function loadCollectorRecord(outDir: string) {
  try {
    return JSON.parse(
      await Bun.file(getCollectorPath(outDir)).text()
    ) as CollectorRecord;
  } catch {
    return;
  }
}

async function appendBrowserEvent(
  event: BrowserEvent,
  sources: Map<string, BrowserSource>,
  outDir: string
) {
  const source = cleanSource(event.source);
  let entry = sources.get(source ?? "browser");
  if (!entry) {
    const paths = getBrowserLogPaths(outDir, source);
    await Promise.all(
      [...new Set([...paths.rawPaths, ...paths.textPaths])].map((path) =>
        Bun.write(path, "")
      )
    );
    await appendFile(
      getRunIndexPath(outDir),
      `${JSON.stringify(getBrowserRunRecord(outDir, paths, source))}\n`
    );
    entry = { paths, source };
    sources.set(source ?? "browser", entry);
  }

  const normalized = normalizeBrowserEvent(event, source);
  await Promise.all([
    appendFile(entry.paths.rawPath, `${JSON.stringify(normalized)}\n`),
    ...entry.paths.rawPaths
      .filter((path) => path !== entry?.paths.rawPath)
      .map((path) => appendFile(path, `${JSON.stringify(normalized)}\n`)),
    appendFile(entry.paths.textPath, renderBrowserEvent(normalized)),
    ...entry.paths.textPaths
      .filter((path) => path !== entry?.paths.textPath)
      .map((path) => appendFile(path, renderBrowserEvent(normalized))),
  ]);
}

function normalizeBrowserEvent(event: BrowserEvent, source?: string) {
  const args = Array.isArray(event.args)
    ? event.args.map((value) => stringifyValue(value))
    : undefined;
  const message = [event.message, args?.join(" ")]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    kind: event.kind || "console",
    level: (event.level || "info").toUpperCase(),
    message: message || "(empty)",
    meta: event.meta,
    source: source || "browser",
    stack: event.stack,
    ts: event.ts || new Date().toISOString(),
    url: event.url,
  };
}

function renderBrowserEvent(event: ReturnType<typeof normalizeBrowserEvent>) {
  const header = [
    event.ts,
    event.level.padEnd(5, " "),
    event.source,
    event.message,
    event.url ? `(${event.url})` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  const stack = event.stack
    ? `${event.stack
        .split("\n")
        .filter(Boolean)
        .map((line) => `  ${line}`)
        .join("\n")}\n`
    : "";

  return `${header}\n${stack}`;
}

function cleanSource(source?: string) {
  const normalized = source?.trim();
  return normalized || undefined;
}

function stringifyValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}
