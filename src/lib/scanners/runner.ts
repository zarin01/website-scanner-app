import { Prisma } from "@/generated/prisma/client";
import { FindingCategory, FindingSeverity } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { functionalityScanner } from "@/lib/scanners/adapters/functionality";
import { lighthouseScanner } from "@/lib/scanners/adapters/lighthouse";
import { reputationScanner } from "@/lib/scanners/adapters/reputation";
import { technicalScanner } from "@/lib/scanners/adapters/technical";
import { waveAccessibilityScanner } from "@/lib/scanners/adapters/wave";
import {
  getScanFailureLogContext,
  getScanFailurePresentation,
} from "@/lib/scanners/error-formatting";
import type { ScannerFinding } from "@/lib/scanners/types";

type ScanConfig = {
  includeSubpages?: boolean;
  maxPages?: number;
};

export async function processScan(scanId: string) {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { urls: true },
  });

  if (!scan) {
    throw new Error(`Scan ${scanId} was not found.`);
  }

  const config = (scan.config ?? {}) as ScanConfig;
  const startedAt = new Date();
  let failedUrlCount = 0;
  let findingCount = 0;

  await prisma.scan.update({
    where: { id: scanId },
    data: {
      status: "RUNNING",
      startedAt,
      finishedAt: null,
    },
  });

  await prisma.finding.deleteMany({ where: { scanId } });

  for (const scannedUrl of scan.urls) {
    await prisma.scannedUrl.update({
      where: { id: scannedUrl.id },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        error: null,
      },
    });

    try {
      const scannerContext = {
        scanId,
        url: scannedUrl.normalizedUrl,
        maxPages: config.maxPages ?? 25,
        includeSubpages: config.includeSubpages ?? false,
      };
      const scanners = [
        technicalScanner,
        functionalityScanner,
        waveAccessibilityScanner,
        lighthouseScanner,
        reputationScanner,
      ];
      const scannerResults = await Promise.allSettled(
        scanners.map((scanner) => scanner.run(scannerContext)),
      );
      const findings = scannerResults.flatMap((result, index) => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        const scannerName = scanners[index].name;
        const failure = getScanFailurePresentation(result.reason);

        console.error(
          "Scanner adapter failed.",
          getScanFailureLogContext(result.reason, {
            scanId,
            scannedUrlId: scannedUrl.id,
            scanner: scannerName,
            url: scannedUrl.normalizedUrl,
          }),
        );

        return [
          {
            category: "TECHNICAL",
            severity: "MEDIUM",
            title: `${scannerName} did not complete`,
            description: failure.message,
            impact: failure.impact,
            recommendation: failure.recommendation,
            evidence: {
              errorKind: failure.kind,
              errorCode: failure.code,
              counts: [{ label: "Failed scanner checks", value: 1 }],
            },
            source: scannerName,
          } satisfies ScannerFinding,
        ];
      });

      const normalizedFindings =
        findings.length > 0
          ? findings
          : [
              {
                category: "OTHER",
                severity: "INFO",
                title: "Baseline scan completed",
                description:
                  "The first technical pass completed without finding a baseline issue.",
                impact:
                  "This only means the starter checks passed. ADA, speed, and deeper SEO scans still need to be wired.",
                recommendation:
                  "Continue with accessibility, speed, and SEO provider checks.",
                source: "technical-baseline",
              } satisfies ScannerFinding,
            ];

      findingCount += normalizedFindings.length;

      await prisma.finding.createMany({
        data: normalizedFindings.map((finding, index) => ({
          scanId,
          scannedUrlId: scannedUrl.id,
          category: normalizeFindingCategory(finding.category),
          severity: normalizeFindingSeverity(finding.severity),
          title: finding.title,
          description: finding.description,
          impact: finding.impact,
          recommendation: finding.recommendation,
          evidence: finding.evidence as Prisma.InputJsonValue | undefined,
          source: finding.source,
          sortOrder: finding.sortOrder ?? index,
        })),
      });

      await prisma.scannedUrl.update({
        where: { id: scannedUrl.id },
        data: {
          status: "COMPLETED",
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      failedUrlCount += 1;

      const failure = getScanFailurePresentation(error);

      console.error(
        "Scan URL failed.",
        getScanFailureLogContext(error, {
          scanId,
          scannedUrlId: scannedUrl.id,
          url: scannedUrl.normalizedUrl,
        }),
      );

      await prisma.finding.create({
        data: {
          scanId,
          scannedUrlId: scannedUrl.id,
          category: "TECHNICAL",
          severity: "HIGH",
          title: "Scan failed",
          description: failure.message,
          impact: failure.impact,
          recommendation: failure.recommendation,
          evidence: {
            errorKind: failure.kind,
            errorCode: failure.code,
            counts: [{ label: "Failed URLs", value: 1 }],
          },
          source: "technical-baseline",
        },
      });

      await prisma.scannedUrl.update({
        where: { id: scannedUrl.id },
        data: {
          status: "FAILED",
          error: failure.message,
          finishedAt: new Date(),
        },
      });
    }
  }

  const finalStatus = failedUrlCount === scan.urls.length ? "FAILED" : "COMPLETED";

  return prisma.scan.update({
    where: { id: scanId },
    data: {
      status: finalStatus,
      finishedAt: new Date(),
      summary: {
        processedUrlCount: scan.urls.length,
        failedUrlCount,
        findingCount,
      },
    },
  });
}

export function processScanInBackground(scanId: string) {
  void processScan(scanId).catch(async (error) => {
    const failure = getScanFailurePresentation(error);

    console.error(
      "Scan failed before URL processing completed.",
      getScanFailureLogContext(error, { scanId }),
    );
    console.error(error);

    await prisma.scan
      .update({
        where: { id: scanId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          summary: {
            failedUrlCount: 1,
            error: failure.message,
          },
        },
      })
      .catch(() => undefined);
  });
}

function normalizeFindingCategory(category: string) {
  const categories = Object.values(FindingCategory);

  return categories.includes(category as (typeof categories)[number])
    ? (category as (typeof categories)[number])
    : FindingCategory.TECHNICAL;
}

function normalizeFindingSeverity(severity: string) {
  const severities = Object.values(FindingSeverity);

  return severities.includes(severity as (typeof severities)[number])
    ? (severity as (typeof severities)[number])
    : FindingSeverity.INFO;
}
