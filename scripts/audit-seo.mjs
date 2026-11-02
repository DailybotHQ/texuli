/**
 * Offline SEO audit for texuli.com (T-29). Crawls the built `dist/` —
 * every `index.html`, no network anywhere — and checks every on-page
 * category from the T-09 target tables
 * (.dwp/…/analysis_results/seo-audit/onsite.md): title/description,
 * canonical, Open Graph, Twitter, JSON-LD, the 1200×630 social images,
 * sitemap membership and the robots policy. Emits `tmp/seo-audit.json`
 * plus a readable markdown report; exits non-zero on any critical
 * finding so CI and preflight runs fail loudly. This tool only reports —
 * it never edits a page.
 *
 * Usage:
 *   node scripts/audit-seo.mjs [--dist apps/website/dist] [--out tmp/seo-audit.md] [--json tmp/seo-audit.json]
 *
 * Severity model (mirrors the T-09 tables):
 *   critical — a shipped requirement is broken or missing (missing
 *              description/canonical/OG tag, a canonical that does not
 *              self-reference, unparseable JSON-LD, a sitemap member with
 *              no page, a future lastmod, a robots policy that forbids).
 *   warning  — present but imperfect (title/description outside the sane
 *              length band, a duplicate description across pages, a thin
 *              robots policy).
 *   planned  — a T-09 target row that stays open on purpose (twitter:site
 *              handle awaits the developer; further JSON-LD graphs grow
 *              with their implementing tasks). Never fails the run.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The one config block: the T-09 target tables (seo-audit/onsite.md). */
export const AUDIT_CONFIG = {
  /** The production origin every canonical/OG URL must carry. */
  site: 'https://texuli.com',
  og: { width: 1200, height: 630, type: 'image/png' },
  /** Present-and-sane bands; anything outside is a warning, not a red. */
  title: { min: 12, max: 65 },
  description: { min: 50, max: 165 },
  /** Docs-area page families that ship BreadcrumbList (T-19 scope). */
  docsFamilies: ['guides/', 'component-pages/', 'primitives-page/'],
  /**
   * T-09 target rows that stay open on purpose. Each cites its onsite.md
   * row; a planned item is reported once, never per page, and never fails
   * the run.
   */
  planned: [
    {
      category: 'Twitter',
      detail:
        'twitter:site (+creator) awaits the developer handle — onsite.md §1; the open owner question is recorded in T-21',
    },
    {
      category: 'JSON-LD',
      detail:
        'FAQPage only where a page shows real questions and answers; none does today — structured.md rows',
    },
    {
      category: 'OG art',
      detail: 'build-time PNG optimization pass (the reference prebuild chain) — onsite.md §3',
    },
  ],
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const W3C_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Normalizes a page pathname to `/a/b/` (or `/`) — same semantics as seo.ts. */
export function normalizePagePath(pathname, base = '/') {
  let path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  if (cleanBase !== '/' && path.startsWith(cleanBase)) path = `/${path.slice(cleanBase.length)}`;
  path = path.replace(/index\.html$/, '').replace(/\.html$/, '/');
  if (!path.endsWith('/')) path += '/';
  return path.replace(/\/{2,}/g, '/');
}

/** `/` → `og/index.png`; `/guides/theming/` → `og/guides/theming.png`. */
export function ogImageFile(pagePath) {
  const path = normalizePagePath(pagePath);
  const slug = path === '/' ? 'index' : path.slice(1, -1);
  return `og/${slug}.png`;
}

function escapeRe(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Decode the HTML character references a build emits, so values compare as
 * the text a reader gets: Astro writes `'` as `&#39;` in element text but
 * raw in attribute values, and both mean the same title.
 */
export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, ref) => {
    if (ref[0] === '#') {
      const code =
        ref[1] === 'x' || ref[1] === 'X' ? Number.parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      // Beyond U+10FFFF is no code point (fromCodePoint would throw): keep
      // the reference as written so one hostile page cannot abort the audit.
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

/** The decoded `content` of the first meta tag carrying `name|property = key`. */
export function metaContent(html, key) {
  const tag = new RegExp(`<meta[^>]*(?:name|property)="${escapeRe(key)}"[^>]*>`, 'i').exec(
    html
  )?.[0];
  if (tag === undefined) return null;
  const raw = /content="([^"]*)"/i.exec(tag)?.[1];
  return raw === undefined ? null : decodeEntities(raw);
}

/** The `href` of the canonical link, or null. */
export function canonicalOf(html) {
  return /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html)?.[1] ?? null;
}

