"use client";

import { MoonIcon, SunIcon, TerminalIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { GITHUB_URL } from "@/lib/constants";
import { GitHubIcon } from "./icons/github-icon";

export function NavHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <nav className="flex items-center gap-4 border-border border-b px-6 py-3">
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2">
        <TerminalIcon
          className="size-4 text-muted-foreground"
          weight="regular"
        />
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.34em]">
          OpenLogs
        </span>
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        <a
          aria-label="GitHub repository"
          className="inline-flex size-7 items-center justify-center text-muted-foreground outline outline-2 outline-transparent outline-offset-2 transition-[outline-color,color] hover:text-foreground focus-visible:outline-foreground"
          href={GITHUB_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <GitHubIcon className="size-4" />
        </a>
        <button
          aria-label="Toggle theme"
          className="inline-flex size-7 items-center justify-center text-muted-foreground outline outline-2 outline-transparent outline-offset-2 transition-[outline-color,color] hover:text-foreground focus-visible:outline-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          type="button"
        >
          {resolvedTheme === "dark" ? (
            <SunIcon className="size-4" weight="regular" />
          ) : (
            <MoonIcon className="size-4" weight="regular" />
          )}
        </button>
      </div>
    </nav>
  );
}
