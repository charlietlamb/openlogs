"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex items-center justify-between border border-border px-4 py-3 font-mono text-sm">
      <code className="min-w-0 flex-1 truncate text-foreground/80">
        {command}
      </code>
      <button
        aria-label={`Copy ${command}`}
        className={cn(
          "ml-3 inline-flex size-6 shrink-0 items-center justify-center outline-none",
          copied
            ? "text-foreground"
            : "text-muted-foreground transition-colors hover:text-foreground"
        )}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <CheckIcon className="size-3.5" weight="bold" />
        ) : (
          <CopyIcon className="size-3.5" weight="regular" />
        )}
      </button>
    </div>
  );
}
