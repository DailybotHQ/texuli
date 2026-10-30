// @vitest-environment node
/**
 * Agent discovery generators (PLAN_011 T-ar-discovery): the typed source in
 * `src/components/seo/agent-discovery.ts`, its build integration, the
 * `Link` lines and header rules the CSP integration writes into
 * `dist/_headers`, and the robots directives. The built files and served
 * headers are checked by `tests/e2e/site-agent-discovery.spec.ts`.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS_VERSION, texuliOps } from '@texuli/tools/ops';
import { afterAll, describe, expect, it } from 'vitest';
import {
  MCP_BATCH_MAX,
  MCP_BODY_MAX,
  MCP_RATE_POLICY,
} from '../../../functions/_lib/mcp-endpoint.ts';
import { linkHeaderLine } from '../src/components/security/csp.ts';
import {
  agentCard,
  apiCatalog,
  authMd,
  CONTENT_SIGNALS,
  contentSignalDirective,
  DISCOVERY_FILE_TYPES,
  DISCOVERY_PATHS,
  type DiscoveryFacts,
  discoveryFiles,
  discoveryHeaderRules,
  discoveryLinks,
  formatLinkHeader,
  jwks,
  oauthAuthorizationServer,
  oauthProtectedResource,
  poppyManifest,
  securityContactFrom,
  securityTxt,
  twinCandidate,
} from '../src/components/seo/agent-discovery.ts';
import { buildRobots } from '../src/components/seo/seo.ts';
import { discoveryFacts } from '../src/integrations/agent-discovery.ts';
import { stripDirectivesForStrictParsers } from '../src/lib/robots-variants.ts';

const ORIGIN = 'https://texuli.com';
const NOW = new Date('2026-10-30T12:34:56.789Z');

function facts(overrides: Partial<DiscoveryFacts> = {}): DiscoveryFacts {
  return {
    origin: ORIGIN,
    toolsVersion: TOOLS_VERSION,
    operations: texuliOps.list({ runtimes: ['edge'] }),
    securityContact: 'security@example.com',
    now: NOW,
    openapi: false,
    mcpLimits: { capacity: 60, windowSeconds: 60, batchMax: 10, bodyMax: 256 * 1024 },
    ...overrides,
  };
}

const temp: string[] = [];
afterAll(() => {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true });
});

describe('robots directives', () => {
  it('puts the content signals in every group and the Agentmap at the ARD catalog', () => {
    expect(contentSignalDirective()).toBe('Content-Signal: ai-train=yes, search=yes, ai-input=yes');
    expect(Object.keys(CONTENT_SIGNALS)).toEqual(['ai-train', 'search', 'ai-input']);
    const robots = buildRobots(`${ORIGIN}/sitemap.xml`);
    const groups = robots.split(/\n(?=User-agent: )/).filter((g) => g.startsWith('User-agent: '));
    expect(groups.length).toBe(17);
    for (const group of groups) expect(group, group).toContain(contentSignalDirective());
    expect(robots).toContain(
      'User-agent: *\nAllow: /\nContent-Signal: ai-train=yes, search=yes, ai-input=yes\n'
    );
    expect(robots).toMatch(/^Agentmap: https:\/\/texuli\.com\/\.well-known\/ai-catalog\.json$/m);
    // No directive outside a group: every Content-Signal line follows an Allow line.
    expect(robots).not.toMatch(/(^|\n\n)Content-Signal:/);
  });

  it('gives strict parsers the same policy without the two non-standard directives', () => {
    const robots = buildRobots(`${ORIGIN}/sitemap.xml`);
    const stripped = stripDirectivesForStrictParsers(robots);
    expect(stripped).not.toMatch(/^(Content-Signal|Agentmap):/im);
    expect(stripped).toContain('User-agent: *\nAllow: /');
    expect(stripped).toMatch(/^Sitemap: https:\/\/texuli\.com\/sitemap\.xml$/m);
    expect([...stripped.matchAll(/^User-agent: /gm)].length).toBe(17);
  });
});

describe('Link headers (RFC 8288)', () => {
  it('lists api-catalog, describedby and ai-catalog, service-desc only with OpenAPI, and the twin', () => {
    expect(formatLinkHeader(discoveryLinks({ openapi: false }))).toBe(
      '</.well-known/api-catalog>; rel="api-catalog", </llms.txt>; rel="describedby", </.well-known/ai-catalog.json>; rel="ai-catalog"'
    );
    expect(formatLinkHeader(discoveryLinks({ openapi: true, twin: '/guides/theming.md' }))).toBe(
      '</.well-known/api-catalog>; rel="api-catalog", </openapi.json>; rel="service-desc", </llms.txt>; rel="describedby", </.well-known/ai-catalog.json>; rel="ai-catalog", </guides/theming.md>; rel="alternate"; type="text/markdown"'
    );
  });

  it('keeps every target inside its angle brackets', () => {
    const value = formatLinkHeader(discoveryLinks({ openapi: true, twin: '/index.md' }));
    for (const part of value.split(', '))
      expect(part).toMatch(/^<\/[^<>\s]*>; rel="[a-z-]+"(; type="[a-z/+-]+")?$/);
    for (const href of [
      '/a>; rel="x"',
      '/a b',
      '/a,b',
      'javascript:alert(1)',
      '//evil.example/x',
      '/a"b',
    ])
      expect(() => formatLinkHeader([{ href, rel: 'alternate' }]), href).toThrow();
    expect(() => formatLinkHeader([{ href: '/a', rel: 'x"; y="z' }])).toThrow();
  });

  it('maps page routes to twin candidates', () => {
    expect(twinCandidate('/')).toBe('/index.md');
    expect(twinCandidate('/index.html')).toBe('/index.md');
    expect(twinCandidate('/guides/theming/')).toBe('/guides/theming.md');
    expect(twinCandidate('/guides/theming/index.html')).toBe('/guides/theming.md');
    expect(twinCandidate('/404.html')).toBeUndefined();
    expect(twinCandidate('guides/')).toBeUndefined();
  });

  it('writes the _headers Link line from what the build holds', () => {
    const built = new Set(['/guides/theming.md', '/openapi.json']);
    const exists = (path: string) => built.has(path);
    expect(linkHeaderLine('/guides/theming/', exists)).toBe(
      `\n  Link: ${formatLinkHeader(discoveryLinks({ openapi: true, twin: '/guides/theming.md' }))}`
    );
    expect(linkHeaderLine('/guides/theming/index.html', exists)).toContain(
      '</guides/theming.md>; rel="alternate"; type="text/markdown"'
    );
    const root = linkHeaderLine('/', () => false);
    expect(root).toBe(`\n  Link: ${formatLinkHeader(discoveryLinks({ openapi: false }))}`);
    expect(root).not.toContain('service-desc');
    expect(root).not.toContain('alternate');
  });
});

describe('discovery documents', () => {
  it('serves the API catalog as a linkset with the MCP anchor and an honest service-desc', () => {
    const without = apiCatalog(facts()) as {
      linkset: { anchor: string; links: { rel: string; href: string }[] }[];
    };
    expect(without.linkset.map((set) => set.anchor)).toEqual([`${ORIGIN}/`, `${ORIGIN}/mcp`]);
    expect(without.linkset[0]?.links.some((link) => link.rel === 'service-desc')).toBe(false);
    const hrefs = without.linkset.flatMap((set) => set.links.map((link) => link.href));
    for (const href of hrefs) expect(href).toMatch(/^https:\/\/texuli\.com\//);
    expect(hrefs).toContain(`${ORIGIN}/llms-full.txt`);
    expect(hrefs).toContain(`${ORIGIN}/.well-known/mcp/server-card.json`);
    const withOpenapi = apiCatalog(facts({ openapi: true })) as typeof without;
    expect(withOpenapi.linkset[0]?.links[0]).toMatchObject({
      rel: 'service-desc',
      href: `${ORIGIN}/openapi.json`,
    });
  });

  it('states anonymous read-only access in the OAuth stubs, with a non-empty read scope', () => {
    const as = oauthAuthorizationServer(facts()) as Record<string, unknown> & {
      agent_auth: Record<string, unknown>;
    };
    const prm = oauthProtectedResource(facts()) as Record<string, unknown>;
    expect(as.issuer).toBe(ORIGIN);
    for (const key of [
      'authorization_endpoint',
      'token_endpoint',
      'jwks_uri',
      'grant_types_supported',
      'response_types_supported',
    ])
      expect(as[key], key).toBeTruthy();
    expect(as.jwks_uri).toBe(`${ORIGIN}${DISCOVERY_PATHS.jwks}`);
    expect(jwks()).toEqual({ keys: [] });
    expect(as.scopes_supported).toEqual(['read']);
    expect(as.agent_auth.identity_types_supported).toEqual(['anonymous']);
    expect(as.agent_auth.skill).toBe(`${ORIGIN}/auth.md`);
    expect(prm).toMatchObject({
      resource: ORIGIN,
      authorization_servers: [ORIGIN],
      scopes_supported: ['read'],
      bearer_methods_supported: ['header'],
    });
    // The PRM issuer matches the AS issuer (auth.md discovery rule).
    expect((prm.authorization_servers as string[])[0]).toBe(as.issuer);
    for (const doc of [as, prm, as.agent_auth]) {
      expect(doc._comment).toMatch(/anonymous/i);
      expect(doc._comment).toMatch(/read-only|nothing to register/i);
    }
    expect(DISCOVERY_PATHS.oauthProtectedResource).toBe('/.well-known/oauth-protected-resource');
  });

  it('writes /auth.md with an auth.md H1, the MCP endpoint and the enforced limits', () => {
    const text = authMd(
      facts({
        mcpLimits: {
          capacity: MCP_RATE_POLICY.capacity,
          windowSeconds: MCP_RATE_POLICY.windowSeconds,
          batchMax: MCP_BATCH_MAX,
          bodyMax: MCP_BODY_MAX,
        },
      })
    );
    expect(text.split('\n')[0]).toMatch(/^# .*auth\.md/);
    expect(text).toContain('`https://texuli.com/mcp`');
    expect(text).toContain('`https://texuli.com/.well-known/mcp`');
    expect(text).toContain(
      `${MCP_RATE_POLICY.capacity} MCP messages per client per ${MCP_RATE_POLICY.windowSeconds} seconds`
    );
    expect(text).toContain(`at most ${MCP_BATCH_MAX})`);
    expect(text).toContain(`${MCP_BODY_MAX / 1024} KB`);
    expect(text).toContain('Retry-After');
    expect(text).toMatch(/anonymous/i);
    expect(text).toContain('security@example.com');
  });

  it('writes RFC 9116 security.txt from the repository policy, expiring a year after the build', () => {
    const policy = readFileSync(
      fileURLToPath(new URL('../../../SECURITY.md', import.meta.url)),
      'utf8'
    );
    const contact = securityContactFrom(policy);
    expect(contact).toBe('security@dailybot.com');
    expect(() => securityContactFrom('# Policy\n\nNo address here.')).toThrow();
    const text = securityTxt(facts({ securityContact: contact }));
    const fields = Object.fromEntries(
      text
        .split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 2)])
    );
    expect(fields).toEqual({
      Contact: 'mailto:security@dailybot.com',
      Expires: '2027-10-30T12:34:56Z',
      Canonical: 'https://texuli.com/.well-known/security.txt',
      Policy: 'https://github.com/DailybotHQ/texuli/blob/main/SECURITY.md',
      'Preferred-Languages': 'en',
    });
  });

  it('points the A2A card at the MCP server, with the edge operations as skills', () => {
    const card = agentCard(facts()) as Record<string, unknown> & {
      supportedInterfaces: { url: string; protocolBinding: string }[];
      capabilities: Record<string, unknown>;
      skills: { id: string; name: string; description: string; tags: string[] }[];
    };
    expect(card.name).toBe('Texuli');
    expect(card.version).toBe(TOOLS_VERSION);
    expect(card.url).toBe(`${ORIGIN}/mcp`);
    expect(card.supportedInterfaces).toEqual([{ url: `${ORIGIN}/mcp`, protocolBinding: 'MCP' }]);
    expect(String(card._comment)).toMatch(/no A2A agent/);
    // A2A capability flags: flat booleans, all off (no streaming, no push).
    for (const value of Object.values(card.capabilities)) expect(value).toBe(false);
    const edge = texuliOps.list({ runtimes: ['edge'] }).map((op) => op.name);
    expect(card.skills.map((skill) => skill.id)).toEqual(edge);
    expect(edge).not.toContain('document.export');
    for (const skill of card.skills) {
      for (const field of [skill.id, skill.name, skill.description]) {
        expect(typeof field).toBe('string');
        expect(field.length).toBeGreaterThan(0);
      }
      for (const tag of skill.tags) expect(typeof tag).toBe('string');
    }
  });

  it('declares website-only Personal Agent Protocol discovery for the served domain', () => {
    expect(poppyManifest(facts())).toMatchObject({
      protocol_version: '0.1',
      organization: { name: 'Texuli', domain: 'texuli.com' },
      web: {},
    });
    const manifest = poppyManifest(facts()) as Record<string, unknown>;
    for (const key of ['agent', 'apis', 'auth']) expect(manifest[key], key).toBeUndefined();
  });
});

describe('the generated set and its _headers rules', () => {
  it('builds every file with its content type, and parses every JSON body', () => {
    const files = discoveryFiles(facts());
    expect(files.map((file) => file.path)).toEqual(DISCOVERY_FILE_TYPES.map((type) => type.path));
    const byPath = Object.fromEntries(files.map((file) => [file.path, file]));
    expect(byPath['/.well-known/api-catalog']?.contentType).toBe('application/linkset+json');
    expect(byPath['/auth.md']?.contentType).toBe('text/markdown; charset=utf-8');
    expect(byPath['/.well-known/security.txt']?.contentType).toBe('text/plain; charset=utf-8');
    for (const file of files)
      if (file.contentType.includes('json'))
        expect(() => JSON.parse(file.body), file.path).not.toThrow();
    expect(new Set(files.map((file) => file.path)).size).toBe(files.length);
  });

  it('writes one rule per file: content type, CORS on public JSON and the ARD, nosniff', () => {
    const rules = discoveryHeaderRules();
    const rule = (path: string) => rules.find((text) => text.startsWith(`${path}\n`)) ?? '';
    expect(rule('/.well-known/api-catalog')).toContain(
      '\n  Content-Type: application/linkset+json\n'
    );
    expect(rule('/.well-known/ai-catalog.json')).toContain('\n  Access-Control-Allow-Origin: *\n');
    expect(rule('/.well-known/agent-card.json')).toContain('\n  Access-Control-Allow-Origin: *\n');
    expect(rule('/auth.md')).toContain('\n  Content-Type: text/markdown; charset=utf-8\n');
    expect(rule('/auth.md')).not.toContain('Access-Control-Allow-Origin');
    expect(rule('/llms-full.txt')).toContain('\n  Content-Type: text/plain; charset=utf-8\n');
    for (const text of rules) {
      expect(text).toContain('\n  X-Content-Type-Options: nosniff');
      // Cloudflare's _headers grammar: a path line, then indented "Name: value" lines.
      const [path, ...lines] = text.split('\n');
      expect(path).toMatch(/^\/[^\s]*$/);
      for (const line of lines) expect(line).toMatch(/^ {2}[A-Za-z-]+: \S.*$/);
    }
  });

  it('reads its facts from the repository and the build', () => {
    const out = mkdtempSync(join(tmpdir(), 'texuli-discovery-'));
    temp.push(out);
    return (async () => {
      const without = await discoveryFacts(out, 'https://texuli.com/', NOW);
      expect(without).toMatchObject({
        origin: ORIGIN,
        toolsVersion: TOOLS_VERSION,
        securityContact: 'security@dailybot.com',
        openapi: false,
        mcpLimits: {
          capacity: MCP_RATE_POLICY.capacity,
          windowSeconds: MCP_RATE_POLICY.windowSeconds,
          batchMax: MCP_BATCH_MAX,
          bodyMax: MCP_BODY_MAX,
        },
      });
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'openapi.json'), '{}');
      expect((await discoveryFacts(out, 'https://texuli.com', NOW)).openapi).toBe(true);
    })();
  });
});
