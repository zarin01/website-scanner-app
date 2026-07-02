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
    key: "functionality",
    label: "Core Functionality",
    score: "Lead paths",
    status: "Revenue impact",
    items: [
      "Forms, phone links, email links, booking buttons, and high-value CTAs",
      "Broken or placeholder action links that can stop visitors from converting",
      "Email DNS readiness for form notifications and client communication",
    ],
    why:
      "Functionality issues are easy for clients to understand because they connect directly to missed leads, missed calls, and wasted follow-up time.",
  },
  {
    key: "ai-opportunities",
    label: "AI Opportunities",
    score: "Time savings",
    status: "Automation",
    items: [
      "Chatbot, live chat, and AI assistant detection",
      "Lead intake, quote, booking, FAQ, and support automation opportunities",
      "Ideas for routing inquiries to email, CRM, task lists, or staff follow-up",
    ],
    why:
      "AI updates can turn a website refresh into a time-saving tool that answers repeat questions, qualifies leads, and reduces manual client follow-up.",
  },
  {
    key: "ada",
    label: "ADA Report",
    score: "WAVE + axe",
    status: "Compliance",
    items: [
      "Missing labels, contrast issues, heading structure, alt text, and form errors",
      "Template-level accessibility issues grouped for developer fixes",
      "Government, school, and public-sector signals that make ADA harder to ignore",
      "Client-facing risk and usability summary",
    ],
    why:
      "ADA updates help more people use the site and reduce legal exposure. For government and school-related websites, accessibility issues are a stronger priority because public services and education information need to be available to people with disabilities.",
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
