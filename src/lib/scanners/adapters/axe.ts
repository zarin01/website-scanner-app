import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import type { ScannerAdapter } from "@/lib/scanners/types";

export const axeAccessibilityScanner: ScannerAdapter = {
  name: "axe-accessibility",
  async run({ url }) {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      const results = await new AxeBuilder({ page }).analyze();

      return results.violations.map((violation, index) => ({
        category: "ADA",
        severity: violation.impact === "critical" ? "CRITICAL" : "HIGH",
        title: violation.help,
        description: violation.description,
        impact:
          "Accessibility issues can block visitors using assistive technology and can increase legal risk.",
        recommendation: violation.helpUrl,
        evidence: {
          id: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.slice(0, 5).map((node) => ({
            target: node.target,
            failureSummary: node.failureSummary,
          })),
        },
        source: "axe-core",
        sortOrder: index,
      }));
    } finally {
      await browser.close();
    }
  },
};
