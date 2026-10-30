/**
 * SEO for texuli.com (T-site-seo): pure helpers shared by the head tags,
 * the build integration (social images, sitemap, robots) and the tests.
 * No DOM, no network: everything runs at build time on built files.
 */

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
/** Built social images live under `/og/`, one PNG per page. */
export const OG_DIRECTORY = 'og';
/** Pages never listed in the sitemap nor given a social image. */
export const SEO_EXCLUDED = new Set(['/404/', '/404.html']);

/** Normalizes a page pathname to `/a/b/` (or `/`), without the base path. */
export function normalizePagePath(pathname: string, base = '/'): string {
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  if (cleanBase !== '/' && path.startsWith(cleanBase)) path = `/${path.slice(cleanBase.length)}`;
  path = path.replace(/index\.html$/, '').replace(/\.html$/, '/');
  if (!path.endsWith('/')) path += '/';
  return path.replace(/\/{2,}/g, '/');
}

/** `/` → `og/index.png`; `/guides/theming/` → `og/guides/theming.png`. */
export function ogImageFile(pagePath: string): string {
  const path = normalizePagePath(pagePath);
  const slug = path === '/' ? 'index' : path.slice(1, -1);
  return `${OG_DIRECTORY}/${slug}.png`;
}

/** Absolute URL for a site-relative path, honoring the base path. */
export function absoluteUrl(site: string | URL, base: string, path: string): string {
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(`${cleanBase}${path.replace(/^\//, '')}`, site).href;
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** C0 control characters XML 1.0 forbids (tab, line feed and carriage return stay). */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target
const XML_FORBIDDEN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

/** Escapes text for XML and SVG (and strips characters XML forbids). */
export function escapeXml(text: string): string {
  return text.replace(XML_FORBIDDEN, '').replace(/[&<>"']/g, (char) => XML_ESCAPES[char] ?? char);
}

export interface SitemapEntry {
  loc: string;
  /** W3C date (`YYYY-MM-DD`) of the page's last source change. */
  lastmod?: string;
}

const W3C_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A `sitemap.xml` for absolute page URLs — optionally with per-page lastmod
 * dates (an entry without one, or a bare string, omits the element) — sorted,
 * without duplicates. An invalid date fails the build: a sitemap that lies to
 * crawlers is worse than one that says less.
 */
export function buildSitemap(entries: readonly (string | SitemapEntry)[]): string {
  const unique = new Map<string, string | undefined>();
  for (const item of entries) {
    const entry: SitemapEntry = typeof item === 'string' ? { loc: item } : item;
    if (entry.lastmod !== undefined && !W3C_DATE.test(entry.lastmod))
      throw new Error(`invalid lastmod "${entry.lastmod}" for ${entry.loc}`);
    if (!unique.has(entry.loc)) unique.set(entry.loc, entry.lastmod);
  }
  const urls = [...unique.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(
      ([loc, lastmod]) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </url>`
    );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/**
 * AI/LLM crawlers explicitly allowed in robots.txt: the docs, the markdown
 * twins and the agent catalog exist to be read by agents. The list follows
 * the deepworkplan.com policy (the reference set from the SEO audit).
 */
export const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Bytespider',
  'CCBot',
  'PerplexityBot',
  'Applebot-Extended',
  'Amazonbot',
  'Meta-ExternalAgent',
  'cohere-ai',
  'OAI-SearchBot',
  'DeepSeekBot',
  'Claude-SearchBot',
  'Perplexity-User',
] as const;

/**
 * `robots.txt`: default allow, the sitemap, and explicit AI-crawler allows.
 * No `Content-Signal` yet: that is a per-user-agent response header, which a
 * static file cannot serve — it waits for the request-time rewrite.
 */
export function buildRobots(sitemapUrl: string): string {
  const lines = [
    '# robots.txt for Texuli',
    '# https://texuli.com',
    '',
    '# Default: every crawler may crawl everything public.',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
    '# AI/LLM crawlers: explicitly welcome. Content-Signal needs per-agent',
    '# responses (request-time middleware, planned); a static file cannot',
    '# vary by user agent.',
  ];
  for (const crawler of AI_CRAWLERS) lines.push('', `User-agent: ${crawler}`, 'Allow: /');
  return `${lines.join('\n')}\n`;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X'))
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export interface PageMeta {
  title: string;
  description: string;
  /** `<meta name="robots" content="noindex">` is present. */
  noindex: boolean;
}

/** Reads the title, description and robots directive of a built HTML page. */
export function readPageMeta(html: string): PageMeta {
  const head = html.slice(
    0,
    html.search(/<\/head>/i) === -1 ? html.length : html.search(/<\/head>/i)
  );
  const title = /<title>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? '';
  const description = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(head)?.[1] ?? '';
  const robots = /<meta\s+name="robots"\s+content="([^"]*)"/i.exec(head)?.[1] ?? '';
  return {
    title: decodeEntities(title).trim(),
    description: decodeEntities(description).trim(),
    noindex: /noindex/i.test(robots),
  };
}

/** Greedy word wrap to at most `maxLines` lines of `width` characters, with an ellipsis. */
export function wrapText(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word.length > width ? `${word.slice(0, width - 1)}\u2026` : word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[maxLines - 1] ?? '';
    lines[maxLines - 1] =
      last.length >= width ? `${last.slice(0, width - 1)}\u2026` : `${last}\u2026`;
  }
  return lines;
}

export interface OgImageInput {
  title: string;
  description: string;
  /** Shown in the footer, e.g. `texuli.com/guides/theming`. */
  url: string;
  siteName: string;
  /** Area badge and accent (T-21); omitted = brand-only card. */
  area?: OgArea;
}

/** One site area's share-art identity: a badge label and its accent. */
export interface OgArea {
  /** Badge text, uppercased in the art; empty = no badge. */
  label: string;
  accent: string;
}

/**
 * The area a route belongs to (T-21) — the share art says where a link
 * lands. Labels are section names, not claims: no metrics, no invented
 * numbers. Areas that do not exist yet (native, architecture) are mapped
 * ahead of the sub-site scaffold.
 */
const OG_AREAS: readonly (readonly [prefix: string, area: OgArea])[] = [
  ['/native/', { label: 'Native', accent: '#fb923c' }],
  ['/web-and-native/', { label: 'Architecture', accent: '#22d3ee' }],
  ['/architecture/', { label: 'Architecture', accent: '#22d3ee' }],
  ['/primitives-page/', { label: 'Primitives', accent: '#a78bfa' }],
  ['/guides/', { label: 'Guides', accent: '#34d399' }],
  ['/skill/', { label: 'Guides', accent: '#34d399' }],
  ['/whats-new/', { label: 'Guides', accent: '#34d399' }],
  ['/foundation/', { label: 'Guides', accent: '#34d399' }],
  ['/component-pages/', { label: 'Components', accent: '#60a5fa' }],
  ['/blocks-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/charts-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/media-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/gallery-components/', { label: 'Components', accent: '#60a5fa' }],
  ['/examples/', { label: 'Components', accent: '#60a5fa' }],
  ['/slides-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/editor-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/motion-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/documents-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/forms-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/canvas-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/sheets-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/dashboards-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/output-page/', { label: 'Components', accent: '#60a5fa' }],
  ['/gallery-themes/', { label: 'Themes', accent: '#fbbf24' }],
  ['/theme-switcher/', { label: 'Themes', accent: '#fbbf24' }],
  ['/theme-studio/', { label: 'Themes', accent: '#fbbf24' }],
  ['/color-explorer/', { label: 'Themes', accent: '#fbbf24' }],
  ['/agents-page/', { label: 'Agents', accent: '#f472b6' }],
  ['/playground/', { label: 'Agents', accent: '#f472b6' }],
  ['/live-generation/', { label: 'Agents', accent: '#f472b6' }],
  ['/builder/', { label: 'Agents', accent: '#f472b6' }],
  ['/agent-chat/', { label: 'Agents', accent: '#f472b6' }],
  ['/brand/', { label: 'Project', accent: '#94a3b8' }],
  ['/showcase/', { label: 'Project', accent: '#94a3b8' }],
  ['/evidence/', { label: 'Project', accent: '#94a3b8' }],
  ['/perf/', { label: 'Project', accent: '#94a3b8' }],
  ['/changelog/', { label: 'Project', accent: '#94a3b8' }],
];

export function ogAreaFor(path: string): OgArea {
  const page = normalizePagePath(path);
  for (const [prefix, area] of OG_AREAS) if (page.startsWith(prefix)) return area;
  return { label: '', accent: '#60a5fa' };
}

/**
 * The social image as SVG (1200 × 630). Every text is XML-escaped; the
 * colors pass WCAG AA on their backgrounds (white and slate on near-black).
 * An area adds a top-right badge in the area accent and tints the footer
 * rule with it.
 */
export function ogImageSvg({ title, description, url, siteName, area }: OgImageInput): string {
  const titleLines = wrapText(title, 28, 3);
  const descriptionLines = wrapText(description, 58, 3);
  const titleStart = 250;
  const titleLineHeight = 76;
  const descriptionStart = titleStart + titleLines.length * titleLineHeight + 24;
  const tspans = (lines: string[], x: number, y: number, step: number) =>
    lines
      .map((line, i) => `<tspan x="${x}" y="${y + i * step}">${escapeXml(line)}</tspan>`)
      .join('');
  const accent = area?.accent ?? '#60a5fa';
  // Badge: uppercased label in an accent pill, right-aligned with the margin.
  const badgeLabel = area?.label.toUpperCase() ?? '';
  const badgeWidth = badgeLabel.length * 18 + 48;
  const badgeX = OG_IMAGE_WIDTH - 80 - badgeWidth;
  const badge = badgeLabel
    ? `<rect x="${badgeX}" y="96" width="${badgeWidth}" height="56" rx="14" fill="${accent}"/>
  <text x="${badgeX + badgeWidth / 2}" y="133" text-anchor="middle" font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="2" fill="#0b1220">${escapeXml(badgeLabel)}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#16233f"/>
    </linearGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)"/>
  <rect x="80" y="96" width="56" height="56" rx="14" fill="${accent}"/>
  <rect x="96" y="112" width="24" height="24" rx="6" fill="#0b1220"/>
  <text x="156" y="138" font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="38" font-weight="700" fill="#ffffff">${escapeXml(siteName)}</text>
  ${badge}
  <text font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${tspans(titleLines, 80, titleStart, titleLineHeight)}</text>
  <text font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="30" fill="#cbd5e1">${tspans(descriptionLines, 80, descriptionStart, 42)}</text>
  <rect x="80" y="548" width="1040" height="2" fill="${accent}"/>
  <text x="80" y="590" font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="26" fill="#93c5fd">${escapeXml(url)}</text>
</svg>`;
}
