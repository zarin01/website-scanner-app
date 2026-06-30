import { prisma } from "@/lib/db/prisma";
import { buildReportSnapshot } from "@/lib/reports/snapshot";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scanId: string }> },
) {
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
    return Response.json({ error: "Scan not found." }, { status: 404 });
  }

  const snapshot = buildReportSnapshot(scan);

  await prisma.report.create({
    data: {
      scanId: scan.id,
      audience: "CLIENT",
      format: "HTML",
      title: `Website update report - ${snapshot.website}`,
      summary: `${snapshot.overallScore}/100 overall score saved for ${snapshot.website}`,
      content: snapshot,
    },
  });

  return Response.redirect(new URL(`/scans/${scan.id}`, request.url), 303);
}
