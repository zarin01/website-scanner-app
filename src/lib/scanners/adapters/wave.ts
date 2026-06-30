import type { ScannerAdapter } from "@/lib/scanners/types";

type WaveSummary = {
  categories?: Record<
    string,
    {
      count?: number;
      items?: Record<
        string,
        {
          count?: number;
          description?: string;
          selectors?: unknown;
          examples?: unknown;
          xpaths?: unknown;
        }
      >;
    }
  >;
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
      .flatMap(([key, value], categoryIndex) => {
        const items = Object.entries(value.items ?? {}).filter(
          ([, item]) => Number(item.count ?? 0) > 0,
        );

        if (items.length === 0) {
          return [
            {
              category: "ADA",
              severity: getWaveSeverity(key),
              title: `WAVE ${formatWaveLabel(key)}`,
              description: `${value.count ?? 0} ${formatWaveLabel(
                key,
              ).toLowerCase()} item(s) detected by WAVE.`,
              impact:
                "Accessibility barriers can keep visitors from using the site and can create compliance risk.",
              recommendation:
                "Review the affected elements and prioritize template-level fixes first.",
              evidence: {
                provider: "WAVE",
                waveCategory: key,
                count: value.count ?? 0,
                counts: [
                  { label: `WAVE ${formatWaveLabel(key)} items`, value: value.count ?? 0 },
                ],
              },
              source: "wave-api",
              sortOrder: categoryIndex,
            },
          ];
        }

        return items.map(([itemKey, item], itemIndex) => ({
          category: "ADA",
          severity: getWaveSeverity(key),
          title: `WAVE: ${formatWaveLabel(itemKey)}`,
          description:
            item.description ??
            `${item.count ?? 0} ${formatWaveLabel(itemKey).toLowerCase()} item(s) detected by WAVE.`,
          impact:
            "Accessibility barriers can keep visitors from using the site and can create compliance risk.",
          recommendation:
            getWaveRecommendation(itemKey) ??
            "Review the affected elements and prioritize template-level fixes first.",
          evidence: {
            provider: "WAVE",
            waveCategory: key,
            waveItem: itemKey,
            count: item.count ?? 0,
            counts: [
              { label: `WAVE ${formatWaveLabel(itemKey)}`, value: item.count ?? 0 },
            ],
            examples: getWaveExamples(item),
          },
          source: "wave-api",
          sortOrder: categoryIndex * 100 + itemIndex,
        }));
      });
  },
};

function getWaveSeverity(category: string) {
  if (category === "error" || category === "contrast") {
    return "HIGH";
  }

  if (category === "alert") {
    return "MEDIUM";
  }

  return "LOW";
}

function formatWaveLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getWaveRecommendation(itemKey: string) {
  const lowerKey = itemKey.toLowerCase();

  if (lowerKey.includes("contrast")) {
    return "Increase text/background contrast on the affected elements to meet WCAG contrast targets.";
  }

  if (lowerKey.includes("alt")) {
    return "Add useful alt text to meaningful images and empty alt text to decorative images.";
  }

  if (lowerKey.includes("link")) {
    return "Update link text or aria-labels so each link has a clear purpose.";
  }

  if (lowerKey.includes("label")) {
    return "Connect each form field to a visible label or accessible aria-label.";
  }

  if (lowerKey.includes("heading")) {
    return "Fix heading order so page structure is clear for screen readers and scanners.";
  }

  return undefined;
}

function getWaveExamples(item: {
  selectors?: unknown;
  examples?: unknown;
  xpaths?: unknown;
}) {
  return [
    ...stringList(item.selectors),
    ...stringList(item.examples),
    ...stringList(item.xpaths),
  ].slice(0, 8);
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return [value];
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .flatMap((item) => stringList(item))
      .filter(Boolean);
  }

  return [];
}
