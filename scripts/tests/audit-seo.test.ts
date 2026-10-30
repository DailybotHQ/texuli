// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditSite,
  canonicalOf,
  collectDist,
  decodeEntities,
  isNoindex,
  jsonLdBlocks,
  metaContent,
  normalizePagePath,
  ogImageFile,
  pngSize,
  renderMarkdown,
} from '../audit-seo.mjs';

/** A 24-byte PNG header: signature + IHDR declaring `width`×`height`. */
function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  buffer.writeUInt32BE(13, 8);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

const LANDING_JSONLD = `{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Texuli"}]}`;
const BREADCRUMB_JSONLD = `{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[]}`;

/** A fully green page for `path` per the shipped head shape. */
function greenPage(
  path: string,
  title = `Texuli — page ${path}`
): { path: string; html: string; noindex: boolean } {
  const url = `https://texuli.com${path}`;
  const image = `https://texuli.com/${ogImageFile(path)}`;
  const jsonld = path === '/' ? LANDING_JSONLD : BREADCRUMB_JSONLD;
  const html = `<!doctype html><html lang="en"><head>
<title>${title}</title>
<meta name="description" content="A unique honest description for ${path} long enough for the band.">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Texuli">
<meta property="og:title" content="${title}">
<meta property="og:description" content="A unique honest description for ${path} long enough for the band.">
<meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630"><meta property="og:image:alt" content="Texuli">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="A unique honest description for ${path} long enough for the band.">
<meta name="twitter:image" content="${image}">
<script type="application/ld+json">${jsonld}</script>
</head><body></body></html>`;
  return { path, html, noindex: false };
}

