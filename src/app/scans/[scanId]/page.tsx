import { ReportPreview } from "@/components/reports/report-preview";

export default async function ScanReportPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-slate-500">Scan Report</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{scanId}</h1>
        </div>
      </section>
      <ReportPreview />
    </main>
  );
}
