/**
 * Offline agent-surface audit for texuli.com (T-30). Crawls the built
 * `dist/` — no network anywhere — and checks every AEO category the plan
 * shipped in T-22..T-26 (analysis_results/seo-audit/aeo.md §1–§4): the
 * llms.txt surface and its links, the `.well-known` discovery quartet
 * (parse + on-site cross-links + re-hashed skill digests), the markdown
 * twins (manifest ↔ disk ↔ built pages) and the robots AI-crawler policy.
 * Emits `tmp/aeo-audit.json` plus a readable report beside the SEO one;
 * exits non-zero on any critical finding. This tool only reports — it
 * never edits a page.
 *
 * Usage:
 *   node scripts/audit-aeo.mjs [--dist apps/website/dist] [--out tmp/aeo-audit.md] [--json tmp/aeo-audit.json]
 *
 * Severity model (mirrors aeo.md):
 *   critical — a shipped agent surface is broken (missing/shim llms.txt, a
 *              dead llms.txt link, an unparseable `.well-known` file, a
 *              cross-link to nothing, a drifted skill digest, a twin the
 *              manifest promises but dist lacks, a twinned-family page
 *              without a manifest entry, a robots policy that forbids).
 *   warning  — visible but by-design gaps (nav-curated llms.txt omitting an
 *              indexed utility route).
 *   planned  — open aeo.md target rows (agent-reachability probes against
 *              the deployed origin). Never fails.
 *
 * PLAN_011 T-ar-discovery added the generated discovery documents (OAuth
 * stubs, A2A card, Personal Agent Protocol manifest) to the parsed set, the
 * Function routes (`/mcp`) that a catalog may advertise although dist does
 * not hold them, and the robots `Content-Signal` and `Agentmap` checks.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The one config block: the aeo.md target tables (§1–§4). */
export const AEO_CONFIG = {
  site: 'https://texuli.com',
  /** dist prefixes that are assets, never llms.txt routes. */
  assetPrefixes: ['_astro', 'og', 'brand', 'illustrations', 'images', 'fonts'],
  /** The `.well-known` files and what they must be. */
  wellKnown: {
    'ai-catalog.json': 'json',
    'api-catalog': 'json',
    'mcp/server-card.json': 'json',
    'agent-skills/index.json': 'json',
    'oauth-authorization-server': 'json',
    'oauth-protected-resource': 'json',
    'agent-card.json': 'json',
    'poppy.json': 'json',
  },
  /** Paths answered by a Pages Function, not a dist file (the remote MCP). */
  functionRoutes: ['/mcp', '/.well-known/mcp'],
  /** Off-site hosts an entry may point at (the npm package row). */
  offSiteHosts: ['www.npmjs.com', 'npmjs.com'],
  /** markdown twin families the manifest must cover (T-23/T-24). */
  twinFamilies: ['guides', 'component-pages', 'primitives-page', 'foundation', 'skill'],
  /** The shipped robots policy names this many AI crawlers + the default. */
  robotsMinGroups: 17,
  planned: [
    {
      category: 'Reachability',
      detail:
        'UA-class reachability probes stay request-time (the deployed origin); the offline tier proves the generated files instead — aeo.md §5',
    },
  ],
};

