import type { ScannerAdapter, ScannerFinding } from "@/lib/scanners/types";

const PAGE_TIMEOUT_MS = 15000;
const SUPPORT_TIMEOUT_MS = 7000;

export const technicalScanner: ScannerAdapter = {
  name: "technical-baseline",
  async run({ url }) {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: {
        "user-agent": "WebsiteScannerBot/0.1",
      },
    });

    const html = await response.text();
    const findings: ScannerFinding[] = [];
    const server = response.headers.get("server");
    const poweredBy = response.headers.get("x-powered-by");
    const finalUrl = response.url || url;
    const parsedUrl = new URL(finalUrl);
    const origin = parsedUrl.origin;
    const title = getTitle(html);
    const metaDescription = getMetaContent(html, "description");
    const robotsMeta = getMetaContent(html, "robots");
    const generator = getMetaContent(html, "generator");
    const canonical = getLinkHref(html, "canonical");
    const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];
    const scriptTags = html.match(/<script\b[^>]*>/gi) ?? [];
    const stylesheetTags =
      html.match(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi) ??
      [];
    const h1Tags = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? [];
    const pluginSlugs = uniqueMatches(html, /\/wp-content\/plugins\/([^/"'?]+)/gi);
    const themeSlugs = uniqueMatches(html, /\/wp-content\/themes\/([^/"'?]+)/gi);
    const missingAltCount = imageTags.filter(hasMissingImageAlt).length;
    const lazyImageCount = imageTags.filter((tag) =>
      /\sloading\s*=\s*["']lazy["']/i.test(tag),
    ).length;
    const formControlTags =
      html.match(/<(input|textarea|select)\b[^>]*>/gi) ?? [];
    const missingLabelCount = formControlTags.filter((tag) =>
      hasMissingFormLabel(tag, html),
    ).length;
    const emptyLinkCount = countEmptyLinks(html);
    const missingSecurityHeaders = getMissingSecurityHeaders(response, parsedUrl);
    const assetCount = imageTags.length + scriptTags.length + stylesheetTags.length;
    const supportFiles = await getSupportFileSignals(origin);

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

    findings.push({
      category: "TECHNICAL",
      severity: "INFO",
      title: "Page response captured",
      description: `The page returned HTTP ${response.status} from ${finalUrl}.`,
      impact:
        "This confirms the scanner can reach the page and gives developers the final resolved URL.",
      recommendation:
        "Review the final URL, redirects, and status code before deeper remediation work.",
      evidence: {
        status: response.status,
        finalUrl,
        server,
        poweredBy,
      },
      source: "technical-baseline",
    });

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

    if (generator?.toLowerCase().includes("wordpress")) {
      const version = generator.match(/wordpress\s+([0-9.]+)/i)?.[1];

      if (version) {
        findings.push({
          category: "WEBSITE_UPDATES",
          severity: "MEDIUM",
          title: "WordPress version is exposed",
          description: `The page source exposes WordPress ${version}.`,
          impact:
            "Public version clues can make security review easier for attackers and help identify update risk.",
          recommendation:
            "Confirm core is current and consider removing public generator/version output.",
          evidence: { generator },
          source: "technical-baseline",
        });
      }
    }

    if (pluginSlugs.length > 0) {
      findings.push({
        category: "WEBSITE_UPDATES",
        severity: pluginSlugs.length > 8 ? "MEDIUM" : "INFO",
        title: "WordPress plugin footprints found",
        description: `${pluginSlugs.length} plugin path${pluginSlugs.length === 1 ? "" : "s"} were visible in page assets.`,
        impact:
          "Visible plugin footprints help developers audit likely maintenance and update areas.",
        recommendation:
          "Review active plugins, remove unused plugins, and confirm all visible plugins are current.",
        evidence: { plugins: pluginSlugs.slice(0, 20) },
        source: "technical-baseline",
      });
    }

    if (themeSlugs.length > 0) {
      findings.push({
        category: "WEBSITE_UPDATES",
        severity: "INFO",
        title: "WordPress theme footprint found",
        description: `Theme asset path detected: ${themeSlugs.slice(0, 3).join(", ")}.`,
        impact:
          "Theme clues help developers find where template-level ADA, SEO, and speed fixes may belong.",
        recommendation:
          "Confirm the active theme is maintained and child-theme changes are tracked.",
        evidence: { themes: themeSlugs.slice(0, 10) },
        source: "technical-baseline",
      });
    }

    if (!title) {
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Missing page title",
        description: "No standard title tag was found in the page source.",
        impact: "Search engines and browser tabs rely on useful page titles.",
        recommendation: "Add a concise, page-specific title tag.",
        source: "technical-baseline",
      });
    } else if (title.length < 20 || title.length > 65) {
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Page title length should be reviewed",
        description: `The title is ${title.length} characters long.`,
        impact:
          "Titles that are too short can be vague; titles that are too long may be truncated in search results.",
        recommendation:
          "Use a descriptive title that fits the page intent, usually around 35-60 characters.",
        evidence: { title, length: title.length },
        source: "technical-baseline",
      });
    }

    if (!metaDescription) {
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Missing meta description",
        description: "No standard meta description tag was found in the page source.",
        impact: "Search engines may generate weaker snippets for this page.",
        recommendation: "Add a concise, page-specific meta description.",
        source: "technical-baseline",
      });
    } else if (metaDescription.length < 70 || metaDescription.length > 165) {
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Meta description length should be reviewed",
        description: `The meta description is ${metaDescription.length} characters long.`,
        impact:
          "Weak or truncated descriptions can reduce click-through from search results.",
        recommendation:
          "Use a clear page-specific description, usually around 120-155 characters.",
        evidence: { length: metaDescription.length },
        source: "technical-baseline",
      });
    }

    if (h1Tags.length === 0) {
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Missing H1 heading",
        description: "No H1 heading was found in the page source.",
        impact:
          "The H1 helps users and search engines understand the main topic of the page.",
        recommendation: "Add one clear H1 that matches the page intent.",
        source: "technical-baseline",
      });
    } else if (h1Tags.length > 1) {
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Multiple H1 headings found",
        description: `${h1Tags.length} H1 headings were found.`,
        impact:
          "Multiple H1 headings can blur page hierarchy and make content harder to scan.",
        recommendation: "Use one main H1, then H2/H3 headings for supporting sections.",
        evidence: { count: h1Tags.length },
        source: "technical-baseline",
      });
    }

    if (!canonical) {
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Canonical URL missing",
        description: "No canonical link tag was found.",
        impact:
          "Canonicals help prevent duplicate URL signals and clarify the preferred page URL.",
        recommendation: "Add a self-referencing canonical URL for indexable pages.",
        source: "technical-baseline",
      });
    }

    if (robotsMeta && /noindex/i.test(robotsMeta)) {
      findings.push({
        category: "SEO",
        severity: "HIGH",
        title: "Page has noindex directive",
        description: "The robots meta tag includes noindex.",
        impact: "Search engines may avoid indexing this page.",
        recommendation:
          "Confirm noindex is intentional. Remove it from pages that should rank.",
        evidence: { robotsMeta },
        source: "technical-baseline",
      });
    }

    if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Viewport meta tag missing",
        description: "No responsive viewport meta tag was found.",
        impact:
          "Mobile layout and mobile SEO can suffer without a viewport declaration.",
        recommendation:
          'Add `<meta name="viewport" content="width=device-width, initial-scale=1">`.',
        source: "technical-baseline",
      });
    }

    if (!supportFiles.robotsFound) {
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "robots.txt not found",
        description: "The scanner did not find a robots.txt file at the site root.",
        impact:
          "A robots.txt file gives crawlers basic site-level crawling guidance.",
        recommendation: "Add a robots.txt file that references the sitemap.",
        evidence: supportFiles,
        source: "technical-baseline",
      });
    }

    if (!supportFiles.sitemapFound) {
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Sitemap not found",
        description: "The scanner did not find sitemap.xml or sitemap_index.xml.",
        impact:
          "A sitemap helps search engines discover important pages and content updates.",
        recommendation:
          "Generate and submit a sitemap through the CMS or SEO plugin.",
        evidence: supportFiles,
        source: "technical-baseline",
      });
    }

    if (missingAltCount > 0) {
      findings.push({
        category: "ADA",
        severity: missingAltCount > 10 ? "HIGH" : "MEDIUM",
        title: "Images missing alt text",
        description: `${missingAltCount} of ${imageTags.length} image tag${imageTags.length === 1 ? "" : "s"} appear to be missing useful alt text.`,
        impact:
          "Visitors using screen readers may miss important visual content.",
        recommendation:
          "Add meaningful alt text for content images and empty alt text for decorative images.",
        evidence: { missingAltCount, imageCount: imageTags.length },
        source: "technical-baseline",
      });
    }

    if (missingLabelCount > 0) {
      findings.push({
        category: "ADA",
        severity: "HIGH",
        title: "Form controls may be missing labels",
        description: `${missingLabelCount} form control${missingLabelCount === 1 ? "" : "s"} appear to be missing labels or accessible names.`,
        impact:
          "Unlabeled form controls are difficult for screen reader and keyboard users.",
        recommendation:
          "Connect each form field to a visible label or accessible aria-label.",
        evidence: { missingLabelCount },
        source: "technical-baseline",
      });
    }

    if (emptyLinkCount > 0) {
      findings.push({
        category: "ADA",
        severity: "MEDIUM",
        title: "Links may not have accessible text",
        description: `${emptyLinkCount} link${emptyLinkCount === 1 ? "" : "s"} appear to have no readable text or aria-label.`,
        impact:
          "Screen reader users may hear unclear links with no purpose or context.",
        recommendation:
          "Add visible link text or aria-labels that explain each link destination.",
        evidence: { emptyLinkCount },
        source: "technical-baseline",
      });
    }

    if (missingAltCount === 0 && missingLabelCount === 0 && emptyLinkCount === 0) {
      findings.push({
        category: "ADA",
        severity: "INFO",
        title: "Accessibility baseline checks passed",
        description:
          "The starter ADA pass did not find missing image alt text, unlabeled form controls, or empty links.",
        impact:
          "This is not a full ADA audit, but it means the first easy-to-detect issues were not present.",
        recommendation:
          "Run WAVE and axe checks next for contrast, ARIA, keyboard, and semantic issues.",
        source: "technical-baseline",
      });
    }

    if (missingSecurityHeaders.length > 0) {
      findings.push({
        category: "SECURITY",
        severity: missingSecurityHeaders.length >= 4 ? "MEDIUM" : "LOW",
        title: "Security headers should be reviewed",
        description: `Missing or incomplete headers: ${missingSecurityHeaders.join(", ")}.`,
        impact:
          "Security headers reduce common browser-side risks and improve baseline hardening.",
        recommendation:
          "Add appropriate security headers through hosting, CDN, or application middleware.",
        evidence: { missingSecurityHeaders },
        source: "technical-baseline",
      });
    }

    if (parsedUrl.protocol === "https:" && /(?:src|href)=["']http:\/\//i.test(html)) {
      findings.push({
        category: "SECURITY",
        severity: "MEDIUM",
        title: "Possible mixed content found",
        description: "The HTTPS page includes one or more HTTP asset/link references.",
        impact:
          "Mixed content can cause browser warnings, blocked assets, or weaker trust signals.",
        recommendation:
          "Update asset and link references to HTTPS or protocol-relative URLs.",
        source: "technical-baseline",
      });
    }

    if (assetCount > 60 || scriptTags.length > 18 || imageTags.length > 30) {
      findings.push({
        category: "SPEED",
        severity: assetCount > 100 || scriptTags.length > 30 ? "HIGH" : "MEDIUM",
        title: "High asset count may slow the page",
        description: `The page source includes ${imageTags.length} images, ${scriptTags.length} scripts, and ${stylesheetTags.length} stylesheets.`,
        impact:
          "Large asset counts can slow load time, especially on mobile connections.",
        recommendation:
          "Audit unused scripts/styles, defer noncritical JavaScript, and optimize image loading.",
        evidence: {
          imageCount: imageTags.length,
          scriptCount: scriptTags.length,
          stylesheetCount: stylesheetTags.length,
        },
        source: "technical-baseline",
      });
    } else {
      findings.push({
        category: "SPEED",
        severity: "INFO",
        title: "Speed baseline captured",
        description: `The starter pass counted ${imageTags.length} images, ${scriptTags.length} scripts, and ${stylesheetTags.length} stylesheets.`,
        impact:
          "Asset counts are a first-pass speed signal before full Lighthouse/PageSpeed scoring.",
        recommendation:
          "Run PageSpeed/Lighthouse next for Core Web Vitals, render-blocking assets, and image optimization details.",
        evidence: {
          imageCount: imageTags.length,
          scriptCount: scriptTags.length,
          stylesheetCount: stylesheetTags.length,
          lazyImageCount,
        },
        source: "technical-baseline",
      });
    }

    if (imageTags.length > 6 && lazyImageCount === 0) {
      findings.push({
        category: "SPEED",
        severity: "LOW",
        title: "Images may not use lazy loading",
        description:
          "Several image tags were found, but none included native lazy loading.",
        impact:
          "Lazy loading can reduce initial page weight and improve perceived speed.",
        recommendation:
          "Lazy-load below-the-fold images while keeping important hero images eager.",
        evidence: { imageCount: imageTags.length, lazyImageCount },
        source: "technical-baseline",
      });
    }

    return findings;
  },
};

