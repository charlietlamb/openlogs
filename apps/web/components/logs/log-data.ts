export const LOG_COUNT = 240;
export const LOG_STEP_MS = 367;
export const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG", "TRACE"] as const;
export const SOURCES = [
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

export type LogLevel = (typeof LEVELS)[number];

export interface LogEntry {
  level: LogLevel;
  message: string;
  source: string;
}

export const timestampFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatTimestamp(
  date: Date,
  formatter: Intl.DateTimeFormat
): string {
  return `${formatter.format(date)}.${String(date.getMilliseconds()).padStart(3, "0")}`;
}

export function buildLogs(): LogEntry[] {
  return Array.from({ length: LOG_COUNT }, (_, index) => {
    const source = SOURCES[(index * 3) % SOURCES.length];
    const level = LEVELS[(index * 7) % LEVELS.length];
    return { level, message: buildMessage(index, source, level), source };
  });
}

function buildMessage(index: number, source: string, level: LogLevel): string {
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
