import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AGENT_LINKS,
  agentSurfaceViews,
  evidenceHref,
  PLATFORM_LINKS,
  PLATFORM_META,
  platformRows,
  sectionHeadingId,
  statusBadgeView,
} from '../../src/components/solutions/shared/platforms/platforms-model.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';
import {
  SOLUTION_PLATFORMS,
  SOLUTION_STATUSES,
  type SolutionEntry,
  type SolutionStatus,
} from '../../src/data/solutions/schema.ts';
import { validateSolutionRegistry } from '../../src/data/solutions/validate.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const DIR = 'src/components/solutions/shared/platforms';
const read = (name: string): string => readFileSync(resolve(WEBSITE, DIR, name), 'utf8');
const markupOf = (source: string): string =>
  source.slice(source.lastIndexOf('---') + 3, source.indexOf('<style>'));
const badge = read('StatusBadge.astro');
const platforms = read('SolutionPlatforms.astro');
const agents = read('SolutionAgents.astro');
const RANK: Record<SolutionStatus, number> = {
  planned: 0,
  experimental: 1,
  'in development': 2,
  available: 3,
};

const base = SOLUTIONS[0] as SolutionEntry;
const withPlatforms = (list: SolutionEntry['platforms']): SolutionEntry => ({
  ...base,
  platforms: list,
});

describe('status badge model', () => {
  it('prints every status word with a tone, filled only for available', () => {
    const views = SOLUTION_STATUSES.map(statusBadgeView);
    expect(views.map((v) => v.label)).toEqual([
      'Available',
      'In development',
      'Experimental',
      'Planned',
    ]);
    expect(views.map((v) => v.tone)).toEqual(['solid', 'outline', 'outline', 'dashed']);
    expect(() => statusBadgeView('shipped' as SolutionStatus)).toThrow(/not a status word/);
  });
});

describe('platform rows', () => {
  it('lists the entry platforms in fixed order with the entry statuses, never raised', () => {
    for (const entry of SOLUTIONS) {
      const rows = platformRows(entry);
      expect(
        rows.map((r) => r.platform),
        entry.slug
      ).toEqual(SOLUTION_PLATFORMS.filter((p) => entry.platforms.some((e) => e.platform === p)));
      for (const row of rows) {
        const source = entry.platforms.find((p) => p.platform === row.platform);
        expect(row.badge.status, `${entry.slug} ${row.platform}`).toBe(source?.status);
        expect(row.name).toBe(PLATFORM_META[row.platform].name);
      }
    }
  });

  it('keeps every registry entry within native/docs/parity.json (validate.ts) and Android/iOS planned', () => {
    expect(validateSolutionRegistry(SOLUTIONS).issues).toEqual([]);
    for (const entry of SOLUTIONS) {
      for (const row of platformRows(entry)) {
        if (row.platform === 'android' || row.platform === 'ios')
          expect(row.badge.status, `${entry.slug} ${row.platform}`).toBe('planned');
        if (row.platform !== 'web')
          expect(RANK[row.badge.status]).toBeLessThanOrEqual(RANK['in development']);
      }
    }
  });

  it('refuses a native status above planned without evidence, and omits unlisted platforms', () => {
    expect(() =>
      platformRows(
        withPlatforms([
          { platform: 'web', status: 'available', evidence: [] },
          { platform: 'android', status: 'experimental', evidence: [] },
        ])
      )
    ).toThrow(/without evidence/);
    const rows = platformRows(
      withPlatforms([{ platform: 'web', status: 'available', evidence: [] }])
    );
    expect(rows.map((r) => r.platform)).toEqual(['web']);
  });

  it('links evidence files to the repository on GitHub and refuses paths outside it', () => {
    const path = 'native/docs/parity.json';
    expect(existsSync(resolve(WEBSITE, '../..', path))).toBe(true);
    expect(evidenceHref(path)).toBe(
      'https://github.com/DailybotHQ/texuli/blob/main/native/docs/parity.json'
    );
    const rows = platformRows(
      withPlatforms([
        { platform: 'web', status: 'available', evidence: [] },
        { platform: 'compose-desktop', status: 'in development', evidence: [path] },
      ])
    );
    expect(rows[1]?.evidence).toEqual([{ path, href: evidenceHref(path) }]);
    for (const bad of ['', '/etc/passwd', '../secret', 'a/../../b'])
      expect(() => evidenceHref(bad), bad).toThrow();
  });
});

describe('agents model', () => {
  it('badges each surface and refuses an empty label', () => {
    const views = agentSurfaceViews([
      { label: 'deck.run', detail: 'MCP tool that renders a deck.', status: 'in development' },
      { label: 'skills/texuli', detail: 'Agent skill.', status: 'available' },
    ]);
    expect(views.map((v) => v.badge.status)).toEqual(['in development', 'available']);
    expect(() => agentSurfaceViews([{ label: ' ', detail: 'x', status: 'planned' }])).toThrow(
      /no label/
    );
  });

  it('links only routes that exist today', () => {
    for (const link of [PLATFORM_LINKS.native, ...AGENT_LINKS]) {
      const page = resolve(
        WEBSITE,
        'src/pages',
        link.href.replace(/^\/+|\/+$/g, ''),
        'index.astro'
      );
      expect(existsSync(page), link.href).toBe(true);
    }
    expect(sectionHeadingId('slides', 'platforms')).not.toBe(sectionHeadingId('slides', 'agents'));
  });
});

describe('markup', () => {
  it('uses the contract props, labelled h2 sections and the shared badge', () => {
    expect(platforms).toContain('type Props = SolutionPlatformsProps;');
    expect(agents).toContain('type Props = SolutionAgentsProps;');
    for (const source of [platforms, agents]) {
      const markup = markupOf(source);
      expect(markup).toContain('aria-labelledby={headingId}');
      expect(markup).toContain('<h2 id={headingId}>');
      expect(markup).not.toMatch(/<h1\b/);
      expect(markup).toContain('<StatusBadge status={');
    }
    expect(markupOf(badge)).toContain('{view.label}');
  });

  it('is static and safe: no script, island, sink, inline style; logical CSS; site links through the URL policy', () => {
    for (const source of [badge, platforms, agents]) {
      expect(markupOf(source)).not.toMatch(/client:[a-z]+/);
      expect(source).not.toMatch(/<script\b/);
      expect(source).not.toMatch(/set:html|\{@html|innerHTML/);
      expect(markupOf(source)).not.toMatch(/\sstyle=/);
      expect(source).not.toMatch(
        /margin-(left|right)|padding-(left|right)|\b(left|right|top|bottom):/
      );
    }
    expect(platforms).toContain('resolveSiteHref(PLATFORM_LINKS.native.href, base)');
    expect(agents).toContain('resolveSiteHref(link.href, base)');
    const model = readFileSync(resolve(WEBSITE, DIR, 'platforms-model.ts'), 'utf8');
    expect(model).toContain("safeHref(url, 'developer')");
    expect(model).toContain("safeHref(href, 'developer')");
  });
});