/** Every `application/ld+json` block body, in document order. */
export function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]
  );
}

/** Whether the page carries a `<meta name="robots" content="…noindex…">`. */
export function isNoindex(html) {
  return /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
}

export function isRedirectPage(html) {
  return html.length < 2000 && html.includes('http-equiv="refresh"');
}

/** `{ width, height }` for a PNG buffer, else null (no network, bytes only). */
export function pngSize(buffer) {
  if (!buffer || buffer.length < 24 || PNG_SIGNATURE.some((byte, i) => buffer[i] !== byte))
    return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const finding = (severity, category, page, detail) => ({ severity, category, page, detail });

/**
 * Audits one indexed page against the config. Pure: string and buffer
 * inputs in, findings out.
 */
export function auditPage(page, config) {
  const { path, html } = page;
  const findings = [];
  const add = (severity, category, detail) =>
    findings.push(finding(severity, category, path, detail));

  // Meta (title/description).
  const head = html.slice(
    0,
    html.search(/<\/head>/i) === -1 ? html.length : html.search(/<\/head>/i)
  );
  const title = decodeEntities(/<title>([\s\S]*?)<\/title>/i.exec(head)?.[1]?.trim() ?? '');
  const description = metaContent(head, 'description') ?? '';
  if (title === '') add('critical', 'Meta', 'missing <title>');
  else if (title.length < config.title.min || title.length > config.title.max)
    add(
      'warning',
      'Meta',
      `title length ${title.length} outside ${config.title.min}–${config.title.max}`
    );
  if (description === '') add('critical', 'Meta', 'missing meta description');
  else if (
    description.length < config.description.min ||
    description.length > config.description.max
  )
    add(
      'warning',
      'Meta',
      `description length ${description.length} outside ${config.description.min}–${config.description.max}`
    );

  // Canonical self-reference.
  const canonical = canonicalOf(html);
  const expected = `${config.site}${path}`;
  if (canonical === null) add('critical', 'Canonical', 'missing <link rel="canonical">');
  else if (canonical !== expected)
    add('critical', 'Canonical', `canonical "${canonical}" does not self-reference "${expected}"`);

  // Open Graph: the full measured set, cross-bound to title/description/canonical.
  const og = {};
  for (const key of [
    'og:title',
    'og:description',
    'og:url',
    'og:image',
    'og:image:secure_url',
    'og:type',
    'og:site_name',
    'og:image:alt',
    'og:image:width',
    'og:image:height',
    'og:image:type',
  ])
    og[key] = metaContent(html, key);
  const imageFile = ogImageFile(path);
  const expectedImage = `${config.site}/${imageFile}`;
  for (const [key, value] of Object.entries(og))
    if (value === null) add('critical', 'Open Graph', `missing ${key}`);
  if (og['og:title'] !== null && og['og:title'] !== title)
    add('critical', 'Open Graph', 'og:title differs from <title>');
  if (og['og:description'] !== null && og['og:description'] !== description)
    add('critical', 'Open Graph', 'og:description differs from the meta description');
  if (og['og:url'] !== null && og['og:url'] !== canonical)
    add('critical', 'Open Graph', `og:url "${og['og:url']}" differs from the canonical`);
  if (og['og:image'] !== null && og['og:image'] !== expectedImage)
    add('critical', 'Open Graph', `og:image "${og['og:image']}" is not the built ${expectedImage}`);
  if (og['og:image:secure_url'] !== null && og['og:image:secure_url'] !== og['og:image'])
    add('critical', 'Open Graph', 'og:image:secure_url differs from og:image');
  if (og['og:image:width'] !== null && og['og:image:width'] !== String(config.og.width))
    add(
      'critical',
      'Open Graph',
      `og:image:width "${og['og:image:width']}" is not ${config.og.width}`
    );
  if (og['og:image:height'] !== null && og['og:image:height'] !== String(config.og.height))
    add(
      'critical',
      'Open Graph',
      `og:image:height "${og['og:image:height']}" is not ${config.og.height}`
    );
  if (og['og:image:type'] !== null && og['og:image:type'] !== config.og.type)
    add(
      'critical',
      'Open Graph',
      `og:image:type "${og['og:image:type']}" is not ${config.og.type}`
    );

  // Twitter (card set; twitter:site stays a planned row).
  for (const key of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'])
    if (metaContent(html, key) === null) add('critical', 'Twitter', `missing ${key}`);
  const card = metaContent(html, 'twitter:card');
  if (card !== null && card !== 'summary_large_image')
    add('critical', 'Twitter', `twitter:card "${card}" is not summary_large_image`);

  // JSON-LD: every block parses; the shipped scopes hold (T-18/T-19).
  const blocks = jsonLdBlocks(html);
  blocks.forEach((block, i) => {
    try {
      JSON.parse(block);
    } catch (error) {
      add('critical', 'JSON-LD', `block #${i + 1} does not parse: ${error.message}`);
    }
  });
  const types = blocks.flatMap((block) => {
    try {
      const parsed = JSON.parse(block);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [];
      return [...nodes, ...graph].map((node) => node?.['@type']).filter(Boolean);
    } catch {
      return [];
    }
  });
  // PLAN_014: every indexable page carries the site graph (owner, website, page).
  for (const type of ['Organization', 'WebSite', 'WebPage'])
    if (!types.includes(type))
      add('critical', 'JSON-LD', `the page lacks the site graph's ${type}`);
  for (const type of ['Organization', 'WebSite'])
    if (types.filter((entry) => entry === type).length > 1)
      add('warning', 'JSON-LD', `more than one ${type} node`);
  if (
    config.docsFamilies.some((family) => path.startsWith(`/${family}`)) &&
    !types.includes('BreadcrumbList')
  )
    add('critical', 'JSON-LD', 'a docs-family page lacks BreadcrumbList (T-19 scope)');

  // Outline and images (PLAN_014): one h1, no skipped heading level, alt on
  // every image. Script, style and template bodies are not page content, and
  // the slide titles of an embedded deck (`tx-deck-layout__…`) are the deck's
  // own outline, not the page's.
  const body = html
    .slice(html.search(/<body[\s>]/i) === -1 ? 0 : html.search(/<body[\s>]/i))
    .replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, '');
  const headings = [...body.matchAll(/<h([1-6])\b([^>]*)>/gi)]
    .filter((match) => !/class="[^"]*tx-deck-layout__/.test(match[2]))
    .map((match) => Number(match[1]));
  const h1 = headings.filter((level) => level === 1).length;
  if (h1 !== 1)
    add(h1 === 0 ? 'critical' : 'warning', 'Outline', `${h1} h1 elements (want exactly 1)`);
  for (let i = 1; i < headings.length; i++)
    if (headings[i] > headings[i - 1] + 1) {
      add('warning', 'Outline', `heading level skips from h${headings[i - 1]} to h${headings[i]}`);
      break;
    }
  const bare = [...body.matchAll(/<img\b[^>]*>/gi)].filter((match) => !/\salt=/i.test(match[0]));
  if (bare.length > 0) add('critical', 'Images', `${bare.length} <img> without an alt attribute`);

  return findings;
}

