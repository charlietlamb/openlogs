import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

interface AccordionTriggerProps {
  label: string;
  onClick: () => void;
  open: boolean;
}

export function AccordionTrigger({
  open,
  label,
  onClick,
}: AccordionTriggerProps) {
  return (
    <button
      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] transition-colors hover:text-foreground"
      onClick={onClick}
      type="button"
    >
      <CaretRightIcon
        className={cn("size-2.5 transition-transform", open && "rotate-90")}
        weight="bold"
      />
      {label}
    </button>
  );
}
