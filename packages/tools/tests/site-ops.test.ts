// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createMcpHandler } from '../src/mcp/handler.ts';
import {
  LOCAL_RUNTIMES,
  normalizeSitePath,
  REMOTE_RUNTIMES,
  rankSitePages,
  SITE_READ_MAX_BYTES,
  siteIndexPages,
  texuliOps,
} from '../src/ops/index.ts';
import { cutUtf8 } from '../src/ops/site.ts';
import { FIXTURE_PAGES, type FixturePage, fakeSiteAssets } from './fixtures/site-assets.ts';
import { scenario } from './scenario.ts';

/**
 * The `site` runtime class (T-ar-site-mcp, ADR-018): `site.pages`,
 * `site.read` and `site.search` read the built site through an
 * `env.ASSETS`-shaped binding, only on the remote door.
 */

const SITE_OPS = ['site.pages', 'site.read', 'site.search'];

// biome-ignore lint/suspicious/noExplicitAny: outputs are checked JSON.
type Json = any;

async function run(name: string, input: unknown, assets = fakeSiteAssets()) {
  return texuliOps.invoke(name, input, { runtimes: REMOTE_RUNTIMES, site: { assets } });
}

async function output(name: string, input: unknown, assets = fakeSiteAssets()): Promise<Json> {
  const outcome = await run(name, input, assets);
  if (!outcome.ok) throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
  return outcome.output;
}