const finding = (severity, category, page, detail) => ({ severity, category, page, detail });
const sha256 = (buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`;

/** Site URL (or absolute off-site URL) → the dist path it must resolve to. */
export function distPathFor(url, config) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== config.site) return parsed.host ? `off-site:${parsed.host}` : null;
  try {
    return decodeURIComponent(parsed.pathname);
  } catch {
    // A malformed % escape (URIError): no dist path can match it; callers
    // report it as a critical finding instead of crashing the audit.
    return `malformed:${parsed.pathname}`;
  }
}

const isMalformed = (path) => typeof path === 'string' && path.startsWith('malformed:');
const malformedDetail = (url) => `"${url}" carries a malformed percent escape`;

/** The on-site dist path a URL must resolve to; null for off-site URLs. */
export function onSitePathFor(url, config) {
  const path = distPathFor(url, config);
  return typeof path === 'string' && path.startsWith('off-site:') ? null : path;
}

/** Whether a dist path exists as a served thing: a file, or a dir page. */
export function distPathExists(distDir, path) {
  if (typeof path !== 'string') return false;
  const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
  if (clean === '') return true;
  const full = join(distDir, clean);
  try {
    readFileSync(full);
    return true;
  } catch {
    return existsIndex(full);
  }
}

function existsIndex(dirPath) {
  try {
    readFileSync(join(dirPath, 'index.html'));
    return true;
  } catch {
    return false;
  }
}

/** Collects the agent surface from a built dist. */
export function collectAeo(distDir, config = AEO_CONFIG) {
  const readText = (relative) => {
    try {
      return readFileSync(join(distDir, relative), 'utf-8');
    } catch {
      return null;
    }
  };
  const readBytes = (relative) => {
    try {
      return readFileSync(join(distDir, relative));
    } catch {
      return null;
    }
  };
  // Top-level content routes: root dirs carrying an index.html.
  const topRoutes = [];
  for (const entry of readdirSync(distDir, { withFileTypes: true })) {
    if (
      !entry.isDirectory() ||
      entry.name.startsWith('.') ||
      config.assetPrefixes.includes(entry.name)
    )
      continue;
    if (existsIndex(join(distDir, entry.name))) topRoutes.push(`${entry.name}/`);
  }
  // Twinned-family html pages.
  const familyPages = {};
  for (const family of config.twinFamilies) {
    const pages = [];
    const walk = (dir, base) => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = base === '' ? entry.name : `${base}/${entry.name}`;
        if (entry.isDirectory()) walk(full, rel);
        else if (entry.name === 'index.html')
          pages.push(`/${family}/${base}/`.replace(/\/{2,}/g, '/'));
      }
    };
    walk(join(distDir, family), '');
    familyPages[family] = pages;
  }
  return {
    distDir,
    llmsTxt: readText('llms.txt'),
    llmsComponents: readText('llms/llms.txt'),
    llmsFull: readText('llms/llms-full.txt'),
    wellKnown: Object.fromEntries(
      Object.keys(config.wellKnown).map((name) => [name, readText(join('.well-known', name))])
    ),
    mdManifest: readText('md-manifest.json'),
    robots: readText('robots.txt'),
    topRoutes,
    familyPages,
    readBytes,
  };
}

/** Prose words a lead must carry to answer what, who and how (PLAN_014). */
export const LEAD_MIN_WORDS = 15;

/**
 * Whether a Markdown twin opens with an answer-ready lead (PLAN_014): a
 * prose paragraph of at least {@link LEAD_MIN_WORDS} words before its second
 * `## ` section. Headings, images, links, lists, tables, code and quotes are
 * not prose; the header block above the first `---` is skipped.
 */
export function twinHasLead(markdown) {
  // The header block ends at the first `---` rule near the top (Language,
  // Canonical, access lines); a twin without one starts at line 1.
  const lines = markdown.split('\n');
  const rule = lines.findIndex((line, index) => index < 20 && line.trim() === '---');
  let sections = 0;
  let paragraph = [];
  const words = () => (paragraph.join(' ').match(/[\p{L}\p{N}]+/gu) ?? []).length;
  for (const raw of lines.slice(rule + 1)) {
    const line = raw.trim();
    // Prose only: headings, images, tables, list items, code, quotes, markup
    // and lines made only of links (buttons) end the paragraph.
    const prose =
      line !== '' &&
      !/^(#|!\[|\||[-*+] |\d+\. |```|>|<)/.test(line) &&
      !/^(\[[^\]]*\]\([^)]*\)\s*)+$/.test(line);
    if (prose) {
      paragraph.push(line);
      continue;
    }
    if (words() >= LEAD_MIN_WORDS) return true;
    paragraph = [];
    if (line.startsWith('## ') && ++sections >= 2) return false;
  }
  return words() >= LEAD_MIN_WORDS;
}

