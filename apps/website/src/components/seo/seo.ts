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

/** A `sitemap.xml` for absolute page URLs, sorted, without duplicates. */
export function buildSitemap(urls: readonly string[], lastmod?: string): string {
  const unique = [...new Set(urls)].sort();
  const entries = unique.map(
    (url) =>
      `  <url>\n    <loc>${escapeXml(url)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </url>`
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

/** `robots.txt`: allow everything, point at the sitemap. */
export function buildRobots(sitemapUrl: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
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
}

/**
 * The social image as SVG (1200 × 630). Every text is XML-escaped; the
 * colors pass WCAG AA on their backgrounds (white and slate on near-black).
 */
export function ogImageSvg({ title, description, url, siteName }: OgImageInput): string {
  const titleLines = wrapText(title, 28, 3);
  const descriptionLines = wrapText(description, 58, 3);
  const titleStart = 250;
  const titleLineHeight = 76;
  const descriptionStart = titleStart + titleLines.length * titleLineHeight + 24;
  const tspans = (lines: string[], x: number, y: number, step: number) =>
    lines
      .map((line, i) => `<tspan x="${x}" y="${y + i * step}">${escapeXml(line)}</tspan>`)
      .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#16233f"/>
    </linearGradient>
  </defs>
  <rect width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" fill="url(#bg)"/>
  <rect x="80" y="96" width="56" height="56" rx="14" fill="#60a5fa"/>
  <rect x="96" y="112" width="24" height="24" rx="6" fill="#0b1220"/>
  <text x="156" y="138" font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="38" font-weight="700" fill="#ffffff">${escapeXml(siteName)}</text>
  <text font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${tspans(titleLines, 80, titleStart, titleLineHeight)}</text>
  <text font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="30" fill="#cbd5e1">${tspans(descriptionLines, 80, descriptionStart, 42)}</text>
  <rect x="80" y="548" width="1040" height="2" fill="#334155"/>
  <text x="80" y="590" font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="26" fill="#93c5fd">${escapeXml(url)}</text>
</svg>`;
}
