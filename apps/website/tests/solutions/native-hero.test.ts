import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL } from '../../src/components/foundation/site.ts';
import {
  NATIVE_HERO,
  nativeHeroStatus,
} from '../../src/components/sections/native/hero/hero-content.ts';
import { NATIVE_COMPATIBILITY } from '../../src/data/native/compatibility.ts';
import { SOLUTION_STATUSES } from '../../src/data/solutions/schema.ts';

const WEBSITE = resolve(import.meta.dirname, '../..');
const REPO = resolve(WEBSITE, '../..');
const HERO = readFileSync(
  resolve(WEBSITE, 'src/components/sections/native/hero/NativeHero.astro'),
  'utf8'
);
const parity = JSON.parse(readFileSync(resolve(REPO, 'native/docs/parity.json'), 'utf8')) as {
  totals: { catalog: number; painted: number };
};

describe('Native hero: Beyond the browser', () => {
  it('carries the eyebrow, the accent h1 and a short subhead', () => {
    expect(NATIVE_HERO.eyebrow).toBe('Texuli Native · In development');
    expect(`${NATIVE_HERO.title.lead} ${NATIVE_HERO.title.accent}`).toBe(
      'Your interface language, beyond the browser.'
    );
    expect(NATIVE_HERO.sub.split(/\s+/).length).toBeLessThanOrEqual(30);
    const copy = JSON.stringify(NATIVE_HERO);
    expect(copy).not.toMatch(/production[- ]ready|write once|run anywhere|coming soon/i);
    expect(copy).not.toMatch(/PLAN_|T-native/);
  });

  it('derives an honest status line from the compatibility data', () => {
    const rows = nativeHeroStatus();
    expect(rows.map((r) => r.id)).toEqual(['web', 'compose-desktop', 'android', 'ios']);
    for (const row of rows) expect(SOLUTION_STATUSES).toContain(row.status);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.web?.status).toBe('available');
    expect(byId['compose-desktop']?.status).toBe('in development');
    expect(byId.android?.status).toBe('planned');
    expect(byId.ios?.status).toBe('planned');
    expect(NATIVE_COMPATIBILITY.totals).toMatchObject(parity.totals);
    expect(byId['compose-desktop']?.detail).toContain(
      `${parity.totals.painted} of ${parity.totals.catalog} catalog components`
    );
  });

  it('follows the data: Android and iOS turn experimental when a renderer target exists', () => {
    const data = {
      ...NATIVE_COMPATIBILITY,
      platforms: NATIVE_COMPATIBILITY.platforms.map((p) =>
        p.target === 'Android UI renderer' ? { ...p, status: 'Experimental' as const } : p
      ),
    };
    const android = nativeHeroStatus(data).find((r) => r.id === 'android');
    expect(android?.status).toBe('experimental');
  });

  it('points every call to action at a real page or the native directory', () => {
    expect(NATIVE_HERO.actions.map((a) => a.role)).toEqual(['primary', 'secondary', 'text']);
    for (const action of NATIVE_HERO.actions) {
      if (action.href.startsWith(REPOSITORY_URL)) {
        expect(action.href).toBe(`${REPOSITORY_URL}/tree/main/native`);
        expect(existsSync(resolve(REPO, 'native/README.md'))).toBe(true);
        continue;
      }
      const [path, hash] = action.href.split('#');
      expect(path).not.toMatch(/-page\//);
      const page = resolve(
        WEBSITE,
        'src/pages',
        (path ?? '').replace(/^\/|\/$/g, ''),
        'index.astro'
      );
      expect(existsSync(page), action.href).toBe(true);
      if (hash) expect(readFileSync(page, 'utf8')).toContain(`id="${hash}"`);
    }
  });

  it('is static, labelled by its h1, and paints the native-hero plate or its mosaic', () => {
    expect(HERO).not.toMatch(/client:|set:html|\{@html|innerHTML|<script/);
    expect(HERO.match(/<h1\b/g)).toHaveLength(1);
    expect(HERO).toContain('aria-labelledby={NATIVE_HERO.ids.heading}');
    expect(HERO).toContain('<SiteIllustration art={NATIVE_HERO.art.slot} />');
    expect(HERO).toContain('<HeroTexels art={NATIVE_HERO.art.slot} alt={NATIVE_HERO.art.alt} />');
    expect(HERO).toContain("safeHref(href, 'developer')");
    expect(NATIVE_HERO.art.slot).toBe('native-hero');
  });
});