/**
 * The whole audit. `readAsset(relativePath)` returns a Buffer from the
 * dist root (or null) so the OG-art check stays offline and injectable.
 */
export function auditSite({ pages, sitemap, robots, readAsset }, config = AUDIT_CONFIG) {
  const findings = [];
  const indexed = pages.filter((page) => !page.noindex);
  const noindexed = pages.filter((page) => page.noindex);

  const descriptions = new Map();
  const titles = new Map();
  for (const page of indexed) {
    findings.push(...auditPage(page, config));
    if (readAsset !== undefined) {
      const file = ogImageFile(page.path);
      const size = pngSize(readAsset(file));
      if (size === null)
        findings.push(finding('critical', 'OG art', page.path, `${file} is missing or not a PNG`));
      else if (size.width !== config.og.width || size.height !== config.og.height)
        findings.push(
          finding(
            'critical',
            'OG art',
            page.path,
            `${file} is ${size.width}×${size.height}, not ${config.og.width}×${config.og.height}`
          )
        );
    }
    const description = metaContent(page.html, 'description') ?? '';
    if (description !== '') {
      if (!descriptions.has(description)) descriptions.set(description, []);
      descriptions.get(description).push(page.path);
    }
    const title = decodeEntities(/<title>([\s\S]*?)<\/title>/i.exec(page.html)?.[1]?.trim() ?? '');
    if (title !== '') {
      if (!titles.has(title)) titles.set(title, []);
      titles.get(title).push(page.path);
    }
  }
  for (const [title, paths] of titles)
    if (paths.length > 1)
      findings.push(
        finding(
          'warning',
          'Meta',
          paths.join(', '),
          `duplicate title across ${paths.length} pages: "${title}"`
        )
      );
  for (const [description, paths] of descriptions)
    if (paths.length > 1)
      findings.push(
        finding(
          'warning',
          'Meta',
          paths.join(', '),
          `duplicate description across ${paths.length} pages: "${description.slice(0, 72)}…"`
        )
      );

  // Sitemap: the shipped equality gate, offline.
  if (typeof sitemap !== 'string' || sitemap === '') {
    findings.push(finding('critical', 'Sitemap', '(dist)', 'sitemap.xml is missing from dist'));
  } else {
    const blocks = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
    const listed = new Map();
    for (const block of blocks) {
      const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '';
      if (loc === '') {
        findings.push(finding('critical', 'Sitemap', '(dist)', 'a <url> block without <loc>'));
        continue;
      }
      listed.set(loc, (listed.get(loc) ?? 0) + 1);
      const lastmod = block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? null;
      if (lastmod === null)
        findings.push(finding('critical', 'Sitemap', loc, 'sitemap entry without lastmod'));
      else if (!W3C_DATE.test(lastmod))
        findings.push(
          finding('critical', 'Sitemap', loc, `lastmod "${lastmod}" is not a W3C date`)
        );
      else if (Date.parse(`${lastmod}T00:00:00Z`) > Date.now())
        findings.push(finding('critical', 'Sitemap', loc, `lastmod "${lastmod}" is in the future`));
    }
    for (const [loc, count] of listed)
      if (count > 1) findings.push(finding('critical', 'Sitemap', loc, `listed ${count} times`));
    const byUrl = new Map(indexed.map((page) => [`${config.site}${page.path}`, page]));
    for (const [loc] of listed) {
      const page = byUrl.get(loc);
      if (!page)
        findings.push(
          finding(
            'critical',
            'Sitemap',
            loc,
            'listed but not a built indexed page (404 or noindex?)'
          )
        );
    }
    for (const page of indexed) {
      const url = `${config.site}${page.path}`;
      if (!listed.has(url))
        findings.push(
          finding('critical', 'Sitemap', page.path, 'an indexed page missing from the sitemap')
        );
    }
  }

  // Robots: the shipped policy shape (the buildRobots equality gate lives
  // in the site-seo spec; the audit checks structure).
  if (typeof robots !== 'string' || robots === '') {
    findings.push(finding('critical', 'Robots', '(dist)', 'robots.txt is missing from dist'));
  } else {
    if (!/^User-agent: \*\nAllow: \/$/m.test(robots))
      findings.push(
        finding('critical', 'Robots', '(dist)', 'the default group is not an unconditional allow')
      );
    if (!/^Sitemap: /m.test(robots))
      findings.push(finding('critical', 'Robots', '(dist)', 'no Sitemap line'));
    if (/Disallow/i.test(robots))
      findings.push(
        finding('critical', 'Robots', '(dist)', 'a Disallow exists (the policy is allow-all)')
      );
    // A Content-Signal line belongs to a User-agent group; outside one no
    // crawler reads it (PLAN_011 T-ar-discovery ships it in every group).
    const strayed = robots.split(/\n\s*\n/).some((block) => {
      const lines = block.split('\n').map((line) => line.trim());
      const signal = lines.findIndex((line) => /^Content-Signal:/i.test(line));
      const agent = lines.findIndex((line) => /^User-agent:/i.test(line));
      return signal !== -1 && (agent === -1 || agent > signal);
    });
    if (strayed)
      findings.push(
        finding('critical', 'Robots', '(dist)', 'a Content-Signal line outside a User-agent group')
      );
    const groups = [...robots.matchAll(/^User-agent: /gm)].length;
    if (groups < 11)
      findings.push(
        finding(
          'warning',
          'Robots',
          '(dist)',
          `only ${groups} user-agent groups (the shipped policy names 16 AI crawlers + default)`
        )
      );
  }

  const byCategory = {};
  for (const item of findings) {
    const bucket = byCategory[item.category] ?? { critical: 0, warning: 0, planned: 0 };
    bucket[item.severity] += 1;
    byCategory[item.category] = bucket;
  }
  for (const item of config.planned) {
    byCategory[item.category] ??= { critical: 0, warning: 0, planned: 0 };
    byCategory[item.category].planned += 1;
    findings.push(finding('planned', item.category, '(T-09 target)', item.detail));
  }

  return {
    summary: {
      pages: {
        total: pages.length,
        indexed: indexed.length,
        noindex: noindexed.length,
      },
      findings: {
        critical: findings.filter((item) => item.severity === 'critical').length,
        warning: findings.filter((item) => item.severity === 'warning').length,
        planned: config.planned.length,
      },
      byCategory,
    },
    findings,
  };
}

