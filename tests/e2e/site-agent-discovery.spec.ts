/// <reference types="node" />
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, normalize } from 'node:path';
import { expect, test } from '@playwright/test';
import { DIST } from './support/site.ts';

/*
 * texuli.com agent discovery on the built site (`pnpm build` first;
 * PLAN_011 T-ar-discovery). Cloudflare Pages applies `dist/_headers` at the
 * edge, which a local static server does not, so this spec serves `dist`
 * with the generated rules applied: every rule this build writes is an
 * exact path (no splats or placeholders), so a path's headers are its
 * rule's lines. The `_headers` text itself is asserted too. The generators
 * are unit-tested in apps/website/tests/agent-discovery.test.ts.
 */

const SITE = 'https://texuli.com';

/** `_headers` → exact path → header lines. */
function headerRules(): Map<string, [string, string][]> {
  const rules = new Map<string, [string, string][]>();
  let path: string | undefined;
  for (const line of readFileSync(join(DIST, '_headers'), 'utf8').split('\n')) {
    if (!line.trim()) {
      path = undefined;
    } else if (!line.startsWith(' ')) {
      path = line.trim();
      rules.set(path, []);
    } else if (path) {
      const colon = line.indexOf(':');
      rules.get(path)?.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()]);
    }
  }
  return rules;
}

let server: Server | undefined;
let origin = '';
let rules = new Map<string, [string, string][]>();

test.beforeAll(async () => {
  if (!existsSync(join(DIST, '_headers'))) throw new Error('Run `pnpm build` before this spec.');
  rules = headerRules();
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '__outside__');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      createReadStream(join(DIST, '404.html')).pipe(response);
      return;
    }
    // Pages' default for an unknown extension, then the rule's own headers.
    const headers: Record<string, string> = {
      'content-type': file.endsWith('.html')
        ? 'text/html; charset=utf-8'
        : file.endsWith('.txt')
          ? 'text/plain; charset=utf-8'
          : 'application/octet-stream',
    };
    for (const [name, value] of rules.get(path) ?? []) headers[name.toLowerCase()] = value;
    response.writeHead(200, headers);
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server?.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(
  () =>
    new Promise<void>((done) => {
      if (!server) return done();
      server.close(() => done());
    })
);

const fetchPath = (path: string, init?: RequestInit) => fetch(`${origin}${path}`, init);

test('robots.txt declares the content signals in every group and the Agentmap', async () => {
  const response = await fetchPath('/robots.txt');
  expect(response.status).toBe(200);
  const robots = await response.text();
  const groups = robots.split(/\n(?=User-agent: )/).filter((g) => g.startsWith('User-agent: '));
  expect(groups.length).toBeGreaterThanOrEqual(17);
  for (const group of groups)
    expect(group).toContain('Content-Signal: ai-train=yes, search=yes, ai-input=yes');
  expect(robots).toContain(`\nAgentmap: ${SITE}/.well-known/ai-catalog.json\n`);
});

test('the home page and a docs page send the discovery Link header', async () => {
  const openapi = existsSync(join(DIST, 'openapi.json'));
  const home = await fetchPath('/');
  expect(home.status).toBe(200);
  const link = home.headers.get('link') ?? '';
  expect(link).toContain('</.well-known/api-catalog>; rel="api-catalog"');
  expect(link).toContain('</llms.txt>; rel="describedby"');
  expect(link).toContain('</.well-known/ai-catalog.json>; rel="ai-catalog"');
  expect(link.includes('</openapi.json>; rel="service-desc"')).toBe(openapi);
  expect(link.includes('</index.md>; rel="alternate"')).toBe(existsSync(join(DIST, 'index.md')));
  for (const part of link.split(', ')) expect(part).toMatch(/^<\/[^<>\s]*>; rel="[a-z-]+"/);
  // The CSP still rides on the same rule.
  expect(home.headers.get('content-security-policy')).toContain("default-src 'none'");
  const html = await home.text();
  expect(html).toContain('<link rel="ai-catalog" href="/.well-known/ai-catalog.json">');

  const docs = await fetchPath('/guides/theming/');
  expect(docs.headers.get('link')).toContain(
    '</guides/theming.md>; rel="alternate"; type="text/markdown"'
  );
  // Every HTML rule in _headers carries the Link line.
  const htmlRules = [...rules.entries()].filter(([, lines]) =>
    lines.some(([name]) => name === 'Content-Security-Policy')
  );
  expect(htmlRules.length).toBeGreaterThan(100);
  for (const [path, lines] of htmlRules)
    expect(
      lines.some(([name, value]) => name === 'Link' && value.includes('rel="api-catalog"')),
      path
    ).toBe(true);
});

