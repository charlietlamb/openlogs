"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { buildLogs } from "./log-data";
import { TerminalLayer } from "./terminal-layer";

interface LogsPaneProps {
  className?: string;
}

export function LogsPane({ className }: LogsPaneProps) {
  const [logs] = useState(() => buildLogs());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className={cn(
        "relative h-full overflow-hidden bg-[var(--log-bg)]",
        className
      )}
    >
      <TerminalLayer className="absolute inset-0" logs={logs} now={now} />
      <TerminalLayer
        className="absolute inset-0 overflow-hidden opacity-[0.18] blur-[1px]"
        logs={[...logs].reverse()}
        now={now}
        reverse
        slow
      />
      {/* Fade masks — top and bottom */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--log-bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--log-bg)] to-transparent" />
    </div>
  );
}
