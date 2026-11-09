import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { texuliOps } from '@texuli/tools/ops';
import { describe, expect, it } from 'vitest';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';
import { illustrationFor } from '../../src/components/landing/illustrations.ts';
import {
  AGENT_SURFACES,
  AGENTS_22_COPY,
  agentSurfaces,
} from '../../src/components/sections/home/agents-22/agents-content.ts';
import { wordCount } from '../../src/components/sections/home/home-content.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const json = (path: string) => JSON.parse(readFileSync(resolve(REPO, path), 'utf8'));
const source = readFileSync(
  resolve(WEBSITE, 'src/components/sections/home/agents-22/HomeAgents22.astro'),
  'utf8'
);
const markup = source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));
const styles = source.slice(source.indexOf('<style>'));
/** Packages marked in development (AGENTS.md rule 12, docs/RELEASE.md). */
const IN_DEVELOPMENT = new Set([
  '@texuli/drag',
  '@texuli/workflows',
  '@texuli/deck',
  '@texuli/slides',
  '@texuli/editor',
  '@texuli/document',
  '@texuli/pages',
  '@texuli/forms',
  '@texuli/canvas',
  '@texuli/sheets',
  '@texuli/mcp',
]);
const item = (label: string) =>
  AGENT_SURFACES.flatMap((s) => s.items).find((entry) => entry.label === label);

describe('humans and agents band copy', () => {
  it('keeps the storyboard title, a short body and the home-agents plate', () => {
    expect(AGENTS_22_COPY.title).toBe('Built for humans and agents.');
    expect(wordCount(AGENTS_22_COPY.body)).toBeLessThanOrEqual(40);
    expect(illustrationFor(AGENTS_22_COPY.art)?.variant).toBe('plate');
    expect(JSON.stringify(AGENT_SURFACES)).not.toMatch(/\d{2,}|PLAN_|cloud/i);
  });

  it('covers catalog, MCP (local and remote), skill and validation', () => {
    expect(AGENT_SURFACES.map((s) => s.id)).toEqual(['catalog', 'mcp', 'skill', 'validation']);
    expect(item('https://texuli.com/mcp')).toBeDefined();
    expect(item('npx -y @texuli/mcp')).toBeDefined();
  });
});

describe('every surface is real', () => {
  it('names a package and subpath the catalog exports', () => {
    const catalog = json('packages/catalog/package.json');
    expect(catalog.name).toBe('@texuli/catalog');
    expect(Object.keys(catalog.exports)).toContain('./validate');
  });

  it('names MCP operations the registry serves and the remote and local doors of the server card', () => {
    const served = new Set(texuliOps.list({ runtimes: ['edge'] }).map((op) => op.name));
    expect(served.has('blueprint.validate')).toBe(true);
    const card = JSON.stringify(json('apps/website/public/.well-known/mcp/server-card.json'));
    expect(card).toContain('https://texuli.com/mcp');
    expect(card).toContain('@texuli/mcp');
    expect(json('packages/mcp/package.json').name).toBe('@texuli/mcp');
  });

  it('names the skill that ships in this repository', () => {
    expect(existsSync(resolve(REPO, 'skills/texuli/SKILL.md'))).toBe(true);
  });

  it('states package statuses from the in-development list', () => {
    expect(item('npx -y @texuli/mcp')?.status).toBe('in development');
    expect(IN_DEVELOPMENT.has('@texuli/catalog')).toBe(false);
    expect(item('@texuli/catalog')?.status).toBe('available');
    for (const surface of AGENT_SURFACES)
      for (const entry of surface.items) {
        const pkg = /@texuli\/[a-z-]+/.exec(entry.label)?.[0];
        if (pkg && IN_DEVELOPMENT.has(pkg))
          expect(entry.status, entry.label).toBe('in development');
      }
  });

  it('links only routes whose page exists', () => {
    for (const surface of agentSurfaces())
      if (surface.link) expect(siteRouteExists(surface.link.href), surface.link.href).toBe(true);
    for (const surface of AGENT_SURFACES)
      expect(siteRouteExists(surface.link.href), surface.link.href).toBe(true);
    for (const surface of agentSurfaces(() => false)) expect(surface.link).toBeUndefined();
  });
});

describe('humans and agents band markup', () => {
  it('is a labelled section with one h2, card h3s, shared badges and the plate', () => {
    expect(markup).toContain('aria-labelledby={copy.id}');
    expect((markup.match(/<h2\b/g) ?? []).length).toBe(1);
    expect((markup.match(/<h3\b/g) ?? []).length).toBe(1);
    expect(markup).not.toMatch(/<h1\b/);
    expect(markup).toContain('<StatusBadge status={item.status} context={item.label} />');
    expect(markup).toContain('<SiteIllustration art={copy.art} />');
  });

  it('is static and safe, with URL-policy links and logical CSS', () => {
    expect(markup).not.toMatch(/client:[a-z]+/);
    expect(source).not.toMatch(/<script\b|set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(source).toContain("safeHref(href, 'developer')");
    for (const href of markup.match(/href=\{[^}]+\}/g) ?? [])
      expect(href).toMatch(/^href=\{resolveHref\(/);
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});
