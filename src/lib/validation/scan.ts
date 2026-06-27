import { z } from "zod";

function normalizeUrl(value: string, ctx: z.RefinementCtx) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid URL.",
    });

    return z.NEVER;
  }
}

const urlListSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    return value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  })
  .pipe(
    z
      .array(z.string().min(3).transform(normalizeUrl))
      .min(1, "Add at least one URL.")
      .max(50, "Scan batches are limited to 50 URLs for now."),
  );

export const scanRequestSchema = z.object({
  urls: urlListSchema,
  projectName: z.string().trim().max(120).optional(),
  clientName: z.string().trim().max(120).optional(),
  includeSubpages: z.boolean().default(false),
  maxPages: z.coerce.number().int().min(1).max(250).default(25),
  notes: z.string().trim().max(1000).optional(),
});

export type ScanRequestInput = z.infer<typeof scanRequestSchema>;
