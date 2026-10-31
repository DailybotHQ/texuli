// @vitest-environment node
/**
 * /design-systems/ (PLAN_011 T-site-0100): the three example brands pass
 * `texuli ds check` and compile, the conformance summary counts exactly what
 * the compiler reports, the build-time stylesheet scopes each brand, the
 * page is static and sink-free with an honest status, and the hub is in the
 * nav, the search index and llms.txt. The browser side is
 * tests/e2e/site-design-systems.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkDesignSystem } from '@texuli/tools/ds-check';
import { describe, expect, it } from 'vitest';
import { BRAND_IDS, loadBrands } from '../src/components/design-systems/brands.ts';
import {
  pairsLabel,
  ratioLabel,
  summarizeConformance,
} from '../src/components/design-systems/conformance.ts';
import { DS_STATUS, DS_SURFACES } from '../src/components/design-systems/page.ts';
import { NAV_GROUPS } from '../src/components/foundation/site.ts';
import { SEARCH_INDEX } from '../src/components/search/index-data.ts';
import { GET } from '../src/pages/design-systems/brands.css.ts';

const read = (path: string) => readFileSync(resolve('apps/website', path), 'utf8');

describe('design systems hub', () => {
  it('checks and compiles the three example brands from examples/design-systems', async () => {
    expect(BRAND_IDS).toEqual(['quillmark', 'ledgerline', 'tumbletown']);
    const brands = await loadBrands();
    for (const brand of brands) {
      const file = JSON.parse(
        readFileSync(resolve('examples/design-systems', `${brand.id}.json`), 'utf8')
      ) as { name: string; version: string };
      expect(brand.name).toBe(file.name);
      expect(brand.version).toBe(file.version);
      expect(brand.conformance.ok).toBe(true);
      expect(brand.compiled.vars.light?.['--tx-primary']).toMatch(/^#[0-9a-f]{6}$/);
    }
    const primaries = new Set(brands.map((brand) => brand.compiled.vars.light?.['--tx-primary']));
    expect(primaries.size).toBe(3);
    // Ledgerline's high-contrast variant is checked too, at AAA.
    const ledgerline = brands.find((brand) => brand.id === 'ledgerline');
    expect(ledgerline?.conformance.runs.map((run) => [run.variant, run.contrast])).toEqual([
      [null, 'AA'],
      ['high-contrast', 'AAA'],
    ]);
    expect(ledgerline?.extends).toBe('texuli:slate-masthead');
  });

  it('summarizes exactly what the compiler reports', async () => {
    const document = JSON.parse(
      readFileSync(resolve('examples/design-systems/tumbletown.json'), 'utf8')
    );
    const report = await checkDesignSystem(document);
    const summary = summarizeConformance(report);
    const run = report.runs[0];
    const base = summary.runs[0];
    expect(run && base).toBeTruthy();
    if (!run || !base) return;
    for (const mode of base.modes) {
      const pairs = run.contrast[mode.mode] ?? [];
      expect(mode.total).toBe(pairs.length);
      expect(mode.passed).toBe(pairs.filter((pair) => pair.pass).length);
      expect(mode.byKind.text.total + mode.byKind.ui.total + mode.byKind.focus.total).toBe(
        pairs.length
      );
      const tightest = mode.tightest;
      expect(tightest).not.toBeNull();
      for (const pair of pairs.filter((entry) => entry.kind === 'text'))
        expect(pair.ratio / pair.required).toBeGreaterThanOrEqual(
          (tightest?.ratio ?? 0) / (tightest?.required ?? 1)
        );
    }
    expect(base.adjustments).toBe(run.adjustments.length);
    expect(base.targetMin).toBe(44);
    expect(pairsLabel({ passed: 3, total: 4 })).toBe('3 of 4');
    expect(ratioLabel({ ratio: 4.61, required: 4.5 })).toBe('4.61:1 (needs 4.5:1)');

    // A refused document is summarized as refused, never as passing.
    const refused = summarizeConformance(
      await checkDesignSystem({ ...document, color: { brand: { seed: 'pink' } } })
    );
    expect(refused.ok).toBe(false);
    expect(refused.codes.length).toBeGreaterThan(0);
    expect(refused.runs.every((entry) => !entry.ok)).toBe(true);
  });

  it('writes one scoped light rule per brand into the build-time stylesheet', async () => {
    const response = await (GET as unknown as () => Promise<Response>)();
    expect(response.headers.get('content-type')).toContain('text/css');
    const css = await response.text();
    for (const id of BRAND_IDS) expect(css).toContain(`[data-tx-ds="${id}"]{--tx-`);
    expect(css).not.toMatch(/data-tx-mode="dark"|url\(|<|javascript:/);
  });

  it('is static, sink-free and honest about its release', () => {
    const page = read('src/pages/design-systems/index.astro');
    const surface = read('src/components/design-systems/BrandSurface.svelte');
    for (const source of [page, surface]) {
      expect(source).not.toMatch(/client:|\{@html|set:html|innerHTML|srcdoc|style=/);
      expect(source).not.toMatch(/production[- ]ready|is released|available on npm/i);
    }
    expect((page.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    expect(surface).toContain('DesignSystemProvider');
    for (const id of ['what', 'brands', 'conformance', 'start'])
      expect(page).toContain(`id="${id}"`);
    expect(DS_STATUS).toMatch(/in development for 0\.10\.0/);
    expect(DS_STATUS).toMatch(/0\.9 line/);
    expect(DS_SURFACES.map((entry) => entry.id)).toEqual([
      'dashboard',
      'slide',
      'document',
      'email',
    ]);
  });

  it('is in the Themes nav, the search index and llms.txt', () => {
    const themes = NAV_GROUPS.find((group) => group.id === 'themes');
    expect(themes?.links[0]?.href).toBe('/design-systems/');
    expect(SEARCH_INDEX.some((entry) => entry.href === '/design-systems/')).toBe(true);
    expect(read('public/llms.txt')).toContain('(https://texuli.com/design-systems/)');
  });
});