/** A green site: landing + a guide + a component page, all assets present. */
function greenSite() {
  const pages = [
    greenPage('/'),
    greenPage('/guides/theming/'),
    greenPage('/component-pages/button/'),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map(
      (page) =>
        `  <url>\n    <loc>https://texuli.com${page.path}</loc>\n    <lastmod>2026-10-25</lastmod>\n  </url>`
    )
    .join('\n')}\n</urlset>\n`;
  const robots = [
    '# robots.txt for Texuli',
    'User-agent: *',
    'Allow: /',
    '',
    'Sitemap: https://texuli.com/sitemap.xml',
    ...Array.from({ length: 16 }, (_, i) => `User-agent: Crawler${i}\nAllow: /`),
    '',
  ].join('\n');
  const readAsset = (file: string) =>
    file === ogImageFile('/') ? pngHeader(1200, 630) : pngHeader(1200, 630);
  return { pages, sitemap, robots, readAsset };
}

const criticals = (result: { findings: { severity: string; category: string }[] }) =>
  result.findings.filter((finding) => finding.severity === 'critical');

describe('auditSite on a green fixture dist', () => {
  it('finds zero criticals and records the planned T-09 targets; renders a green verdict and the planned section', () => {
    // finds zero criticals and records the planned T-09 targets
    {
      const result = auditSite(greenSite());
      expect(criticals(result).map((finding) => `${finding.category}: ${finding.detail}`)).toEqual(
        []
      );
      expect(result.summary.findings.critical).toBe(0);
      expect(result.summary.findings.planned).toBe(4);
      expect(result.summary.byCategory.Twitter?.planned).toBe(1);
      expect(result.summary.pages).toEqual({ total: 3, indexed: 3, noindex: 0 });
    }
    // renders a green verdict and the planned section
    {
      const report = renderMarkdown(auditSite(greenSite()));
      expect(report).toContain('GREEN — every shipped category holds');
      expect(report).toContain('twitter:site');
      expect(report).toContain('## Findings');
    }
  });
});

describe('auditSite page checks', () => {
  it('flags a missing canonical and a canonical that does not self-reference; compares the decoded text: an escaped apostrophe in <title> matches the raw og:title; flags missing description, missing og:image and a cross-bound og:title; flags unparseable JSON-LD and the shipped graph scopes; flags a missing or wrong-size OG art and keeps title length a warning; skips noindex pages as indexed but keeps them out of the sitemap; warns on duplicate descriptions instead of failing the run', () => {
    // flags a missing canonical and a canonical that does not self-reference
    {
      const site = greenSite();
      site.pages[1]!.html = site.pages[1]!.html.replace(/<link rel="canonical" href="[^"]*">/, '');
      expect(
        criticals(auditSite(site)).some(
          (finding) => finding.category === 'Canonical' && finding.detail.includes('missing')
        )
      ).toBe(true);
      const site2 = greenSite();
      site2.pages[1]!.html = site2.pages[1]!.html.replace(
        'https://texuli.com/guides/theming/',
        'https://texuli.com/guides/other/'
      );
      expect(
        criticals(auditSite(site2)).some(
          (finding) =>
            finding.category === 'Canonical' && finding.detail.includes('does not self-reference')
        )
      ).toBe(true);
    }
    // compares the decoded text: an escaped apostrophe in <title> matches the raw og:title
    {
      // Astro escapes `'` as `&#39;` in element text but not in attribute
      // values; both mean the same string (T-98: /web-and-native/ false red).
      const site = greenSite();
      site.pages[1]!.html = site.pages[1]!.html.replace(
        /<title>[^<]*<\/title>/,
        '<title>Texuli&#39;s architecture &amp; seam · Texuli</title>'
      ).replace(
        /<meta property="og:title" content="[^"]*">/,
        `<meta property="og:title" content="Texuli's architecture &amp; seam · Texuli">`
      );
      const opengraph = criticals(auditSite(site)).filter(
        (finding) => finding.category === 'Open Graph'
      );
      expect(opengraph).toEqual([]);
    }
    // flags missing description, missing og:image and a cross-bound og:title
    {
      const site = greenSite();
      site.pages[1]!.html = site.pages[1]!.html.replace(/<meta name="description"[^>]*>/, '');
      const site2 = greenSite();
      site2.pages[1]!.html = site2.pages[1]!.html.replace(
        /<meta property="og:image" content="[^"]*">/,
        ''
      );
      const site3 = greenSite();
      site3.pages[1]!.html = site3.pages[1]!.html.replace(
        /<meta property="og:title" content="[^"]*">/,
        '<meta property="og:title" content="Other">'
      );
      const results = [auditSite(site), auditSite(site2), auditSite(site3)].map(criticals);
      expect(
        results[0]!.some(
          (finding) =>
            finding.category === 'Meta' && finding.detail.includes('missing meta description')
        )
      ).toBe(true);
      expect(
        results[1]!.some(
          (finding) =>
            finding.category === 'Open Graph' && finding.detail.includes('missing og:image')
        )
      ).toBe(true);
      expect(
        results[2]!.some(
          (finding) =>
            finding.category === 'Open Graph' && finding.detail.includes('differs from <title>')
        )
      ).toBe(true);
    }
    // flags unparseable JSON-LD and the shipped graph scopes
    {
      const broken = greenSite();
      broken.pages[1]!.html = broken.pages[1]!.html.replace(BREADCRUMB_JSONLD, '{"@context":');
      const categories = criticals(auditSite(broken)).filter(
        (finding) => finding.category === 'JSON-LD'
      );
      expect(categories.some((finding) => finding.detail.includes('does not parse'))).toBe(true);
      expect(categories.some((finding) => finding.detail.includes('BreadcrumbList'))).toBe(true);

      const noGraph = greenSite();
      noGraph.pages[0]!.html = noGraph.pages[0]!.html.replace(LANDING_JSONLD, BREADCRUMB_JSONLD);
      expect(
        criticals(auditSite(noGraph)).some((finding) => finding.detail.includes('WebSite graph'))
      ).toBe(true);
    }
    // flags a missing or wrong-size OG art and keeps title length a warning
    {
      const missing = greenSite();
      missing.readAsset = () => null;
      expect(
        criticals(auditSite(missing)).some(
          (finding) => finding.category === 'OG art' && finding.detail.includes('missing')
        )
      ).toBe(true);
      const wrong = greenSite();
      wrong.readAsset = () => pngHeader(600, 315);
      expect(
        criticals(auditSite(wrong)).some((finding) => finding.detail.includes('600×315'))
      ).toBe(true);

      const long = greenSite();
      long.pages[1] = greenPage('/guides/theming/', `Texuli — ${'x'.repeat(90)}`);
      const result = auditSite(long);
      expect(criticals(result).length).toBe(0);
      expect(result.summary.findings.warning).toBeGreaterThanOrEqual(1);
    }
    // skips noindex pages as indexed but keeps them out of the sitemap
    {
      const site = greenSite();
      const preview = greenPage('/examples/preview/harbor/');
      preview.noindex = true;
      site.pages.push(preview);
      const result = auditSite(site);
      expect(result.summary.pages).toEqual({ total: 4, indexed: 3, noindex: 1 });
      expect(criticals(result).length).toBe(0);
    }
    // warns on duplicate descriptions instead of failing the run
    {
      const site = greenSite();
      const twin = greenPage('/guides/rtl/', 'Texuli — twin');
      twin.html = twin.html.replace(
        /A unique honest description for [^"]+/,
        'Shared description text for twins'
      );
      const original = greenPage('/guides/other/', 'Texuli — other');
      original.html = original.html.replace(
        /A unique honest description for [^"]+/,
        'Shared description text for twins'
      );
      site.pages.push(twin, original);
      const warnings = auditSite(site).findings.filter((finding) => finding.severity === 'warning');
      expect(warnings.some((finding) => finding.detail.includes('duplicate description'))).toBe(
        true
      );
    }
  });
});

