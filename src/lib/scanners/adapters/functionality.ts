import { resolveMx, resolveTxt } from "node:dns/promises";
import type { ScannerAdapter, ScannerFinding } from "@/lib/scanners/types";

const PAGE_TIMEOUT_MS = 15000;
const LINK_TIMEOUT_MS = 6000;
const MAX_LINK_CHECKS = 12;

type LinkCheck = {
  url: string;
  status: number;
  ok: boolean;
};

type PageLink = {
  tag: string;
  href: string;
  text: string;
};

const CHATBOT_PATTERNS = [
  { label: "Intercom", pattern: /intercom(?:cdn|\.io|\.com)|intercomSettings/i },
  { label: "Drift", pattern: /drift\.com|driftt\.com|drift\.load/i },
  { label: "Tawk.to", pattern: /tawk\.to|Tawk_API/i },
  { label: "Crisp", pattern: /crisp\.chat|CRISP_WEBSITE_ID/i },
  { label: "Zendesk chat", pattern: /zendesk|zE\(|zdassets\.com/i },
  { label: "HubSpot chat", pattern: /HubSpotConversations|js\.hs-scripts\.com|hubspot/i },
  { label: "LiveChat", pattern: /livechatinc\.com|LiveChatWidget/i },
  { label: "Tidio", pattern: /tidio\.co|tidiochat/i },
  { label: "Freshchat", pattern: /freshchat|freshworks/i },
  { label: "Gorgias", pattern: /gorgias/i },
  { label: "Help Scout Beacon", pattern: /beacon-v2\.helpscout\.net|HelpScout/i },
  { label: "Chatwoot", pattern: /chatwoot/i },
  { label: "Olark", pattern: /olark/i },
  { label: "Zoho SalesIQ", pattern: /salesiq\.zoho/i },
  { label: "Facebook customer chat", pattern: /fb-customerchat|facebook\.com\/customerchat/i },
  { label: "Chatbase", pattern: /chatbase\.co|chatbase\.js/i },
  { label: "Botpress", pattern: /botpress/i },
  { label: "Voiceflow", pattern: /voiceflow/i },
  { label: "CustomGPT", pattern: /customgpt/i },
  { label: "SiteGPT", pattern: /sitegpt/i },
] as const;

export const functionalityScanner: ScannerAdapter = {
  name: "functionality-baseline",
  async run({ url }) {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: {
        "user-agent": "WebsiteScannerBot/0.1",
      },
    });
    const html = await response.text();
    const finalUrl = response.url || url;
    const parsedUrl = new URL(finalUrl);
    const domain = getMailDomain(parsedUrl.hostname);
    const findings: ScannerFinding[] = [];
    const links = getLinks(html);

    const [mxRecords, spfRecord, dmarcRecord] = await Promise.all([
      getMxRecords(domain),
      getTxtRecord(domain, (record) => /^v=spf1\b/i.test(record)),
      getTxtRecord(`_dmarc.${domain}`, (record) => /^v=dmarc1\b/i.test(record)),
    ]);

    const forms = getTags(html, "form");
    const contactForms = forms.filter(isContactForm);
    const leadIntakeForms = forms.filter(isLeadIntakeForm);
    const emailInputs = getTags(html, "input").filter((tag) =>
      /\btype\s*=\s*["']?email/i.test(tag),
    );
    const mailtoLinks = links.filter((link) => link.href.startsWith("mailto:"));
    const telLinks = links.filter((link) => link.href.startsWith("tel:"));
    const exposedEmails = uniqueValues(
      Array.from(html.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)).map(
        (match) => match[0],
      ),
    );
    const chatbotSignals = getChatbotSignals(html);
    const bookingLinks = links.filter(isBookingLink);
    const supportLinks = links.filter(isSupportLink);
    const faqSignals = getFaqSignals(html, links);
    const brokenActionLinks = getBrokenActionLinks(links);
    const problematicForms = forms.filter(hasProblematicFormSetup);
    const sampledLinks = getSameSiteLinks(links, parsedUrl).slice(0, MAX_LINK_CHECKS);
    const checkedLinks = await Promise.all(sampledLinks.map(checkLink));
    const brokenLinks = checkedLinks.filter((link) => !link.ok);

    findings.push({
      category: "FUNCTIONALITY",
      severity: "INFO",
      title: "Core functionality baseline captured",
      description:
        "The scanner checked public contact, email, form, phone, CTA, and internal-link signals.",
      impact:
        "These checks help catch visible problems that can stop leads, calls, form submissions, or important page navigation.",
      recommendation:
        "Review the counts below and manually test the highest-value contact and conversion paths.",
      evidence: {
        provider: "Functionality baseline",
        counts: [
          { label: "Forms found", value: forms.length },
          { label: "Likely contact forms", value: contactForms.length },
          { label: "Email fields", value: emailInputs.length },
          { label: "Mail links", value: mailtoLinks.length },
          { label: "Phone links", value: telLinks.length },
          { label: "Internal links sampled", value: checkedLinks.length },
        ],
        examples: [
          ...contactForms.slice(0, 4).map(summarizeHtml),
          ...mailtoLinks.slice(0, 3).map((link) => link.href),
          ...telLinks.slice(0, 3).map((link) => link.href),
        ],
      },
      source: "functionality-baseline",
    });

    findings.push({
      category: "AI_OPPORTUNITIES",
      severity: chatbotSignals.length > 0 ? "INFO" : "MEDIUM",
      title:
        chatbotSignals.length > 0
          ? "Chat or AI assistant detected"
          : "No AI chat assistant detected",
      description:
        chatbotSignals.length > 0
          ? `${chatbotSignals.length} public chat or assistant signal${chatbotSignals.length === 1 ? "" : "s"} were found in the page source.`
          : "The scanned page did not show a public chat widget, AI assistant, or obvious automated help tool.",
      impact:
        chatbotSignals.length > 0
          ? "A chat tool can reduce phone and email load, but it should be reviewed for after-hours handling, answer quality, lead routing, and AI automation options."
          : "Visitors may still rely on phone calls, emails, or staff follow-up for repetitive questions that an AI assistant could answer immediately.",
      recommendation:
        chatbotSignals.length > 0
          ? "Review the current chat setup and consider AI answers for FAQs, service questions, lead qualification, and appointment routing."
          : "Add a website assistant trained on services, FAQs, hours, pricing guidance, forms, and contact rules so common questions do not require staff time.",
      evidence: {
        counts: [
          { label: "Chatbot signals found", value: chatbotSignals.length },
          { label: "Forms found", value: forms.length },
          { label: "Booking links found", value: bookingLinks.length },
          { label: "FAQ/help signals", value: faqSignals.length },
        ],
        examples:
          chatbotSignals.length > 0
            ? chatbotSignals
            : [
                ...contactForms.slice(0, 2).map(summarizeHtml),
                ...bookingLinks.slice(0, 2).map((link) => `${link.text || "Booking link"}: ${link.href}`),
                ...faqSignals.slice(0, 3),
              ],
      },
      source: "functionality-baseline",
    });

    if (
      contactForms.length > 0 ||
      leadIntakeForms.length > 0 ||
      bookingLinks.length > 0 ||
      exposedEmails.length > 0 ||
      telLinks.length > 0
    ) {
      findings.push({
        category: "AI_OPPORTUNITIES",
        severity: leadIntakeForms.length > 0 || bookingLinks.length > 0 ? "MEDIUM" : "LOW",
        title: "AI lead intake could reduce manual follow-up",
        description:
          "The page has public lead or contact paths that could be supported by AI intake, routing, and follow-up prompts.",
        impact:
          "An AI intake flow can collect project details, answer repeat questions, qualify inquiries, and route the next step before staff has to respond.",
        recommendation:
          "Add an AI-assisted intake flow for quotes, bookings, support, or service questions, then send clean summaries to email, CRM, or the client's task list.",
        evidence: {
          counts: [
            { label: "Likely contact forms", value: contactForms.length },
            { label: "Lead intake forms", value: leadIntakeForms.length },
            { label: "Booking links", value: bookingLinks.length },
            { label: "Phone links", value: telLinks.length },
          ],
          examples: [
            ...leadIntakeForms.slice(0, 4).map(summarizeHtml),
            ...bookingLinks.slice(0, 4).map((link) => `${link.text || "Booking link"}: ${link.href}`),
            ...mailtoLinks.slice(0, 2).map((link) => link.href),
            ...telLinks.slice(0, 2).map((link) => link.href),
          ],
        },
        source: "functionality-baseline",
      });
    }

    if (faqSignals.length > 0 || supportLinks.length > 0) {
      findings.push({
        category: "AI_OPPORTUNITIES",
        severity: "LOW",
        title: "FAQ and help content can power an AI assistant",
        description:
          "The page includes FAQ, help, support, or question-style content that could become a knowledge base for automated answers.",
        impact:
          "Existing support content lowers setup time because the assistant can start with answers the client already approves.",
        recommendation:
          "Use this content to train an AI helper, then add guardrails for quotes, medical/legal claims, emergency issues, and anything that should route to staff.",
        evidence: {
          counts: [
            { label: "FAQ/question signals", value: faqSignals.length },
            { label: "Help/support links", value: supportLinks.length },
          ],
          examples: [
            ...faqSignals.slice(0, 5),
            ...supportLinks.slice(0, 5).map((link) => `${link.text || "Support link"}: ${link.href}`),
          ],
        },
        source: "functionality-baseline",
      });
    }

    if (mxRecords.length === 0) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "HIGH",
        title: "Email MX records were not found",
        description: `No MX records were found for ${domain}.`,
        impact:
          "Without MX records, domain email may not receive messages reliably.",
        recommendation:
          "Confirm the client uses this domain for email. If they do, add the correct MX records from their email provider.",
        evidence: {
          domain,
          counts: [{ label: "MX records found", value: 0 }],
          examples: [`Checked MX for ${domain}`],
        },
        source: "functionality-baseline",
      });
    }

    if (!spfRecord) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "MEDIUM",
        title: "SPF email authentication record missing",
        description: `No SPF TXT record was found for ${domain}.`,
        impact:
          "Missing SPF can make client email more likely to land in spam or fail sender checks.",
        recommendation:
          "Add an SPF record that includes the client's email provider and any website form sender.",
        evidence: {
          domain,
          counts: [{ label: "SPF records found", value: 0 }],
          examples: [`Checked TXT records for ${domain}`],
        },
        source: "functionality-baseline",
      });
    }

    if (!dmarcRecord) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "MEDIUM",
        title: "DMARC email authentication record missing",
        description: `No DMARC TXT record was found for _dmarc.${domain}.`,
        impact:
          "Missing DMARC makes spoofing harder to monitor and can weaken email trust.",
        recommendation:
          "Add a DMARC record after SPF/DKIM are confirmed. Start with a monitoring policy if needed.",
        evidence: {
          domain,
          counts: [{ label: "DMARC records found", value: 0 }],
          examples: [`Checked TXT records for _dmarc.${domain}`],
        },
        source: "functionality-baseline",
      });
    } else if (/;\s*p=none\b/i.test(dmarcRecord) || /\bp=none\b/i.test(dmarcRecord)) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "LOW",
        title: "DMARC policy is monitoring only",
        description: "The DMARC record uses p=none.",
        impact:
          "A monitoring-only DMARC policy reports issues but does not ask receivers to quarantine or reject spoofed mail.",
        recommendation:
          "After confirming legitimate senders pass SPF/DKIM, consider moving DMARC toward quarantine or reject.",
        evidence: {
          domain,
          examples: [dmarcRecord],
        },
        source: "functionality-baseline",
      });
    }

    if (problematicForms.length > 0) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "HIGH",
        title: "Forms may not submit correctly",
        description: `${problematicForms.length} form${problematicForms.length === 1 ? "" : "s"} use an empty, placeholder, or mailto action.`,
        impact:
          "Broken form actions can stop leads or support requests from reaching the client.",
        recommendation:
          "Manually submit each important form and confirm the client receives the email or CRM entry.",
        evidence: {
          counts: [{ label: "Forms needing submit review", value: problematicForms.length }],
          examples: problematicForms.slice(0, 8).map(summarizeHtml),
        },
        source: "functionality-baseline",
      });
    }

    if (brokenActionLinks.length > 0) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "MEDIUM",
        title: "Important action links may be placeholders",
        description: `${brokenActionLinks.length} CTA/contact-style link${brokenActionLinks.length === 1 ? "" : "s"} use empty, #, or javascript href values.`,
        impact:
          "Broken action links can stop visitors from calling, contacting, booking, buying, or requesting a quote.",
        recommendation:
          "Update placeholder CTA links to real pages, forms, phone links, email links, or booking URLs.",
        evidence: {
          counts: [{ label: "Placeholder action links", value: brokenActionLinks.length }],
          examples: brokenActionLinks.slice(0, 8),
        },
        source: "functionality-baseline",
      });
    }

    if (brokenLinks.length > 0) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: brokenLinks.length > 3 ? "HIGH" : "MEDIUM",
        title: "Sampled internal links returned errors",
        description: `${brokenLinks.length} of ${checkedLinks.length} sampled same-site links returned an error status.`,
        impact:
          "Broken internal links can block visitors from key pages and weaken trust in the site.",
        recommendation:
          "Fix or redirect broken internal links, especially links in navigation, CTAs, and footer areas.",
        evidence: {
          counts: [
            { label: "Broken sampled links", value: brokenLinks.length },
            { label: "Internal links sampled", value: checkedLinks.length },
          ],
          examples: brokenLinks
            .slice(0, 8)
            .map((link) => `${link.status}: ${link.url}`),
        },
        source: "functionality-baseline",
      });
    }

    if (exposedEmails.length > 0 && mailtoLinks.length === 0) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "LOW",
        title: "Email addresses are visible but not linked",
        description: `${exposedEmails.length} visible email address${exposedEmails.length === 1 ? "" : "es"} were found, but no mailto links were found.`,
        impact:
          "Visitors may need to manually copy email addresses instead of tapping to email on mobile.",
        recommendation:
          "Make public email addresses clickable or provide a working contact form nearby.",
        evidence: {
          counts: [
            { label: "Visible email addresses", value: exposedEmails.length },
            { label: "Mail links", value: mailtoLinks.length },
          ],
          examples: exposedEmails.slice(0, 8),
        },
        source: "functionality-baseline",
      });
    }

    if (forms.length === 0 && mailtoLinks.length === 0 && telLinks.length === 0) {
      findings.push({
        category: "FUNCTIONALITY",
        severity: "LOW",
        title: "No obvious contact action found",
        description:
          "The scanned page did not show a form, mailto link, or phone link.",
        impact:
          "If this page is meant to generate leads, visitors may not have a clear way to contact the business.",
        recommendation:
          "Confirm the page has a clear conversion path such as a contact form, phone link, quote button, or booking link.",
        evidence: {
          counts: [
            { label: "Forms", value: forms.length },
            { label: "Mail links", value: mailtoLinks.length },
            { label: "Phone links", value: telLinks.length },
          ],
        },
        source: "functionality-baseline",
      });
    }

    return findings;
  },
};

