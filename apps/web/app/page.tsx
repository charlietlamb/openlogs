import { HeroCta } from "@/components/hero-cta";
import { NavHeader } from "@/components/nav-header";
import { SetupGuide } from "@/components/setup-guide";
import { AgentStrip } from "./agent-strip";
import { LogsPane } from "./logs";

function HatchColumn() {
  return (
    <div className="hatch-bg hidden w-12 shrink-0 border-border border-x lg:block" />
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="relative flex min-h-screen lg:h-dvh lg:border-border lg:border-y">
        <HatchColumn />

        {/* All content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <NavHeader />

          {/* Row 2 — agent marquee */}
          <div className="border-border border-b py-1">
            <AgentStrip />
          </div>

          {/* Row 3 — two-column layout */}
          <div className="flex flex-1 flex-col gap-2 lg:min-h-0 lg:flex-row">
            {/* LEFT column: headline → description → logs */}
            <div className="flex min-w-0 flex-1 flex-col gap-2 border-border lg:border-r">
              <div className="flex flex-col border-border border-b">
                <div className="border-border border-b px-6 py-10">
                  <h1 className="max-w-[600px] text-4xl leading-[0.97] tracking-tight sm:text-5xl lg:text-6xl">
                    Give agents direct access to your logs.
                  </h1>
                </div>
                <div className="border-border border-b px-6 py-5">
                  <p className="max-w-xl text-base text-muted-foreground leading-7 sm:text-lg">
                    OpenLogs turns raw product, API, worker, and infra events
                    into a stream agents can inspect so they can debug failures,
                    trace requests, and answer with real runtime context instead
                    of guesses.
                  </p>
                </div>
                <div className="px-6 py-5">
                  <HeroCta />
                </div>
              </div>

              <div className="min-h-[440px] flex-1 overflow-hidden border-border border-t">
                <LogsPane className="h-full w-full overflow-hidden" />
              </div>
            </div>

            <SetupGuide />
          </div>
        </div>

        <HatchColumn />
      </section>
    </main>
  );
}
