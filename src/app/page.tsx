import {
  BarChart3,
  ClipboardList,
  Database,
  FileText,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import { ScanLauncher } from "@/components/dashboard/scan-launcher";
import { ReportPreview } from "@/components/reports/report-preview";

const featureCards = [
  { label: "ADA", value: "WAVE + axe checks", icon: ShieldCheck },
  { label: "Speed", value: "PageSpeed + Lighthouse", icon: Gauge },
  { label: "SEO", value: "Metadata, indexability, schema", icon: BarChart3 },
  { label: "Reports", value: "Client + developer views", icon: FileText },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#070b10] text-slate-100">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32rem),linear-gradient(180deg,#0b1118_0%,#070b10_100%)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Website Scanner</div>
              <div className="text-xs text-slate-400">Webdev audit reports</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:flex">
            <Database className="h-3.5 w-3.5 text-cyan-300" />
            Postgres + worker-ready
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-8 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8 lg:pb-10 lg:pt-6">
          <div className="w-full">
            <ScanLauncher />
          </div>

          <aside className="grid content-start gap-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm font-medium text-emerald-200">
                No report yet. Start with a URL.
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-normal text-white">
                Scan websites, rank fixes, and build reports clients can understand.
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Paste one URL or a batch list. The app stores raw scan data for
                developers and turns the findings into ADA, speed, SEO, and
                update sections for clients.
              </p>
            </div>

            {featureCards.map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{label}</div>
                    <div className="mt-1 text-sm leading-6 text-slate-400">{value}</div>
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-100">
              Raw scan data stays available for developers. The report text is
              written so clients understand why the work matters.
            </div>
          </aside>
        </div>
      </section>

      <ReportPreview />
    </main>
  );
}
