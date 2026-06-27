import type { ScannerAdapter } from "@/lib/scanners/types";

type WaveSummary = {
  categories?: Record<string, { count?: number }>;
};

export const waveAccessibilityScanner: ScannerAdapter = {
  name: "wave-api",
  async run({ url }) {
    if (!process.env.WAVE_API_KEY) {
      return [
        {
          category: "ADA",
          severity: "INFO",
          title: "WAVE API key is not configured",
          description: "Add WAVE_API_KEY to enable WAVE accessibility scans.",
          impact:
            "WAVE gives clients a recognizable accessibility report source and helps validate fixes.",
          recommendation: "Add the key in environment variables before production scans.",
          source: "wave-api",
        },
      ];
    }

    const params = new URLSearchParams({
      key: process.env.WAVE_API_KEY,
      url,
      format: "json",
    });

    const response = await fetch(`https://wave.webaim.org/api/request?${params}`);

    if (!response.ok) {
      throw new Error(`WAVE API failed with ${response.status}`);
    }

    const data = (await response.json()) as WaveSummary;
    const categories = data.categories ?? {};

    return Object.entries(categories)
      .filter(([, value]) => Number(value.count ?? 0) > 0)
      .map(([key, value], index) => ({
        category: "ADA",
        severity: key === "error" ? "HIGH" : "MEDIUM",
        title: `WAVE ${key}`,
        description: `${value.count ?? 0} ${key} item(s) detected by WAVE.`,
        impact:
          "Accessibility barriers can keep visitors from using the site and can create compliance risk.",
        recommendation: "Review the affected elements and prioritize template-level fixes first.",
        evidence: value,
        source: "wave-api",
        sortOrder: index,
      }));
  },
};
