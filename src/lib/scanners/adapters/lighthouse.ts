import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import type { ScannerAdapter, ScannerFinding } from "@/lib/scanners/types";

type LighthouseAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  details?: unknown;
};

const categoryMap = {
  performance: "SPEED",
  accessibility: "ADA",
  "best-practices": "SECURITY",
  seo: "SEO",
} as const;

export const lighthouseScanner: ScannerAdapter = {
  name: "lighthouse",
  async run({ url }) {
    const chrome = await launch({
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
    });

    try {
      const result = await lighthouse(url, {
        port: chrome.port,
        logLevel: "error",
        output: "json",
        onlyCategories: Object.keys(categoryMap),
        maxWaitForLoad: 45000,
        maxWaitForFcp: 30000,
      });

      if (!result?.lhr) {
        throw new Error("Lighthouse did not return a report.");
      }

      const lhr = result.lhr;
      const findings: ScannerFinding[] = [];

      Object.entries(categoryMap).forEach(([lighthouseCategory, findingCategory]) => {
        const category = lhr.categories[lighthouseCategory];
        const score = typeof category?.score === "number" ? Math.round(category.score * 100) : null;

        findings.push({
          category: findingCategory,
          severity: score === null ? "INFO" : score < 50 ? "HIGH" : score < 90 ? "MEDIUM" : "INFO",
          title: `Lighthouse ${category?.title ?? lighthouseCategory} score`,
          description:
            score === null
              ? `Lighthouse captured ${category?.title ?? lighthouseCategory} data.`
              : `Lighthouse scored ${category?.title ?? lighthouseCategory} at ${score}/100.`,
          impact:
            "Lighthouse gives a standardized browser-based audit for performance, accessibility, SEO, and best practices.",
          recommendation:
            score !== null && score < 90
              ? "Review the failed Lighthouse audits below and prioritize template-level fixes."
              : "Keep monitoring this score after site updates.",
          evidence: {
            provider: "Lighthouse",
            score,
            counts: score === null ? [] : [{ label: `${category?.title ?? lighthouseCategory} score`, value: score }],
            finalDisplayedUrl: lhr.finalDisplayedUrl,
            fetchTime: lhr.fetchTime,
          },
          source: "lighthouse",
        });

        category?.auditRefs
          .map((ref) => lhr.audits[ref.id] as LighthouseAudit | undefined)
          .filter((audit): audit is LighthouseAudit => Boolean(audit))
          .filter(shouldCreateAuditFinding)
          .slice(0, 14)
          .forEach((audit, index) => {
            findings.push({
              category: findingCategory,
              severity: getAuditSeverity(audit),
              title: `Lighthouse: ${audit.title ?? audit.id ?? "Audit issue"}`,
              description: stripMarkdown(audit.description ?? "Lighthouse flagged this audit for review."),
              impact: getAuditImpact(lighthouseCategory),
              recommendation: getAuditRecommendation(audit),
              evidence: {
                provider: "Lighthouse",
                auditId: audit.id,
                displayValue: audit.displayValue,
                score: audit.score,
                counts: getAuditCounts(audit),
                examples: getAuditExamples(audit.details),
              },
              source: "lighthouse",
              sortOrder: index,
            });
          });
      });

      return findings;
    } finally {
      await chrome.kill();
    }
  },
};

function shouldCreateAuditFinding(audit: LighthouseAudit) {
  if (audit.scoreDisplayMode === "notApplicable" || audit.scoreDisplayMode === "manual") {
    return false;
  }

  if (typeof audit.score !== "number") {
    return Boolean(audit.displayValue);
  }

  return audit.score < 0.9;
}

function getAuditSeverity(audit: LighthouseAudit) {
  if (typeof audit.score !== "number") {
    return "MEDIUM";
  }

  if (audit.score < 0.5) {
    return "HIGH";
  }

  if (audit.score < 0.9) {
    return "MEDIUM";
  }

  return "LOW";
}

function getAuditImpact(lighthouseCategory: string) {
  const impacts = {
    performance:
      "Performance issues can slow page load, weaken Core Web Vitals, and reduce conversions from mobile visitors.",
    accessibility:
      "Accessibility issues can block visitors using assistive technology and can create compliance risk.",
    "best-practices":
      "Best-practice failures can point to browser security, trust, and maintainability problems.",
    seo: "SEO issues can reduce how clearly search engines understand and display this page.",
  };

  return impacts[lighthouseCategory as keyof typeof impacts] ?? "This Lighthouse audit should be reviewed.";
}

function getAuditRecommendation(audit: LighthouseAudit) {
  const displayValue = audit.displayValue ? ` Lighthouse measured: ${audit.displayValue}.` : "";

  return `Fix the affected page elements or assets flagged by this Lighthouse audit.${displayValue}`;
}

function getAuditCounts(audit: LighthouseAudit) {
  const counts = [];

  if (typeof audit.score === "number") {
    counts.push({ label: "Audit score", value: Math.round(audit.score * 100) });
  }

  if (audit.displayValue) {
    const number = Number(audit.displayValue.match(/[\d.]+/)?.[0]);

    if (Number.isFinite(number)) {
      counts.push({ label: audit.displayValue.replace(String(number), "").trim() || "Measured value", value: number });
    }
  }

  return counts;
}

function getAuditExamples(details: unknown) {
  const examples = new Set<string>();

  collectDetailExamples(details, examples);

  return Array.from(examples).slice(0, 8);
}

function collectDetailExamples(value: unknown, examples: Set<string>) {
  if (examples.size >= 8 || value === null || value === undefined) {
    return;
  }

  if (typeof value === "string") {
    if (isUsefulExample(value)) {
      examples.add(value.slice(0, 220));
    }
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((item) => collectDetailExamples(item, examples));
    return;
  }

  const record = value as Record<string, unknown>;
  ["url", "nodeLabel", "snippet", "selector", "source", "wastedBytes", "totalBytes"].forEach(
    (key) => collectDetailExamples(record[key], examples),
  );

  if (Array.isArray(record.items)) {
    record.items.slice(0, 10).forEach((item) => collectDetailExamples(item, examples));
  }
}

function isUsefulExample(value: string) {
  return (
    value.startsWith("http") ||
    value.startsWith("<") ||
    value.startsWith("#") ||
    value.startsWith(".") ||
    value.includes("/")
  );
}

function stripMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
