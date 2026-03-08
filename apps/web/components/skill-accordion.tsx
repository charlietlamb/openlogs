"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useCopyToClipboard } from "@/lib/use-copy-to-clipboard";
import { AccordionTrigger } from "./accordion-trigger";

export function SkillAccordion({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  return (
    <div className="mt-4 border-border border-t pt-3">
      <AccordionTrigger
        label="View skill"
        onClick={() => setOpen((v) => !v)}
        open={open}
      />
      {open && (
        <div className="relative mt-3 border border-border">
          <button
            aria-label="Copy skill content"
            className={cn(
              "absolute top-3 right-3 inline-flex size-6 items-center justify-center outline-none transition-colors",
              copied
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => copy(content)}
            type="button"
          >
            {copied ? (
              <CheckIcon className="size-3.5" weight="bold" />
            ) : (
              <CopyIcon className="size-3.5" weight="regular" />
            )}
          </button>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap p-4 pr-10 font-mono text-[10px] text-foreground/70 leading-relaxed">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}
