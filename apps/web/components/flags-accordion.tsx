"use client";

import { CaretRightIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export interface Flag {
  default?: string;
  description: string;
  flag: string;
}

export function FlagsAccordion({ flags }: { flags: Flag[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-border border-t pt-3">
      <button
        className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] transition-colors hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <CaretRightIcon
          className={cn("size-2.5 transition-transform", open && "rotate-90")}
          weight="bold"
        />
        Flags
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-1.5">
          {flags.map(({ flag, description, default: def }) => (
            <div className="flex items-baseline gap-3" key={flag}>
              <code className="w-36 shrink-0 font-mono text-[10px] text-foreground/70">
                {flag}
              </code>
              <span className="min-w-0 font-mono text-[10px] text-muted-foreground">
                {description}
                {def && (
                  <span className="ml-1 text-foreground/40">
                    (default: {def})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
