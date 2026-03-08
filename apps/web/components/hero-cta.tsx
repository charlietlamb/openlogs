"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { GitHubIcon } from "./icons/github-icon";

const INSTALL_COMMAND = "npm i -g openlogs";

export function HeroCta() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        className={cn(
          "inline-flex h-9 w-52 items-center justify-center gap-2 border border-foreground bg-foreground px-4 font-mono text-background text-xs tracking-wide outline outline-2 outline-offset-2 transition-[outline-color]",
          copied
            ? "outline-foreground"
            : "outline-transparent hover:outline-foreground"
        )}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <CheckIcon className="size-3.5" weight="bold" />
        ) : (
          <CopyIcon className="size-3.5" weight="regular" />
        )}
        {copied ? "Copied!" : "Copy install command"}
      </button>
      <a
        className="inline-flex h-9 items-center gap-2 border border-border px-4 font-mono text-muted-foreground text-xs tracking-wide transition-colors hover:border-foreground hover:text-foreground"
        href="https://github.com/charlietlamb/openlogs"
        rel="noopener noreferrer"
        target="_blank"
      >
        <GitHubIcon className="size-3.5" />
        View on GitHub
      </a>
    </div>
  );
}
