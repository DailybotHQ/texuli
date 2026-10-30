/**
 * Markdown twins for every page (PLAN_011 T-ar-twins): the pure half. The
 * build (`integration.ts`) writes one `.md` file beside every built HTML page,
 * `/` → `/index.md` and `/guides/theming/` → `/guides/theming.md`; the edge
 * middleware serves the same file on `Accept: text/markdown`; every page head
 * links it with `<link rel="alternate" type="text/markdown">`; and
 * `scripts/check-md-parity.ts --strict` proves the three agree after a build.
 *
 * A twin is the page's own content, never a summary written elsewhere: the
 * rendered main content (between the layout's `<!--tx-page-body-->` markers,
 * or the page's `<main>`, or its `<body>`) through `htmlToMarkdown`, which
 * keeps headings, prose, lists, tables, links, code and image alt text. No
 * page of the site has a Markdown or MDX source today, so there is no native
 * Markdown to prefer; when one appears, its source should replace the
 * rendition here. Interactive pages also get a "For agents" section
 * (`twin-notes.ts`) that names the docs and the MCP operations that do the
 * same thing through the protocol.
 *
 * Every twin opens with a header block an agent can parse line by line:
 *
 * ```md
 * # Theming
 *
 * > Pick a library theme, compile CSS variables, …
 *
 * Language: en
 * Canonical: https://texuli.com/guides/theming/
 * Markdown: https://texuli.com/guides/theming.md (this page). …
 * Last Updated: 2026-10-30
 *
 * ---
 * ```
 *
 * Pure: no file system, no clock, no network. Strings only.
 */
import { twinCandidate } from '../seo/agent-discovery.ts';
import { absolutizeMarkdownLinks, htmlToMarkdown } from './markdown.ts';

/** A route that has no twin, and why. */
export interface TwinExemption {
  /** Matches the page route (`/404.html`, `/404/`). */
  pattern: RegExp;
  reason: string;
}

/**
 * The explicit allowlist of built HTML routes without a twin. Everything
 * else the build writes as HTML must have one (the strict parity check
 * fails otherwise). Non-HTML endpoints (`/theme-css/<id>.css`,
 * `/theme-data/<id>.json`, `/theme-catalog.json`, `/theme-catalog-dark.json`,
 * `/theme-gallery.json`, `/slides-page/media/texuli-mark.webp`) are not
 * pages, so they never enter the check; redirect stubs (a `meta refresh`
 * document) are detected by `isRedirectStub` and skipped too (the site
 * builds none today).
 */
export const TWIN_EXEMPTIONS: readonly TwinExemption[] = Object.freeze([
  {
    pattern: /^\/404(?:\.html|\/)?$/,
    reason:
      'The error document. A miss has no content to mirror: a non-browser client gets a Markdown 404 body from the middleware instead.',
  },
]);

/** The exemption that covers `route`, or `undefined` when the route needs a twin. */
export function twinExemption(route: string): TwinExemption | undefined {
  return TWIN_EXEMPTIONS.find((entry) => entry.pattern.test(route));
}