async function getMxRecords(domain: string) {
  try {
    return await resolveMx(domain);
  } catch {
    return [];
  }
}

async function getTxtRecord(domain: string, predicate: (record: string) => boolean) {
  try {
    const records = await resolveTxt(domain);
    return records.map((record) => record.join("")).find(predicate);
  } catch {
    return undefined;
  }
}

function getTags(html: string, tagName: string) {
  if (tagName === "form") {
    return html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  }

  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function getLinks(html: string) {
  const links = html.match(/<a\b[\s\S]*?<\/a>/gi) ?? [];

  return links
    .map((tag) => ({
      tag,
      href: getAttribute(tag, "href") ?? "",
      text: cleanText(tag),
    }))
    .filter((link) => link.href);
}

function getSameSiteLinks(links: PageLink[], pageUrl: URL) {
  const sameSiteLinks = links
    .map((link) => {
      try {
        const url = new URL(link.href, pageUrl);

        if (url.origin !== pageUrl.origin) {
          return null;
        }

        if (["mailto:", "tel:", "sms:", "javascript:"].includes(url.protocol)) {
          return null;
        }

        url.hash = "";
        return url.toString();
      } catch {
        return null;
      }
    })
    .filter((link): link is string => Boolean(link));

  return uniqueValues(sameSiteLinks).filter((link) => link !== pageUrl.toString());
}

async function checkLink(url: string): Promise<LinkCheck> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      headers: { "user-agent": "WebsiteScannerBot/0.1" },
    });

    if (response.status === 405 || response.status === 403) {
      return checkLinkWithGet(url);
    }

    return { url, status: response.status, ok: response.ok };
  } catch {
    return checkLinkWithGet(url);
  }
}

