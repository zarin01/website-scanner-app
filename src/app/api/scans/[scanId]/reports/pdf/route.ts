import { prisma } from "@/lib/db/prisma";
import { buildReportSnapshot, type ReportSnapshot } from "@/lib/reports/snapshot";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
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
  const pdf = buildSimplePdf(snapshot);

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${safeFilename(
        snapshot.website,
      )}-website-report.pdf"`,
    },
  });
}

type PdfLine = {
  text: string;
  size: number;
  x: number;
  y: number;
  color: [number, number, number];
};

function buildSimplePdf(snapshot: ReportSnapshot) {
  const pages: PdfLine[][] = [[]];
  let y = 744;

  const addLine = (
    text: string,
    options: {
      size?: number;
      indent?: number;
      gap?: number;
      color?: [number, number, number];
    } = {},
  ) => {
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const gap = options.gap ?? size + 5;
    const color = options.color ?? [24, 33, 47];
    const maxChars = Math.max(28, Math.floor((96 - indent * 2) * (10 / size)));
    const wrapped = wrapText(text, maxChars);

    wrapped.forEach((line) => {
      if (y < 54) {
        pages.push([]);
        y = 744;
      }

      pages[pages.length - 1].push({
        text: line,
        size,
        x: 54 + indent,
        y,
        color,
      });
      y -= gap;
    });
  };

  addLine("Website Update Report", { size: 22, gap: 28, color: [12, 18, 26] });
  addLine(snapshot.website, { size: 16, gap: 22, color: [15, 118, 110] });
  addLine(`Saved: ${formatDate(snapshot.savedAt)}`, { color: [71, 85, 105] });
  addLine(`Overall score: ${snapshot.overallScore}/100`, {
    size: 13,
    gap: 20,
    color: [22, 101, 52],
  });
  addLine(
    `URLs scanned: ${snapshot.urlCount}. Sections below are ordered from worst score to best score so the client sees what needs attention first.`,
    { gap: 18, color: [71, 85, 105] },
  );

  snapshot.sections.forEach((section) => {
    addLine(`${section.label} - ${section.score}/100`, {
      size: 15,
      gap: 22,
      color: section.score < 45 ? [153, 27, 27] : section.score < 70 ? [146, 64, 14] : [22, 101, 52],
    });

    section.findings.forEach((finding) => {
      addLine(`${finding.severity}: ${finding.title}`, {
        size: 11,
        indent: 10,
        gap: 16,
        color: [15, 23, 42],
      });
      addLine(finding.description, {
        indent: 18,
        color: [71, 85, 105],
      });
      addLine(`Recommended fix: ${finding.recommendation}`, {
        indent: 18,
        color: [22, 101, 52],
      });

      finding.counts.forEach((count) => {
        addLine(`${count.label}: ${count.value}`, {
          indent: 24,
          color: [15, 23, 42],
        });
      });

      finding.examples.slice(0, 4).forEach((example) => {
        addLine(`Example: ${example}`, {
          indent: 24,
          color: [7, 89, 133],
        });
      });

      if (finding.impact) {
        addLine(`Why it matters: ${finding.impact}`, {
          indent: 18,
          color: [7, 89, 133],
        });
      }

      y -= 5;
    });
  });

  return writePdf(pages);
}

function writePdf(pages: PdfLine[][]) {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  pages.forEach((lines) => {
    const stream = lines
      .map((line) => {
        const [red, green, blue] = line.color.map((value) => value / 255);
        return `${red.toFixed(3)} ${green.toFixed(3)} ${blue.toFixed(3)} rg BT /F1 ${
          line.size
        } Tf ${line.x} ${line.y} Td (${escapePdf(line.text)}) Tj ET`;
      })
      .join("\n");
    const contentId = addObject(
      `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "utf8"));
}

function wrapText(text: string, maxChars: number) {
  const words = toPdfSafeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

function toPdfSafeText(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
}

function escapePdf(value: string) {
  return toPdfSafeText(value).replace(/[\\()]/g, "\\$&");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function safeFilename(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
