import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { technicalScanner } from "@/lib/scanners/adapters/technical";
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
      const findings = await technicalScanner.run({
        scanId,
        url: scannedUrl.normalizedUrl,
        maxPages: config.maxPages ?? 25,
        includeSubpages: config.includeSubpages ?? false,
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
          category: finding.category,
          severity: finding.severity,
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

      const message =
        error instanceof Error ? error.message : "The scan failed unexpectedly.";

      await prisma.finding.create({
        data: {
          scanId,
          scannedUrlId: scannedUrl.id,
          category: "TECHNICAL",
          severity: "HIGH",
          title: "Scan failed",
          description: message,
          impact:
            "This URL could not be scanned, so the report may be incomplete.",
          recommendation:
            "Confirm the URL is reachable and retry the scan. Some hosts block automated requests.",
          source: "technical-baseline",
        },
      });

      await prisma.scannedUrl.update({
        where: { id: scannedUrl.id },
        data: {
          status: "FAILED",
          error: message,
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
    const message =
      error instanceof Error ? error.message : "The scan failed unexpectedly.";

    console.error(error);

    await prisma.scan
      .update({
        where: { id: scanId },
        data: {
          status: "FAILED",
          finishedAt: new Date(),
          summary: {
            failedUrlCount: 1,
            error: message,
          },
        },
      })
      .catch(() => undefined);
  });
}