async function checkLinkWithGet(url: string): Promise<LinkCheck> {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      headers: { "user-agent": "WebsiteScannerBot/0.1" },
    });

    return { url, status: response.status, ok: response.ok };
  } catch {
    return { url, status: 0, ok: false };
  }
}

function isContactForm(form: string) {
  return /contact|quote|message|email|name|phone|subscribe|newsletter|appointment|booking/i.test(
    form,
  );
}

function isLeadIntakeForm(form: string) {
  return /quote|estimate|consult|booking|appointment|apply|register|request|intake|contact|message|email|phone/i.test(
    form,
  );
}

function hasProblematicFormSetup(form: string) {
  const action = getAttribute(form, "action");

  return (
    action === undefined ||
    action.trim() === "" ||
    action.trim() === "#" ||
    /^javascript:/i.test(action) ||
    /^mailto:/i.test(action)
  );
}

function getBrokenActionLinks(links: PageLink[]) {
  return links
    .filter((link) => /contact|quote|book|schedule|call|email|buy|donate|apply|register/i.test(link.text))
    .filter((link) => {
      const href = link.href.trim().toLowerCase();
      return href === "" || href === "#" || href === "/" || href.startsWith("javascript:");
    })
    .map((link) => summarizeHtml(link.tag));
}

function isBookingLink(link: PageLink) {
  return /calendly|acuityscheduling|book|schedule|appointment|reservation|consultation|meeting|calendar/i.test(
    `${link.text} ${link.href}`,
  );
}

