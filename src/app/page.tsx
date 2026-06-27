import { BarChart3, Database, FileText, ShieldCheck } from "lucide-react";
import { ScanLauncher } from "@/components/dashboard/scan-launcher";
import { ReportPreview } from "@/components/reports/report-preview";

const featureCards = [
  { label: "ADA", value: "WAVE + axe", icon: ShieldCheck },
  { label: "Speed", value: "PageSpeed + Lighthouse", icon: BarChart3 },
  { label: "Reports", value: "Client + dev views", icon: FileText },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
              <span>Website Scanner</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>Webdev Audit System</span>
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
              Scan websites, rank fixes, and turn findings into client-ready
              reports.
            </h1>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {featureCards.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <Icon className="h-5 w-5 text-emerald-600" />
                  <div className="mt-3 text-sm font-semibold text-slate-950">
                    {label}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <Database className="h-4 w-4 text-slate-500" />
              Postgres stores raw scan data, normalized findings, and reports.
            </div>
          </div>

          <ScanLauncher />
        </div>
      </section>

      <ReportPreview />
    </main>
  );
}
