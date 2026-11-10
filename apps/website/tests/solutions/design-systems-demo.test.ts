/**
 * The design-systems demo (PLAN_017 T-demo): build-time generation and the locked check
 * on published APIs, the island's interaction (brand, mode, allow toggles, reset), and its
 * source rules (no HTML sinks, no compiler or checker in the island, one island, budget).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { budgetFor, islandBudgetFor } from '../../src/components/perf/budgets.ts';
import {
  buildDesignSystemsDemo,
  type DemoBuild,
} from '../../src/components/solutions/design-systems/demo/build.ts';
import DesignSystemsDemo from '../../src/components/solutions/design-systems/demo/DesignSystemsDemo.svelte';
import { DEMO_BRAND_INPUTS } from '../../src/components/solutions/design-systems/demo/fixtures/brands.ts';
import {
  DEMO_TOGGLES_ON,
  demoCheckSummary,
  demoFindingsFor,
  demoToggleCombinations,
  demoToggleKey,
} from '../../src/components/solutions/design-systems/demo/model.ts';

const DEMO_DIR = resolve('apps/website/src/components/solutions/design-systems/demo');
const read = (file: string) => readFileSync(resolve(DEMO_DIR, file), 'utf8');

let demo: DemoBuild;
beforeAll(async () => {
  demo = await buildDesignSystemsDemo();
});
afterEach(cleanup);

describe('design-systems demo: build-time results on published APIs', () => {
  it('generates and compiles three fictional brands, one per input kind', () => {
    expect(demo.brands.map((brand) => brand.id)).toEqual(['harborline', 'quillmark', 'tumbletown']);
    expect(demo.brands.map((brand) => brand.kind)).toEqual(['brief', 'tokens', 'css']);
    for (const brand of demo.brands) {
      expect(brand.guaranteesPassed, brand.id).toBe(true);
      expect(brand.attrs['data-tx-ds']).toBe(brand.id);
      expect(brand.command).toMatch(/^texuli ds generate --(brief|from-tokens|from-css) /);
      expect(demo.css).toContain(`[data-tx-ds="${brand.id}"]{--tx-`);
    }
    // The token file and the stylesheet each keep a value the importer reports as dropped.
    expect(demo.brands[1]?.losses.map((line) => line.path)).toContain('$.color.ink');
    expect(demo.brands[2]?.losses.length).toBeGreaterThan(0);
    // Repairs are grouped: one line per path and reason, with a count.
    for (const brand of demo.brands)
      expect(new Set(brand.repairs.map((r) => r.path + r.reason)).size).toBe(brand.repairs.length);
  });

  it('emits only scoped variable rules, with nothing that could leave the style element', () => {
    expect(demo.css).not.toMatch(/<|@import|url\(|expression\(/i);
    const selectors = demo.css.match(/(^|\n|\})([^{}]+)\{/g) ?? [];
    expect(selectors.length).toBeGreaterThanOrEqual(3);
  });

  it('checks the sample prototype for every toggle combination with stable codes', () => {
    const keys = demoToggleCombinations().map(demoToggleKey);
    expect(Object.keys(demo.checks).sort()).toEqual([...keys].sort());
    expect(demoFindingsFor(demo.checks, DEMO_TOGGLES_ON)).toEqual([]);

    const noBadge = demoFindingsFor(demo.checks, { badge: false, 'button-ghost': true }) ?? [];
    expect(noBadge.map((f) => [f.code, f.path])).toEqual([['not-allowed', '$.tree.children[3]']]);
    const noGhost = demoFindingsFor(demo.checks, { badge: true, 'button-ghost': false }) ?? [];
    expect(noGhost.map((f) => [f.code, f.path])).toEqual([
      ['variant-not-allowed', '$.tree.children[2]'],
    ]);
    const none = demoFindingsFor(demo.checks, { badge: false, 'button-ghost': false }) ?? [];
    expect(none).toHaveLength(2);
    // The allowed set only names catalog ids and values: nothing is reported as unknown.
    for (const findings of Object.values(demo.checks))
      expect(findings.some((f) => f.code.startsWith('unknown-'))).toBe(false);
    expect(demoCheckSummary([])).toMatch(/^Locked check passed/);
    expect(demoCheckSummary(noBadge)).toBe('Locked check failed: 1 finding (not-allowed).');
  });
});

describe('design-systems demo island', () => {
  it('switches brands, shows the report and keeps the draft status', async () => {
    render(DesignSystemsDemo, { props: { brands: demo.brands, checks: demo.checks } });
    const app = document.querySelector('[data-tx-ds-demo]') as HTMLElement;
    expect(app.dataset.brand).toBe('harborline');
    expect(screen.getByText(/^Status:/).textContent).toContain('draft');

    await fireEvent.click(screen.getByRole('radio', { name: /Quillmark/ }));
    expect(app.dataset.brand).toBe('quillmark');
    // The input is a figure captioned by the brand (no aria-label on the generic <pre>).
    const figure = screen.getByText('Quillmark input').closest('figure');
    expect(figure?.querySelector('pre')?.textContent).toContain('"$value": "#9a3412"');
    expect(figure?.querySelector('pre')?.hasAttribute('aria-label')).toBe(false);
    expect(figure?.querySelector('pre')?.getAttribute('tabindex')).toBe('0');
    expect(document.querySelector('[data-tx-ds-demo-report]')?.textContent).toContain(
      '1 dropped value'
    );
    const scope = document.querySelector('[data-tx-ds-demo-scope]') as HTMLElement;
    expect(scope.getAttribute('data-tx-ds')).toBe('quillmark');

    await fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(scope.getAttribute('data-tx-mode')).toBe('dark');
  });

  it('re-checks when an allow entry is switched off, and resets', async () => {
    render(DesignSystemsDemo, { props: { brands: demo.brands, checks: demo.checks } });
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/Locked check passed/);
    expect(screen.getByText('New')).toBeTruthy();

    await fireEvent.click(screen.getByRole('checkbox', { name: /Badge/ }));
    expect(status.textContent).toContain('Locked check failed: 1 finding (not-allowed).');
    expect(document.querySelector('[data-tx-ds-demo-blocked="badge"]')).not.toBeNull();
    expect(document.querySelector('[data-tx-ds-demo-finding="not-allowed"]')).not.toBeNull();

    await fireEvent.click(screen.getByRole('checkbox', { name: /ghost variant/ }));
    expect(status.textContent).toContain('2 findings');
    expect(screen.queryByRole('button', { name: 'Maybe later' })).toBeNull();

    await fireEvent.click(screen.getByRole('radio', { name: /Tumbletown/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(status.textContent).toMatch(/Locked check passed/);
    expect((document.querySelector('[data-tx-ds-demo]') as HTMLElement).dataset.brand).toBe(
      'harborline'
    );
    expect(screen.getByRole('button', { name: 'Maybe later' })).toBeTruthy();
  });

  it('labels every control and renders inputs as text', () => {
    render(DesignSystemsDemo, { props: { brands: demo.brands, checks: demo.checks } });
    expect(screen.getAllByRole('radio')).toHaveLength(DEMO_BRAND_INPUTS.length + 2);
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(screen.getByRole('group', { name: '1. Pick a brand input' })).toBeTruthy();
    expect(screen.getByLabelText('Work email')).toBeTruthy();
  });
});

describe('design-systems demo: source rules and budget', () => {
  it('ships no compiler, no checker and no HTML sink to the browser', () => {
    const island = read('DesignSystemsDemo.svelte');
    const model = read('model.ts');
    expect(island).not.toMatch(/\{@html|innerHTML|set:html|eval\(|fetch\s*\(/);
    expect(model).not.toMatch(/^import /m);
    expect(island).not.toMatch(/from '@texuli\/(tools|tokens)/);
    expect(island).toMatch(/^import type \{ DemoBrand \} from '\.\/build\.ts';$/m);
    expect(island).toContain('role="status"');
    const section = read('DesignSystemsDemoSection.astro');
    expect(section.match(/<[A-Za-z]+ client:/g)).toEqual(['<DesignSystemsDemo client:']);
    expect(section).toContain('<style is:inline set:html={demoBuild.css}></style>');
  });

  it('stays within the /solutions/ island and route budgets', () => {
    expect(islandBudgetFor('/solutions/design-systems/')).toBe(1);
    const budget = budgetFor('/solutions/design-systems/');
    // Only the HTML gets more room (the brand CSS and the server-rendered island); page and
    // JavaScript keep the defaults.
    expect(budget.htmlGzipKb).toBe(29);
    expect(budget.pageGzipKb).toBe(96);
    expect(budget.jsGzipKb).toBe(64);
  });
});
