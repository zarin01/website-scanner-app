const categoryLabels = {
  WEBSITE_UPDATES: "Needed Website Updates",
  FUNCTIONALITY: "Core Functionality",
  ADA: "ADA Report",
  SPEED: "Speed Report",
  SEO: "SEO Report",
  SECURITY: "Security",
  TECHNICAL: "Technical",
  OTHER: "Other Issues",
} as const;

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

const severityOrder = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
} as const;

type CategoryKey = keyof typeof categoryLabels;
type SeverityKey = keyof typeof severityOrder;

type SnapshotScan = {
  id: string;
  createdAt: Date;
  finishedAt: Date | null;
  project?: {
    name: string;
    client?: {
      name: string;
    } | null;
  } | null;
  urls: {
    url: string;
    normalizedUrl: string;
    finalUrl: string | null;
    title: string | null;
  }[];
  findings: {
    id: string;
    category: CategoryKey;
    severity: SeverityKey;
    title: string;
    description: string;
    impact: string | null;
    recommendation: string | null;
    evidence: unknown;
    source: string;
  }[];
};

export type ReportSnapshot = ReturnType<typeof buildReportSnapshot>;

export function buildReportSnapshot(scan: SnapshotScan, savedAt = new Date()) {
  const sections = categoryOrder
    .map((category) => {
      const findings = scan.findings
        .filter((finding) => finding.category === category)
        .sort((first, second) => {
          return (
            severityOrder[second.severity] - severityOrder[first.severity] ||
            first.title.localeCompare(second.title)
          );
        });

      return {
        category,
        label: categoryLabels[category],
        score: getSectionScore(findings),
        findings: findings.map((finding) => ({
          severity: finding.severity,
          title: finding.title,
          description: finding.description,
          recommendation:
            finding.recommendation ?? "Review this item during the maintenance check.",
          impact: finding.impact,
          source: finding.source,
          counts: getEvidenceCounts(finding.evidence),
          examples: getEvidenceExamples(finding.evidence),
        })),
      };
    })
    .filter((section) => section.findings.length > 0)
    .sort((first, second) => {
      return (
        first.score - second.score ||
        categoryOrder.indexOf(first.category) - categoryOrder.indexOf(second.category)
      );
    });

  const overallScore =
    sections.length > 0
      ? Math.round(
          sections.reduce((total, section) => total + section.score, 0) /
            sections.length,
        )
      : 100;

  return {
    scanId: scan.id,
    website: scan.urls[0]?.normalizedUrl ?? scan.urls[0]?.url ?? "Unknown website",
    client: scan.project?.client?.name ?? null,
    project: scan.project?.name ?? null,
    savedAt: savedAt.toISOString(),
    scannedAt: (scan.finishedAt ?? scan.createdAt).toISOString(),
    urlCount: scan.urls.length,
    overallScore,
    sections,
  };
}

function getSectionScore(findings: SnapshotScan["findings"]) {
  const penalty = findings.reduce((total, finding) => {
    return total + severityWeight(finding.severity);
  }, 0);

  return Math.max(0, Math.min(100, 100 - penalty));
}

function severityWeight(severity: SeverityKey) {
  const weights = {
    CRITICAL: 35,
    HIGH: 25,
    MEDIUM: 14,
    LOW: 7,
    INFO: 0,
  };

  return weights[severity];
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

function getEvidenceExamples(evidence: unknown) {
  if (!isRecord(evidence)) {
    return [];
  }

  const examples = Array.isArray(evidence.examples)
    ? evidence.examples.filter((item): item is string => typeof item === "string")
    : [];
  const missingHeaders = Array.isArray(evidence.missingSecurityHeaders)
    ? evidence.missingSecurityHeaders
        .filter((item): item is string => typeof item === "string")
        .map((header) => `Missing security header: ${header}`)
    : [];

  return [...examples, ...missingHeaders].slice(0, 8);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
