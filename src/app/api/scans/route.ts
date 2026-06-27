import { createScanRequest, SetupRequiredError } from "@/lib/scanners/service";
import { scanRequestSchema } from "@/lib/validation/scan";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = scanRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid scan request.",
        issues: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const scan = await createScanRequest(parsed.data);

    return Response.json({ scan }, { status: 202 });
  } catch (error) {
    if (
      error instanceof SetupRequiredError ||
      isDatabaseConnectionError(error)
    ) {
      return Response.json(
        {
          error:
            "Postgres is not ready for this app. Start the app database and run the first migration.",
          setupRequired: true,
        },
        { status: 503 },
      );
    }

    console.error(error);

    return Response.json(
      {
        error: "Could not queue scan.",
      },
      { status: 500 },
    );
  }
}

function isDatabaseConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? String(error.code) : "";

  if (/P1001|P1010|P2021|ECONNREFUSED/i.test(code)) {
    return true;
  }

  return /P1001|P1010|P2021|ECONNREFUSED|Can't reach database|connect ECONNREFUSED|denied access|does not exist/i.test(
    error.message,
  );
}
