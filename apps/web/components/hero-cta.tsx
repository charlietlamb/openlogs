"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { GITHUB_URL, INSTALL_COMMAND } from "@/lib/constants";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { GitHubIcon } from "./icons/github-icon";

export function HeroCta() {
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="flex items-center gap-3">
      <button
        className={cn(
          "inline-flex h-9 w-52 items-center justify-center gap-2 border border-foreground bg-foreground px-4 font-mono text-background text-xs tracking-wide outline outline-2 outline-offset-2 transition-[outline-color] focus-visible:outline-foreground",
          copied
            ? "outline-foreground"
            : "outline-transparent hover:outline-foreground"
        )}
        onClick={() => copy(INSTALL_COMMAND)}
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
        className="inline-flex h-9 items-center gap-2 border border-border px-4 font-mono text-muted-foreground text-xs tracking-wide outline outline-2 outline-transparent outline-offset-2 transition-[outline-color,color,border-color] hover:border-foreground hover:text-foreground focus-visible:outline-foreground"
        href={GITHUB_URL}
        rel="noopener noreferrer"
        target="_blank"
      >
        <GitHubIcon className="size-3.5" />
        View on GitHub
      </a>
    </div>
  );
}