function isSupportLink(link: PageLink) {
  return /faq|help|support|knowledge|docs|documentation|resources|questions/i.test(
    `${link.text} ${link.href}`,
  );
}

function getChatbotSignals(html: string) {
  return uniqueValues(
    CHATBOT_PATTERNS.filter(({ pattern }) => pattern.test(html)).map(
      ({ label }) => label,
    ),
  );
}

function getFaqSignals(html: string, links: PageLink[]) {
  const schemaSignals = /"@type"\s*:\s*"FAQPage"|"@type"\s*:\s*\[\s*"FAQPage"/i.test(
    html,
  )
    ? ["FAQ schema found"]
    : [];
  const linkSignals = links
    .filter(isSupportLink)
    .map((link) => `${link.text || "Help link"}: ${link.href}`);
  const headingSignals = Array.from(
    html.matchAll(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi),
  )
    .map((match) => cleanText(match[0]))
    .filter((text) => /\?|^(what|how|when|where|why|can|do|does|will)\b/i.test(text));

  return uniqueValues([...schemaSignals, ...linkSignals, ...headingSignals]);
}

function getAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
}

function getMailDomain(hostname: string) {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  const parts = host.split(".");

  if (parts.length <= 2) {
    return host;
  }

  return parts.slice(-2).join(".");
}

function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueValues(values: string[]) {
  return values
    .filter(Boolean)
    .filter((value, index, allValues) => allValues.indexOf(value) === index)
    .slice(0, 50);
}

function summarizeHtml(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 220);
}
