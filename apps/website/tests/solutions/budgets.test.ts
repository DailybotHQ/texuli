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
  it('keeps each Solution landing within the current budget of its replaced route', () => {
    for (const solution of SOLUTIONS) {
      if (!solution.replaces) {
        // A new landing keeps the defaults, except a measured override with a reason
        // (PLAN_017 T-demo: the design-systems demo carries its brand CSS, HTML only).
        const measured = ROUTE_BUDGET_OVERRIDES.find((entry) => entry.route === solution.route);
        expect(budgetFor(solution.route), solution.slug).toEqual({
          ...DEFAULT_BUDGET,
          ...measured?.budget,
        });
        if (measured) {
          expect(Object.keys(measured.budget), solution.slug).toEqual(['htmlGzipKb']);
          expect(measured.reason, solution.slug).toMatch(/Measured \d{4}-\d{2}-\d{2}/);
        }
        continue;
      }
      const replaced = budgetFor(solution.replaces);
      expect(budgetFor(solution.route), solution.slug).toEqual(replaced);
    }

    expect(budgetFor('/solutions/slides/')).toMatchObject({
      pageGzipKb: 168,
      jsGzipKb: 60,
      htmlGzipKb: 27,
    });
    expect(budgetFor('/solutions/documents/').pageGzipKb).toBe(182);
    expect(budgetFor('/solutions/workflows/')).toMatchObject({ pageGzipKb: 132, jsGzipKb: 96 });
    expect(budgetFor('/solutions/canvas/').pageGzipKb).toBe(177);
    expect(budgetFor('/solutions/sheets/')).toMatchObject({
      pageGzipKb: 186,
      htmlRawKb: 236,
      htmlGzipKb: 31,
    });
  });

  it('derives static catalog and guide limits from existing pages', () => {
    const designSystems = budgetFor('/design-systems/');
    expect(budgetFor('/solutions/')).toEqual(designSystems);
    expect(budgetFor('/built-with/')).toEqual(designSystems);
    expect(budgetFor('/built-with/protoyard/')).toEqual(designSystems);
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

  it('keeps the native landing page cap and the default JavaScript and HTML limits', () => {
    expect(budgetFor('/native/').pageGzipKb).toBe(122);
    expect(budgetFor('/native/').jsGzipKb).toBe(DEFAULT_BUDGET.jsGzipKb);
    expect(budgetFor('/native/').htmlGzipKb).toBe(DEFAULT_BUDGET.htmlGzipKb);
  });
});