/** A redirect stub: a small document whose only job is a `meta refresh`. */
export function isRedirectStub(html: string): boolean {
  return html.length < 4096 && /<meta\b[^>]*http-equiv=["']?refresh/i.test(html);
}

/**
 * The twin URL path of a built page route (`/` → `/index.md`,
 * `/guides/theming/` → `/guides/theming.md`), or `undefined` when the route
 * is exempt or is not a page route.
 */
export function twinPathFor(route: string): string | undefined {
  if (twinExemption(route)) return undefined;
  return twinCandidate(route);
}

/**
 * The Markdown access line: where this page's Markdown lives and how to get
 * Markdown for any other page. The header name and media type stay literal,
 * since agents parse those tokens.
 */
export function markdownAccessLine(twinUrl: string, origin: string): string {
  return `Markdown: ${twinUrl} (this page). Every texuli.com page has a Markdown twin at its URL plus \`.md\` (the home page is ${origin}/index.md), and any page URL answers \`Accept: text/markdown\` with its twin instead of HTML.`;
}

/** The facts a twin's header block states. */
export interface TwinHeader {
  title: string;
  description?: string;
  /** BCP 47 language of the page (`en`). */
  language: string;
  /** The HTML page's absolute URL. */
  canonical: string;
  /** The twin's absolute URL. */
  twinUrl: string;
  /** The site origin (`https://texuli.com`), for the access line. */
  origin: string;
  /** `YYYY-MM-DD`, deterministic (git, see `routeLastmod`). */
  lastUpdated: string;
}

/** One line of a header value: no newlines, no runaway whitespace. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The header block that opens every twin, ending with the `---` rule. */
export function twinHeader(header: TwinHeader): string {
  const lines = [`# ${oneLine(header.title)}`, ''];
  const description = header.description ? oneLine(header.description) : '';
  if (description) lines.push(`> ${description}`, '');
  lines.push(
    `Language: ${header.language}`,
    `Canonical: ${header.canonical}`,
    markdownAccessLine(header.twinUrl, header.origin),
    `Last Updated: ${header.lastUpdated}`,
    '',
    '---',
    ''
  );
  return `${lines.join('\n')}\n`;
}

/** The parsed header block of a twin. */
export interface ParsedTwinHeader {
  title: string;
  language: string;
  canonical: string;
  markdown: string;
  lastUpdated: string;
  /** The content after the `---` rule. */
  body: string;
}

const HEADER_FIELDS = ['Language', 'Canonical', 'Markdown', 'Last Updated'] as const;

/**
 * Parses a twin's header block. Returns the fields, or the list of problems
 * that make the block invalid (missing or empty fields, a malformed date, no
 * `---` rule, an empty body).
 */
export function parseTwinHeader(
  markdown: string
): { ok: true; header: ParsedTwinHeader } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  const rule = markdown.indexOf('\n---\n');
  if (!markdown.startsWith('# ')) problems.push('does not open with a "# Title" line');
  if (rule === -1) problems.push('has no "---" rule after the header block');
  const head = rule === -1 ? markdown : markdown.slice(0, rule);
  const body = rule === -1 ? '' : markdown.slice(rule + 5).trim();
  const title = /^# (.+)$/m.exec(head)?.[1]?.trim() ?? '';
  const fields: Record<string, string> = {};
  for (const name of HEADER_FIELDS) {
    const value = new RegExp(`^${name}: (.+)$`, 'm').exec(head)?.[1]?.trim() ?? '';
    if (!value) problems.push(`has no "${name}:" line`);
    fields[name] = value;
  }
  if (!title) problems.push('has an empty title');
  if (fields.Language && !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(fields.Language))
    problems.push(`has an invalid language "${fields.Language}"`);
  if (fields['Last Updated'] && !/^\d{4}-\d{2}-\d{2}$/.test(fields['Last Updated']))
    problems.push(`has an invalid Last Updated date "${fields['Last Updated']}"`);
  if (fields.Markdown && !fields.Markdown.includes('`Accept: text/markdown`'))
    problems.push('has a Markdown line that does not explain `Accept: text/markdown`');
  if (rule !== -1 && !body) problems.push('has no content after the header block');
  if (problems.length > 0) return { ok: false, problems };
  return {
    ok: true,
    header: {
      title,
      language: fields.Language ?? '',
      canonical: fields.Canonical ?? '',
      markdown: fields.Markdown ?? '',
      lastUpdated: fields['Last Updated'] ?? '',
      body,
    },
  };
}

const BODY = /<!--tx-page-body-->([\s\S]*?)<!--\/tx-page-body-->/;

/**
 * The page's content HTML: between the layout's body markers when present
 * (every `BaseLayout` page, the home included), else the page's `<main>`,
 * else its `<body>` (the isolated preview documents and the email preview).
 */
export function pageContentHtml(html: string): string {
  const marked = BODY.exec(html);
  if (marked) return marked[1] ?? '';
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(html);
  if (main) return main[1] ?? '';
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return body?.[1] ?? html;
}

/** The facts of a built page a twin needs, read from its HTML. */
export interface PageFacts {
  title: string;
  description: string;
  language: string;
}

