import Image from "next/image";

interface Agent {
  href: string;
  label: string;
  src: string;
}

const AGENTS: Agent[] = [
  { href: "https://ampcode.com/", label: "AMP", src: "/agents/amp.svg" },
  {
    href: "https://antigravity.google/",
    label: "Antigravity",
    src: "/agents/antigravity.svg",
  },
  {
    href: "https://claude.com/product/claude-code",
    label: "Claude Code",
    src: "/agents/claude-code.svg",
  },
  {
    href: "https://clawd.bot/",
    label: "ClawdBot",
    src: "/agents/clawdbot.svg",
  },
  { href: "https://cline.bot/", label: "Cline", src: "/agents/cline.svg" },
  {
    href: "https://openai.com/codex",
    label: "Codex",
    src: "/agents/codex.svg",
  },
  { href: "https://cursor.sh", label: "Cursor", src: "/agents/cursor.svg" },
  { href: "https://factory.ai", label: "Droid", src: "/agents/droid.svg" },
  {
    href: "https://gemini.google.com",
    label: "Gemini",
    src: "/agents/gemini.svg",
  },
  {
    href: "https://github.com/features/copilot",
    label: "GitHub Copilot",
    src: "/agents/copilot.svg",
  },
  {
    href: "https://block.github.io/goose",
    label: "Goose",
    src: "/agents/goose.svg",
  },
  { href: "https://kilo.ai/", label: "Kilo", src: "/agents/kilo.svg" },
  {
    href: "https://kiro.dev/cli",
    label: "Kiro CLI",
    src: "/agents/kiro-cli.svg",
  },
  {
    href: "https://opencode.ai/",
    label: "OpenCode",
    src: "/agents/opencode.svg",
  },
  { href: "https://roocode.com/", label: "Roo", src: "/agents/roo.svg" },
  { href: "https://www.trae.ai/", label: "Trae", src: "/agents/trae.svg" },
  {
    href: "https://code.visualstudio.com/",
    label: "VSCode",
    src: "/agents/vscode.svg",
  },
  {
    href: "https://codeium.com/windsurf",
    label: "Windsurf",
    src: "/agents/windsurf.svg",
  },
];

export function AgentStrip() {
  return (
    <div className="group relative w-full overflow-hidden">
      <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-24 bg-gradient-to-r from-background to-transparent sm:w-32 lg:w-48" />
      <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-24 bg-gradient-to-l from-background to-transparent sm:w-32 lg:w-48" />

      <div className="agent-marquee flex min-w-max group-hover:[animation-play-state:paused]">
        {[0, 1].map((copy) => (
          <div
            aria-hidden={copy === 1}
            className="flex shrink-0 gap-2 pr-2 sm:gap-3 sm:pr-3"
            key={copy}
          >
            {AGENTS.map((agent) => (
              <a
                className="flex-shrink-0 opacity-50 grayscale invert transition-all duration-300 hover:opacity-100 hover:grayscale-0 dark:invert-0"
                href={agent.href}
                key={`${copy}-${agent.label}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Image
                  alt={agent.label}
                  className="h-[72px] w-auto object-contain lg:h-[88px]"
                  height={100}
                  loading="eager"
                  src={agent.src}
                  width={100}
                />
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
