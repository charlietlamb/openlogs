import { cn } from "@/lib/cn";
import {
  formatTimestamp,
  LOG_STEP_MS,
  type LogEntry,
  type LogLevel,
  timestampFormatter,
} from "./log-data";

const LEVEL_CLASS: Record<LogLevel, string> = {
  ERROR: "text-[var(--log-level-error)]",
  WARN: "text-[var(--log-level-warn)]",
  DEBUG: "text-[var(--log-level-debug)]",
  TRACE: "text-[var(--log-level-trace)]",
  INFO: "text-[var(--log-level-info)]",
};

const ROW_BG_CLASS: Record<LogLevel, string> = {
  ERROR: "bg-[var(--log-row-error-bg)]",
  WARN: "bg-[var(--log-row-warn-bg)]",
  DEBUG: "bg-[var(--log-row-debug-bg)]",
  TRACE: "bg-[var(--log-row-trace-bg)]",
  INFO: "bg-[var(--log-row-info-bg)]",
};

interface TerminalLayerProps {
  className?: string;
  logs: LogEntry[];
  now: number;
  reverse?: boolean;
  slow?: boolean;
}

export function TerminalLayer({
  logs,
  now,
  className,
  reverse = false,
  slow = false,
}: TerminalLayerProps) {
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
          "flex flex-col",
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
              "flex h-10 items-center gap-3 border-[var(--log-row-border)] border-t px-6 font-light font-mono text-[11px] text-[var(--log-fg)]",
              ROW_BG_CLASS[log.level]
            )}
            key={key}
          >
            <span className="shrink-0 text-[var(--log-ts)]">{timestamp}</span>
            <span
              className={cn("shrink-0 font-normal", LEVEL_CLASS[log.level])}
            >
              {log.level}
            </span>
            <span className="shrink-0 text-[var(--log-source)]">
              {log.source}
            </span>
            <span className="min-w-0 flex-1 truncate text-[var(--log-msg)]">
              {log.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
