export const reportSections = [
  {
    key: "website-updates",
    label: "Needed Website Updates",
    score: "Priority",
    status: "Review first",
    items: [
      "WordPress, PHP, plugin, and theme update checks",
      "SSL, redirects, mixed content, and security header checks",
      "Broken links, forms, tracking, and visible template issues",
    ],
    why:
      "These updates protect the site, reduce support problems, and usually fix the issues clients notice first.",
  },
  {
    key: "ada",
    label: "ADA Report",
    score: "WAVE + axe",
    status: "Compliance",
    items: [
      "Missing labels, contrast issues, heading structure, alt text, and form errors",
      "Template-level accessibility issues grouped for developer fixes",
      "Client-facing risk and usability summary",
    ],
    why:
      "ADA updates help more people use the site and reduce legal exposure while improving the quality of the user experience.",
  },
  {
    key: "speed",
    label: "Speed Report",
    score: "Core Web Vitals",
    status: "SEO impact",
    items: [
      "Lighthouse and PageSpeed performance scores",
      "Image, script, caching, render-blocking, and layout shift issues",
      "Mobile-first recommendations",
    ],
    why:
      "Speed affects conversions, bounce rate, and SEO. Faster pages make it easier for visitors and search engines to trust the site.",
  },
  {
    key: "seo",
    label: "SEO Report",
    score: "Technical SEO",
    status: "Visibility",
    items: [
      "Titles, descriptions, headings, canonicals, robots, sitemap, and schema",
      "Indexing blockers and page quality signals",
      "Prioritized content and technical fixes",
    ],
    why:
      "SEO work helps search engines understand the site and gives clients a clearer path to more qualified traffic.",
  },
  {
    key: "other",
    label: "Other Issues",
    score: "Signals",
    status: "Catch-all",
    items: [
      "Console errors, tracking gaps, expired assets, and obvious hosting problems",
      "CMS fingerprints and integration warnings",
      "Developer notes that do not fit the main report groups",
    ],
    why:
      "These findings catch problems that can hurt trust, analytics, maintenance, or the client's day-to-day workflow.",
  },
];
