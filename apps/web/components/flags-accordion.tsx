"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { AccordionTrigger } from "./accordion-trigger";

export interface Flag {
  default?: string;
  description: string;
  flag: string;
}

export function FlagsAccordion({ flags }: { flags: Flag[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-border border-t pt-3">
      <AccordionTrigger
        label="Flags"
        onClick={() => setOpen((v) => !v)}
        open={open}
      />
      {open && (
        <div className="mt-3 flex flex-col gap-1.5">
          {flags.map(({ flag, description, default: def }) => (
            <div className="flex items-baseline gap-3" key={flag}>
              <code
                className={cn(
                  "w-36 shrink-0 font-mono text-[10px] text-foreground/70"
                )}
              >
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