describe('auditSite sitemap checks', () => {
  it('flags a missing page, an extra loc, duplicates and bad lastmod', () => {
    const missing = greenSite();
    missing.sitemap = missing.sitemap!.replace(
      /<url>\s*<loc>https:\/\/texuli\.com\/guides\/theming\/<\/loc>[\s\S]*?<\/url>/,
      ''
    );
    const missingResult = criticals(auditSite(missing));
    expect(
      missingResult.some(
        (finding) =>
          finding.category === 'Sitemap' && finding.detail.includes('missing from the sitemap')
      )
    ).toBe(true);

    const extra = greenSite();
    extra.sitemap = extra.sitemap!.replace(
      '</urlset>',
      '  <url>\n    <loc>https://texuli.com/ghost/</loc>\n    <lastmod>2026-10-25</lastmod>\n  </url>\n</urlset>'
    );
    expect(
      criticals(auditSite(extra)).some((finding) =>
        finding.detail.includes('not a built indexed page')
      )
    ).toBe(true);

    const future = greenSite();
    future.sitemap = future.sitemap!.replaceAll('2026-10-25', '2027-01-01');
    expect(
      criticals(auditSite(future)).some((finding) => finding.detail.includes('in the future'))
    ).toBe(true);

    const noDate = greenSite();
    noDate.sitemap = noDate.sitemap!.replaceAll('    <lastmod>2026-10-25</lastmod>\n', '');
    expect(
      criticals(auditSite(noDate)).some((finding) => finding.detail.includes('without lastmod'))
    ).toBe(true);

    const listed = greenSite();
    listed.pages.push({ ...greenPage('/examples/preview/x/'), noindex: true });
    listed.sitemap = listed.sitemap!.replace(
      '</urlset>',
      '  <url>\n    <loc>https://texuli.com/examples/preview/x/</loc>\n    <lastmod>2026-10-25</lastmod>\n  </url>\n</urlset>'
    );
    expect(
      criticals(auditSite(listed)).some((finding) => finding.detail.includes('404 or noindex'))
    ).toBe(true);
  });
});