/** Walks dist for `index.html` pages and reads the sitemap and robots. */
export function collectDist(distDir) {
  const pages = [];
  const walk = (dir, base) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = base === '' ? entry.name : `${base}/${entry.name}`;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.name === 'index.html') {
        const html = readFileSync(full, 'utf-8');
        pages.push({
          path: base === '' ? '/' : normalizePagePath(rel),
          html,
          noindex: isNoindex(html),
          redirect: isRedirectPage(html),
        });
      }
    }
  };
  walk(distDir, '');
  const readOptional = (name) => {
    try {
      return readFileSync(join(distDir, name), 'utf-8');
    } catch {
      return null;
    }
  };
  return {
    pages: pages.filter((page) => !page.redirect),
    redirects: pages.length - pages.filter((page) => !page.redirect).length,
    sitemap: readOptional('sitemap.xml'),
    robots: readOptional('robots.txt'),
    readAsset: (relative) => {
      try {
        return readFileSync(join(distDir, relative));
      } catch {
        return null;
      }
    },
  };
}

/** The readable markdown report. */
export function renderMarkdown(result, config = AUDIT_CONFIG) {
  const { summary, findings } = result;
  const lines = [
    '# SEO audit — texuli.com',
    '',
    `Generated by \`scripts/audit-seo.mjs\` over the built \`dist/\` (offline, no network).`,
    '',
    '## Summary',
    '',
    `- Pages: ${summary.pages.total} built, ${summary.pages.indexed} indexed, ${summary.pages.noindex} noindex`,
    `- Findings: ${summary.findings.critical} critical, ${summary.findings.warning} warning, ${summary.findings.planned} planned`,
    `- Verdict: ${summary.findings.critical === 0 ? 'GREEN — every shipped category holds' : 'RED — fix the critical findings'}`,
    '',
    '| Category | Critical | Warning | Planned |',
    '| --- | --- | --- | --- |',
  ];
  for (const [category, bucket] of Object.entries(summary.byCategory))
    lines.push(`| ${category} | ${bucket.critical} | ${bucket.warning} | ${bucket.planned} |`);
  lines.push('', '## Findings', '');
  for (const severity of ['critical', 'warning', 'planned']) {
    const rows = findings.filter((item) => item.severity === severity);
    lines.push(`### ${severity} (${rows.length})`, '');
    if (rows.length === 0) lines.push('None.', '');
    else {
      lines.push('| Category | Page | Detail |', '| --- | --- | --- |');
      for (const item of rows)
        lines.push(
          `| ${item.category} | \`${item.page}\` | ${item.detail.replace(/\|/g, '\\|')} |`
        );
      lines.push('');
    }
  }
  lines.push(
    '## Open T-09 targets (planned, tracked)',
    '',
    ...config.planned.map((item) => `- **${item.category}** — ${item.detail}`),
    ''
  );
  return `${lines.join('\n')}\n`;
}