/** The whole audit. Pure: the collected surface in, findings out. */
export function auditAeo(surface, config = AEO_CONFIG) {
  const findings = [];
  const servedFile = surface.exists ?? ((path) => distPathExists(surface.distDir, path));
  const exists = (path) => (config.functionRoutes ?? []).includes(path) || servedFile(path);

  // §1 llms.txt surface.
  const llms = surface.llmsTxt;
  if (llms === null)
    findings.push(finding('critical', 'llms', '(dist)', 'the root llms.txt is missing'));
  else if (llms.trimStart().toLowerCase().startsWith('<!doctype'))
    findings.push(
      finding(
        'critical',
        'llms',
        '(dist)',
        'the root llms.txt is an HTML shim, not a physical file'
      )
    );
  else {
    for (const link of [...llms.matchAll(/\((https:\/\/[^)\s]+)\)/g)].map((match) => match[1])) {
      const path = onSitePathFor(link, config);
      if (path === null) continue; // off-site rows stay off-site
      if (isMalformed(path))
        findings.push(
          finding('critical', 'llms', path.slice('malformed:'.length), malformedDetail(link))
        );
      else if (!exists(path))
        findings.push(
          finding(
            'critical',
            'llms',
            path,
            `llms.txt links to "${link}" but dist does not serve it`
          )
        );
    }
  }
  if (surface.llmsComponents === null)
    findings.push(
      finding('critical', 'llms', '(dist)', 'llms/llms.txt (component docs) is missing')
    );
  if (surface.llmsFull === null)
    findings.push(finding('critical', 'llms', '(dist)', 'llms/llms-full.txt is missing'));
  for (const route of surface.topRoutes)
    if (!llmsIncludesRoute(llms, route))
      findings.push(
        finding(
          'warning',
          'llms',
          route,
          'an indexed top route outside the nav-curated llms.txt (T-22 curates from the site nav)'
        )
      );

  // §3 .well-known quartet: parse, cross-link, re-hash.
  for (const [name, kind] of Object.entries(config.wellKnown)) {
    const text = surface.wellKnown[name];
    if (text === null) {
      findings.push(
        finding('critical', 'well-known', name, 'the shipped discovery file is missing')
      );
      continue;
    }
    if (kind === 'json') {
      try {
        JSON.parse(text);
      } catch (error) {
        findings.push(finding('critical', 'well-known', name, `does not parse: ${error.message}`));
      }
    }
  }
  const aiCatalog = parse(surface.wellKnown['ai-catalog.json']);
  if (aiCatalog) {
    for (const entry of aiCatalog.entries ?? []) {
      const path = onSitePathFor(entry.url ?? '', config);
      if (path === null) continue;
      if (isMalformed(path))
        findings.push(
          finding(
            'critical',
            'well-known',
            entry.identifier ?? entry.url,
            malformedDetail(entry.url)
          )
        );
      else if (!exists(path))
        findings.push(
          finding(
            'critical',
            'well-known',
            entry.identifier ?? entry.url,
            'the ARD advertises a URL dist does not serve'
          )
        );
    }
    if (!Array.isArray(aiCatalog.entries) || aiCatalog.entries.length === 0)
      findings.push(finding('critical', 'well-known', 'ai-catalog.json', 'no entries advertised'));
  }
  const linkset = parse(surface.wellKnown['api-catalog']);
  if (linkset) {
    for (const set of linkset.linkset ?? [])
      for (const link of set.links ?? []) {
        const path = onSitePathFor(link.href ?? '', config);
        if (isMalformed(path))
          findings.push(finding('critical', 'well-known', link.rel, malformedDetail(link.href)));
        else if (path !== null && !exists(path))
          findings.push(
            finding(
              'critical',
              'well-known',
              link.rel,
              `the linkset advertises "${link.href}" but dist does not serve it`
            )
          );
      }
  }
  const card = parse(surface.wellKnown['mcp/server-card.json']);
  if (card) {
    const cardFinding = (detail) =>
      findings.push(finding('critical', 'well-known', 'mcp/server-card.json', detail));
    if (typeof card.serverInfo?.name !== 'string') cardFinding('serverInfo.name missing');
    if (!Array.isArray(card.tools) || card.tools.length === 0) cardFinding('no tools advertised');
    const stdio = card.transport?.stdio?.launch;
    const remote = card.transport?.streamableHttp?.url;
    if (typeof stdio !== 'string' && remote === undefined)
      cardFinding('no transport: neither transport.stdio.launch nor transport.streamableHttp.url');
    if (remote !== undefined && !(typeof remote === 'string' && /^https:\/\//.test(remote)))
      cardFinding('transport.streamableHttp.url is not an https URL');
    // The tool names the card must advertise (the operations registry, passed
    // by the tests and generators; the plain CLI run has no registry).
    if (Array.isArray(config.mcpTools) && Array.isArray(card.tools)) {
      const names = card.tools.map((tool) => (typeof tool === 'string' ? tool : tool?.name));
      for (const name of config.mcpTools)
        if (!names.includes(name))
          cardFinding(`the registry operation "${name}" is not advertised`);
      for (const name of names)
        if (!config.mcpTools.includes(name))
          cardFinding(`advertises "${name}", which is not a registry operation`);
    }
  }
  const skills = parse(surface.wellKnown['agent-skills/index.json']);
  if (skills) {
    for (const skill of skills.skills ?? []) {
      const path = onSitePathFor(skill.url ?? '', config);
      if (path === null) continue;
      if (isMalformed(path)) {
        findings.push(
          finding('critical', 'well-known', skill.name ?? skill.url, malformedDetail(skill.url))
        );
        continue;
      }
      const bytes = surface.readBytes(path.replace(/^\/+/, ''));
      if (bytes === null)
        findings.push(
          finding(
            'critical',
            'well-known',
            skill.name ?? skill.url,
            'the indexed skill file is missing from dist'
          )
        );
      else if (skill.digest !== sha256(bytes))
        findings.push(
          finding(
            'critical',
            'well-known',
            skill.name ?? skill.url,
            `digest drift: index says ${skill.digest}, dist hashes to ${sha256(bytes)}`
          )
        );
    }
  }

  // §2 markdown twins: manifest ↔ disk ↔ built pages.
  const manifest = parse(surface.mdManifest);
  const twins = manifest?.twins;
  if (!twins || typeof twins !== 'object') {
    findings.push(
      finding('critical', 'twins', '(dist)', 'md-manifest.json is missing or carries no twins map')
    );
  } else {
    for (const [pagePath, twinPath] of Object.entries(twins))
      if (!exists(twinPath))
        findings.push(
          finding(
            'critical',
            'twins',
            pagePath,
            `the manifest promises twin "${twinPath}" but dist lacks it`
          )
        );
    for (const [family, pages] of Object.entries(surface.familyPages))
      for (const pagePath of pages)
        if (!(pagePath in twins))
          findings.push(
            finding('critical', 'twins', pagePath, `a built ${family} page without a manifest twin`)
          );
    // Answer-ready leads (PLAN_014): the landing and every top route's twin.
    for (const pagePath of ['/', ...surface.topRoutes.map((route) => `/${route}`)]) {
      const twinPath = twins[pagePath];
      const bytes = twinPath ? surface.readBytes(twinPath.replace(/^\//, '')) : null;
      if (bytes !== null && !twinHasLead(bytes.toString('utf8')))
        findings.push(
          finding(
            'warning',
            'twins',
            pagePath,
            `the twin does not open with an answer-ready lead (${LEAD_MIN_WORDS}+ words of prose before its second section)`
          )
        );
    }
  }

  // §4 robots policy.
  const robots = surface.robots;
  if (robots === null)
    findings.push(finding('critical', 'Robots', '(dist)', 'robots.txt is missing from dist'));
  else {
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
    if (
      !/^User-agent: \*\nAllow: \/\nContent-Signal: ai-train=\w+, search=\w+, ai-input=\w+$/m.test(
        robots
      )
    )
      findings.push(
        finding('critical', 'Robots', '(dist)', 'the default group declares no Content-Signal')
      );
    if (!robots.split('\n').includes(`Agentmap: ${config.site}/.well-known/ai-catalog.json`))
      findings.push(
        finding('critical', 'Robots', '(dist)', 'no Agentmap line for the ARD catalog')
      );
    const groups = [...robots.matchAll(/^User-agent: /gm)].length;
    if (groups < config.robotsMinGroups)
      findings.push(
        finding(
          'critical',
          'Robots',
          '(dist)',
          `only ${groups} user-agent groups; the shipped policy names ${config.robotsMinGroups - 1} AI crawlers + the default`
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
    findings.push(finding('planned', item.category, '(aeo.md target)', item.detail));
  }

  return {
    summary: {
      surface: {
        topRoutes: surface.topRoutes.length,
        twins: twins ? Object.keys(twins).length : 0,
        wellKnownFiles: Object.keys(config.wellKnown).length,
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

function llmsIncludesRoute(llms, route) {
  if (typeof llms !== 'string') return false;
  const bare = route.replace(/\/$/, '');
  return new RegExp(`/${bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(llms);
}

function parse(text) {
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** The readable markdown report. */
export function renderMarkdown(result, config = AEO_CONFIG) {
  const { summary, findings } = result;
  const lines = [
    '# Agent-surface (AEO) audit — texuli.com',
    '',
    'Generated by `scripts/audit-aeo.mjs` over the built `dist/` (offline, no network).',
    '',
    '## Summary',
    '',
    `- Surface: ${summary.surface.topRoutes} top routes, ${summary.surface.twins} markdown twins, ${summary.surface.wellKnownFiles} .well-known files`,
    `- Findings: ${summary.findings.critical} critical, ${summary.findings.warning} warning, ${summary.findings.planned} planned`,
    `- Verdict: ${summary.findings.critical === 0 ? 'GREEN — the agent surface holds' : 'RED — fix the critical findings'}`,
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
    '## Open aeo.md targets (planned, tracked)',
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
  const outMd = arg('--out', 'tmp/aeo-audit.md');
  const outJson = arg('--json', 'tmp/aeo-audit.json');

  let surface;
  try {
    surface = collectAeo(distDir);
  } catch (error) {
    console.error(`❌ cannot read ${distDir} (${error.message}); run \`pnpm build\` first.`);
    return 1;
  }
  const result = auditAeo(surface);
  writeFileSync(
    outJson,
    `${JSON.stringify({ generated: new Date().toISOString(), ...result }, null, 2)}\n`
  );
  writeFileSync(outMd, renderMarkdown(result));
  const { critical, warning, planned } = result.summary.findings;
  console.log(
    `🤖 ${result.summary.surface.topRoutes} top routes, ${result.summary.surface.twins} twins, ${result.summary.surface.wellKnownFiles} .well-known files: ${critical} critical, ${warning} warning, ${planned} planned`
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