describe('auditSite robots checks', () => {
  it('flags a missing sitemap line, a Disallow and a Content-Signal outside a group', () => {
    const base = greenSite();
    for (const [needle, detail] of [
      ['Sitemap: https://texuli.com/sitemap.xml', 'no Sitemap line'],
      ['Allow: /', 'unconditional allow'],
    ] as const) {
      const robots = base.robots!.replace(needle, 'X');
      const findings = criticals(auditSite({ ...base, robots })).filter(
        (finding) => finding.category === 'Robots'
      );
      expect(
        findings.some((finding) => finding.detail.includes(detail)),
        `${detail} in ${robots}`
      ).toBe(true);
    }
    const signalling = greenSite();
    signalling.robots = `${base.robots}\nContent-Signal: ai-train=yes\n`;
    expect(
      criticals(auditSite(signalling)).some((finding) => finding.detail.includes('Content-Signal'))
    ).toBe(true);
    // Inside a group it is the shipped policy (PLAN_011 T-ar-discovery).
    const grouped = greenSite();
    grouped.robots = `${base.robots}\nUser-agent: GPTBot\nAllow: /\nContent-Signal: ai-train=yes, search=yes, ai-input=yes\n`;
    expect(
      criticals(auditSite(grouped)).some((finding) => finding.detail.includes('Content-Signal'))
    ).toBe(false);
    const forbidding = greenSite();
    forbidding.robots = `${base.robots}User-agent: *\nDisallow: /private/\n`;
    expect(
      criticals(auditSite(forbidding)).some((finding) => finding.detail.includes('Disallow exists'))
    ).toBe(true);
  });
});

describe('pure extractors', () => {
  it('leaves character references beyond U+10FFFF undecoded instead of throwing (T-100 P2-4); matches the shipped path and image conventions; extracts meta, canonical, blocks and PNG dimensions', () => {
    // leaves character references beyond U+10FFFF undecoded instead of throwing (T-100 P2-4)
    {
      expect(() => decodeEntities('A &#x110000; B')).not.toThrow();
      expect(decodeEntities('A &#x110000; B &#1114112; C')).toBe('A &#x110000; B &#1114112; C');
      expect(decodeEntities('&#x10FFFF;')).toBe(String.fromCodePoint(0x10ffff));
      expect(decodeEntities('&#39;&#x27;&amp;')).toBe("''&");
      // One hostile reference in a title or meta must not abort the whole audit.
      const site = greenSite();
      site.pages[1]!.html = site.pages[1]!.html.replace('<title>', '<title>&#x110000; ').replace(
        'content="A unique',
        'content="&#x110000; A unique'
      );
      expect(() => auditSite(site)).not.toThrow();
    }
    expect(normalizePagePath('guides/theming')).toBe('/guides/theming/');
    expect(normalizePagePath('/index.html')).toBe('/');
    expect(ogImageFile('/')).toBe('og/index.png');
    expect(ogImageFile('/guides/theming/')).toBe('og/guides/theming.png');
    // extracts meta, canonical, blocks and PNG dimensions
    {
      const page = greenPage('/');
      expect(metaContent(page.html, 'description')).toContain('unique honest description');
      expect(canonicalOf(page.html)).toBe('https://texuli.com/');
      expect(jsonLdBlocks(page.html)).toHaveLength(1);
      expect(isNoindex(page.html)).toBe(false);
      expect(pngSize(pngHeader(1200, 630))).toEqual({ width: 1200, height: 630 });
      expect(pngSize(Buffer.from('not a png'))).toBeNull();
      expect(pngSize(null)).toBeNull();
    }
  });
});

describe('collectDist over a fixture directory', () => {
  const dist = mkdtempSync(join(tmpdir(), 'texuli-audit-seo-'));

  afterAll(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it('walks pages, reads sitemap/robots and loads assets', () => {
    mkdirSync(join(dist, 'guides', 'theming'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), greenPage('/').html);
    writeFileSync(
      join(dist, 'guides', 'theming', 'index.html'),
      greenPage('/guides/theming/').html
    );
    writeFileSync(join(dist, 'sitemap.xml'), greenSite().sitemap!);
    writeFileSync(join(dist, 'robots.txt'), greenSite().robots!);

    const collected = collectDist(dist);
    expect(collected.pages.map((page) => page.path).sort()).toEqual(['/', '/guides/theming/']);
    expect(collected.sitemap).toContain('<urlset');
    expect(collected.robots).toContain('User-agent: *');
    expect(collected.readAsset('og/index.png')).toBeNull();

    mkdirSync(join(dist, 'og'), { recursive: true });
    writeFileSync(join(dist, 'og', 'index.png'), pngHeader(1200, 630));
    expect(pngSize(collected.readAsset('og/index.png'))).toEqual({ width: 1200, height: 630 });
    expect(collected.readAsset('og/nope.png')).toBeNull();
  });
});
