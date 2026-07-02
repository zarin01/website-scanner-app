import type { ScannerAdapter, ScannerFinding } from "@/lib/scanners/types";

const PAGE_TIMEOUT_MS = 15000;
const SUPPORT_TIMEOUT_MS = 7000;
const WORDPRESS_API_TIMEOUT_MS = 7000;

export const technicalScanner: ScannerAdapter = {
  name: "technical-baseline",
  async run({ url }) {
    const startedAt = Date.now();
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: {
        "user-agent": "WebsiteScannerBot/0.1",
      },
    });

    const html = await response.text();
    const responseTimeMs = Date.now() - startedAt;
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
    const pluginAssets = extractWordPressAssets(html, "plugins");
    const themeAssets = extractWordPressAssets(html, "themes");
    const pluginSlugs = uniqueValues(pluginAssets.map((asset) => asset.slug));
    const themeSlugs = uniqueValues(themeAssets.map((asset) => asset.slug));
    const exposedWordPressVersion = generator?.match(/wordpress\s+([0-9.]+)/i)?.[1];
    const exposedPhpVersion = getPhpVersion(poweredBy);
    const pluginVersionSignals = getPluginVersionSignals(pluginAssets);
    const missingAltImages = imageTags.filter(hasMissingImageAlt);
    const missingAltCount = missingAltImages.length;
    const lazyImageCount = imageTags.filter((tag) =>
      /\sloading\s*=\s*["']lazy["']/i.test(tag),
    ).length;
    const nonLazyImages = imageTags.filter(
      (tag) => !/\sloading\s*=\s*["']lazy["']/i.test(tag),
    );
    const formControlTags =
      html.match(/<(input|textarea|select)\b[^>]*>/gi) ?? [];
    const missingLabelControls = formControlTags.filter((tag) =>
      hasMissingFormLabel(tag, html),
    );
    const missingLabelCount = missingLabelControls.length;
    const emptyLinkExamples = getEmptyLinkExamples(html);
    const emptyLinkCount = emptyLinkExamples.length;
    const mixedContentExamples = getMixedContentExamples(html);
    const missingSecurityHeaders = getMissingSecurityHeaders(response, parsedUrl);
    const assetCount = imageTags.length + scriptTags.length + stylesheetTags.length;
    const htmlSizeKb = Math.round(Buffer.byteLength(html, "utf8") / 1024);
    const domNodeCount = html.match(/<[a-z][\w:-]*(?:\s|>)/gi)?.length ?? 0;
    const [supportFiles, latestWordPressVersion, pluginUpdateSignals] =
      await Promise.all([
        getSupportFileSignals(origin),
        exposedWordPressVersion ? getLatestWordPressVersion() : Promise.resolve(undefined),
        getPluginUpdateSignals(pluginVersionSignals.slice(0, 8)),
      ]);

    const platformSummary = getPlatformSummary({
      exposedPhpVersion,
      exposedWordPressVersion,
      latestWordPressVersion,
      pluginSlugs,
      pluginUpdateSignals,
    });

    findings.push({
      category: "WEBSITE_UPDATES",
      severity: platformSummary.severity,
      title: "Platform update snapshot",
      description:
        "Public platform signals were checked for PHP, WordPress core, and visible plugin version clues.",
      impact:
        "Outdated PHP, WordPress core, or plugins can create security, compatibility, and performance risk.",
      recommendation:
        "Confirm these items in hosting and wp-admin before quoting or completing maintenance updates.",
      evidence: {
        platformSummary,
        php: platformSummary.php,
        wordpress: platformSummary.wordpress,
        plugins: platformSummary.plugins,
        counts: [
          { label: "Visible plugins checked", value: pluginUpdateSignals.length },
          {
            label: "Outdated visible plugins",
            value: pluginUpdateSignals.filter((plugin) => plugin.status === "fail").length,
          },
        ],
        examples: [
          platformSummary.php.detail,
          platformSummary.wordpress.detail,
          ...pluginUpdateSignals
            .filter(isOutdatedPlugin)
            .map((plugin) => `${plugin.slug}: visible ${plugin.detectedVersion}, latest ${plugin.latestVersion}`),
        ],
      },
      source: "technical-baseline",
    });

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
          title,
          htmlSizeKb,
          domNodeCount,
          responseTimeMs,
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
        evidence: {
          server,
          poweredBy,
          generator,
          examples: [
            ...pluginAssets.slice(0, 2).map((asset) => asset.path),
            ...themeAssets.slice(0, 2).map((asset) => asset.path),
          ],
          remoteLimits: [
            "PHP version is usually hidden from public scans.",
            "Exact WordPress/plugin/theme versions require wp-admin, hosting, or authenticated checks unless exposed in source.",
          ],
        },
        source: "technical-baseline",
      });
    }

    if (generator?.toLowerCase().includes("wordpress")) {
      if (exposedWordPressVersion) {
        const isOutdated =
          latestWordPressVersion &&
          compareVersions(exposedWordPressVersion, latestWordPressVersion) < 0;

        findings.push({
          category: "WEBSITE_UPDATES",
        severity: isOutdated ? "HIGH" : "MEDIUM",
          title: "WordPress version is exposed",
          description: `The page source exposes WordPress ${exposedWordPressVersion}.`,
          impact:
            "Public version clues can make security review easier for attackers and help identify update risk.",
          recommendation:
            isOutdated
              ? `Update WordPress core after backups and staging review. Latest detected WordPress release is ${latestWordPressVersion}.`
              : "Confirm core is current and consider removing public generator/version output.",
        evidence: {
          generator,
          detectedVersion: exposedWordPressVersion,
          latestVersion: latestWordPressVersion,
          examples: [generator],
        },
          source: "technical-baseline",
        });
      }
    }

    const outdatedPlugins = pluginUpdateSignals.filter(isOutdatedPlugin);

    if (outdatedPlugins.length > 0) {
      findings.push({
        category: "WEBSITE_UPDATES",
        severity: outdatedPlugins.some((plugin) => plugin.severity === "HIGH")
          ? "HIGH"
          : "MEDIUM",
        title: "Visible plugin versions may be outdated",
        description: `${outdatedPlugins.length} visible plugin version${outdatedPlugins.length === 1 ? "" : "s"} appear older than WordPress.org's current plugin version.`,
        impact:
          "Outdated plugins are one of the most common WordPress security and compatibility risks.",
        recommendation:
          "Confirm active plugin versions in wp-admin, test updates in staging, and replace abandoned plugins.",
        evidence: {
          outdatedPlugins,
          counts: [
            { label: "Outdated visible plugins", value: outdatedPlugins.length },
            { label: "Visible plugins checked", value: pluginUpdateSignals.length },
          ],
          examples: outdatedPlugins
            .slice(0, 8)
            .map((plugin) => `${plugin.slug}: visible ${plugin.detectedVersion}, latest ${plugin.latestVersion}`),
        },
        source: "technical-baseline",
      });
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
        evidence: {
          plugins: pluginSlugs.slice(0, 20),
          examples: pluginAssets.slice(0, 8).map((asset) => asset.path),
          updateCheck:
            "Compare these visible plugin names against the active plugin list in wp-admin.",
        },
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
        evidence: {
          themes: themeSlugs.slice(0, 10),
          examples: themeAssets.slice(0, 8).map((asset) => asset.path),
          updateCheck:
            "Confirm the active theme and child theme are current and tracked in version control.",
        },
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
        evidence: { title, length: title.length, examples: [title] },
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
        evidence: {
          length: metaDescription.length,
          metaDescription,
          examples: [metaDescription],
        },
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
        evidence: {
          count: h1Tags.length,
          examples: h1Tags.slice(0, 5).map(summarizeHtml),
        },
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
        evidence: { robotsMeta, examples: [robotsMeta] },
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
        evidence: {
          missingAltCount,
          imageCount: imageTags.length,
          examples: missingAltImages.slice(0, 8).map(summarizeHtml),
          counts: [
            { label: "Images missing alt text", value: missingAltCount },
            { label: "Total images checked", value: imageTags.length },
          ],
        },
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
        evidence: {
          missingLabelCount,
          examples: missingLabelControls.slice(0, 8).map(summarizeHtml),
          counts: [{ label: "Controls missing labels", value: missingLabelCount }],
        },
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
        evidence: {
          emptyLinkCount,
          examples: emptyLinkExamples.slice(0, 8),
          counts: [{ label: "Links without accessible text", value: emptyLinkCount }],
        },
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
        evidence: {
          missingSecurityHeaders,
          counts: [{ label: "Missing security headers", value: missingSecurityHeaders.length }],
          examples: missingSecurityHeaders.map((header) => `Missing: ${header}`),
          presentHeaders: getPresentSecurityHeaders(response, parsedUrl),
        },
        source: "technical-baseline",
      });
    }

    if (parsedUrl.protocol === "https:" && mixedContentExamples.length > 0) {
      findings.push({
        category: "SECURITY",
        severity: "MEDIUM",
        title: "Possible mixed content found",
        description: `The HTTPS page includes ${mixedContentExamples.length} HTTP asset/link reference${mixedContentExamples.length === 1 ? "" : "s"}.`,
        impact:
          "Mixed content can cause browser warnings, blocked assets, or weaker trust signals.",
        recommendation:
          "Update asset and link references to HTTPS or protocol-relative URLs.",
        evidence: {
          mixedContentCount: mixedContentExamples.length,
          examples: mixedContentExamples.slice(0, 8),
          counts: [{ label: "HTTP references on HTTPS page", value: mixedContentExamples.length }],
        },
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
          assetCount,
          htmlSizeKb,
          domNodeCount,
          responseTimeMs,
          counts: [
            { label: "Images", value: imageTags.length },
            { label: "Scripts", value: scriptTags.length },
            { label: "Stylesheets", value: stylesheetTags.length },
            { label: "Estimated HTML KB", value: htmlSizeKb },
          ],
          examples: [
            ...imageTags.slice(0, 3).map(summarizeHtml),
            ...scriptTags.slice(0, 3).map(summarizeHtml),
            ...stylesheetTags.slice(0, 3).map(summarizeHtml),
          ],
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
          assetCount,
          htmlSizeKb,
          domNodeCount,
          responseTimeMs,
          counts: [
            { label: "Images", value: imageTags.length },
            { label: "Scripts", value: scriptTags.length },
            { label: "Stylesheets", value: stylesheetTags.length },
            { label: "Lazy-loaded images", value: lazyImageCount },
          ],
          examples: [
            ...imageTags.slice(0, 3).map(summarizeHtml),
            ...scriptTags.slice(0, 3).map(summarizeHtml),
            ...stylesheetTags.slice(0, 3).map(summarizeHtml),
          ],
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
        evidence: {
          imageCount: imageTags.length,
          lazyImageCount,
          examples: nonLazyImages.slice(0, 8).map(summarizeHtml),
          counts: [
            { label: "Images without lazy loading", value: nonLazyImages.length },
            { label: "Total images checked", value: imageTags.length },
          ],
        },
        source: "technical-baseline",
      });
    }

    if (htmlSizeKb > 500 || domNodeCount > 1500) {
      findings.push({
        category: "SPEED",
        severity: htmlSizeKb > 1000 || domNodeCount > 2500 ? "HIGH" : "MEDIUM",
        title: "Page markup may be heavy",
        description: `The page source is about ${htmlSizeKb} KB and contains roughly ${domNodeCount} HTML nodes.`,
        impact:
          "Heavy markup can slow browser parsing, increase memory use, and make template updates harder.",
        recommendation:
          "Review page builder output, unused sections, duplicated markup, and large inline scripts/styles.",
        evidence: {
          htmlSizeKb,
          domNodeCount,
          counts: [
            { label: "Estimated HTML KB", value: htmlSizeKb },
            { label: "Approximate HTML nodes", value: domNodeCount },
          ],
        },
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

function uniqueValues(values: string[]) {
  return values
    .filter(Boolean)
    .filter((value, index, allValues) => allValues.indexOf(value) === index)
    .slice(0, 50);
}

function extractWordPressAssets(html: string, type: "plugins" | "themes") {
  const pattern = new RegExp(
    `(?:https?:)?//[^"'\\s]+/wp-content/${type}/([^/"'?\\s]+)([^"'\\s]*)|/wp-content/${type}/([^/"'?\\s]+)([^"'\\s]*)`,
    "gi",
  );

  return Array.from(html.matchAll(pattern))
    .map((match) => {
      const slug = (match[1] ?? match[3] ?? "").toLowerCase();
      const suffix = match[2] ?? match[4] ?? "";

      return {
        slug,
        path: `/wp-content/${type}/${slug}${suffix}`.slice(0, 180),
        version: getAssetVersion(suffix),
      };
    })
    .filter((asset) => /^[a-z0-9._-]+$/.test(asset.slug))
    .filter(
      (asset, index, allAssets) =>
        allAssets.findIndex((candidate) => candidate.path === asset.path) === index,
    )
    .slice(0, 30);
}

function getAssetVersion(value: string) {
  const version = value.match(/[?&]ver=([^&#"'\s]+)/i)?.[1];

  return version ? decodeURIComponent(version).replace(/[^0-9A-Za-z._-]/g, "") : undefined;
}

function getPhpVersion(poweredBy: string | null) {
  return poweredBy?.match(/php\/?\s*([0-9]+(?:\.[0-9]+){1,2})/i)?.[1];
}

function getPluginVersionSignals(
  assets: ReturnType<typeof extractWordPressAssets>,
) {
  const bySlug = new Map<string, { slug: string; detectedVersion: string; example: string }>();

  assets.forEach((asset) => {
    if (!asset.version || bySlug.has(asset.slug) || !/^\d+(?:\.\d+){0,3}/.test(asset.version)) {
      return;
    }

    bySlug.set(asset.slug, {
      slug: asset.slug,
      detectedVersion: asset.version,
      example: asset.path,
    });
  });

  return Array.from(bySlug.values());
}

async function getLatestWordPressVersion() {
  try {
    const response = await fetch("https://api.wordpress.org/core/version-check/1.7/", {
      signal: AbortSignal.timeout(WORDPRESS_API_TIMEOUT_MS),
      headers: { "user-agent": "WebsiteScannerBot/0.1" },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as {
      offers?: { current?: string; response?: string }[];
    };

    return data.offers?.find((offer) => offer.response === "upgrade")?.current;
  } catch {
    return undefined;
  }
}

async function getPluginUpdateSignals(
  plugins: { slug: string; detectedVersion: string; example: string }[],
) {
  const results = await Promise.all(
    plugins.map(async (plugin) => {
      const latestVersion = await getLatestPluginVersion(plugin.slug);

      if (!latestVersion) {
        return {
          ...plugin,
          status: "unknown" as const,
          detail: "Latest version could not be confirmed from WordPress.org.",
        };
      }

      const comparison = compareVersions(plugin.detectedVersion, latestVersion);

      return {
        ...plugin,
        latestVersion,
        status: comparison < 0 ? ("fail" as const) : ("pass" as const),
        severity: getVersionGapSeverity(plugin.detectedVersion, latestVersion),
        detail:
          comparison < 0
            ? `${plugin.slug} appears outdated: visible ${plugin.detectedVersion}, latest ${latestVersion}.`
            : `${plugin.slug} visible version ${plugin.detectedVersion} matches or exceeds WordPress.org ${latestVersion}.`,
      };
    }),
  );

  return results;
}

async function getLatestPluginVersion(slug: string) {
  try {
    const params = new URLSearchParams({
      action: "plugin_information",
      "request[slug]": slug,
      "request[fields][version]": "1",
      "request[fields][sections]": "0",
    });
    const response = await fetch(`https://api.wordpress.org/plugins/info/1.2/?${params}`, {
      signal: AbortSignal.timeout(WORDPRESS_API_TIMEOUT_MS),
      headers: { "user-agent": "WebsiteScannerBot/0.1" },
    });

    if (!response.ok) {
      return undefined;
    }

    const data = (await response.json()) as { version?: string };

    return data.version;
  } catch {
    return undefined;
  }
}

function getPlatformSummary({
  exposedPhpVersion,
  exposedWordPressVersion,
  latestWordPressVersion,
  pluginSlugs,
  pluginUpdateSignals,
}: {
  exposedPhpVersion?: string;
  exposedWordPressVersion?: string;
  latestWordPressVersion?: string;
  pluginSlugs: string[];
  pluginUpdateSignals: Awaited<ReturnType<typeof getPluginUpdateSignals>>;
}) {
  const php = getPhpStatus(exposedPhpVersion);
  const wordpress = getWordPressStatus(exposedWordPressVersion, latestWordPressVersion);
  const plugins = getPluginsStatus(pluginSlugs, pluginUpdateSignals);
  const statuses = [php.status, wordpress.status, plugins.status];
  const severity: ScannerFinding["severity"] = statuses.includes("fail")
    ? "HIGH"
    : statuses.includes("warn")
      ? "MEDIUM"
      : "INFO";

  return { php, wordpress, plugins, severity };
}

function isOutdatedPlugin(
  plugin: Awaited<ReturnType<typeof getPluginUpdateSignals>>[number],
): plugin is {
  slug: string;
  detectedVersion: string;
  example: string;
  detail: string;
  latestVersion: string;
  severity: ScannerFinding["severity"];
  status: "fail";
} {
  return plugin.status === "fail";
}

function getPhpStatus(version?: string) {
  if (!version) {
    return {
      status: "warn" as const,
      label: "PHP hidden",
      detail: "PHP version is not publicly visible. Confirm in hosting.",
      version: null,
    };
  }

  const [major = 0, minor = 0] = version.split(".").map(Number);
  const status = major < 8 || (major === 8 && minor < 2)
    ? "fail"
    : major === 8 && minor === 2
      ? "warn"
      : "pass";

  return {
    status,
    label:
      status === "pass"
        ? "PHP looks current"
        : status === "warn"
          ? "PHP security-only"
          : "PHP update needed",
    detail:
      status === "pass"
        ? `PHP ${version} is within the current supported baseline.`
        : status === "warn"
          ? `PHP ${version} is older and should be planned for update.`
          : `PHP ${version} is outdated and should be upgraded.`,
    version,
  };
}

function getWordPressStatus(version?: string, latestVersion?: string) {
  if (!version) {
    return {
      status: "warn" as const,
      label: "WP version hidden",
      detail: "WordPress version is not publicly visible. Confirm in wp-admin.",
      version: null,
      latestVersion: latestVersion ?? null,
    };
  }

  if (!latestVersion) {
    return {
      status: "warn" as const,
      label: "WP latest unknown",
      detail: `WordPress ${version} is visible, but the latest version could not be checked.`,
      version,
      latestVersion: null,
    };
  }

  const outdated = compareVersions(version, latestVersion) < 0;

  return {
    status: outdated ? ("fail" as const) : ("pass" as const),
    label: outdated ? "WP update needed" : "WP looks current",
    detail: outdated
      ? `WordPress ${version} is visible; latest is ${latestVersion}.`
      : `WordPress ${version} matches the latest detected release.`,
    version,
    latestVersion,
  };
}

function getPluginsStatus(
  pluginSlugs: string[],
  pluginUpdateSignals: Awaited<ReturnType<typeof getPluginUpdateSignals>>,
) {
  const outdated = pluginUpdateSignals.filter((plugin) => plugin.status === "fail");

  if (outdated.length > 0) {
    return {
      status: "fail" as const,
      label: "Plugin updates found",
      detail: `${outdated.length} visible plugin version${outdated.length === 1 ? "" : "s"} appear outdated.`,
      checkedCount: pluginUpdateSignals.length,
      outdatedCount: outdated.length,
    };
  }

  if (pluginUpdateSignals.length > 0) {
    return {
      status: "pass" as const,
      label: "Visible plugins pass",
      detail: `${pluginUpdateSignals.length} visible plugin version${pluginUpdateSignals.length === 1 ? "" : "s"} checked against WordPress.org.`,
      checkedCount: pluginUpdateSignals.length,
      outdatedCount: 0,
    };
  }

  return {
    status: "warn" as const,
    label: pluginSlugs.length > 0 ? "Plugin versions hidden" : "No plugin versions",
    detail:
      pluginSlugs.length > 0
        ? `${pluginSlugs.length} plugin footprint${pluginSlugs.length === 1 ? "" : "s"} found, but public version numbers were not reliable enough to compare.`
        : "No WordPress plugin footprints were visible on this page.",
    checkedCount: 0,
    outdatedCount: 0,
  };
}

function compareVersions(first: string, second: string) {
  const firstParts = first.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const secondParts = second.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(firstParts.length, secondParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0);

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function getVersionGapSeverity(
  detectedVersion: string,
  latestVersion: string,
): ScannerFinding["severity"] {
  const detectedMajor = Number.parseInt(detectedVersion.split(".")[0] ?? "0", 10);
  const latestMajor = Number.parseInt(latestVersion.split(".")[0] ?? "0", 10);

  return detectedMajor < latestMajor ? "HIGH" : "MEDIUM";
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

function getEmptyLinkExamples(html: string) {
  const links = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) ?? [];

  return links
    .filter((link) => {
      if (/\s(aria-label|aria-labelledby|title)\s*=/i.test(link)) {
        return false;
      }

      const text = cleanText(link);
      const imageAlt = link.match(/\salt\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();

      return !text && !imageAlt;
    })
    .map(summarizeHtml);
}

function getMixedContentExamples(html: string) {
  const matches = html.match(/(?:src|href)=["']http:\/\/[^"']+["']/gi) ?? [];

  return uniqueValues(matches.map((match) => match.slice(0, 180)));
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

function getPresentSecurityHeaders(response: Response, url: URL) {
  const headers = [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
  ];

  return headers
    .filter((header) => header !== "strict-transport-security" || url.protocol === "https:")
    .map((header) => ({
      header,
      value: response.headers.get(header),
    }))
    .filter((header) => header.value);
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

function summarizeHtml(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}
