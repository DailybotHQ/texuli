// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { AEO_CONFIG, auditAeo, collectAeo, distPathFor, renderMarkdown } from '../audit-aeo.mjs';

const sha256 = (text: string) => `sha256:${createHash('sha256').update(text).digest('hex')}`;

/** A green fixture surface: every shipped agent surface present and true. */
function greenSurface() {
  const llmsLinks = [
    'https://texuli.com/guides/theming/',
    'https://texuli.com/component-pages/button/',
  ];
  const llmsTxt = ['# Texuli', '', ...llmsLinks.map((link) => `- [x](${link})`), ''].join('\n');
  const skills = {
    skills: [
      {
        name: 'texuli',
        url: 'https://texuli.com/skill-pack/SKILL.md',
        digest: null as string | null,
      },
    ],
  };
  const skillBody = '---\nname: texuli\n---\nSkill body.';
  skills.skills[0]!.digest = sha256(skillBody);
  const twins = {
    '/guides/theming/': '/guides/theming.md',
    '/guides/': '/guides.md',
    '/component-pages/button/': '/component-pages/button.md',
  };
  return {
    distDir: 'unused',
    llmsTxt,
    llmsComponents: '# Components\n\n- [button](/component-pages/button/)',
    llmsFull: '# Texuli full',
    wellKnown: {
      'ai-catalog.json': JSON.stringify({
        entries: [
          { identifier: 'urn:air:content:llms', url: 'https://texuli.com/llms.txt' },
          { identifier: 'urn:air:package:npm', url: 'https://www.npmjs.com/package/texuli' },
        ],
      }),
      'api-catalog': JSON.stringify({
        linkset: [
          {
            anchor: 'https://texuli.com/',
            links: [
              { rel: 'service-doc', href: 'https://texuli.com/llms.txt', type: 'text/plain' },
            ],
          },
        ],
      }),
      'mcp/server-card.json': JSON.stringify({
        serverInfo: { name: 'texuli' },
        transport: { stdio: { launch: 'pnpm exec tsx src/mcp/stdio.ts' } },
        tools: [{ name: 'catalog' }],
      }),
      'agent-skills/index.json': JSON.stringify(skills),
    },
    mdManifest: JSON.stringify({ twins }),
    robots: [
      'User-agent: *',
      'Allow: /',
      '',
      'Sitemap: https://texuli.com/sitemap.xml',
      ...Array.from({ length: 16 }, (_, i) => `User-agent: Crawler${i}\nAllow: /`),
      '',
    ].join('\n'),
    topRoutes: ['guides/', 'component-pages/'],
    familyPages: {
      guides: ['/guides/', '/guides/theming/'],
      'component-pages': ['/component-pages/button/'],
      foundation: [],
      skill: [],
    },
    readBytes: (relative: string) =>
      relative === 'skill-pack/SKILL.md' ? Buffer.from(skillBody) : null,
    exists: () => true,
  };
}

const criticals = (result: {
  findings: { severity: string; category: string; detail: string }[];
}) => result.findings.filter((finding) => finding.severity === 'critical');

describe('auditAeo on a green fixture surface', () => {
  it('finds zero criticals, three planned rows and counts the surface', () => {
    const result = auditAeo(greenSurface());
    expect(criticals(result).map((finding) => `${finding.category}: ${finding.detail}`)).toEqual(
      []
    );
    expect(result.summary.findings.critical).toBe(0);
    expect(result.summary.findings.planned).toBe(3);
    expect(result.summary.surface).toEqual({ topRoutes: 2, twins: 3, wellKnownFiles: 4 });
  });

  it('renders a green verdict and the planned section', () => {
    const report = renderMarkdown(auditAeo(greenSurface()));
    expect(report).toContain('GREEN — the agent surface holds');
    expect(report).toContain('Content-Signal');
  });

  it('warns on an indexed top route outside the nav-curated llms.txt', () => {
    const surface = greenSurface();
    surface.topRoutes = ['guides/', 'search/', 'docs-shell/'];
    const warnings = auditAeo(surface).findings.filter(
      (finding) => finding.severity === 'warning' && finding.category === 'llms'
    );
    expect(warnings.map((finding) => finding.page).sort()).toEqual(['docs-shell/', 'search/']);
  });
});

