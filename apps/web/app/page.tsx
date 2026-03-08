"use client";

import { CheckIcon, CopyIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { AgentStrip } from "./agent-strip";
import { LogsPane } from "./logs-pane";

export default function Home() {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  async function handleCopy() {
    await navigator.clipboard.writeText("npm i -g openlogs");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <section className="relative flex min-h-screen lg:border-border lg:border-y">
        {/* Left hatch column */}
        <div className="hatch-bg hidden w-12 shrink-0 border-border border-x lg:block" />

        {/* All content — single flex-col, gap-2 creates double-border gutters between rows */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Row 1 — label + theme toggle */}
          <div className="flex items-center justify-between border-border border-y px-6 py-3 sm:px-10 lg:px-12">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.34em]">
              Available for these agents
            </p>
            <button
              aria-label="Toggle theme"
              className="inline-flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              type="button"
            >
              {resolvedTheme === "dark" ? (
                <SunIcon className="size-4" weight="regular" />
              ) : (
                <MoonIcon className="size-4" weight="regular" />
              )}
            </button>
          </div>

          {/* Row 2 — agent marquee */}
          <div className="border-border border-y py-1">
            <AgentStrip />
          </div>

          {/* Rows 3+4 — headline + description grouped, single border between them */}
          <div className="flex flex-col">
            <div className="border-border border-y px-6 py-10 sm:px-10 lg:px-12">
              <h1 className="max-w-[600px] text-4xl leading-[0.97] tracking-tight sm:text-5xl lg:text-6xl">
                Give coding agents direct access to your logs.
              </h1>
            </div>
            <div className="border-border border-b px-6 py-5 sm:px-10 lg:px-12">
              <p className="max-w-xl text-base text-muted-foreground leading-7 sm:text-lg">
                OpenLogs turns raw product, API, worker, and infra events into a
                stream agents can inspect so they can debug failures, trace
                requests, and answer with real runtime context instead of
                guesses.
              </p>
            </div>
          </div>

          {/* Row 5 — logs (left) | npm install + CTAs (right) */}
          <div className="flex flex-1 overflow-hidden border-border border-y">
            {/* Left: logs pane fills remaining height */}
            <LogsPane className="min-h-[440px] min-w-0 flex-1 overflow-hidden" />

            {/* Right: npm + cta stacked with their own double-border gutters */}
            <div
              className="flex w-2/5 shrink-0 flex-col gap-2 border-border border-l"
              id="content"
            >
              {/* npm install — fills the row, no inner box */}
              <div className="flex items-center justify-between border-border border-b px-6 py-4 font-mono text-foreground/80 text-sm sm:px-10 lg:px-12">
                <code>npm i -g openlogs</code>
                <button
                  className={
                    copied
                      ? "inline-flex size-7 shrink-0 items-center justify-center text-foreground outline-none"
                      : "inline-flex size-7 shrink-0 items-center justify-center text-muted-foreground outline-none transition-colors hover:text-foreground"
                  }
                  onClick={handleCopy}
                  type="button"
                >
                  {copied ? (
                    <CheckIcon className="size-4" weight="bold" />
                  ) : (
                    <CopyIcon className="size-4" weight="regular" />
                  )}
                </button>
              </div>

              {/* CTAs */}
              <div className="border-border border-t px-6 py-4 sm:px-10 lg:px-12">
                <div className="flex flex-wrap gap-3">
                  <a
                    className="bg-foreground px-5 py-3 font-medium text-background transition-opacity hover:opacity-90"
                    href="#logs"
                  >
                    Show the logs
                  </a>
                  <a
                    className="border border-border bg-foreground/5 px-5 py-3 font-medium text-foreground/80 transition-colors hover:bg-foreground/8 hover:text-foreground"
                    href="#content"
                  >
                    For coding agents
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right hatch column */}
        <div className="hatch-bg hidden w-12 shrink-0 border-border border-x lg:block" />
      </section>
    </main>
  );
}
