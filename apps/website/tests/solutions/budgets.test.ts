import { describe, expect, it } from 'vitest';
import {
  budgetFor,
  DEFAULT_BUDGET,
  islandBudgetFor,
  ROUTE_BUDGET_OVERRIDES,
  ROUTE_ISLAND_BUDGETS,
  ROUTE_PREFIX_BUDGETS,
} from '../../src/components/perf/budgets.ts';
import { SOLUTIONS } from '../../src/data/solutions/index.ts';

describe('ecosystem route budgets', () => {
  it('keeps each Solution landing within the budget of its replaced route, art measured apart', () => {
    // Every landing shows its own WebP art (PLAN_015, PLAN_017): only the page weight may grow
    // past the replaced route's cap, by a measured override that says so.
    const ART = /art \(\d{4}-\d{2}-\d{2}\).*Measured [\d.]+ KB page/;
    for (const solution of SOLUTIONS) {
      const measured = ROUTE_BUDGET_OVERRIDES.find((entry) => entry.route === solution.route);
      if (!solution.replaces && !measured) continue;
      expect(measured?.reason, solution.slug).toMatch(ART);
      if (!solution.replaces) {
        // A new landing keeps the defaults, except measured overrides with a reason
        // (PLAN_017 T-demo: the design-systems demo carries its brand CSS in the HTML).
        expect(budgetFor(solution.route), solution.slug).toEqual({
          ...DEFAULT_BUDGET,
          ...measured?.budget,
        });
        expect(Object.keys(measured?.budget ?? {}).sort(), solution.slug).toEqual([
          'htmlGzipKb',
          'pageGzipKb',
        ]);
        expect(measured?.reason, solution.slug).toMatch(/Measured \d{4}-\d{2}-\d{2}/);
        continue;
      }
      const replaced = budgetFor(solution.replaces);
      const { pageGzipKb, ...rest } = budgetFor(solution.route);
      const { pageGzipKb: replacedPage, ...replacedRest } = replaced;
      expect(rest, solution.slug).toEqual(replacedRest);
      expect(pageGzipKb, solution.slug).toBeGreaterThanOrEqual(replacedPage);
    }

    expect(budgetFor('/solutions/slides/')).toMatchObject({
      pageGzipKb: 488,
      jsGzipKb: 60,
      htmlGzipKb: 27,
    });
    expect(budgetFor('/solutions/documents/').pageGzipKb).toBe(527);
    expect(budgetFor('/solutions/workflows/')).toMatchObject({ pageGzipKb: 400, jsGzipKb: 96 });
    expect(budgetFor('/solutions/canvas/').pageGzipKb).toBe(332);
    expect(budgetFor('/solutions/sheets/')).toMatchObject({
      pageGzipKb: 400,
      htmlRawKb: 236,
      htmlGzipKb: 31,
    });
  });

  it('derives static catalog and guide limits from existing pages', () => {
    const designSystems = budgetFor('/design-systems/');
    // The catalog keeps the static catalog's limits except its page weight, which carries the
    // banner and six hero plates (a measured art override).
    const { pageGzipKb: catalogPage, ...catalog } = budgetFor('/solutions/');
    const { pageGzipKb: designSystemsPage, ...designSystemsRest } = designSystems;
    expect(catalog).toEqual(designSystemsRest);
    expect(catalogPage).toBeGreaterThan(designSystemsPage);
    // Built with keeps the catalog limits too; its pages carry measured art overrides.
    for (const route of ['/built-with/', '/built-with/protoyard/']) {
      const { pageGzipKb, ...rest } = budgetFor(route);
      expect(rest, route).toEqual(designSystemsRest);
      expect(pageGzipKb, route).toBeGreaterThan(designSystemsPage);
    }
    expect(budgetFor('/guides/solutions/slides/')).toEqual(budgetFor('/guides/'));

    const reasons = [
      ...ROUTE_BUDGET_OVERRIDES.map((entry) => entry.reason),
      ...ROUTE_PREFIX_BUDGETS.map((entry) => entry.reason),
    ].join('\n');
    expect(reasons).toContain('/design-systems/');
    expect(reasons).toContain('/guides/');
  });

  it('caps islands for each ecosystem route family', () => {
    expect(islandBudgetFor('/')).toBe(0);
    expect(islandBudgetFor('/solutions/')).toBe(0);
    for (const solution of SOLUTIONS) expect(islandBudgetFor(solution.route)).toBe(1);
    expect(islandBudgetFor('/built-with/')).toBe(0);
    expect(islandBudgetFor('/built-with/protoyard/')).toBe(0);
    expect(islandBudgetFor('/guides/solutions/slides/')).toBe(0);
    expect(islandBudgetFor('/native/')).toBe(1);
    expect(islandBudgetFor('/component-pages/button/')).toBeUndefined();
    expect(ROUTE_ISLAND_BUDGETS.every((entry) => entry.reason.trim().length > 0)).toBe(true);
  });

  it('keeps the native landing caps measured with its art and the default JavaScript limit', () => {
    expect(budgetFor('/native/').pageGzipKb).toBe(364);
    expect(budgetFor('/native/').jsGzipKb).toBe(DEFAULT_BUDGET.jsGzipKb);
    // Five more plates add their srcset markup (measured 24.2 KB gzip, PLAN_015 art).
    expect(budgetFor('/native/').htmlGzipKb).toBe(25.2);
  });
});
