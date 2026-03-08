import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { CopyableCommand } from "./copyable-command";
import { type Flag, FlagsAccordion } from "./flags-accordion";

interface Step {
  command: string;
  description?: string;
  flags?: Flag[];
  number: string;
  title: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Install the CLI",
    command: "npm i -g openlogs",
  },
  {
    number: "02",
    title: "Run with openlogs",
    description:
      "Prefix your existing dev command to pipe its output into the stream.",
    command: "openlogs bun run dev",
    flags: [
      {
        flag: "--out-dir <path>",
        description: "directory for log files",
        default: ".openlogs",
      },
      {
        flag: "--name <name>",
        description: "log filename base",
        default: "latest",
      },
      {
        flag: "--raw-only",
        description: "skip cleaned text log, write raw only",
      },
      { flag: "--text-only", description: "skip raw PTY log, write text only" },
      {
        flag: "--no-history",
        description: "don't write timestamped history copies",
      },
      {
        flag: "--print-paths",
        description: "print log file paths before running",
      },
    ],
  },
  {
    number: "03",
    title: "Tell your agent to use the CLI to check the logs",
    description:
      "Your agent can tail the live stream at any point during a debugging session.",
    command: "openlogs tail",
    flags: [
      {
        flag: "--out-dir <path>",
        description: "directory to find log file",
        default: ".openlogs",
      },
      {
        flag: "--raw",
        description: "read raw PTY log instead of cleaned text",
      },
      {
        flag: "[tail args...]",
        description: "forwarded to system tail (e.g. -f, -n 50)",
      },
    ],
  },
  {
    number: "04",
    title: "Install the skill to make this even easier",
    description:
      "The OpenLogs skill teaches your agent when and how to check logs automatically — no manual prompting needed.",
    command: "npx skills add https://github.com/charlietlamb/openlogs",
  },
];

function SetupStep({ number, title, description, command, flags }: Step) {
  return (
    <div className="border-border border-b px-6 py-7">
      <p className="mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
        {number}
      </p>
      <h3
        className={cn("font-semibold text-sm", description ? "mb-2" : "mb-4")}
      >
        {title}
      </h3>
      {description && (
        <p className="mb-4 text-muted-foreground text-xs leading-5">
          {description}
        </p>
      )}
      <CopyableCommand command={command} />
      {flags && <FlagsAccordion flags={flags} />}
    </div>
  );
}

export function SetupGuide() {
  return (
    <div className="flex w-full flex-col border-border border-t lg:w-2/5 lg:shrink-0 lg:border-t-0 lg:border-l">
      <div className="border-border border-b px-6 py-3">
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.34em]">
          Readme
        </p>
      </div>
      {STEPS.map((step) => (
        <SetupStep key={step.number} {...step} />
      ))}
      {/* Star CTA */}
      <div className="flex flex-1 flex-col justify-end px-6 py-7">
        <p className="mb-1 font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          05
        </p>
        <h3 className="mb-2 font-semibold text-sm">Star us on GitHub</h3>
        <p className="mb-4 text-muted-foreground text-xs leading-5">
          If OpenLogs is useful to you, a star helps others find it.
        </p>
        <a
          className="inline-flex h-9 w-fit items-center gap-2 border border-border px-4 font-mono text-muted-foreground text-xs tracking-wide transition-colors hover:border-foreground hover:text-foreground"
          href="https://github.com/charlietlamb/openlogs"
          rel="noopener noreferrer"
          target="_blank"
        >
          <StarIcon className="size-3.5" weight="regular" />
          Star on GitHub
        </a>
      </div>
    </div>
  );
}
