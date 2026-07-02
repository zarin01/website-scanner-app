import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  ListChecks,
  MonitorCog,
  Save,
  SearchCode,
  ShieldAlert,
} from "lucide-react";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const categoryLabels = {
  WEBSITE_UPDATES: "Needed Website Updates",
  FUNCTIONALITY: "Core Functionality",
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

const attentionConfig = {
  URGENT: {
    label: "Urgent",
    color: "#f87171",
    classes: "border-red-300/30 bg-red-300/10 text-red-100",
  },
  HIGH: {
    label: "High",
    color: "#fb923c",
    classes: "border-orange-300/30 bg-orange-300/10 text-orange-100",
  },
  MEDIUM: {
    label: "Medium",
    color: "#fbbf24",
    classes: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  LOW: {
    label: "Low",
    color: "#34d399",
    classes: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  },
};

const attentionOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
const categoryOrder = [
  "WEBSITE_UPDATES",
  "FUNCTIONALITY",
  "ADA",
  "SPEED",
  "SEO",
  "SECURITY",
  "TECHNICAL",
  "OTHER",
] as const;

const statusStyles = {
  QUEUED: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  RUNNING: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  COMPLETED: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  FAILED: "border-red-300/25 bg-red-300/10 text-red-100",
  CANCELLED: "border-slate-300/25 bg-slate-300/10 text-slate-100",
};

const platformStatusStyles = {
  pass: "border-emerald-300/25 bg-emerald-300/10 text-emerald-50",
  warn: "border-amber-300/25 bg-amber-300/10 text-amber-50",
  fail: "border-red-300/25 bg-red-300/10 text-red-50",
};

type ReportFinding = {
  id: string;
  category: keyof typeof categoryLabels;
  severity: keyof typeof severityStyles;
  title: string;
  description: string;
  impact: string | null;
  recommendation: string | null;
  evidence: unknown;
  source: string;
};

type SavedReport = {
  id: string;
  title: string;
  summary: string | null;
  content: unknown;
  createdAt: Date;
  scan: {
    urls: {
      url: string;
      normalizedUrl: string;
    }[];
  };
};

type PlatformStatus = "pass" | "warn" | "fail";

type PlatformCard = {
  title: string;
  status: PlatformStatus;
  label: string;
  detail: string;
};

type PlatformSnapshot = PlatformCard[];

type WebsiteMetric = {
  label: string;
  value: string;
  detail?: string;
  status?: PlatformStatus;
};

type SectionRating = {
  category: keyof typeof categoryLabels;
  score: number;
  findingCount: number;
  attention: keyof typeof attentionConfig;
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

  const rootUrl = scan.urls[0]?.normalizedUrl ?? scan.urls[0]?.url ?? "";
  const savedReports = rootUrl
    ? await prisma.report.findMany({
        where: {
          audience: "CLIENT",
          format: "HTML",
          scan: {
            urls: {
              some: {
                normalizedUrl: rootUrl,
              },
            },
          },
        },
        include: {
          scan: {
            include: {
              urls: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      })
    : [];

  const groupedFindings = scan.findings.reduce(
    (groups, finding) => {
      groups[finding.category] ??= [];
      groups[finding.category].push(finding);
      return groups;
    },
    {} as Record<keyof typeof categoryLabels, typeof scan.findings>,
  );
  const orderedGroups = categoryOrder
    .filter((category) => groupedFindings[category]?.length > 0)
    .map((category) => ({
      category,
      findings: sortFindingsByAttention(groupedFindings[category]),
      score: getSectionScore(groupedFindings[category]),
    }))
    .sort((first, second) => {
      const scoreDifference = first.score - second.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return categoryOrder.indexOf(first.category) - categoryOrder.indexOf(second.category);
    });

  const isProcessing = scan.status === "QUEUED" || scan.status === "RUNNING";
  const platformSnapshot = getPlatformSnapshot(scan.findings);
  const websiteMetrics = getWebsiteMetrics(scan.findings);
  const sectionRatings = categoryOrder.map((category) => {
    const findings = groupedFindings[category] ?? [];

    return {
      category,
      score: getSectionScore(findings),
      findingCount: findings.length,
      attention: getPrimaryAttention(findings),
    };
  });

  return (
    <main className="min-h-screen bg-[#070b10] text-slate-100">
      {isProcessing ? <meta httpEquiv="refresh" content="5" /> : null}
      <section className="border-b border-white/10 bg-[#0b1118]">
        <div className="mx-auto w-full max-w-8xl px-4 py-6 sm:px-6 lg:px-8">
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
          <RatingOverviewPanel ratings={sectionRatings} />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-8xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
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

          <SaveReportPanel scanId={scan.id} savedReports={savedReports} />
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

          <WebsiteMetricsPanel metrics={websiteMetrics} />

          <PlatformSnapshotCards snapshot={platformSnapshot} />

          {scan.findings.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <h2 className="font-semibold text-white">No findings yet</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The scan record exists, but no findings have been saved yet.
              </p>
            </div>
          ) : (
            orderedGroups.map(({ category, findings }) =>
              category === "WEBSITE_UPDATES" ? (
                <WebsiteUpdatesSection
                  key={category}
                  findings={findings}
                  urlCount={scan.urls.length}
                />
              ) : (
                <GenericFindingSection
                  key={category}
                  category={category}
                  findings={findings}
                />
              ),
            )
          )}
        </div>
      </section>
    </main>
  );
}

function RatingOverviewPanel({ ratings }: { ratings: SectionRating[] }) {
  if (ratings.length === 0) {
    return null;
  }

  const sortedRatings = [...ratings].sort((first, second) => {
    const scoreDifference = first.score - second.score;

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return categoryOrder.indexOf(first.category) - categoryOrder.indexOf(second.category);
  });
  const issueCount = ratings.reduce((total, rating) => total + rating.findingCount, 0);

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Report Ratings
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Scores by section, worst to best
          </h2>
        </div>
        <div className="text-sm text-slate-400">
          {issueCount} issue{issueCount === 1 ? "" : "s"} found
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {sortedRatings.map((rating) => (
          <div
            key={rating.category}
            className="flex min-h-[156px] flex-col items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3 text-center"
          >
            <MiniScoreCircle score={rating.score} attention={rating.attention} />
            <div className="mt-3">
              <div className="text-sm font-semibold leading-5 text-white">
                {categoryLabels[rating.category]}
              </div>
              <div
                className={`mt-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${attentionConfig[rating.attention].classes}`}
              >
                {rating.findingCount > 0
                  ? `${rating.findingCount} issue${rating.findingCount === 1 ? "" : "s"}`
                  : "No issues"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveReportPanel({
  scanId,
  savedReports,
}: {
  scanId: string;
  savedReports: SavedReport[];
}) {
  const latest = getSavedReportMeta(savedReports[0]?.content);
  const previous = getSavedReportMeta(savedReports[1]?.content);
  const improvement =
    latest && previous ? latest.overallScore - previous.overallScore : null;

  return (
    <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
        <Save className="h-4 w-4" />
        Save & PDF
      </div>
      <p className="mt-2 text-sm leading-6 text-emerald-50/80">
        Save a dated report before updates, then scan again after the work to
        compare scores.
      </p>

      <div className="mt-4 grid gap-2">
        <form action={`/api/scans/${scanId}/reports`} method="post">
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
          >
            <Save className="h-4 w-4" />
            Save Report
          </button>
        </form>
        <a
          href={`/api/scans/${scanId}/reports/pdf`}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      </div>

      {improvement !== null ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
            Latest change
          </div>
          <div className="mt-1 text-2xl font-semibold text-white">
            {improvement > 0 ? "+" : ""}
            {improvement}
          </div>
          <p className="text-xs leading-5 text-emerald-50/70">
            Compared with the previous saved report for this website.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
          Saved reports
        </div>
        {savedReports.length > 0 ? (
          savedReports.map((report) => {
            const meta = getSavedReportMeta(report.content);

            return (
              <div
                key={report.id}
                className="rounded-lg border border-white/10 bg-black/20 p-1"
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {formatDate(report.createdAt)}
                    </div>
                    <div className="mt-1 break-words text-xs leading-5 text-emerald-50/70">
                      {meta?.website ?? report.scan.urls[0]?.url ?? "Saved website report"}
                    </div>
                  </div>
                  <div className="rounded-full border border-emerald-300/30 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                    {meta ? `${meta.overallScore}/100` : "Saved"}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm leading-6 text-emerald-50/70">
            No saved reports yet for this website.
          </p>
        )}
      </div>
    </div>
  );
}

function WebsiteMetricsPanel({ metrics }: { metrics: WebsiteMetric[] }) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Website Metrics
          </div>
          <h2 className="mt-1 text-lg font-semibold text-white">
            Basic information found during the scan
          </h2>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={`rounded-lg border p-3 ${
              metric.status
                ? platformStatusStyles[metric.status]
                : "border-white/10 bg-black/20 text-slate-100"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
              {metric.label}
            </div>
            <div className="mt-2 break-words text-lg font-semibold text-white">
              {metric.value}
            </div>
            {metric.detail ? (
              <p className="mt-1 text-xs leading-5 opacity-75">{metric.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlatformSnapshotCards({ snapshot }: { snapshot: PlatformSnapshot }) {
  if (snapshot.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {snapshot.map((card) => (
        <div
          key={card.title}
          className={`rounded-lg border p-4 ${platformStatusStyles[card.status]}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-75">
                {card.title}
              </div>
              <h2 className="mt-2 text-lg font-semibold text-white">{card.label}</h2>
            </div>
            <span className="rounded-full border border-current/25 px-2.5 py-1 text-xs font-semibold uppercase">
              {card.status === "pass"
                ? "Pass"
                : card.status === "fail"
                  ? "Update"
                  : "Review"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 opacity-85">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function WebsiteUpdatesSection({
  findings,
  urlCount,
}: {
  findings: ReportFinding[];
  urlCount: number;
}) {
  const evidence = collectUpdateEvidence(findings);
  const score = getSectionScore(findings);
  const primaryAttention = getPrimaryAttention(findings);

  return (
    <section className="overflow-hidden rounded-lg border border-emerald-300/20 bg-[#0f151d]">
      <SectionTopBand attention={primaryAttention} />
      <div className="border-b border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
              <MonitorCog className="h-4 w-4" />
              Needed Website Updates
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Maintenance and platform signals found on the site
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              This section turns visible site clues into a maintenance checklist.
              It is not saying every plugin or theme is broken. It shows what a
              developer should verify first in wp-admin, hosting, backups, and
              source control.
            </p>
          </div>
          <div className="grid gap-3 sm:min-w-[360px] sm:grid-cols-[120px_1fr]">
            <ScoreRing score={score} attention={primaryAttention} />
            <div className="grid grid-cols-2 gap-2 text-center">
              <MetricCard
                label="Needs Attention"
                value={attentionConfig[primaryAttention].label}
                tone={primaryAttention}
              />
              <MetricCard label="Signals" value={String(findings.length)} tone="CYAN" />
              <MetricCard label="URLs" value={String(urlCount)} tone="SLATE" />
              <MetricCard label="Perfect" value="100%" tone="EMERALD" />
            </div>
          </div>
        </div>
        <AttentionSummary findings={findings} />
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <UpdateSummaryCard
              icon={<ListChecks className="h-4 w-4" />}
              label="What to verify"
              items={[
                "WordPress core",
                "PHP version",
                "Active plugins",
                "Active theme",
                "Backups before updates",
              ]}
            />
            <UpdateSummaryCard
              icon={<SearchCode className="h-4 w-4" />}
              label="Visible evidence"
              items={[
                `${evidence.plugins.length} plugin clue${evidence.plugins.length === 1 ? "" : "s"}`,
                `${evidence.themes.length} theme clue${evidence.themes.length === 1 ? "" : "s"}`,
                evidence.server ? "Server header found" : "Server header hidden",
                evidence.generator ? "Generator tag found" : "Generator tag hidden",
              ]}
            />
            <UpdateSummaryCard
              icon={<ShieldAlert className="h-4 w-4" />}
              label="Cannot verify publicly"
              items={[
                "Actual PHP version",
                "Exact plugin versions",
                "Available updates",
                "Backup status",
              ]}
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white">Action Checklist</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {[
                "Log into wp-admin and check core/plugin/theme update notices.",
                "Check hosting for PHP version, SSL, backups, and staging availability.",
                "Review visible plugins and remove anything unused or abandoned.",
                "Confirm theme updates will not overwrite custom work.",
                "Run updates in staging first when the site is business-critical.",
                "Retest ADA, speed, and SEO after maintenance updates.",
              ].map((item) => (
                <div
                  key={item}
                  className="flex gap-2 rounded-lg border border-white/10 bg-black/15 p-3 text-sm leading-6 text-slate-300"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <AttentionFindingList
              findings={findings}
              renderFinding={(finding) => (
                <UpdateFindingCard key={finding.id} finding={finding} />
              )}
            />
          </div>
        </div>

        <div className="space-y-4">
          <EvidencePanel title="Examples From This Site">
            {evidence.examples.length > 0 ? (
              <div className="space-y-2">
                {evidence.examples.slice(0, 10).map((example, index) => (
                  <code
                    key={`${example}-${index}`}
                    className="block overflow-hidden text-ellipsis rounded-md border border-white/10 bg-black/25 px-3 py-2 text-xs leading-5 text-cyan-100"
                  >
                    {example}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-6 text-slate-400">
                No source path examples were stored for this scan.
              </p>
            )}
          </EvidencePanel>

          <EvidencePanel title="Detected Plugins">
            {evidence.plugins.length > 0 ? (
              <TagList items={evidence.plugins} />
            ) : (
              <p className="text-sm text-slate-400">No plugin slugs detected.</p>
            )}
          </EvidencePanel>

          <EvidencePanel title="Detected Theme / Server">
            <div className="space-y-3 text-sm leading-6 text-slate-300">
              <InfoRow label="Theme" value={evidence.themes.join(", ") || "Not detected"} />
              <InfoRow label="Server" value={evidence.server ?? "Hidden"} />
              <InfoRow label="Powered By" value={evidence.poweredBy ?? "Hidden"} />
              <InfoRow label="Generator" value={evidence.generator ?? "Hidden"} />
            </div>
          </EvidencePanel>

          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
            <span className="font-semibold">Important: </span>
            public scans can detect clues, not the exact update state. To confirm
            “needs WordPress/PHP/plugin update,” connect the site, use wp-admin,
            or check hosting.
          </div>
        </div>
      </div>
    </section>
  );
}

function GenericFindingSection({
  category,
  findings,
}: {
  category: (typeof categoryOrder)[number];
  findings: ReportFinding[];
}) {
  const score = getSectionScore(findings);
  const primaryAttention = getPrimaryAttention(findings);

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-[#0f151d]">
      <SectionTopBand attention={primaryAttention} />
      <div className="border-b border-white/10 bg-white/[0.03] p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_120px] lg:items-center">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {getCategoryContext(category)}
            </div>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {categoryLabels[category]}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {getCategorySummary(category, findings)}
            </p>
          </div>
          <ScoreRing score={score} attention={primaryAttention} />
        </div>
        <AttentionSummary findings={findings} />
      </div>

      <div className="space-y-4 p-5">
        <AttentionFindingList
          findings={findings}
          renderFinding={(finding) => (
            <article
              key={finding.id}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
            >
              <FindingHeader finding={finding} />
              <RecommendationBlocks finding={finding} />
              <EvidenceDetails finding={finding} />
            </article>
          )}
        />
      </div>
    </section>
  );
}

function FindingHeader({ finding }: { finding: ReportFinding }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-semibold text-white">{finding.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">{finding.description}</p>
      </div>
      <span
        className={`inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${severityStyles[finding.severity]}`}
      >
        {finding.severity}
      </span>
    </div>
  );
}

function SectionTopBand({
  attention,
}: {
  attention: keyof typeof attentionConfig;
}) {
  return (
    <div
      className="h-1.5"
      style={{
        background: `linear-gradient(90deg, ${attentionConfig[attention].color}, rgba(255,255,255,0.08))`,
      }}
    />
  );
}

function ScoreRing({
  score,
  attention,
}: {
  score: number;
  attention: keyof typeof attentionConfig;
}) {
  const color = attentionConfig[attention].color;

  return (
    <div className="flex justify-center">
      <div
        className="grid h-28 w-28 place-items-center rounded-full p-1"
        style={{
          background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
        }}
        aria-label={`Section score ${score} percent`}
      >
        <div className="grid h-full w-full place-items-center rounded-full bg-[#0f151d] text-center">
          <div>
            <div className="text-3xl font-semibold text-white">{score}</div>
            <div className="text-xs font-medium text-slate-500">/ 100</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniScoreCircle({
  score,
  attention,
}: {
  score: number;
  attention: keyof typeof attentionConfig;
}) {
  const color = attentionConfig[attention].color;

  return (
    <div
      className="grid h-20 w-20 place-items-center rounded-full p-1"
      style={{
        background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
      }}
      aria-label={`Section score ${score} percent`}
    >
      <div className="grid h-full w-full place-items-center rounded-full bg-[#0f151d] text-center">
        <div>
          <div className="text-xl font-semibold text-white">{score}</div>
          <div className="text-[10px] font-medium text-slate-500">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function AttentionSummary({ findings }: { findings: ReportFinding[] }) {
  const summary = getAttentionSummary(findings);

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-4">
      {attentionOrder.map((attention) => (
        <div
          key={attention}
          className={`rounded-lg border px-3 py-2 ${attentionConfig[attention].classes}`}
        >
          <div className="text-lg font-semibold">{summary[attention]}</div>
          <div className="text-xs font-medium opacity-80">
            {attentionConfig[attention].label}
          </div>
        </div>
      ))}
    </div>
  );
}

function AttentionFindingList({
  findings,
  renderFinding,
}: {
  findings: ReportFinding[];
  renderFinding: (finding: ReportFinding) => ReactNode;
}) {
  const grouped = attentionOrder
    .map((attention) => ({
      attention,
      findings: findings.filter((finding) => getAttentionLevel(finding) === attention),
    }))
    .filter((group) => group.findings.length > 0);

  return (
    <div className="space-y-5">
      {grouped.map((group) => (
        <section key={group.attention}>
          <div
            className={`mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${attentionConfig[group.attention].classes}`}
          >
            {attentionConfig[group.attention].label} Attention
          </div>
          <div className="space-y-3">{group.findings.map(renderFinding)}</div>
        </section>
      ))}
    </div>
  );
}

function UpdateFindingCard({ finding }: { finding: ReportFinding }) {
  const examples = getStringArrayFromEvidence(finding.evidence, "examples");

  return (
    <article className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <FindingHeader finding={finding} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
        <div className="space-y-3">
          <RecommendationBlocks finding={finding} />
          <EvidenceDetails finding={finding} />
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
            Site example
          </div>
          {examples.length > 0 ? (
            <code className="mt-2 block overflow-hidden text-ellipsis text-xs leading-5 text-cyan-50">
              {examples[0]}
            </code>
          ) : (
            <p className="mt-2 text-sm leading-6 text-cyan-100/80">
              No source example stored for this item.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof attentionConfig | "EMERALD" | "CYAN" | "SLATE";
}) {
  const tones = {
    URGENT: "border-red-300/20 bg-red-300/10 text-red-100",
    HIGH: "border-orange-300/20 bg-orange-300/10 text-orange-100",
    MEDIUM: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    LOW: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    EMERALD: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
    CYAN: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    SLATE: "border-white/10 bg-white/[0.04] text-slate-100",
  };

  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs text-current opacity-75">{label}</div>
    </div>
  );
}

function UpdateSummaryCard({
  icon,
  label,
  items,
}: {
  icon: ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-emerald-300">{icon}</span>
        {label}
      </div>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-sm text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidencePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function RecommendationBlocks({ finding }: { finding: ReportFinding }) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
          Recommended fix
        </div>
        <p className="mt-2 text-sm leading-6 text-emerald-50">
          {finding.recommendation ?? "Review this item during the maintenance check."}
        </p>
      </div>
      {finding.impact ? (
        <div className="rounded-lg border border-sky-300/20 bg-sky-300/10 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-200">
            Why it matters
          </div>
          <p className="mt-2 text-sm leading-6 text-sky-50">{finding.impact}</p>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceDetails({ finding }: { finding: ReportFinding }) {
  const counts = getEvidenceCounts(finding.evidence);
  const examples = getStringArrayFromEvidence(finding.evidence, "examples");
  const missingSecurityHeaders = getStringArrayFromEvidence(
    finding.evidence,
    "missingSecurityHeaders",
  );

  if (counts.length === 0 && examples.length === 0 && missingSecurityHeaders.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
        Specific items found on this site
      </div>

      {counts.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {counts.slice(0, 6).map((count, index) => (
            <div
              key={`${count.label}-${count.value}-${index}`}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
            >
              <div className="text-lg font-semibold text-white">{count.value}</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{count.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {missingSecurityHeaders.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {missingSecurityHeaders.map((header, index) => (
            <span
              key={`${header}-${index}`}
              className="rounded-full border border-orange-300/20 bg-orange-300/10 px-2.5 py-1 text-xs font-medium text-orange-100"
            >
              {header}
            </span>
          ))}
        </div>
      ) : null}

      {examples.length > 0 ? (
        <div className="mt-3 space-y-2">
          {examples.slice(0, 6).map((example, index) => (
            <code
              key={`${example}-${index}`}
              className="block overflow-hidden text-ellipsis rounded-md border border-white/10 bg-[#070b10] px-3 py-2 text-xs leading-5 text-cyan-100"
            >
              {example}
            </code>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 24).map((item) => (
        <span
          key={item}
          className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs font-medium text-slate-200"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-white/10 pb-2 last:border-0 last:pb-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="break-words text-slate-200">{value}</span>
    </div>
  );
}

function collectUpdateEvidence(findings: ReportFinding[]) {
  const plugins = new Set<string>();
  const themes = new Set<string>();
  const examples = new Set<string>();
  let server: string | undefined;
  let poweredBy: string | undefined;
  let generator: string | undefined;

  findings.forEach((finding) => {
    getStringArrayFromEvidence(finding.evidence, "plugins").forEach((plugin) =>
      plugins.add(plugin),
    );
    getStringArrayFromEvidence(finding.evidence, "themes").forEach((theme) =>
      themes.add(theme),
    );
    getStringArrayFromEvidence(finding.evidence, "examples").forEach((example) =>
      examples.add(example),
    );
    server ??= getStringFromEvidence(finding.evidence, "server");
    poweredBy ??= getStringFromEvidence(finding.evidence, "poweredBy");
    generator ??= getStringFromEvidence(finding.evidence, "generator");
  });

  return {
    plugins: Array.from(plugins),
    themes: Array.from(themes),
    examples: Array.from(examples),
    server,
    poweredBy,
    generator,
  };
}

function sortFindingsByAttention(findings: ReportFinding[]) {
  return [...findings].sort((first, second) => {
    const attentionDifference =
      attentionOrder.indexOf(getAttentionLevel(first)) -
      attentionOrder.indexOf(getAttentionLevel(second));

    if (attentionDifference !== 0) {
      return attentionDifference;
    }

    return severityWeight(second.severity) - severityWeight(first.severity);
  });
}

function getAttentionLevel(finding: ReportFinding) {
  if (finding.severity === "CRITICAL") {
    return "URGENT";
  }

  if (finding.severity === "HIGH") {
    return "HIGH";
  }

  if (finding.severity === "MEDIUM") {
    return "MEDIUM";
  }

  return "LOW";
}

function getAttentionSummary(findings: ReportFinding[]) {
  return findings.reduce(
    (summary, finding) => {
      summary[getAttentionLevel(finding)] += 1;
      return summary;
    },
    {
      URGENT: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    } as Record<keyof typeof attentionConfig, number>,
  );
}

function getPrimaryAttention(findings: ReportFinding[]) {
  return (
    attentionOrder.find((attention) =>
      findings.some((finding) => getAttentionLevel(finding) === attention),
    ) ?? "LOW"
  );
}

function getSectionScore(findings: ReportFinding[]) {
  const penalty = findings.reduce((total, finding) => {
    return total + severityWeight(finding.severity);
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function severityWeight(severity: ReportFinding["severity"]) {
  const weights = {
    CRITICAL: 35,
    HIGH: 25,
    MEDIUM: 14,
    LOW: 7,
    INFO: 0,
  };

  return weights[severity];
}

function getCategoryContext(category: keyof typeof categoryLabels) {
  const contexts = {
    WEBSITE_UPDATES: "Maintenance",
    FUNCTIONALITY: "Forms, email, and client actions",
    ADA: "Accessibility",
    SPEED: "Performance",
    SEO: "Search visibility",
    SECURITY: "Hardening",
    TECHNICAL: "Diagnostics",
    OTHER: "Additional signals",
  };

  return contexts[category];
}

function getCategorySummary(
  category: keyof typeof categoryLabels,
  findings: ReportFinding[],
) {
  const topAttention = attentionConfig[getPrimaryAttention(findings)].label;
  const count = findings.length;
  const plural = count === 1 ? "finding" : "findings";
  const summaries = {
    WEBSITE_UPDATES:
      "Maintenance clues from public source, headers, and CMS asset paths.",
    FUNCTIONALITY:
      "Public checks for contact forms, email DNS readiness, mail links, broken CTAs, and common client-action issues.",
    ADA: "Accessibility issues and baseline checks that can affect visitors using assistive technology.",
    SPEED:
      "Performance signals from visible page weight, scripts, styles, and image usage.",
    SEO: "Search visibility checks for titles, descriptions, headings, canonicals, robots, and sitemap signals.",
    SECURITY:
      "Security and trust checks from headers, HTTPS behavior, and mixed-content clues.",
    TECHNICAL:
      "Connection, response, redirect, and diagnostic details for developers.",
    OTHER: "Additional scanner findings that do not fit the main report groups.",
  };

  return `${summaries[category]} ${count} ${plural}; highest attention level: ${topAttention}.`;
}

function getStringArrayFromEvidence(evidence: unknown, key: string) {
  if (!isRecord(evidence) || !Array.isArray(evidence[key])) {
    return [];
  }

  return evidence[key].filter((item): item is string => typeof item === "string");
}

function getStringFromEvidence(evidence: unknown, key: string) {
  if (!isRecord(evidence)) {
    return undefined;
  }

  return typeof evidence[key] === "string" ? evidence[key] : undefined;
}

function getEvidenceCounts(evidence: unknown) {
  if (!isRecord(evidence) || !Array.isArray(evidence.counts)) {
    return [];
  }

  return evidence.counts
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const label = item.label;
      const value = item.value;

      if (typeof label !== "string" || typeof value !== "number") {
        return null;
      }

      return { label, value };
    })
    .filter((item): item is { label: string; value: number } => Boolean(item));
}

function getSavedReportMeta(content: unknown) {
  if (!isRecord(content)) {
    return null;
  }

  const overallScore = content.overallScore;
  const website = content.website;

  if (typeof overallScore !== "number") {
    return null;
  }

  return {
    overallScore,
    website: typeof website === "string" ? website : undefined,
  };
}

function getPlatformSnapshot(findings: ReportFinding[]): PlatformSnapshot {
  const snapshotFinding = findings.find((finding) => {
    if (!isRecord(finding.evidence)) {
      return false;
    }

    return isRecord(finding.evidence.platformSummary);
  });

  if (!snapshotFinding || !isRecord(snapshotFinding.evidence)) {
    return [];
  }

  const platformSummary = snapshotFinding.evidence.platformSummary;

  if (!isRecord(platformSummary)) {
    return [];
  }

  return [
    getPlatformCard(
      "PHP Version",
      platformSummary.php,
      "PHP hidden",
      "Confirm PHP version in hosting.",
    ),
    getPlatformCard(
      "WordPress Version",
      platformSummary.wordpress,
      "WP version hidden",
      "Confirm WordPress version in wp-admin.",
    ),
    getPlatformCard(
      "Plugin Updates",
      platformSummary.plugins,
      "Plugin versions hidden",
      "Confirm active plugin update notices in wp-admin.",
    ),
  ].filter((card): card is PlatformCard => Boolean(card));
}

function getWebsiteMetrics(findings: ReportFinding[]): WebsiteMetric[] {
  const metrics: WebsiteMetric[] = [];
  const responseFinding = findings.find(
    (finding) => finding.source === "technical-baseline" && finding.title === "Page response captured",
  );
  const responseEvidence = isRecord(responseFinding?.evidence)
    ? responseFinding.evidence
    : undefined;
  const status = getNumberFromEvidence(responseEvidence, "status");
  const finalUrl = getStringFromEvidence(responseEvidence, "finalUrl");
  const htmlSizeKb = getNumberFromEvidence(responseEvidence, "htmlSizeKb");
  const responseTimeMs = getNumberFromEvidence(responseEvidence, "responseTimeMs");
  const speedFinding = findings.find(
    (finding) => finding.source === "technical-baseline" && finding.category === "SPEED",
  );
  const speedEvidence = isRecord(speedFinding?.evidence) ? speedFinding.evidence : undefined;
  const imageCount = getNumberFromEvidence(speedEvidence, "imageCount");
  const scriptCount = getNumberFromEvidence(speedEvidence, "scriptCount");
  const stylesheetCount = getNumberFromEvidence(speedEvidence, "stylesheetCount");
  const performanceScore = getLighthouseScore(findings, "Lighthouse Performance score");
  const seoScore = getLighthouseScore(findings, "Lighthouse SEO score");
  const accessibilityScore = getLighthouseScore(findings, "Lighthouse Accessibility score");
  const bestPracticesScore = getLighthouseScore(findings, "Lighthouse Best Practices score");
  const fcp = getLighthouseDisplayValue(findings, "first-contentful-paint");
  const lcp = getLighthouseDisplayValue(findings, "largest-contentful-paint");
  const pageTitle = getStringFromEvidence(
    findings.find((finding) => finding.title === "Page title length should be reviewed")
      ?.evidence,
    "title",
  );
  const sitemapFinding = findings.find((finding) => finding.title === "Sitemap not found");
  const robotsFinding = findings.find((finding) => finding.title === "robots.txt not found");
  const noindexFinding = findings.find((finding) => finding.title === "Page has noindex directive");

  if (status !== undefined) {
    metrics.push({
      label: "HTTP Status",
      value: String(status),
      detail: finalUrl ? shortUrl(finalUrl) : undefined,
      status: status >= 200 && status < 400 ? "pass" : "fail",
    });
  }

  if (responseTimeMs !== undefined) {
    metrics.push({
      label: "HTML Response",
      value: formatMilliseconds(responseTimeMs),
      detail: "Time to fetch the page HTML",
      status: responseTimeMs < 1000 ? "pass" : responseTimeMs < 2500 ? "warn" : "fail",
    });
  }

  if (performanceScore !== undefined || fcp || lcp) {
    metrics.push({
      label: "Page Load Speed",
      value:
        performanceScore !== undefined
          ? `${performanceScore}/100`
          : fcp ?? lcp ?? "Measured",
      detail: [fcp ? `FCP ${fcp}` : "", lcp ? `LCP ${lcp}` : ""]
        .filter(Boolean)
        .join(" • "),
      status:
        performanceScore === undefined
          ? undefined
          : performanceScore >= 90
            ? "pass"
            : performanceScore >= 50
              ? "warn"
              : "fail",
    });
  }

  metrics.push({
    label: "Crawlable",
    value: noindexFinding || (status !== undefined && status >= 400) ? "Needs Review" : "Likely Yes",
    detail: noindexFinding
      ? "Noindex directive found"
      : status !== undefined && status >= 400
        ? `HTTP ${status} may block crawlers`
        : "No public noindex issue found",
    status: noindexFinding || (status !== undefined && status >= 400) ? "fail" : "pass",
  });

  metrics.push({
    label: "Robots / Sitemap",
    value: sitemapFinding || robotsFinding ? "Review" : "Found",
    detail: [
      robotsFinding ? "robots.txt missing" : "robots.txt ok",
      sitemapFinding ? "sitemap missing" : "sitemap ok",
    ].join(" • "),
    status: sitemapFinding ? "warn" : robotsFinding ? "warn" : "pass",
  });

  if (seoScore !== undefined || accessibilityScore !== undefined || bestPracticesScore !== undefined) {
    metrics.push({
      label: "Lighthouse Scores",
      value: [
        seoScore !== undefined ? `SEO ${seoScore}` : "",
        accessibilityScore !== undefined ? `ADA ${accessibilityScore}` : "",
        bestPracticesScore !== undefined ? `BP ${bestPracticesScore}` : "",
      ]
        .filter(Boolean)
        .join(" / "),
      detail: "SEO, accessibility, and best practices",
    });
  }

  if (htmlSizeKb !== undefined) {
    metrics.push({
      label: "Page Size",
      value: `${htmlSizeKb} KB`,
      detail: "HTML size only",
      status: htmlSizeKb < 250 ? "pass" : htmlSizeKb < 500 ? "warn" : "fail",
    });
  }

  if (
    imageCount !== undefined ||
    scriptCount !== undefined ||
    stylesheetCount !== undefined
  ) {
    metrics.push({
      label: "Assets",
      value: `${imageCount ?? 0} img / ${scriptCount ?? 0} JS / ${stylesheetCount ?? 0} CSS`,
      detail: "Visible source count",
    });
  }

  if (pageTitle) {
    metrics.push({
      label: "Page Title",
      value: pageTitle,
    });
  }

  return metrics.slice(0, 10);
}

function getLighthouseScore(findings: ReportFinding[], title: string) {
  const evidence = findings.find((finding) => finding.title === title)?.evidence;

  return getNumberFromEvidence(evidence, "score");
}

function getLighthouseDisplayValue(findings: ReportFinding[], auditId: string) {
  const evidence = findings.find((finding) => {
    if (!isRecord(finding.evidence)) {
      return false;
    }

    return finding.evidence.auditId === auditId;
  })?.evidence;

  return getStringFromEvidence(evidence, "displayValue");
}

function getPlatformCard(
  title: string,
  value: unknown,
  fallbackLabel: string,
  fallbackDetail: string,
): PlatformCard | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = value.status;
  const label = value.label;
  const detail = value.detail;
  const version = value.version;
  const latestVersion = value.latestVersion;
  const checkedCount = value.checkedCount;
  const outdatedCount = value.outdatedCount;
  const hasConcreteVersion =
    typeof version === "string" || typeof latestVersion === "string";
  const hasPluginCheck =
    typeof checkedCount === "number" && checkedCount > 0;
  const hasOutdatedPlugins =
    typeof outdatedCount === "number" && outdatedCount > 0;

  if (!hasConcreteVersion && !hasPluginCheck && !hasOutdatedPlugins) {
    return null;
  }

  return {
    title,
    status:
      status === "pass" || status === "warn" || status === "fail"
        ? status
        : "warn",
    label: typeof label === "string" ? label : fallbackLabel,
    detail: typeof detail === "string" ? detail : fallbackDetail,
  };
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getNumberFromEvidence(evidence: unknown, key: string) {
  if (!isRecord(evidence)) {
    return undefined;
  }

  return typeof evidence[key] === "number" ? evidence[key] : undefined;
}

function formatMilliseconds(milliseconds: number) {
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Math.round(milliseconds)}ms`;
}

function shortUrl(value: string) {
  return value.length > 58 ? `${value.slice(0, 55)}...` : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
