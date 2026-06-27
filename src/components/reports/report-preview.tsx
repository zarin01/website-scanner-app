import {
  Activity,
  Gauge,
  ListChecks,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { reportSections } from "@/lib/reports/default-content";

const icons = {
  "website-updates": ListChecks,
  ada: ShieldCheck,
  speed: Gauge,
  seo: Search,
  other: TriangleAlert,
};

export function ReportPreview() {
  return (
    <section className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <aside>
          <div className="sticky top-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-emerald-600" />
              Report Layout
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {reportSections.map((section) => (
                <div
                  key={section.key}
                  className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-0 last:pb-0"
                >
                  <span>{section.label}</span>
                  <span className="text-xs text-slate-400">{section.status}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="grid gap-4">
          {reportSections.map((section) => {
            const Icon = icons[section.key as keyof typeof icons] ?? Activity;

            return (
              <article
                key={section.key}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-950">
                        {section.label}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">{section.status}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800">
                    {section.score}
                  </div>
                </div>

                <div className="mt-5 grid gap-2">
                  {section.items.map((item) => (
                    <div
                      key={item}
                      className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                  <span className="font-semibold">Why it matters: </span>
                  {section.why}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
