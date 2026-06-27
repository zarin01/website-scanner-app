import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const categoryLabels = {
  WEBSITE_UPDATES: "Needed Website Updates",
  ADA: "ADA Report",
  SPEED: "Speed Report",
  SEO: "SEO Report",
  SECURITY: "Security",
  TECHNICAL: "Technical",
  OTHER: "Other Issues",
};

const severityStyles = {
  INFO: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  LOW: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  MEDIUM: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  HIGH: "border-orange-300/20 bg-orange-300/10 text-orange-100",
  CRITICAL: "border-red-300/20 bg-red-300/10 text-red-100",
};

const statusStyles = {
  QUEUED: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  RUNNING: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  COMPLETED: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  FAILED: "border-red-300/25 bg-red-300/10 text-red-100",
  CANCELLED: "border-slate-300/25 bg-slate-300/10 text-slate-100",
};

export default async function ScanReportPage({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) {
  const { scanId } = await params;
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      project: {
        include: {
          client: true,
        },
      },
      urls: {
        orderBy: { createdAt: "asc" },
      },
      findings: {
        orderBy: [{ category: "asc" }, { severity: "desc" }, { sortOrder: "asc" }],
      },
    },
  });

  if (!scan) {
    notFound();
  }

  const groupedFindings = scan.findings.reduce(
    (groups, finding) => {
      groups[finding.category] ??= [];
      groups[finding.category].push(finding);
      return groups;
    },
    {} as Record<keyof typeof categoryLabels, typeof scan.findings>,
  );

  const isProcessing = scan.status === "QUEUED" || scan.status === "RUNNING";

  return (
    <main className="min-h-screen bg-[#070b10] text-slate-100">
      {isProcessing ? <meta httpEquiv="refresh" content="5" /> : null}
      <section className="border-b border-white/10 bg-[#0b1118]">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            New scan
          </Link>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-200">Scan Report</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {scan.project?.name ?? "Website scan"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                {scan.urls.length} URL{scan.urls.length === 1 ? "" : "s"} scanned.
                {scan.project?.client?.name ? ` Client: ${scan.project.client.name}.` : ""}
              </p>
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${statusStyles[scan.status]}`}
            >
              {scan.status === "COMPLETED" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : scan.status === "FAILED" ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}
              {scan.status}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8">
        <aside className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <h2 className="text-sm font-semibold text-white">Scanned URLs</h2>
            <div className="mt-4 space-y-3">
              {scan.urls.map((url) => (
                <div
                  key={url.id}
                  className="rounded-lg border border-white/10 bg-black/15 p-3"
                >
                  <div className="flex items-start gap-2">
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                    <div className="min-w-0">
                      <p className="break-words text-sm text-slate-200">{url.url}</p>
                      <p className="mt-1 text-xs text-slate-500">{url.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-400">
            <span className="font-semibold text-white">Current scan depth: </span>
            local baseline checks for website updates, SEO, ADA markup, speed
            signals, security headers, robots, and sitemap. WAVE and PageSpeed
            are the next provider adapters to turn on.
          </div>
        </aside>

        <div className="space-y-5">
          {isProcessing ? (
            <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-5 text-cyan-50">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 animate-pulse text-cyan-300" />
                <div>
                  <h2 className="font-semibold">Scan is processing</h2>
                  <p className="mt-1 text-sm leading-6 text-cyan-100/80">
                    This page refreshes every 5 seconds while the scan is queued or
                    running.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {scan.findings.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-semibold text-white">No findings yet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The scan record exists, but no findings have been saved yet.
              </p>
            </div>
          ) : (
            Object.entries(groupedFindings).map(([category, findings]) => (
              <section
                key={category}
                className="rounded-lg border border-white/10 bg-[#0f151d] p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg font-semibold text-white">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </h2>
                  <span className="text-sm text-slate-500">
                    {findings.length} finding{findings.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {findings.map((finding) => (
                    <article
                      key={finding.id}
                      className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-white">{finding.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-300">
                            {finding.description}
                          </p>
                        </div>
                        <span
                          className={`inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${severityStyles[finding.severity]}`}
                        >
                          {finding.severity}
                        </span>
                      </div>

                      {finding.impact || finding.recommendation ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {finding.impact ? (
                            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">
                              <span className="font-semibold">Why it matters: </span>
                              {finding.impact}
                            </div>
                          ) : null}
                          {finding.recommendation ? (
                            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm leading-6 text-emerald-100">
                              <span className="font-semibold">Recommended fix: </span>
                              {finding.recommendation}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