/** `<html lang>`, defaulting to English (every page is English today). */
export function pageLanguage(html: string): string {
  return /<html\b[^>]*\blang="([^"]+)"/i.exec(html)?.[1] ?? 'en';
}

/** Removes the ` · Texuli` (or ` · preview`) suffix the layouts add to `<title>`. */
export function pageTitle(documentTitle: string): string {
  return documentTitle.replace(/\s+·\s+(?:Texuli|preview)$/, '').trim();
}

/** What `renderTwin` needs for one page. */
export interface TwinInput {
  /** The built page route (`/`, `/guides/theming/`). */
  route: string;
  /** The finished page HTML. */
  html: string;
  /** Title, description and language, read from the page head. */
  facts: PageFacts;
  /** The site origin (`https://texuli.com`). */
  origin: string;
  /** `YYYY-MM-DD`. */
  lastUpdated: string;
  /** An extra Markdown section appended after the content ("For agents"). */
  note?: string;
}

/**
 * The full twin of one page: the header block, then the content. The page's
 * first `h1` becomes the twin title (so the title is not repeated); without
 * one, the document title is used. Root-relative links become absolute, so
 * an agent can follow them from anywhere.
 */
export function renderTwin(input: TwinInput): string {
  const twin = twinPathFor(input.route);
  if (!twin) throw new Error(`the route ${input.route} has no twin`);
  let content = htmlToMarkdown(pageContentHtml(input.html));
  let title = pageTitle(input.facts.title);
  const heading = /^# (.+)$/m.exec(content);
  if (heading?.[1]) {
    title = heading[1].trim();
    content =
      `${content.slice(0, heading.index)}${content.slice(heading.index + heading[0].length)}`
        .replace(/^\n+/, '')
        .replace(/\n{3,}/g, '\n\n');
  }
  if (!title) title = 'Texuli';
  const header = twinHeader({
    title,
    description: input.facts.description,
    language: input.facts.language,
    canonical: `${input.origin}${input.route}`,
    twinUrl: `${input.origin}${twin}`,
    origin: input.origin,
    lastUpdated: input.lastUpdated,
  });
  const body = content.trim() || 'This page has no static text; see the section below.';
  const note = input.note ? `\n\n${input.note.trim()}` : '';
  return absolutizeMarkdownLinks(`${header}${body}${note}\n`, input.origin);
}

/** One page of the twin manifest's `pages` list (PLAN_011 T-ar-site-mcp). */
export interface TwinIndexEntry {
  /** The page route (`/`, `/guides/theming/`). */
  path: string;
  /** Its twin (`/index.md`, `/guides/theming.md`). */
  twin: string;
  title: string;
  description: string;
  /** The twin's h2 and h3 headings, in order, as plain text. */
  headings: string[];
}

/** The most headings one manifest entry keeps, and the longest heading. */
export const TWIN_INDEX_MAX_HEADINGS = 64;
const TWIN_INDEX_MAX_HEADING = 160;

/** Heading text without Markdown links, code ticks or emphasis marks. */
function plainHeading(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TWIN_INDEX_MAX_HEADING);
}

/**
 * The manifest entry of one written twin: the title from its header block,
 * the page description, and the h2/h3 headings of its body (outside code
 * fences). The remote MCP's `site.pages` and `site.search` read these. Pure.
 */
export function twinIndexEntry(
  route: string,
  twin: string,
  markdown: string,
  description: string
): TwinIndexEntry {
  const parsed = parseTwinHeader(markdown);
  const title = parsed.ok ? parsed.header.title : (/^# (.+)$/m.exec(markdown)?.[1]?.trim() ?? '');
  const body = parsed.ok ? parsed.header.body : markdown;
  const headings: string[] = [];
  let fenced = false;
  for (const line of body.split('\n')) {
    if (/^\s*(?:```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const match = /^#{2,3} (.+)$/.exec(line);
    const text = match?.[1] ? plainHeading(match[1]) : '';
    if (text && headings.length < TWIN_INDEX_MAX_HEADINGS) headings.push(text);
  }
  return {
    path: route,
    twin,
    title: title || route,
    description: oneLine(description),
    headings,
  };
}
