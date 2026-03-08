"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";

export function CopyableCommand({ command }: { command: string }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex items-center justify-between border border-border px-4 py-3 font-mono text-sm">
      <code className="min-w-0 flex-1 truncate text-foreground/80">
        {command}
      </code>
      <button
        aria-label={`Copy ${command}`}
        className={cn(
          "ml-3 inline-flex size-6 shrink-0 items-center justify-center outline outline-2 outline-transparent outline-offset-2 transition-[outline-color,color] focus-visible:outline-foreground",
          copied
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => copy(command)}
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
