/**
 * Whole-site `llms.txt` formatting (T-22): the llmstxt.org convention — an
 * H1, a blockquote summary, then H2 sections of Markdown links — for a
 * route map that comes from the caller (the website's nav). Pure text in,
 * pure text out: no filesystem, no network, no invented content.
 */

export interface SiteLlmsLink {
  title: string;
  /** Absolute (`https://texuli.com/guides/`) or site-absolute (`/guides/`). */
  href: string;
  /** One factual line after the link (`[Title](href): line`). */
  description?: string;
}

export interface SiteLlmsSection {
  name: string;
  /** One factual line under the heading. */
  description?: string;
  links: readonly SiteLlmsLink[];
}

export interface SiteLlmsOptions {
  title: string;
  /** The blockquote summary directly under the title. */
  summary: string;
  /** Optional intro paragraph between the summary and the first section. */
  intro?: string;
  sections: readonly SiteLlmsSection[];
}

/** Single-line text: Markdown list items cannot carry line breaks. */
function oneline(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, ' ').trim();
}

/**
 * A Markdown link destination that cannot break its list item: surrounding
 * whitespace is trimmed, then any inner whitespace (including newlines) and
 * parentheses are percent-encoded.
 */
function linkHref(href: string): string {
  return href
    .trim()
    .replace(/[\s()]/g, (char) =>
      char === '(' ? '%28' : char === ')' ? '%29' : encodeURIComponent(char)
    );
}

/**
 * The `llms.txt` document. Sections without links are dropped (an empty
 * section is a caller bug, not content); every text field is collapsed to
 * one line. Hrefs are used as given apart from percent-encoding whitespace and
 * parentheses (so a link cannot break its list item) — callers pass absolute
 * URLs so agents can fetch without resolving a base.
 */
export function formatSiteLlmsTxt(options: SiteLlmsOptions): string {
  const lines: string[] = [`# ${oneline(options.title)}`, '', `> ${oneline(options.summary)}`];
  if (options.intro) lines.push('', oneline(options.intro));
  for (const section of options.sections) {
    if (section.links.length === 0) continue;
    lines.push('', `## ${oneline(section.name)}`, '');
    if (section.description) lines.push(oneline(section.description), '');
    for (const link of section.links) {
      const title = oneline(link.title);
      const href = linkHref(link.href);
      const description = link.description ? oneline(link.description) : '';
      lines.push(`- [${title}](${href})${description ? `: ${description}` : ''}`);
    }
  }
  return `${lines.join('\n')}\n`;
}