describe('auditAeo red cases', () => {
  it('flags a missing or shim llms.txt and a dead llms link', () => {
    const missing = greenSurface();
    missing.llmsTxt = null;
    expect(
      criticals(auditAeo(missing)).some((finding) => finding.detail.includes('llms.txt is missing'))
    ).toBe(true);

    const shim = greenSurface();
    shim.llmsTxt = '<!doctype html><html><body>redirect</body></html>';
    expect(criticals(auditAeo(shim)).some((finding) => finding.detail.includes('HTML shim'))).toBe(
      true
    );

    const dead = greenSurface();
    dead.llmsTxt = '- [x](https://texuli.com/guides/ghost/)';
    dead.exists = () => false;
    expect(
      criticals(auditAeo(dead)).some((finding) => finding.detail.includes('does not serve'))
    ).toBe(true);

    const absent = { ...greenSurface(), llmsComponents: null, llmsFull: null };
    const findings = criticals(auditAeo(absent)).filter((finding) => finding.category === 'llms');
    expect(findings.length).toBeGreaterThanOrEqual(2);
  });

  it('flags unparseable or unresolvable .well-known files and digest drift', () => {
    const bad = greenSurface();
    bad.wellKnown['ai-catalog.json'] = '{"entries":';
    expect(
      criticals(auditAeo(bad)).some(
        (finding) => finding.page === 'ai-catalog.json' && finding.detail.includes('does not parse')
      )
    ).toBe(true);

    const advertises = greenSurface();
    advertises.wellKnown['ai-catalog.json'] = JSON.stringify({
      entries: [{ identifier: 'urn:air:content:ghost', url: 'https://texuli.com/ghost.txt' }],
    });
    advertises.exists = (path: string) => path !== '/ghost.txt';
    expect(
      criticals(auditAeo(advertises)).some((finding) => finding.detail.includes('does not serve'))
    ).toBe(true);

    const linkset = greenSurface();
    linkset.wellKnown['api-catalog'] = JSON.stringify({
      linkset: [
        {
          anchor: 'https://texuli.com/',
          links: [{ rel: 'item', href: 'https://texuli.com/ghost.json' }],
        },
      ],
    });
    linkset.exists = (path: string) => path !== '/ghost.json';
    expect(
      criticals(auditAeo(linkset)).some((finding) => finding.detail.includes('linkset advertises'))
    ).toBe(true);

    const card = greenSurface();
    card.wellKnown['mcp/server-card.json'] = JSON.stringify({ serverInfo: {} });
    const cardFindings = criticals(auditAeo(card)).filter(
      (finding) => finding.page === 'mcp/server-card.json'
    );
    expect(cardFindings.some((finding) => finding.detail.includes('serverInfo.name'))).toBe(true);
    expect(cardFindings.some((finding) => finding.detail.includes('no tools'))).toBe(true);
    expect(cardFindings.some((finding) => finding.detail.includes('transport.stdio.launch'))).toBe(
      true
    );

    const drifted = greenSurface();
    drifted.readBytes = () => Buffer.from('changed body');
    expect(
      criticals(auditAeo(drifted)).some((finding) => finding.detail.includes('digest drift'))
    ).toBe(true);
  });

  it('flags twin drift: a promised twin missing and a page without a manifest entry', () => {
    const missing = greenSurface();
    missing.mdManifest = JSON.stringify({
      twins: {
        ...JSON.parse(greenSurface().mdManifest),
        '/guides/position/': '/guides/position.md',
      },
    });
    missing.exists = (path: string) => path !== '/guides/position.md';
    expect(
      criticals(auditAeo(missing)).some((finding) => finding.detail.includes('dist lacks it'))
    ).toBe(true);

    const uncovered = greenSurface();
    uncovered.familyPages.guides = ['/guides/', '/guides/theming/', '/guides/position/'];
    expect(
      criticals(auditAeo(uncovered)).some((finding) =>
        finding.detail.includes('without a manifest twin')
      )
    ).toBe(true);

    const noManifest = greenSurface();
    noManifest.mdManifest = null;
    expect(
      criticals(auditAeo(noManifest)).some((finding) =>
        finding.detail.includes('md-manifest.json is missing')
      )
    ).toBe(true);
  });

  it('flags a robots policy that shrinks, forbids or lies', () => {
    const shrunk = greenSurface();
    shrunk.robots = 'User-agent: *\nAllow: /\n\nSitemap: https://texuli.com/sitemap.xml\n';
    expect(
      criticals(auditAeo(shrunk)).some((finding) => finding.detail.includes('user-agent groups'))
    ).toBe(true);

    const noSitemap = greenSurface();
    noSitemap.robots = greenSurface().robots.replace(
      'Sitemap: https://texuli.com/sitemap.xml\n',
      ''
    );
    expect(
      criticals(auditAeo(noSitemap)).some((finding) => finding.detail.includes('no Sitemap line'))
    ).toBe(true);

    const forbidding = greenSurface();
    forbidding.robots = `${greenSurface().robots}User-agent: *\nDisallow: /private/\n`;
    expect(
      criticals(auditAeo(forbidding)).some((finding) => finding.detail.includes('Disallow exists'))
    ).toBe(true);
  });
});

