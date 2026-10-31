// @vitest-environment node
/**
 * Build-time guards of the site:
 * - JSON-LD serialization cannot break out of its script element (S-7);
 * - sitemap lastmod is the commit's UTC day, not the committer's (T-100 P2-2);
 * - `src/pages` holds routes only: Astro treats every `.ts` file there as an
 *   endpoint, so a helper without a GET handler becomes a stray route;
 * - the site layers its element defaults before Texuli's cascade layers;
 * - the page CSP names the `texuli-analytics` Trusted Types policy only on
 *   pages that mount the Umami loader (T-100 S-1), and hashes every inline
 *   script, style element and style attribute (no `unsafe-inline`);
 * - the skill pack is published from its SHA256SUMS allowlist only (S-8);
 * - the SEO helpers (paths, sitemap, robots, social art) and the JSON-LD
 *   builders state only what the repository backs;
 * - the committed agent discovery files describe real surfaces only;
 * - the skill page reads the pack exactly as setup.sh does.
 * The built output itself (every page's head, the sitemap, the social
 * images, the twins, internal links) is audited in tests/e2e/site-seo.spec.ts.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createMcpHandler } from '../../../packages/tools/src/mcp/handler.ts';
import {
  MCP_PROTOCOL_VERSION,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
} from '../../../packages/tools/src/mcp/protocol.ts';
import {
  REMOTE_RUNTIMES,
  TOOLS_VERSION,
  texuliOps,
} from '../../../packages/tools/src/ops/index.ts';
import {
  ANALYTICS_TRUSTED_TYPES_POLICY,
  pagePolicy,
  pageRoute,
  reportOnlyPolicy,
} from '../src/components/security/csp.ts';
import {
  aiCatalog as buildAiCatalog,
  apiCatalog as buildApiCatalog,
} from '../src/components/seo/agent-discovery.ts';
import { breadcrumbJsonLd, breadcrumbTrail } from '../src/components/seo/breadcrumbs.ts';
import { gitCommitDateUtc } from '../src/components/seo/integration.ts';
import { serializeJsonLd } from '../src/components/seo/json-ld.ts';
import {
  AI_CRAWLERS,
  absoluteUrl,
  buildRobots,
  buildSitemap,
  escapeXml,
  normalizePagePath,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  ogAreaFor,
  ogImageFile,
  ogImageSvg,
  readPageMeta,
  wrapText,
} from '../src/components/seo/seo.ts';
import {
  parseChecksums,
  parseFrontmatter,
  parseHostLabels,
  parseSetupHosts,
  skillHosts,
  subSkills,
} from '../src/components/skill/skill.ts';
import { publishSkillPack } from '../src/integrations/skill-pack.ts';
import { libraryJsonLd, techArticleJsonLd } from '../src/lib/schema.ts';

const temps: string[] = [];
function temp(prefix = 'texuli-site-guard-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('serializeJsonLd (S-7)', () => {
  it('cannot close the script element, open a comment, or carry &, U+2028 and U+2029', () => {
    const out = serializeJsonLd({
      name: '</script><script>alert(1)</script>',
      note: '<!-- x -->',
      a: 'Tom & Jerry',
      b: 'x\u2028y\u2029z',
    });
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
    expect(out.toLowerCase()).not.toContain('</script');
    for (const escaped of ['\\u003c/script\\u003e', '\\u0026', '\\u2028', '\\u2029']) {
      expect(out, escaped).toContain(escaped);
    }
  });

  it('round-trips through JSON.parse and leaves plain data byte-identical to JSON.stringify', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'A </script> & <b> title \u2028 here',
      list: [1, true, null, { url: 'https://example.com/?a=1&b=2' }],
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
    const plain = { '@type': 'Organization', name: 'Texuli', url: 'https://texuli.com' };
    expect(serializeJsonLd(plain)).toBe(JSON.stringify(plain));
  });
});

describe('gitCommitDateUtc (T-100 P2-2)', () => {
  // A commit at 01:00 on 10-27 in +05:30 is 19:30 UTC on 10-26.
  let repo = '';
  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'texuli-lastmod-'));
    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: 'Example',
      GIT_AUTHOR_EMAIL: 'dev@example.com',
      GIT_COMMITTER_NAME: 'Example',
      GIT_COMMITTER_EMAIL: 'dev@example.com',
      GIT_AUTHOR_DATE: '2026-10-27T01:00:00+05:30',
      GIT_COMMITTER_DATE: '2026-10-27T01:00:00+05:30',
    };
    const git = (...args: string[]) =>
      execFileSync(
        'git',
        ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
        { cwd: repo, env, stdio: 'pipe' }
      );
    git('init', '-q');
    writeFileSync(join(repo, 'page.astro'), '---\n---\n');
    git('add', 'page.astro');
    git('commit', '-q', '-m', 'fixture');
  });
  afterAll(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it('reports the UTC day of a commit made just after midnight in +05:30, for a path and HEAD', () => {
    expect(gitCommitDateUtc(['--', 'page.astro'], repo)).toBe('2026-10-26');
    expect(gitCommitDateUtc([], repo)).toBe('2026-10-26');
  });
});

describe('src/pages holds routes only', () => {
  const pagesRoot = join(import.meta.dirname, '..', 'src', 'pages');
  function tsFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return entry.name.startsWith('_') ? [] : tsFiles(path);
      return entry.name.endsWith('.ts') && !entry.name.startsWith('_') ? [path] : [];
    });
  }

  it('every .ts module under src/pages exports a GET handler', () => {
    const handlerless = tsFiles(pagesRoot)
      .filter(
        (file) =>
          !/export\s+(const|async\s+function|function)\s+GET\b/.test(readFileSync(file, 'utf8'))
      )
      .map((file) => relative(pagesRoot, file));
    expect(handlerless).toEqual([]);
  });
});

describe('site cascade layers', () => {
  it('layers the site element defaults before Texuli, so Button colors win over a { color }', () => {
    const layers = readFileSync(
      fileURLToPath(new URL('../src/styles/site-layers.css', import.meta.url)),
      'utf8'
    );
    expect(layers).toContain('@layer site-base, tx.base, tx.components, site-overrides');
    expect(layers).toMatch(/@layer site-base\s*\{[\s\S]*\ba\s*\{/);
  });
});

describe('pagePolicy: trusted types (T-100 S-1) and hashes', () => {
  const MOUNT =
    '<script src="/umami-loader.js" data-umami-loader data-script-src="/api/umami/script.js" data-website-id="fixture-id" data-host-url="/api/umami" defer></script>';
  const directive = (policy: string, name: string): string | undefined =>
    policy
      .split('; ')
      .find((entry) => entry.startsWith(`${name} `))
      ?.slice(name.length + 1);

  it('allows only svelte-trusted-html without the mount, even when the marker is escaped text', () => {
    for (const html of [
      '<!doctype html><html><head></head><body><p>Hi</p></body></html>',
      '<!doctype html><html><body><pre>&lt;script data-umami-loader&gt;</pre></body></html>',
    ]) {
      expect(directive(pagePolicy(html), 'trusted-types'), html).toBe('svelte-trusted-html');
    }
  });

  it('adds exactly the texuli-analytics policy on a page that mounts the loader, nothing broader', () => {
    const policy = pagePolicy(`<!doctype html><html><head>${MOUNT}</head><body></body></html>`);
    expect(ANALYTICS_TRUSTED_TYPES_POLICY).toBe('texuli-analytics');
    expect(directive(policy, 'trusted-types')).toBe('svelte-trusted-html texuli-analytics');
    expect(directive(policy, 'require-trusted-types-for')).toBe("'script'");
    expect(directive(policy, 'script-src')).toBe("'self'");
    expect(policy).not.toContain("'allow-duplicates'");
  });

  it('hashes each inline source, so a changed script needs a new hash; maps files to routes; report-only adds its group', () => {
    const sha = (source: string) =>
      `'sha256-${createHash('sha256').update(source).digest('base64')}'`;
    const html =
      '<html><head><script>window.ready=1</script><script src="/a.js"></script><style>p{color:red}</style></head><body><p style="margin:0">x</p></body></html>';
    const policy = pagePolicy(html);
    expect(directive(policy, 'script-src')).toBe(`'self' ${sha('window.ready=1')}`);
    expect(directive(policy, 'style-src')).toBe(`'self' ${sha('p{color:red}')}`);
    expect(directive(policy, 'style-src-attr')).toBe(`'unsafe-hashes' ${sha('margin:0')}`);
    expect(policy).not.toMatch(/'unsafe-(?:inline|eval)'/);
    expect(pagePolicy(html.replace('ready=1', 'ready=2'))).not.toBe(policy);
    expect(pageRoute('/dist', '/dist/docs/index.html')).toBe('/docs/');
    expect(pageRoute('/dist', '/dist/index.html')).toBe('/');
    expect(pageRoute('/dist', '/dist/404.html')).toBe('/404.html');
    expect(reportOnlyPolicy(policy)).toBe(`${policy}; report-to texuli-csp`);
  });
});

describe('publishSkillPack (S-8)', () => {
  const PACK = fileURLToPath(new URL('../../../skills/texuli', import.meta.url));
  const listed = (pack: string): string[] =>
    readFileSync(join(pack, 'SHA256SUMS'), 'utf8')
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(/^[0-9a-f]{64}\s+\*?/, ''));
  const filesUnder = (dir: string, base = dir): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? filesUnder(full, base) : [full.slice(base.length + 1)];
    });

  it('publishes exactly the SHA256SUMS files, never an untracked extra, with matching digests', () => {
    const pack = join(temp(), 'texuli');
    cpSync(PACK, pack, { recursive: true });
    writeFileSync(join(pack, 'secret-notes.md'), 'not for publication\n');
    mkdirSync(join(pack, '.cache'), { recursive: true });
    writeFileSync(join(pack, '.cache', 'scratch.json'), '{}\n');
    writeFileSync(join(pack, 'router', 'draft.md'), 'draft\n');

    const served = join(temp(), 'skill-pack');
    const published = publishSkillPack(pack, served);

    const expected = [...listed(pack), 'SHA256SUMS'].sort();
    expect(filesUnder(served).sort()).toEqual(expected);
    expect(published.sort()).toEqual(expected);
    expect(existsSync(join(served, 'secret-notes.md'))).toBe(false);
    expect(existsSync(join(served, '.cache'))).toBe(false);
    expect(existsSync(join(served, 'router', 'draft.md'))).toBe(false);
    for (const line of readFileSync(join(served, 'SHA256SUMS'), 'utf8').split('\n')) {
      const match = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line);
      if (!match?.[1] || !match[2]) continue;
      expect(readFileSync(join(served, match[2]))).toEqual(readFileSync(join(pack, match[2])));
      const digest = createHash('sha256')
        .update(readFileSync(join(served, match[2])))
        .digest('hex');
      expect(digest, match[2]).toBe(match[1]);
    }
  });

  it('refuses an entry that escapes the pack and fails when a listed file is missing', () => {
    const root = temp();
    const escaping = join(root, 'texuli');
    mkdirSync(escaping, { recursive: true });
    writeFileSync(join(root, 'outside.txt'), 'outside\n');
    writeFileSync(join(escaping, 'SHA256SUMS'), `${'0'.repeat(64)}  ../outside.txt\n`);
    const served = join(temp(), 'skill-pack');
    expect(() => publishSkillPack(escaping, served)).toThrow(/outside the pack/);
    expect(existsSync(join(dirname(served), 'outside.txt'))).toBe(false);

    const missing = join(temp(), 'texuli');
    mkdirSync(missing, { recursive: true });
    writeFileSync(join(missing, 'SHA256SUMS'), `${'0'.repeat(64)}  SKILL.md\n`);
    expect(() => publishSkillPack(missing, join(temp(), 'skill-pack'))).toThrow(/SKILL\.md/);
  });
});

describe('SEO helpers', () => {
  const SITE = 'https://texuli.com';

  it('normalize paths, files and absolute URLs; escape XML; build the sitemap and robots', () => {
    expect(normalizePagePath('/guides/theming')).toBe('/guides/theming/');
    expect(normalizePagePath('guides/theming/index.html')).toBe('/guides/theming/');
    expect(normalizePagePath('/preview/guides/', '/preview/')).toBe('/guides/');
    expect(normalizePagePath('')).toBe('/');
    expect(ogImageFile('/')).toBe('og/index.png');
    expect(ogImageFile('/component-pages/button/')).toBe('og/component-pages/button.png');
    expect(absoluteUrl(SITE, '/', '/guides/')).toBe('https://texuli.com/guides/');
    expect(absoluteUrl(SITE, '/preview', 'og/index.png')).toBe(
      'https://texuli.com/preview/og/index.png'
    );
    expect(escapeXml(`a&b<c>"d"'e'${String.fromCharCode(1)}`)).toBe(
      'a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;'
    );

    const xml = buildSitemap([
      `${SITE}/b/`,
      { loc: `${SITE}/`, lastmod: '2026-10-25' },
      `${SITE}/b/`,
      `${SITE}/a?x=1&y=2`,
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<loc>/g)).toHaveLength(3);
    expect(xml.indexOf(`${SITE}/</loc>`)).toBeLessThan(xml.indexOf(`${SITE}/b/</loc>`));
    expect(xml).toContain('x=1&amp;y=2');
    expect(xml.match(/<lastmod>/g)).toEqual(['<lastmod>']);
    expect(xml).toContain('<lastmod>2026-10-25</lastmod>');
    expect(() => buildSitemap([{ loc: `${SITE}/x/`, lastmod: 'not-a-date' }])).toThrow();

    // Every AI crawler is welcomed by name and nothing is disallowed; every
    // group carries the site's Content-Signal and the Agentmap names the ARD
    // catalog (PLAN_011 T-ar-discovery; the directives are unit-tested in
    // agent-discovery.test.ts).
    const robots = buildRobots(`${SITE}/sitemap.xml`);
    const signal = 'Content-Signal: ai-train=yes, search=yes, ai-input=yes';
    expect(robots).toContain(`User-agent: *\nAllow: /\n${signal}\n`);
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml\n`);
    expect(robots).toContain(`Agentmap: ${SITE}/.well-known/ai-catalog.json\n`);
    for (const crawler of AI_CRAWLERS)
      expect(robots).toContain(`User-agent: ${crawler}\nAllow: /\n${signal}\n`);
    expect(robots).not.toContain('Disallow');
  });

  it('maps routes to social-art areas, reads page meta, wraps text and escapes hostile titles', () => {
    const labels: Array<[string, string]> = [
      ['/', ''],
      ['/guides/theming/', 'Guides'],
      ['/component-pages/button/', 'Components'],
      ['/primitives-page/accordion/', 'Primitives'],
      ['/theme-studio/', 'Themes'],
      ['/playground/', 'Agents'],
    ];
    for (const [path, label] of labels) expect(ogAreaFor(path).label, path).toBe(label);
    expect(new Set(labels.map(([path]) => ogAreaFor(path).accent)).size).toBeGreaterThanOrEqual(5);
    const base = {
      title: 'Same title',
      description: 'Same description text.',
      url: 'texuli.com/x',
      siteName: 'Texuli',
    };
    const plain = ogImageSvg(base);
    const guides = ogImageSvg({ ...base, area: ogAreaFor('/guides/theming/') });
    expect(guides).toContain('GUIDES');
    expect(plain).not.toContain('GUIDES');

    expect(
      readPageMeta(
        '<html><head><title>Tom &amp; Jerry &#183; Texuli</title><meta name="description" content="A &quot;quoted&quot; page"><meta name="robots" content="noindex"></head><body><title>ignored</title></body></html>'
      )
    ).toEqual({ title: 'Tom & Jerry · Texuli', description: 'A "quoted" page', noindex: true });
    expect(wrapText('one two three four five six', 9, 2)).toEqual(['one two', 'three…']);
    expect(wrapText('short', 20, 3)).toEqual(['short']);

    const svg = ogImageSvg({
      title: '<script>alert(1)</script> & "x"',
      description: '</text><image href="https://evil.example/x.png"/>',
      url: 'texuli.com/x',
      siteName: 'Texuli',
    });
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<image');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain(`width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}"`);
  });
});

describe('JSON-LD builders', () => {
  it('the library graph states the owner, the search action and a pre-1.0 release, with no offers', () => {
    const graph = libraryJsonLd()['@graph'];
    const byType = new Map(graph.map((node) => [node['@type'], node]));
    expect(byType.get('Organization')).toMatchObject({ name: 'Dailybot, Inc.' });
    const website = byType.get('WebSite') as Record<string, unknown>;
    expect(website).toMatchObject({ name: 'Texuli', url: 'https://texuli.com/' });
    expect(JSON.stringify(website.potentialAction)).toContain('/search/?q={search_term_string}');
    const app = byType.get('SoftwareApplication') as Record<string, unknown>;
    expect(app).toMatchObject({
      name: 'Texuli',
      applicationCategory: 'DeveloperApplication',
      license: 'https://opensource.org/licenses/MIT',
    });
    // Pre-1.0 reality: the pattern fails the day the version leaves 0.x.
    expect(app.softwareVersion).toMatch(/^0\.\d+\.\d+(?:-next\.\d+)?$/);
    expect(String(app.description)).toContain('in development');
    expect(app).not.toHaveProperty('offers');

    const article = techArticleJsonLd('Headline', 'Description.', '/web-and-native/')['@graph'][0];
    expect(article).toMatchObject({
      '@type': 'TechArticle',
      headline: 'Headline',
      url: 'https://texuli.com/web-and-native/',
    });
  });

  it('breadcrumbs follow the site nav: contiguous positions, absolute items, none on the landing', () => {
    const names = (path: string) => breadcrumbTrail(path).map((entry) => entry.name);
    expect(names('/guides/theming/')).toEqual(['Home', 'Get started', 'Theming']);
    // The family heading has no href, so it cannot be a breadcrumb entry.
    expect(names('/component-pages/button/')).toEqual(['Home', 'Components', 'Button']);
    expect(breadcrumbTrail('/')).toEqual([]);
    expect(breadcrumbTrail('/no-such-page/')).toEqual([]);
    for (const path of ['/guides/theming/', '/component-pages/button/']) {
      const list = breadcrumbJsonLd(breadcrumbTrail(path)).itemListElement;
      list.forEach((entry, index) => {
        expect(entry.position).toBe(index + 1);
        expect(entry.item).toMatch(/^https:\/\/texuli\.com\/.*\/?$/);
      });
      expect(list.at(-1)?.item).toBe(`https://texuli.com${path}`);
    }
  });
});

describe('agent discovery files (public/.well-known, the generated API and ARD catalogs, public/llms.txt)', () => {
  const read = (path: string) =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../public/.well-known/${path}`, import.meta.url)), 'utf8')
    );

  it('describe only real surfaces: unique entries, texuli.com or npm URLs, the registry tools on both MCP transports', async () => {
    // The ARD catalog is generated at build too (agent-discovery.ts, PLAN_011 T-ar-api).
    const aiCatalog = buildAiCatalog({ origin: 'https://texuli.com', openapi: true }) as {
      host: { displayName: string; documentationUrl: string };
      entries: { identifier: string; url: string }[];
    };
    // The API catalog is generated at build (agent-discovery.ts), not committed.
    const apiCatalog = buildApiCatalog({ origin: 'https://texuli.com', openapi: true }) as {
      linkset: { links: { href: string }[] }[];
    };
    const card = read('mcp/server-card.json') as {
      serverInfo: { name: string; version: string };
      protocolVersion: string;
      protocolVersions: string[];
      transport: { stdio: { launch: string }; streamableHttp: { url: string } };
      capabilities: string[];
      tools: { name: string; title: string; description: string; remote: boolean }[];
      deprecatedTools: { name: string; remote: boolean }[];
      removedTools: { name: string; replacedBy: string[]; removedIn: string }[];
    };
    expect(aiCatalog.host.displayName).toBe('Texuli');
    // T-100 P1-4: /docs/ was advertised but has no route.
    expect(aiCatalog.host.documentationUrl).toBe('https://texuli.com/guides/');
    const identifiers = aiCatalog.entries.map((entry) => entry.identifier);
    expect(identifiers.length).toBeGreaterThanOrEqual(6);
    // The ARD lists the remote MCP endpoint (PLAN_011 T-ar-discovery).
    expect(aiCatalog.entries.map((entry) => entry.url)).toContain('https://texuli.com/mcp');
    expect(new Set(identifiers).size).toBe(identifiers.length);
    for (const url of [
      ...aiCatalog.entries.map((entry) => entry.url),
      ...apiCatalog.linkset.flatMap((set) => set.links.map((link) => link.href)),
    ])
      expect(url).toMatch(/^https:\/\/(texuli\.com\/|www\.npmjs\.com\/)/);
    // The card is generated from the operations registry (pnpm check:surfaces):
    // compare with the registry and the handler, never with literals.
    expect(card.serverInfo.name).toBe('texuli');
    expect(card.serverInfo.version).toBe(TOOLS_VERSION);
    expect(card.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(card.protocolVersions).toEqual([...MCP_SUPPORTED_PROTOCOL_VERSIONS]);
    expect(card.tools.map((tool) => tool.name)).toEqual(texuliOps.list().map((op) => op.name));
    for (const tool of card.tools) {
      expect(tool.title, tool.name).toBe(texuliOps.get(tool.name)?.title);
      expect(tool.description, tool.name).toBe(texuliOps.get(tool.name)?.summary);
    }
    expect(card.deprecatedTools.map((alias) => alias.name)).toEqual(
      texuliOps.aliases().map((alias) => alias.name)
    );
    expect(card.removedTools.map((entry) => entry.name)).toEqual(
      texuliOps.removed().map((entry) => entry.name)
    );
    expect(card.capabilities.every((name) => typeof name === 'string')).toBe(true);
    expect(card.capabilities).toContain('tools');
    expect(card.transport.stdio.launch).toBe('npx -y @texuli/mcp');
    // The remote endpoint (functions/mcp.ts) is the Streamable HTTP door; the
    // card's remote flags match what its handler (edge and site operations) lists.
    expect(card.transport.streamableHttp.url).toBe('https://texuli.com/mcp');
    const listed = (await createMcpHandler({ mode: 'stateless', runtimes: REMOTE_RUNTIMES })({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    })) as unknown as { result: { tools: { name: string }[] } };
    expect([
      ...card.tools.filter((tool) => tool.remote).map((tool) => tool.name),
      ...card.deprecatedTools.filter((alias) => alias.remote).map((alias) => alias.name),
    ]).toEqual(listed.result.tools.map((tool) => tool.name));

    // The root llms.txt (generated from the nav; its drift check is in
    // scripts/tests/site-loaders.test.ts) has a section per site area.
    const llms = readFileSync(
      fileURLToPath(new URL('../public/llms.txt', import.meta.url)),
      'utf8'
    );
    expect(llms.startsWith('# Texuli\n\n> ')).toBe(true);
    for (const area of [
      'Guides',
      'Components',
      'Primitives',
      'Themes',
      'Agents',
      'Project',
      'Tools',
    ])
      expect(llms, area).toContain(`## ${area}\n`);
    expect(llms.match(/^- \[[^\]]+\]\(https:\/\/texuli\.com[^)]*\)/gm)?.length).toBeGreaterThan(30);
    // The Tools section names every registry operation.
    const tools = llms.slice(llms.indexOf('## Tools\n'));
    for (const operation of texuliOps.list())
      expect(tools, operation.name).toContain(`- [${operation.name}](`);
  });
});

describe('skill page data', () => {
  const PACK = fileURLToPath(new URL('../../../skills/texuli', import.meta.url));
  const read = (path: string) => readFileSync(join(PACK, path), 'utf8');

  it('parses frontmatter, the host map and SHA256SUMS', () => {
    expect(
      parseFrontmatter(
        '---\nname: demo\ndescription: Does a thing.\nversion: "1.2.3"\nallowed-tools: Bash, Read\nmetadata:\n  x: y\n---\n# Body'
      )
    ).toEqual({
      name: 'demo',
      description: 'Does a thing.',
      version: '1.2.3',
      allowedTools: ['Bash', 'Read'],
    });
    expect(
      parseSetupHosts(
        'HOSTS="a b"\nhost_dir() {\n  case "$1" in\n    a) echo ".a/skills" ;;\n    b) echo ".b/x" ;;\n  esac\n}\n'
      )
    ).toEqual([
      { id: 'a', dir: '.a/skills' },
      { id: 'b', dir: '.b/x' },
    ]);
    expect([
      ...parseHostLabels(
        '| Host | `setup.sh --host` | x |\n| Claude Code | `claude` | `~/.claude` |'
      ),
    ]).toEqual([['claude', 'Claude Code']]);
    const hash = 'a'.repeat(64);
    expect(parseChecksums(`${hash}  SKILL.md\n\nnot a line\n${hash} *setup.sh\n`)).toEqual([
      { hash, path: 'SKILL.md' },
      { hash, path: 'setup.sh' },
    ]);
  });

  it('lists exactly the hosts setup.sh prints, and every sub-skill folder with its references', () => {
    const hosts = skillHosts(read('setup.sh'), read('router/hosts.md'), 'texuli');
    const listed = execFileSync('sh', [join(PACK, 'setup.sh'), '--list-hosts'], {
      encoding: 'utf8',
      timeout: 60_000,
    })
      .trim()
      .split('\n')
      .map((line) => line.trim().split(/\s+/));
    expect(hosts.map((host) => [host.id, host.folder])).toEqual(listed);
    for (const host of hosts) expect(host.label, host.id).not.toBe(host.id);

    const router = parseFrontmatter(read('SKILL.md'));
    const checksums = parseChecksums(read('SHA256SUMS'));
    const files = new Map(checksums.map((sum) => [sum.path, read(sum.path)]));
    const skills = subSkills(files, checksums);
    const folders = readdirSync(PACK, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(PACK, entry.name, 'SKILL.md')))
      .map((entry) => entry.name)
      .sort();
    expect(skills.map((skill) => skill.folder)).toEqual(folders);
    for (const skill of skills) {
      expect(skill.name, skill.folder).toBe(`texuli-${skill.folder}`);
      expect(skill.description, skill.folder).not.toBe('');
      expect(skill.version, skill.folder).toBe(router.version);
      const refs = join(PACK, skill.folder, 'references');
      if (existsSync(refs)) expect([...skill.references].sort()).toEqual(readdirSync(refs).sort());
    }
  });
});
