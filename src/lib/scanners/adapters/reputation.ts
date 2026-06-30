import type { ScannerAdapter, ScannerFinding } from "@/lib/scanners/types";

type GoogleSafeBrowsingResponse = {
  matches?: {
    threatType?: string;
    platformType?: string;
    threat?: {
      url?: string;
    };
  }[];
};

type VirusTotalResponse = {
  data?: {
    attributes?: {
      last_analysis_stats?: {
        harmless?: number;
        malicious?: number;
        suspicious?: number;
        undetected?: number;
        timeout?: number;
      };
      last_analysis_date?: number;
      reputation?: number;
    };
  };
};

export const reputationScanner: ScannerAdapter = {
  name: "reputation-checks",
  async run({ url }) {
    const findings: ScannerFinding[] = [];
    const lookupLinks = getLookupLinks(url);
    const googleKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    const virusTotalKey = process.env.VIRUSTOTAL_API_KEY;

    if (!googleKey && !virusTotalKey) {
      return [
        {
          category: "SECURITY",
          severity: "INFO",
          title: "External blocklist checks need API keys",
          description:
            "Google Safe Browsing and VirusTotal API keys are not configured, so automated blocklist checks were skipped.",
          impact:
            "Blocked or flagged websites can lose traffic, trigger browser warnings, and damage client trust.",
          recommendation:
            "Add GOOGLE_SAFE_BROWSING_API_KEY and VIRUSTOTAL_API_KEY to run automated reputation checks. Use the lookup links for manual Norton, Google, and VirusTotal review.",
          evidence: {
            provider: "Reputation checks",
            examples: lookupLinks,
          },
          source: "reputation-checks",
        },
      ];
    }

    if (googleKey) {
      findings.push(await runGoogleSafeBrowsing(url, googleKey, lookupLinks));
    }

    if (virusTotalKey) {
      findings.push(await runVirusTotal(url, virusTotalKey, lookupLinks));
    }

    return findings;
  },
};

async function runGoogleSafeBrowsing(
  url: string,
  apiKey: string,
  lookupLinks: string[],
): Promise<ScannerFinding> {
  const response = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client: {
          clientId: "website-scanner-app",
          clientVersion: "0.1.0",
        },
        threatInfo: {
          threatTypes: [
            "MALWARE",
            "SOCIAL_ENGINEERING",
            "UNWANTED_SOFTWARE",
            "POTENTIALLY_HARMFUL_APPLICATION",
          ],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Google Safe Browsing failed with ${response.status}`);
  }

  const data = (await response.json()) as GoogleSafeBrowsingResponse;
  const matches = data.matches ?? [];

  return {
    category: "SECURITY",
    severity: matches.length > 0 ? "CRITICAL" : "INFO",
    title:
      matches.length > 0
        ? "Google Safe Browsing flagged this URL"
        : "Google Safe Browsing did not flag this URL",
    description:
      matches.length > 0
        ? `${matches.length} Safe Browsing threat match${matches.length === 1 ? "" : "es"} found.`
        : "No Google Safe Browsing threat matches were returned for this URL.",
    impact:
      "Safe Browsing flags can cause browser warnings, ad disapprovals, search visibility issues, and client trust problems.",
    recommendation:
      matches.length > 0
        ? "Review malware/social-engineering flags, clean the site, update software, and request review after remediation."
        : "Keep monitoring after updates, plugin changes, and security incidents.",
    evidence: {
      provider: "Google Safe Browsing",
      matches,
      counts: [{ label: "Safe Browsing threat matches", value: matches.length }],
      examples: [
        ...matches.map((match) => `${match.threatType ?? "Threat"} on ${match.platformType ?? "ANY_PLATFORM"}`),
        ...lookupLinks,
      ],
    },
    source: "google-safe-browsing",
  };
}

async function runVirusTotal(
  url: string,
  apiKey: string,
  lookupLinks: string[],
): Promise<ScannerFinding> {
  const response = await fetch(
    `https://www.virustotal.com/api/v3/urls/${getVirusTotalUrlId(url)}`,
    {
      headers: {
        "x-apikey": apiKey,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`VirusTotal failed with ${response.status}`);
  }

  const data = (await response.json()) as VirusTotalResponse;
  const stats = data.data?.attributes?.last_analysis_stats;
  const malicious = stats?.malicious ?? 0;
  const suspicious = stats?.suspicious ?? 0;
  const flagged = malicious + suspicious;

  return {
    category: "SECURITY",
    severity: malicious > 0 ? "CRITICAL" : suspicious > 0 ? "HIGH" : "INFO",
    title:
      flagged > 0
        ? "VirusTotal vendors flagged this URL"
        : "VirusTotal did not show malicious vendor flags",
    description:
      flagged > 0
        ? `${malicious} malicious and ${suspicious} suspicious vendor result${flagged === 1 ? "" : "s"} were returned.`
        : "VirusTotal returned no malicious or suspicious vendor counts for this URL.",
    impact:
      "Security vendor detections can cause users, browsers, email tools, and network filters to distrust the site.",
    recommendation:
      flagged > 0
        ? "Review vendor detections, clean the site, harden WordPress and hosting, then request vendor rechecks."
        : "Keep monitoring reputation after major updates or security cleanup.",
    evidence: {
      provider: "VirusTotal",
      stats,
      reputation: data.data?.attributes?.reputation,
      lastAnalysisDate: data.data?.attributes?.last_analysis_date,
      counts: [
        { label: "Malicious vendors", value: malicious },
        { label: "Suspicious vendors", value: suspicious },
        { label: "Harmless vendors", value: stats?.harmless ?? 0 },
        { label: "Undetected vendors", value: stats?.undetected ?? 0 },
      ],
      examples: lookupLinks,
    },
    source: "virustotal",
  };
}

function getLookupLinks(url: string) {
  const encoded = encodeURIComponent(url);

  return [
    `Norton Safe Web manual lookup: https://safeweb.norton.com/report?url=${encoded}`,
    `Google Transparency Report lookup: https://transparencyreport.google.com/safe-browsing/search?url=${encoded}`,
    `VirusTotal lookup: https://www.virustotal.com/gui/search/${encoded}`,
  ];
}

function getVirusTotalUrlId(url: string) {
  return Buffer.from(url).toString("base64url").replace(/=+$/, "");
}