describe('pure helpers', () => {
  it('resolves on-site URLs to dist paths and marks off-site hosts', () => {
    expect(distPathFor('https://texuli.com/guides/', AEO_CONFIG)).toBe('/guides/');
    expect(distPathFor('https://www.npmjs.com/package/texuli', AEO_CONFIG)).toBe(
      'off-site:www.npmjs.com'
    );
    expect(distPathFor('not a url', AEO_CONFIG)).toBeNull();
  });
});

describe('collectAeo over a fixture directory', () => {
  const dist = mkdtempSync(join(tmpdir(), 'texuli-audit-aeo-'));

  afterAll(() => {
    rmSync(dist, { recursive: true, force: true });
  });

  it('walks top routes, family pages and reads the surface files', () => {
    mkdirSync(join(dist, 'guides', 'theming'), { recursive: true });
    mkdirSync(join(dist, '_astro'), { recursive: true });
    writeFileSync(join(dist, 'guides', 'index.html'), '<html></html>');
    writeFileSync(join(dist, 'guides', 'theming', 'index.html'), '<html></html>');
    writeFileSync(join(dist, 'guides.md'), '# Guides');
    writeFileSync(join(dist, '_astro', 'index.html'), '<html></html>');
    writeFileSync(join(dist, 'guides', 'theming.md'), '# Theming');
    writeFileSync(
      join(dist, 'md-manifest.json'),
      JSON.stringify({
        twins: { '/guides/theming/': '/guides/theming.md', '/guides/': '/guides.md' },
      })
    );
    writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\n');
    mkdirSync(join(dist, '.well-known', 'mcp'), { recursive: true });
    mkdirSync(join(dist, '.well-known', 'agent-skills'), { recursive: true });
    writeFileSync(join(dist, '.well-known', 'ai-catalog.json'), '{}');
    writeFileSync(join(dist, '.well-known', 'api-catalog'), '{}');
    writeFileSync(join(dist, '.well-known', 'mcp', 'server-card.json'), '{}');
    writeFileSync(join(dist, '.well-known', 'agent-skills', 'index.json'), '{}');

    const surface = collectAeo(dist);
    expect(surface.topRoutes).toEqual(['guides/']);
    expect(surface.familyPages.guides).toEqual(['/guides/', '/guides/theming/']);
    expect(surface.mdManifest).toContain('twins');
    expect(surface.wellKnown['ai-catalog.json']).toBe('{}');
    expect(surface.readBytes('robots.txt')).not.toBeNull();

    const result = auditAeo(surface);
    expect(
      criticals(result).some((finding) => finding.detail.includes('root llms.txt is missing'))
    ).toBe(true);
    expect(
      criticals(result).some((finding) => finding.detail.includes('without a manifest twin'))
    ).toBe(false);
  });
});
