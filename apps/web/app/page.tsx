"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
  AgentStrip,
  ClaudeCodeIcon,
  OpenAiIcon,
  OpenCodeLogo,
} from "./agent-strip";
import { LogsPane } from "./logs-pane";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function Home() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText("npm i -g openlogs");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <section className="relative flex min-h-screen items-center">
        <div className="grid min-h-screen w-full overflow-hidden border-white/10 bg-black/18 backdrop-blur-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:border-y">
          <LogsPane className="min-h-[440px] lg:min-h-[78vh]" />

          <div
            className="relative flex flex-col justify-center border-white/10 border-t px-6 py-8 sm:px-10 lg:border-t-0 lg:border-l lg:px-14"
            id="content"
          >
            <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-white/10" />

            <div className="relative max-w-2xl">
              <div className="space-y-6">
                <AgentStrip />

                <h1 className="max-w-xl font-semibold text-4xl leading-[0.98] tracking-[-0.05em] sm:text-6xl">
                  Give{" "}
                  <span className="inline-flex translate-y-[-0.06em] align-middle text-white">
                    <ClaudeCodeIcon className="size-[0.92em]" />
                    <span className="sr-only">Claude Code</span>
                  </span>
                  ,{" "}
                  <span className="inline-flex translate-y-[-0.02em] align-middle text-white">
                    <OpenAiIcon className="size-[0.9em]" />
                    <span className="sr-only">OpenAI</span>
                  </span>
                  , and{" "}
                  <span className="inline-flex translate-y-[-0.04em] align-middle text-white">
                    <OpenCodeLogo className="h-[0.95em] w-[0.76em]" />
                    <span className="sr-only">OpenCode</span>
                  </span>{" "}
                  direct access to your logs.
                </h1>

                <p className="max-w-xl text-base text-white/68 leading-7 sm:text-lg">
                  OpenLogs turns raw product, API, worker, and infra events into
                  a stream agents can inspect so they can debug failures, trace
                  requests, and answer with real runtime context instead of
                  guesses.
                </p>

                <div className="flex items-center justify-between gap-4 border border-white/10 bg-white/[0.03] px-4 py-4 font-mono text-sm text-white/82">
                  <code className="overflow-x-auto">npm i -g openlogs</code>
                  <button
                    className={cn(
                      "inline-flex size-8 shrink-0 items-center justify-center border border-transparent text-white/68 outline-none transition-colors",
                      copied
                        ? "text-white"
                        : "hover:bg-white/5 hover:text-white"
                    )}
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
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  className="bg-white px-5 py-3 font-medium text-black"
                  href="#logs"
                >
                  Show the logs
                </a>
                <a
                  className="border border-white/12 bg-white/5 px-5 py-3 font-medium text-white/80 transition-colors hover:bg-white/8 hover:text-white"
                  href="#content"
                >
                  For coding agents
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
