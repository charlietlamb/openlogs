"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { GitHubIcon } from "./icons/github-icon";

export function NavHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between border-border border-b px-6 py-3">
      <a
        className="inline-flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        href="https://github.com/charlietlamb/openlogs"
        rel="noopener noreferrer"
        target="_blank"
      >
        <span className="sr-only">GitHub repository</span>
        <GitHubIcon className="size-4" />
      </a>
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.34em]">
        OpenLogs
      </p>
      <button
        aria-label="Toggle theme"
        className="inline-flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
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
  );
}