function getTitle(html: string) {
  return cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function getMetaContent(html: string, name: string) {
  const patterns = [
    new RegExp(
      `<meta\\b(?=[^>]*\\bname=["']${name}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta\\b(?=[^>]*\\bcontent=["']([^"']*)["'])(?=[^>]*\\bname=["']${name}["'])[^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const value = cleanText(html.match(pattern)?.[1]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function getLinkHref(html: string, rel: string) {
  const match = html.match(
    new RegExp(
      `<link\\b(?=[^>]*\\brel=["'][^"']*${rel}[^"']*["'])(?=[^>]*\\bhref=["']([^"']*)["'])[^>]*>`,
      "i",
    ),
  );

  return cleanText(match?.[1]);
}

function cleanText(value?: string) {
  return value
    ?.replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueMatches(html: string, pattern: RegExp) {
  return Array.from(html.matchAll(pattern))
    .map((match) => match[1]?.toLowerCase())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 50);
}

function hasMissingImageAlt(tag: string) {
  const alt = tag.match(/\salt\s*=\s*["']([^"']*)["']/i)?.[1];

  return alt === undefined || alt.trim().length === 0;
}

function hasMissingFormLabel(tag: string, html: string) {
  if (/\stype\s*=\s*["']?(hidden|submit|button|reset|image)/i.test(tag)) {
    return false;
  }

  if (/\s(aria-label|aria-labelledby|title)\s*=/i.test(tag)) {
    return false;
  }

  const id = tag.match(/\sid\s*=\s*["']([^"']+)["']/i)?.[1];

  return !id || !new RegExp(`<label\\b[^>]*\\bfor=["']${escapeRegExp(id)}["']`, "i").test(html);
}

function countEmptyLinks(html: string) {
  const links = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];

  return links.filter((link) => {
    if (/\s(aria-label|aria-labelledby|title)\s*=/i.test(link)) {
      return false;
    }

    const text = cleanText(link);
    const imageAlt = link.match(/\salt\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();

    return !text && !imageAlt;
  }).length;
}

function getMissingSecurityHeaders(response: Response, url: URL) {
  const missing = [];

  if (url.protocol === "https:" && !response.headers.get("strict-transport-security")) {
    missing.push("strict-transport-security");
  }

  if (
    !response.headers.get("content-security-policy") &&
    !response.headers.get("x-frame-options")
  ) {
    missing.push("content-security-policy or x-frame-options");
  }

  if (!response.headers.get("x-content-type-options")) {
    missing.push("x-content-type-options");
  }

  if (!response.headers.get("referrer-policy")) {
    missing.push("referrer-policy");
  }

  if (!response.headers.get("permissions-policy")) {
    missing.push("permissions-policy");
  }

  return missing;
}

async function getSupportFileSignals(origin: string) {
  const [robots, sitemap, sitemapIndex] = await Promise.all([
    fetchSupportFile(`${origin}/robots.txt`),
    fetchSupportFile(`${origin}/sitemap.xml`),
    fetchSupportFile(`${origin}/sitemap_index.xml`),
  ]);

  return {
    robotsFound: robots.ok,
    sitemapFound: sitemap.ok || sitemapIndex.ok,
    robotsStatus: robots.status,
    sitemapStatus: sitemap.status,
    sitemapIndexStatus: sitemapIndex.status,
  };
}

async function fetchSupportFile(url: string) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(SUPPORT_TIMEOUT_MS),
      headers: {
        "user-agent": "WebsiteScannerBot/0.1",
      },
    });

    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
