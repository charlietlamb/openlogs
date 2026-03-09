import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";
import { GITHUB_URL, INSTALL_COMMAND } from "@/lib/constants";
import { SKILL_CONTENT } from "@/lib/skill-content";
import { CopyableCommand } from "./copyable-command";
import { type Flag, FlagsAccordion } from "./flags-accordion";
import { SkillAccordion } from "./skill-accordion";

// Shared eyebrow label style — also used in nav-header
export const EYEBROW_CLS =
  "font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground";

interface Step {
  command: string;
  description?: string;
  flags?: Flag[];
  number: string;
  skillContent?: string;
  title: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Install the CLI",
    command: INSTALL_COMMAND,
  },
  {
    number: "02",
    title: "Wrap your dev command",
    description:
      "Prefix any command with openlogs (or ol) to capture its output into a live stream your agent can read.",
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
    title: "Let your agent tail the stream",
    description:
      "At any point in a debugging session your agent can read the live log stream directly, with no copy-pasting or context switching.",
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
    title: "Add the skill for hands-free debugging",
    description:
      "The OpenLogs skill tells your agent when and how to check logs automatically, so it reaches for real runtime data before asking you.",
    command: "npx skills add https://github.com/charlietlamb/openlogs",
    skillContent: SKILL_CONTENT,
  },
];

function SetupStep({
  number,
  title,
  description,
  command,
  flags,
  skillContent,
}: Step) {
  return (
    <div className="border-border border-b px-6 py-7">
      <p className={cn(EYEBROW_CLS, "mb-1")}>{number}</p>
      <h3 className={cn("font text-sm", description ? "mb-2" : "mb-4")}>
        {title}
      </h3>
      {description && (
        <p className="mb-4 text-muted-foreground text-xs leading-5">
          {description}
        </p>
      )}
      <CopyableCommand command={command} />
      {flags && <FlagsAccordion flags={flags} />}
      {skillContent && <SkillAccordion content={skillContent} />}
    </div>
  );
}

export function SetupGuide() {
  return (
    <div className="flex w-full flex-col border-border border-t lg:w-2/5 lg:shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
      <div className="border-border border-b px-6 py-3">
        <p className={cn(EYEBROW_CLS, "tracking-[0.34em]")}>Readme</p>
      </div>
      {STEPS.map((step) => (
        <SetupStep key={step.number} {...step} />
      ))}
      <div className="flex flex-1 flex-col justify-end px-6 py-7">
        <p className={cn(EYEBROW_CLS, "mb-1")}>05</p>
        <h3 className="mb-2 text-sm">Star on GitHub</h3>
        <p className="mb-4 text-muted-foreground text-xs leading-5">
          If OpenLogs saves you time, a star helps other developers find it.
        </p>
        <a
          className="inline-flex h-9 w-fit items-center gap-2 border border-border px-4 font-mono text-muted-foreground text-xs tracking-wide transition-colors hover:border-foreground hover:text-foreground"
          href={GITHUB_URL}
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
