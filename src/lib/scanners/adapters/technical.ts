import type { ScannerAdapter, ScannerFinding } from "@/lib/scanners/types";

export const technicalScanner: ScannerAdapter = {
  name: "technical-baseline",
  async run({ url }) {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "WebsiteScannerBot/0.1",
      },
    });

    const html = await response.text();
    const findings: ScannerFinding[] = [];
    const server = response.headers.get("server");
    const poweredBy = response.headers.get("x-powered-by");

    if (!response.ok) {
      findings.push({
        category: "TECHNICAL",
        severity: "HIGH",
        title: `HTTP ${response.status}`,
        description: "The page did not return a successful HTTP response.",
        impact: "Users and search engines may not be able to access this page reliably.",
        recommendation: "Check hosting, redirects, caching, and application errors.",
        evidence: { status: response.status, statusText: response.statusText },
        source: "technical-baseline",
      });
    }

    if (/wp-content|wp-includes|wp-json/i.test(html)) {
      findings.push({
        category: "WEBSITE_UPDATES",
        severity: "INFO",
        title: "WordPress detected",
        description: "The page appears to be powered by WordPress.",
        impact: "WordPress sites need routine core, plugin, theme, PHP, and security reviews.",
        recommendation:
          "Confirm WordPress core, plugins, active theme, PHP, and backups are current.",
        evidence: { server, poweredBy },
        source: "technical-baseline",
      });
    }

    if (!html.includes('<meta name="description"')) {
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Missing meta description",
        description: "No standard meta description tag was found in the page source.",
        impact: "Search engines may generate weaker snippets for this page.",
        recommendation: "Add a concise, page-specific meta description.",
        source: "technical-baseline",
      });
    }

    return findings;
  },
};