test('the API catalog is an RFC 9727 linkset served as application/linkset+json', async () => {
  const response = await fetchPath('/.well-known/api-catalog');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/linkset+json');
  const body = (await response.json()) as {
    linkset: { anchor: string; links: { rel: string; href: string }[] }[];
  };
  expect(body.linkset.map((set) => set.anchor)).toEqual([`${SITE}/`, `${SITE}/mcp`]);
  for (const set of body.linkset)
    for (const link of set.links) {
      const path = new URL(link.href).pathname;
      expect((await fetchPath(path)).status, link.href).toBe(200);
    }
});

test('the ARD catalog allows any origin and lists the remote MCP', async () => {
  const response = await fetchPath('/.well-known/ai-catalog.json');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  const catalog = (await response.json()) as { entries: { url: string }[] };
  expect(catalog.entries.map((entry) => entry.url)).toContain(`${SITE}/mcp`);
});

test('the OAuth discovery stubs say anonymous and read-only, with the read scope', async () => {
  const as = await fetchPath('/.well-known/oauth-authorization-server');
  expect(as.status).toBe(200);
  expect(as.headers.get('content-type')).toBe('application/json');
  const asBody = (await as.json()) as Record<string, unknown>;
  expect(asBody).toMatchObject({ issuer: SITE, scopes_supported: ['read'] });
  expect(String(asBody._comment)).toMatch(/anonymous/);
  const jwks = await fetchPath(new URL(String(asBody.jwks_uri)).pathname);
  expect(await jwks.json()).toEqual({ keys: [] });

  const prm = await fetchPath('/.well-known/oauth-protected-resource');
  expect(prm.status).toBe(200);
  expect(prm.headers.get('content-type')).toBe('application/json');
  const prmBody = (await prm.json()) as Record<string, unknown>;
  expect(prmBody).toMatchObject({
    resource: SITE,
    authorization_servers: [SITE],
    scopes_supported: ['read'],
    bearer_methods_supported: ['header'],
  });
  expect(String(prmBody._comment)).toMatch(/anonymous/);
  expect((await fetchPath('/.well-known/oauth-protected-resource.json')).status).toBe(404);
});

test('/auth.md is Markdown about anonymous access, the MCP endpoint and its limits', async () => {
  const response = await fetchPath('/auth.md');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
  const text = await response.text();
  expect(text.split('\n')[0]).toMatch(/^# .*auth\.md/);
  expect(text).toContain(`\`${SITE}/mcp\``);
  expect(text).toMatch(/\d+ MCP messages per client per \d+ seconds/);
  expect(text).toContain('Retry-After');
});

test('security.txt follows RFC 9116 and expires about a year after the build', async () => {
  const response = await fetchPath('/.well-known/security.txt');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  const text = await response.text();
  expect(text).toMatch(/^Contact: mailto:security@dailybot\.com$/m);
  expect(text).toContain(`\nCanonical: ${SITE}/.well-known/security.txt\n`);
  expect(text).toMatch(
    /^Policy: https:\/\/github\.com\/DailybotHQ\/texuli\/blob\/main\/SECURITY\.md$/m
  );
  const expires = Date.parse(/^Expires: (.+)$/m.exec(text)?.[1] ?? '');
  const days = (expires - Date.now()) / 86_400_000;
  expect(days).toBeGreaterThan(300);
  expect(days).toBeLessThanOrEqual(366);
});

test('the A2A card points at the MCP server with string skills', async () => {
  const response = await fetchPath('/.well-known/agent-card.json');
  expect(response.status).toBe(200);
  expect(response.headers.get('access-control-allow-origin')).toBe('*');
  const card = (await response.json()) as {
    name: string;
    version: string;
    description: string;
    url: string;
    supportedInterfaces: { url: string; protocolBinding: string }[];
    capabilities: Record<string, boolean>;
    skills: { id: string; name: string; description: string }[];
  };
  expect(card.name).toBe('Texuli');
  expect(card.version).toMatch(/^\d+\.\d+\.\d+/);
  expect(card.url).toBe(`${SITE}/mcp`);
  expect(card.supportedInterfaces[0]).toEqual({ url: `${SITE}/mcp`, protocolBinding: 'MCP' });
  expect(card.skills.length).toBeGreaterThan(5);
  for (const skill of card.skills)
    for (const field of [skill.id, skill.name, skill.description])
      expect(typeof field === 'string' && field.length > 0).toBe(true);
});

test('the Personal Agent Protocol manifest declares website-only discovery', async () => {
  const response = await fetchPath('/.well-known/poppy.json');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(await response.json()).toMatchObject({
    protocol_version: '0.1',
    organization: { domain: 'texuli.com' },
    web: {},
  });
});

test('the root llms-full.txt is the same bytes as the catalog corpus', async () => {
  const root = await fetchPath('/llms-full.txt');
  expect(root.status).toBe(200);
  expect(root.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  const bytes = Buffer.from(await root.arrayBuffer());
  expect(bytes.length).toBeGreaterThan(1000);
  expect(bytes.equals(readFileSync(join(DIST, 'llms', 'llms-full.txt')))).toBe(true);
});
