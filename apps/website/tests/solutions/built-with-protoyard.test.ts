import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeHref } from '@texuli/core/url-policy';
import { describe, expect, it } from 'vitest';
import {
  PROTOYARD_PAGE,
  PROTOYARD_PATHWAY_LINKS,
  PROTOYARD_PRODUCT,
  PROTOYARD_ROADMAP,
  PROTOYARD_SITE,
  PROTOYARD_TEXULI_PACKAGES,
  PROTOYARD_TODAY,
  type ProtoyardAuditRow,
} from '../../src/components/built-with/protoyard/protoyard-content.ts';
import { siteRouteExists } from '../../src/components/foundation/nav-data.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const read = (path: string) => readFileSync(resolve(WEBSITE, path), 'utf8');
const component = read('src/components/built-with/protoyard/ProtoyardCaseStudy.astro');
const page = read('src/pages/built-with/protoyard/index.astro');
const markup = component.slice(component.lastIndexOf('---') + 3, component.indexOf('<style>'));
const styles = component.slice(component.indexOf('<style>'));

/**
 * The statuses the current Protoyard capability audit records (golden path at Protoyard
 * 1.5.0 on Texuli 0.14.2): stages 2 and 4 implemented, 1, 3, 5 and 6 partial, 7 and 8
 * missing; Cloud, multiplayer and hosted agents are absent ("boundaries").
 */
const AUDIT: Readonly<Record<ProtoyardAuditRow, 'implemented' | 'partial' | 'missing'>> = {
  'stage-1-brief': 'partial',
  'stage-2-spec': 'implemented',
  'stage-3-generation': 'partial',
  'stage-4-iteration': 'implemented',
  'stage-5-validation': 'partial',
  'stage-6-export': 'partial',
  'stage-7-hardening': 'missing',
  'stage-8-launch': 'missing',
  packages: 'implemented',
  boundaries: 'missing',
};

describe('Protoyard claims cite the audit', () => {
  it('shows as working today only stages the audit records as implemented or partial, each cited once', () => {
    for (const claim of PROTOYARD_TODAY) {
      expect(AUDIT[claim.source], claim.title).not.toBe('missing');
      expect(claim.audit, claim.title).toBe(AUDIT[claim.source]);
    }
    expect(PROTOYARD_TODAY.map((c) => c.source)).toEqual([
      'stage-1-brief',
      'stage-2-spec',
      'stage-3-generation',
      'stage-4-iteration',
      'stage-5-validation',
      'stage-6-export',
    ]);
  });

  it('puts every missing audit row on the roadmap, as planned, never available', () => {
    for (const item of PROTOYARD_ROADMAP) {
      expect(AUDIT[item.source], item.title).toBe('missing');
      expect(item.status).toBe('planned');
    }
    const missing = Object.entries(AUDIT)
      .filter(([, status]) => status === 'missing')
      .map(([row]) => row);
    expect(PROTOYARD_ROADMAP.map((item) => item.source).sort()).toEqual(missing.sort());
    const cloud = PROTOYARD_ROADMAP.find((item) => item.title === 'Protoyard Cloud');
    expect(cloud?.body).toMatch(
      /shared, multiplayer workspace where teams turn ideas into products/
    );
  });

  it('keeps the product record honest: the local version available, Cloud planned, public evidence only', () => {
    expect(PROTOYARD_PRODUCT.offerings).toContainEqual(
      expect.objectContaining({ id: 'open-source-local', status: 'available' })
    );
    expect(PROTOYARD_PRODUCT.offerings).toContainEqual(
      expect.objectContaining({ id: 'cloud', status: 'planned' })
    );
    for (const { source } of PROTOYARD_PRODUCT.evidence) expect(source).not.toMatch(/^\.dwp\//);
  });

  it('lists only Texuli packages that exist in this workspace', () => {
    const names = new Set(
      readdirSync(resolve(REPO, 'packages'), { withFileTypes: true })
        .filter((dir) => dir.isDirectory())
        .map(
          (dir) =>
            JSON.parse(readFileSync(resolve(REPO, 'packages', dir.name, 'package.json'), 'utf8'))
              .name as string
        )
    );
    for (const name of PROTOYARD_TEXULI_PACKAGES) expect(names.has(name), name).toBe(true);
    for (const name of ['@texuli/spec', '@texuli/player', '@texuli/mcp'])
      expect(PROTOYARD_TEXULI_PACKAGES).not.toContain(name);
  });

  it('never calls the roadmap available and never names the plan', () => {
    const roadmap = JSON.stringify(PROTOYARD_ROADMAP);
    expect(roadmap).not.toMatch(/\bavailable\b/i);
    const copy = JSON.stringify([PROTOYARD_PAGE, PROTOYARD_TODAY, PROTOYARD_ROADMAP]);
    expect(copy).not.toMatch(/PLAN_|\.dwp|Ronin/);
    expect(JSON.stringify(PROTOYARD_TODAY)).not.toMatch(/cloud|multiplayer|hosted|billing/i);
  });
});

describe('links', () => {
  it('links the product site through the URL policy and only existing Texuli routes', () => {
    expect(PROTOYARD_SITE).toBe('https://protoyard.app');
    expect(safeHref(PROTOYARD_SITE, 'developer')).toBe(PROTOYARD_SITE);
    expect(component).toContain("const external = safeHref(page.hero.cta.href, 'developer');");
    expect(markup).toContain('rel="noopener"');
    expect(component).toContain(
      'PROTOYARD_PATHWAY_LINKS.filter((link) => siteRouteExists(link.href))'
    );
    const kept = PROTOYARD_PATHWAY_LINKS.filter((link) => siteRouteExists(link.href));
    expect(kept.length).toBeGreaterThan(0);
    for (const link of kept) expect(siteRouteExists(link.href), link.href).toBe(true);
  });
});

describe('page and markup', () => {
  it('is a landing page on BaseLayout with the case-study title and description', () => {
    expect(page).toContain(
      '<BaseLayout title={PROTOYARD_PAGE.title} description={PROTOYARD_PAGE.description} landing>'
    );
    expect(page).toContain('<ProtoyardCaseStudy />');
    expect(siteRouteExists('/built-with/protoyard/')).toBe(true);
  });

  it('renders the roadmap under its own heading with planned badges, after what works today', () => {
    expect((markup.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(markup.indexOf('page.today.id')).toBeLessThan(markup.indexOf('page.roadmap.id'));
    expect(markup).toContain('data-roadmap=""');
    expect(markup).toContain('<StatusBadge status={item.status} context={item.title} />');
    expect(PROTOYARD_PAGE.roadmap.title).toBe('Roadmap');
    expect(PROTOYARD_PAGE.roadmap.intro).toMatch(/^Planned, not available\./);
  });

  it('is static and safe, with a decorative mosaic instead of an invented screenshot', () => {
    expect(markup).toMatch(/class="protoyard__mosaic" aria-hidden="true"/);
    expect(markup).not.toMatch(/<img\b/);
    for (const source of [markup, page]) expect(source).not.toMatch(/client:[a-z]+/);
    expect(component).not.toMatch(/<script\b|set:html|\{@html|innerHTML/);
    expect(markup).not.toMatch(/\sstyle=/);
    expect(styles).not.toMatch(
      /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
    );
  });
});
