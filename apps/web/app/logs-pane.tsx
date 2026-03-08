"use client";

import { useEffect, useState } from "react";

const LOG_COUNT = 240;
const LOG_STEP_MS = 367;
const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG", "TRACE"] as const;
const SOURCES = [
  "ingest.gateway",
  "timeline.query",
  "events.indexer",
  "alerts.worker",
  "session.replay",
  "auth.guard",
  "billing.webhook",
  "search.cache",
  "edge.proxy",
  "export.runner",
] as const;
const ACTIONS = [
  "hydrated stream window",
  "grouped request burst",
  "flushed cold shard",
  "attached replay context",
  "indexed event batch",
  "rebuilt trace graph",
  "resolved actor lookup",
  "trimmed noisy span set",
  "cached filter preset",
  "sealed export chunk",
] as const;

type LogLevel = (typeof LEVELS)[number];

interface LogEntry {
  level: LogLevel;
  levelClass: string;
  message: string;
  rowClass: string;
  source: string;
}

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function LogsPane({ className }: { className?: string }) {
  const [logs] = useState(() => buildLogs());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className={cn("relative overflow-hidden bg-black", className)}
      id="logs"
    >
      <div className="relative h-full overflow-hidden">
        <TerminalLayer className="absolute inset-0" logs={logs} now={now} />
        <TerminalLayer
          className="absolute inset-0 opacity-18 blur-[1px]"
          logs={[...logs].reverse()}
          now={now}
          reverse
          slow
        />
      </div>
    </div>
  );
}

function TerminalLayer({
  logs,
  now,
  className,
  reverse = false,
  slow = false,
}: {
  logs: LogEntry[];
  now: number;
  className?: string;
  reverse?: boolean;
  slow?: boolean;
}) {
  const items = [0, 1].flatMap((copy) =>
    logs.map((log, index) => ({
      key: `${copy}-${index}-${log.source}`,
      log,
      timestamp: formatTimestamp(
        new Date(now - (copy * logs.length + index) * LOG_STEP_MS),
        timestampFormatter
      ),
    }))
  );

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className={cn(
          "flex flex-col gap-0",
          reverse
            ? "animate-terminal-stream-reverse"
            : "animate-terminal-stream"
        )}
        style={{
          animationDuration: slow ? "128s" : "88s",
          animationTimingFunction: `steps(${logs.length})`,
        }}
      >
        {items.map(({ key, log, timestamp }) => (
          <div
            className={cn(
              "grid h-10 grid-cols-[auto_auto_auto_1fr] items-center gap-3 border-white/[0.04] border-t px-3 font-mono text-[11px] text-white/70 backdrop-blur-[2px]",
              log.rowClass
            )}
            key={key}
          >
            <span className="text-white/38">{timestamp}</span>
            <span className={cn("font-semibold", log.levelClass)}>
              {log.level}
            </span>
            <span className="text-white/62">{log.source}</span>
            <span className="truncate text-white/58">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildLogs() {
  return Array.from({ length: LOG_COUNT }, (_, index) => {
    const source = SOURCES[(index * 3) % SOURCES.length];
    const level = LEVELS[(index * 7) % LEVELS.length];

    return {
      level,
      levelClass: levelClass(level),
      message: buildMessage(index, source, level),
      rowClass: rowClass(level),
      source,
    };
  });
}

function buildMessage(index: number, source: string, level: LogLevel) {
  const request = `req_${(8400 + index).toString(36)}`;
  const session = `sess_${(220_000 + index * 17).toString(36)}`;
  const duration = 40 + ((index * 37) % 960);
  const count = 3 + ((index * 11) % 480);
  const action = ACTIONS[index % ACTIONS.length];

  if (level === "ERROR") {
    return `${action}; retry scheduled for ${request} after ${duration}ms on ${source}`;
  }

  if (level === "WARN") {
    return `${action}; elevated latency detected for ${session} with ${count} related events`;
  }

  if (level === "DEBUG") {
    return `${action}; trace ${request} expanded to ${count} correlated rows in ${duration}ms`;
  }

  if (level === "TRACE") {
    return `${action}; tail cursor advanced past shard-${(index % 8) + 1} for ${session}`;
  }

  return `${action}; ${count} records merged into ${request} from ${source} in ${duration}ms`;
}

function formatTimestamp(date: Date, formatter: Intl.DateTimeFormat) {
  return `${formatter.format(date)}.${String(date.getMilliseconds()).padStart(
    3,
    "0"
  )}`;
}

function levelClass(level: LogLevel) {
  switch (level) {
    case "ERROR":
      return "text-[#ff6b6b]";
    case "WARN":
      return "text-[#fbbf24]";
    case "DEBUG":
      return "text-[#7dd3fc]";
    case "TRACE":
      return "text-white/45";
    default:
      return "text-[#7cffb2]";
  }
}

function rowClass(level: LogLevel) {
  switch (level) {
    case "ERROR":
      return "border-[#ff6b6b]/22 bg-[#180909]/72";
    case "WARN":
      return "border-[#fbbf24]/18 bg-[#17130a]/58";
    case "DEBUG":
      return "border-[#7dd3fc]/14 bg-[#071116]/52";
    case "TRACE":
      return "border-white/8 bg-white/[0.02]";
    default:
      return "border-white/10 bg-black/30";
  }
}
