const DEFAULT_MESSAGE =
  "The scan hit an internal app error before it could finish this URL.";
const DEFAULT_IMPACT =
  "This URL could not be fully scanned, so the report may be incomplete.";
const DEFAULT_RECOMMENDATION =
  "Check the server logs for the technical error, then retry the scan.";

type ScanFailureKind =
  | "database-migration"
  | "database-connection"
  | "website-unreachable"
  | "provider"
  | "internal";

export type ScanFailurePresentation = {
  kind: ScanFailureKind;
  message: string;
  impact: string;
  recommendation: string;
  technicalMessage: string;
  code?: string;
};

export function getScanFailurePresentation(
  error: unknown,
): ScanFailurePresentation {
  const technicalMessage = getErrorMessage(error);
  const code = getErrorCode(error);

  if (isFindingCategoryMigrationError(technicalMessage)) {
    return {
      kind: "database-migration",
      message:
        "The scan reached the website, but the app database is missing the latest finding category migration.",
      impact:
        "Results were collected, but they could not be saved because the database does not recognize the AI Opportunities category yet.",
      recommendation:
        "Run npm run db:migrate, restart the dev server if needed, then start a new scan.",
      technicalMessage,
      code,
    };
  }

  if (isDatabaseConnectionError(technicalMessage, code)) {
    return {
      kind: "database-connection",
      message: "The app could not connect to the local scan database.",
      impact:
        "The scan cannot save URLs, findings, or reports until Postgres is reachable.",
      recommendation:
        "Start the local database, confirm DATABASE_URL, then retry the scan.",
      technicalMessage,
      code,
    };
  }

  if (isWebsiteReachabilityError(technicalMessage)) {
    return {
      kind: "website-unreachable",
      message: "The website could not be reached reliably during the scan.",
      impact:
        "The report may be missing page details because the target site timed out, blocked the request, or could not resolve.",
      recommendation:
        "Confirm the URL loads in a browser, then retry. If it keeps failing, the host may be blocking automated requests.",
      technicalMessage,
      code,
    };
  }

  if (/__name is not defined/i.test(technicalMessage)) {
    return {
      kind: "provider",
      message: "Lighthouse did not complete in this runtime.",
      impact:
        "The rest of the scan can still be saved, but Lighthouse performance, accessibility, SEO, and best-practice details may be incomplete.",
      recommendation:
        "Retry from the running app or worker. If it repeats, check the Lighthouse and Chrome runtime setup.",
      technicalMessage,
      code,
    };
  }

  if (isProviderError(technicalMessage)) {
    return {
      kind: "provider",
      message: "One of the external scanner checks did not complete.",
      impact:
        "The report can still be useful, but it may be missing provider-specific details.",
      recommendation:
        "Review API keys, provider limits, and retry the scan after setup is confirmed.",
      technicalMessage,
      code,
    };
  }

  return {
    kind: "internal",
    message: DEFAULT_MESSAGE,
    impact: DEFAULT_IMPACT,
    recommendation: DEFAULT_RECOMMENDATION,
    technicalMessage,
    code,
  };
}

export function sanitizeScanFailureText(value?: string | null) {
  if (!value) {
    return DEFAULT_MESSAGE;
  }

  if (looksInternal(value)) {
    return getScanFailurePresentation(new Error(value)).message;
  }

  return value.length > 220 ? `${value.slice(0, 217)}...` : value;
}

export function getScanFailureLogContext(
  error: unknown,
  context: Record<string, string | number | boolean | undefined>,
) {
  const presentation = getScanFailurePresentation(error);

  return {
    ...context,
    kind: presentation.kind,
    code: presentation.code,
    message: presentation.message,
    technicalMessage: presentation.technicalMessage.slice(0, 1200),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return DEFAULT_MESSAGE;
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined;
  }

  const code = error.code;

  return typeof code === "string" || typeof code === "number"
    ? String(code)
    : undefined;
}

function isFindingCategoryMigrationError(message: string) {
  return (
    /AI_OPPORTUNITIES/i.test(message) ||
    /Expected FindingCategory/i.test(message) ||
    /invalid input value for enum "FindingCategory"/i.test(message)
  );
}

function isDatabaseConnectionError(message: string, code?: string) {
  return /P1001|P1010|P2021|ECONNREFUSED|Can't reach database|connect ECONNREFUSED|denied access|does not exist/i.test(
    `${code ?? ""} ${message}`,
  );
}

function isWebsiteReachabilityError(message: string) {
  return /fetch failed|ENOTFOUND|ERR_NAME_NOT_RESOLVED|getaddrinfo|ETIMEDOUT|ECONNRESET|AbortError|timed out|certificate/i.test(
    message,
  );
}

function isProviderError(message: string) {
  return /WAVE API|Lighthouse|Safe Browsing|VirusTotal|API key|provider/i.test(
    message,
  );
}

function looksInternal(message: string) {
  return /__TURBOPACK__|Prisma|createMany|invocation|Expected FindingCategory|invalid input value|\.next\/dev|at\s+\S+\s+\(/i.test(
    message,
  );
}