describe('site operations', () => {
  it('are site-only: listed on the remote door, absent from the local doors', async () => {
    expect(texuliOps.list({ runtimes: ['site'] }).map((op) => op.name)).toEqual(SITE_OPS);
    const local = texuliOps.list({ runtimes: LOCAL_RUNTIMES }).map((op) => op.name);
    for (const name of SITE_OPS) expect(local).not.toContain(name);
    const remote = texuliOps.list({ runtimes: REMOTE_RUNTIMES }).map((op) => op.name);
    for (const name of SITE_OPS) expect(remote).toContain(name);
    expect(remote).not.toContain('document.export');

    // A local door names the runtime; a remote door without the binding refuses too.
    const local1 = await texuliOps.invoke('site.read', { path: '/' }, { runtimes: LOCAL_RUNTIMES });
    expect(local1.ok ? '' : local1.error.code).toBe('runtime-unavailable');
    const unbound = await texuliOps.invoke(
      'site.read',
      { path: '/' },
      { runtimes: REMOTE_RUNTIMES }
    );
    expect(unbound.ok ? '' : unbound.error.code).toBe('runtime-unavailable');
    expect(unbound.ok ? '' : unbound.error.message).toMatch(/texuli\.com\/mcp/u);
  });

  it('site.pages lists the manifest in path order, filtered and paginated', async () => {
    await scenario('first page and nextOffset', async () => {
      const first = await output('site.pages', { limit: 2 });
      expect(first.total).toBe(FIXTURE_PAGES.length);
      expect(first.pages.map((page: Json) => page.path)).toEqual(['/', '/component-pages/card/']);
      expect(first.nextOffset).toBe(2);
      expect(first.pages[1]).toEqual({
        path: '/component-pages/card/',
        twin: '/component-pages/card.md',
        url: 'https://texuli.com/component-pages/card/',
        title: 'Card',
        description: 'A surface that groups related content.',
      });
    });
    await scenario('walking every page visits each once', async () => {
      const seen: string[] = [];
      let offset: number | undefined = 0;
      while (offset !== undefined) {
        const next: Json = await output('site.pages', { offset, limit: 4 });
        seen.push(...next.pages.map((page: Json) => page.path));
        offset = next.nextOffset;
      }
      expect(seen).toEqual(FIXTURE_PAGES.map((page) => page.path).sort());
    });
    await scenario('a prefix and an offset past the end', async () => {
      const guides = await output('site.pages', { prefix: '/guides/' });
      expect(guides.pages.map((page: Json) => page.path)).toEqual([
        '/guides/',
        '/guides/dark-mode/',
        '/guides/theming/',
      ]);
      expect(guides.nextOffset).toBeUndefined();
      const past = await output('site.pages', { offset: 100 });
      expect(past).toMatchObject({ total: FIXTURE_PAGES.length, pages: [] });
    });
    await scenario('bounds are schema-checked', async () => {
      for (const input of [{ limit: 0 }, { limit: 201 }, { offset: -1 }, { prefix: 'guides' }]) {
        const outcome = await run('site.pages', input);
        expect(outcome.ok ? '' : outcome.error.code, JSON.stringify(input)).toBe('invalid-input');
      }
    });
    await scenario('the origin of the request names the URLs', async () => {
      const outcome = await texuliOps.invoke(
        'site.pages',
        { limit: 1 },
        {
          runtimes: REMOTE_RUNTIMES,
          site: { assets: fakeSiteAssets(), origin: 'https://preview.texuli.pages.dev' },
        }
      );
      expect(outcome.ok && (outcome.output as Json).pages[0].url).toBe(
        'https://preview.texuli.pages.dev/'
      );
    });
  });

  it('site.read returns a twin for every accepted path form and refuses the rest', async () => {
    for (const path of [
      '/guides/theming/',
      '/guides/theming',
      '/guides/theming.md',
      '/guides/theming/index.html',
      '/guides/theming/?tab=1#css',
      'https://texuli.com/guides/theming/',
    ]) {
      await scenario(`accepts ${path}`, async () => {
        const read = await output('site.read', { path });
        expect(read).toMatchObject({
          path: '/guides/theming/',
          twin: '/guides/theming.md',
          url: 'https://texuli.com/guides/theming/',
          title: 'Theming',
          truncated: false,
        });
        expect(read.markdown).toContain('## CSS layers');
        expect(read.bytes).toBe(new TextEncoder().encode(read.markdown).byteLength);
      });
    }
    await scenario('the home page by / and /index.md', async () => {
      expect((await output('site.read', { path: '/' })).twin).toBe('/index.md');
      expect((await output('site.read', { path: '/index.md' })).path).toBe('/');
    });
    const refusals: [string, string, RegExp][] = [
      ['/../etc/passwd', 'invalid-input', /traversal/u],
      ['/guides/../md-manifest.json', 'invalid-input', /traversal/u],
      ['/guides/./theming/', 'invalid-input', /traversal/u],
      ['/guides/%2e%2e/secret', 'invalid-input', /escaped/u],
      ['/guides\\theming', 'invalid-input', /backslashed/u],
      ['//evil.example/x', 'invalid-input', /characters or empty segments/u],
      ['guides/theming', 'invalid-input', /must start with/u],
      ['https://evil.example/guides/theming/', 'invalid-input', /Only texuli\.com/u],
      ['javascript:alert(1)', 'invalid-input', /Only texuli\.com/u],
      ['/guides/the ming/', 'invalid-input', /characters/u],
      ['/md-manifest.json', 'not-found', /No texuli\.com page at \/md-manifest\.json\//u],
      ['/no/such/page/', 'not-found', /site\.search/u],
    ];
    for (const [path, code, message] of refusals) {
      await scenario(`refuses ${path}`, async () => {
        const assets = fakeSiteAssets();
        const outcome = await run('site.read', { path }, assets);
        expect(outcome.ok, path).toBe(false);
        if (outcome.ok) return;
        expect(outcome.error.code).toBe(code);
        expect(outcome.error.message).toMatch(message);
        // Only the manifest is ever fetched for a refused path; never caller text.
        for (const requested of assets.requested) expect(requested).toBe('/md-manifest.json');
      });
    }
    await scenario('an over-long path is refused by the schema', async () => {
      const outcome = await run('site.read', { path: `/${'a'.repeat(600)}/` });
      expect(outcome.ok ? '' : outcome.error.code).toBe('invalid-input');
    });
    await scenario('a manifest entry whose twin is missing answers not-found', async () => {
      const assets = fakeSiteAssets({ files: { '/guides/theming.md': null } });
      const outcome = await run('site.read', { path: '/guides/theming/' }, assets);
      expect(outcome.ok ? '' : outcome.error.code).toBe('not-found');
    });
  });

  it('site.read caps the size at a line and character boundary', async () => {
    const line = `${'é'.repeat(99)}\n`;
    const big = `# Theming\n\n${line.repeat(Math.ceil((SITE_READ_MAX_BYTES * 2) / 199))}`;
    const assets = fakeSiteAssets({ files: { '/guides/theming.md': big } });
    const read = await output('site.read', { path: '/guides/theming/' }, assets);
    expect(read.truncated).toBe(true);
    expect(read.bytes).toBeLessThanOrEqual(SITE_READ_MAX_BYTES);
    expect(read.bytes).toBeGreaterThan(SITE_READ_MAX_BYTES - 400);
    expect(read.markdown.endsWith('\n')).toBe(true);
    expect(read.markdown).not.toContain('�');
    // A cut inside a multi-byte character backs off to the character start.
    const bytes = new TextEncoder().encode('aé');
    expect(cutUtf8(bytes, 2)).toBe('a');
  });

  it('site.search ranks deterministically: coverage, then score, then path', async () => {
    await scenario('a title word outranks a heading and a description', async () => {
      const hits = await output('site.search', { query: 'theming' });
      expect(hits.results.map((hit: Json) => hit.path)).toEqual([
        '/guides/theming/',
        '/guides/',
        '/guides/dark-mode/',
      ]);
      expect(hits.total).toBe(3);
      expect(hits.results[0]).toMatchObject({ title: 'Theming', score: 14 });
      expect(hits.results[1].headings).toEqual(['Theming and tokens']);
    });
    await scenario('every term matched comes first, with a phrase bonus', async () => {
      const hits = await output('site.search', { query: 'Dark mode', limit: 2 });
      expect(hits.results.map((hit: Json) => hit.path)).toEqual([
        '/guides/dark-mode/',
        '/guides/theming/',
      ]);
      expect(hits.limit).toBe(2);
      expect(hits.total).toBe(2);
    });
    await scenario('the same query gives the same answer', async () => {
      const a = await output('site.search', { query: 'for agents card' });
      const b = await output('site.search', { query: 'card FOR agents!!' });
      expect(b.results).toEqual(a.results);
    });
    await scenario('equal scores tie-break on the shorter path, then the path', () => {
      const twins: FixturePage[] = ['/b/x/', '/a/x/', '/ccc/x/'].map((path) => ({
        path,
        twin: `${path.slice(0, -1)}.md`,
        title: 'Same',
        description: '',
        headings: [],
      }));
      expect(rankSitePages(twins, 'same').map((hit) => hit.page.path)).toEqual([
        '/a/x/',
        '/b/x/',
        '/ccc/x/',
      ]);
    });
    await scenario('no letters or digits, or no match', async () => {
      const empty = await run('site.search', { query: '?!' });
      expect(empty.ok ? '' : empty.error.code).toBe('invalid-input');
      expect((await output('site.search', { query: 'zzzz' })).results).toEqual([]);
      const over = await run('site.search', { query: 'card', limit: 51 });
      expect(over.ok ? '' : over.error.code).toBe('invalid-input');
    });
  });

  it('reads the manifest once per binding and refuses a broken one', async () => {
    const assets = fakeSiteAssets();
    await output('site.search', { query: 'card' }, assets);
    await output('site.pages', {}, assets);
    expect(assets.requested.filter((path) => path === '/md-manifest.json')).toHaveLength(1);
    for (const body of [null, '{ not json', '{"twins":{}}', '{"pages":[{"path":"/../x/"}]}']) {
      const broken = fakeSiteAssets({ files: { '/md-manifest.json': body } });
      const outcome = await run('site.pages', {}, broken);
      expect(outcome.ok ? '' : outcome.error.code, String(body)).toBe('operation-failed');
    }
  });

  it('keeps only safe manifest entries', () => {
    const pages = siteIndexPages({
      pages: [
        { path: '/ok/', twin: '/ok.md', title: 'Ok', headings: ['A', 7, ''] },
        { path: '/ok/', twin: '/ok.md', title: 'Duplicate' },
        { path: '/../up/', twin: '/up.md' },
        { path: '/up/', twin: '/../up.md' },
        { path: '/abs/', twin: 'https://evil.example/x.md' },
        { path: '/noslash', twin: '/noslash.md' },
        'nope',
      ],
    });
    expect(pages).toEqual([
      { path: '/ok/', twin: '/ok.md', title: 'Ok', description: '', headings: ['A'] },
    ]);
  });

  it('normalizes paths without a manifest', () => {
    expect(normalizeSitePath('/')).toEqual({ ok: true, route: '/' });
    expect(normalizeSitePath('/a/b')).toEqual({ ok: true, route: '/a/b/' });
    expect(
      normalizeSitePath('https://preview.texuli.pages.dev/a/', 'https://preview.texuli.pages.dev')
    ).toEqual({
      ok: true,
      route: '/a/',
    });
    expect(normalizeSitePath('/a/..').ok).toBe(false);
  });

  it('answer over the stateless MCP handler with the request’s site context', async () => {
    const handle = createMcpHandler({ mode: 'stateless', runtimes: REMOTE_RUNTIMES });
    const listed = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as Json;
    const names = listed.result.tools.map((tool: Json) => tool.name);
    for (const name of SITE_OPS) expect(names).toContain(name);
    const site = { assets: fakeSiteAssets() };
    const read = (await handle(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'site.read', arguments: { path: '/component-pages/card/' } },
      },
      { site }
    )) as Json;
    expect(read.result.isError).toBeUndefined();
    expect(read.result.structuredContent.markdown).toContain('## Props');
    const without = (await handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'site.read', arguments: { path: '/' } },
    })) as Json;
    expect(without.result.isError).toBe(true);
    expect(JSON.parse(without.result.content[0].text).code).toBe('runtime-unavailable');
    // The local handler lists none of them.
    const local = createMcpHandler({ mode: 'stateless' });
    const localList = (await local({ jsonrpc: '2.0', id: 4, method: 'tools/list' })) as Json;
    for (const name of SITE_OPS)
      expect(localList.result.tools.map((tool: Json) => tool.name)).not.toContain(name);
  });
});
