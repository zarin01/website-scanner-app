import {
  Activity,
  Bot,
  Gauge,
  ListChecks,
  MonitorCog,
  MousePointerClick,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { reportSections } from "@/lib/reports/default-content";

const icons = {
  "website-updates": ListChecks,
  functionality: MousePointerClick,
  "ai-opportunities": Bot,
  ada: ShieldCheck,
  speed: Gauge,
  seo: Search,
  other: TriangleAlert,
};

export function ReportPreview() {
  const prioritySections = reportSections.slice(0, 3);

  return (
    <section className="border-t border-white/10 bg-[#111820]">
      <div className="mx-auto grid w-full max-w-8xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside>
          <div className="sticky top-6 rounded-lg border border-white/10 bg-[#18212c] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Activity className="h-4 w-4 text-emerald-300" />
              Report Setup
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The final report puts the most important problems first, then explains
              the update path.
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              {["Major issues", "Why it matters", "What to update"].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between border-b border-white/10 pb-2 last:border-0 last:pb-0"
                >
                  <span>{item}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-300" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-lg border border-white/10 bg-[#18212c] p-5 shadow-xl shadow-slate-950/20">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Scan Report Preview
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Major issues first, with the reason behind each update
              </h2>
              <div className="mt-5 grid gap-3">
                {prioritySections.map((section) => {
                  const Icon = icons[section.key as keyof typeof icons] ?? Activity;

                  return (
                    <article
                      key={section.key}
                      className="rounded-lg border border-white/10 bg-[#202a36] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{section.label}</h3>
                            <p className="mt-1 text-sm text-slate-400">
                              {section.status}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm font-semibold text-amber-100">
                          {section.score}
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <div className="rounded-lg border border-sky-300/20 bg-sky-300/10 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-sky-200">
                            Why it matters
                          </div>
                          <p className="mt-2 text-sm leading-6 text-sky-50">
                            {section.why}
                          </p>
                        </div>
                        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                            What gets checked
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {section.items.slice(0, 2).map((item) => (
                              <div key={item} className="flex gap-2 text-sm text-emerald-50">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-200" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-[#202a36] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <MonitorCog className="h-4 w-4 text-cyan-300" />
                Website Preview Area
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-white/10 bg-white">
                <div className="flex h-8 items-center gap-1 border-b border-slate-200 bg-slate-100 px-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="relative h-[310px] bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] p-4">
                  <div className="h-14 rounded-md bg-slate-300" />
                  <div className="mt-4 grid grid-cols-[1fr_90px] gap-3">
                    <div className="space-y-3">
                      <div className="h-5 rounded bg-slate-400" />
                      <div className="h-24 rounded bg-slate-200" />
                      <div className="h-16 rounded bg-slate-200" />
                    </div>
                    <div className="space-y-3">
                      <div className="h-20 rounded bg-slate-300" />
                      <div className="h-20 rounded bg-slate-300" />
                    </div>
                  </div>
                  <div className="absolute inset-x-3 bottom-3 rounded-lg border border-white/50 bg-[#18212c]/95 p-3 shadow-lg shadow-slate-950/20">
                    <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
                      Examples shown with the preview
                    </div>
                    <div className="mt-2 space-y-1.5 text-xs leading-5 text-slate-100">
                      <div>No AI chat assistant detected</div>
                      <div>Quote form could use AI intake</div>
                      <div>School or government ADA issues get flagged first</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {reportSections.map((section) => {
              const Icon = icons[section.key as keyof typeof icons] ?? Activity;

              return (
                <article
                  key={section.key}
                  className="rounded-lg border border-white/10 bg-[#202a36] p-4"
                >
                  <div className="flex gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold leading-5 text-white">
                        {section.label}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">{section.status}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-white/10 bg-slate-800/35 px-3 py-2 text-sm font-semibold text-slate-200">
                    {section.score}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