async function main() {
  const arg = (name, fallback) => {
    const index = process.argv.indexOf(name);
    return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
  };
  const distDir = arg(
    '--dist',
    join(fileURLToPath(new URL('../apps/website/dist', import.meta.url)))
  );
  const outMd = arg('--out', 'tmp/seo-audit.md');
  const outJson = arg('--json', 'tmp/seo-audit.json');

  let collected;
  try {
    collected = collectDist(distDir);
  } catch (error) {
    console.error(`❌ cannot read ${distDir} (${error.message}); run \`pnpm build\` first.`);
    return 1;
  }
  if (collected.pages.length === 0) {
    console.error(`❌ no pages under ${distDir}; run \`pnpm build\` first.`);
    return 1;
  }
  const result = auditSite(collected);
  writeFileSync(
    outJson,
    `${JSON.stringify({ generated: new Date().toISOString(), ...result }, null, 2)}\n`
  );
  writeFileSync(outMd, renderMarkdown(result));
  const { critical, warning, planned } = result.summary.findings;
  console.log(
    `📊 ${collected.pages.length} pages (${collected.redirects} redirects skipped): ${critical} critical, ${warning} warning, ${planned} planned`
  );
  console.log(`   JSON → ${outJson}\n   report → ${outMd}`);
  return critical === 0 ? 0 : 1;
}

/* Node CLI entry — imported as a module (the unit tests) this never runs. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code;
  });
}
