import { expect, test } from '@playwright/test';
import {
  checkOpenToFocus,
  DEFAULT_OPEN_TO_FOCUS_P75_MS,
  defineRows,
  OPEN_TO_FOCUS_P75_MS,
  openToFocusLimit,
  p75,
  perfEnabled,
  runRow,
} from './index.ts';
import { sampleRows } from './sample/rows.ts';

/**
 * The harness tests itself: the limit rules on fixed data, then the sample
 * scenario (every row passes) and a deliberately broken copy of it (exactly
 * the two planted bugs are caught).
 */

test.describe('the limits', () => {
  test('p75 is the nearest-rank 75th percentile', () => {
    expect(p75([5])).toBe(5);
    expect(p75([4, 1, 3, 2])).toBe(3);
    expect(p75([10, 20, 30, 40, 50, 60, 70, 80])).toBe(60);
    expect(() => p75([])).toThrow(/at least one sample/);
  });

  test('open-to-focus is checked against an absolute limit per primitive', () => {
    expect(openToFocusLimit('no-such-primitive')).toBe(DEFAULT_OPEN_TO_FOCUS_P75_MS);
    for (const [primitive, limit] of Object.entries(OPEN_TO_FOCUS_P75_MS)) {
      expect(openToFocusLimit(primitive)).toBe(limit);
      expect(limit).toBeGreaterThanOrEqual(50);
    }
    const limit = openToFocusLimit('sample');
    expect(checkOpenToFocus('sample', [limit, limit, limit, limit]).ok).toBe(true);
    const over = checkOpenToFocus('sample', [1, 1, limit + 1, limit + 1]);
    expect(over).toEqual({ primitive: 'sample', p75: limit + 1, limit, ok: false });
  });

  test('timing is asserted only with TEXULI_PERF=1', () => {
    expect(perfEnabled({})).toBe(false);
    expect(perfEnabled({ TEXULI_PERF: '0' })).toBe(false);
    expect(perfEnabled({ TEXULI_PERF: '1' })).toBe(true);
  });

  test('rows have unique slug ids', () => {
    const run = async () => {};
    expect(() => defineRows([{ id: 'Bad Id', title: 'x', run }])).toThrow(/lowercase slug/);
    expect(() =>
      defineRows([
        { id: 'a', title: 'x', run },
        { id: 'a', title: 'y', run },
      ])
    ).toThrow(/duplicate/);
  });
});

test.describe('the sample scenario', () => {
  test.describe.configure({ retries: 0 });
  // The harness, not an engine, is under test: every real scenario already
  // runs the oracle on WebKit and the Pixel 7.
  test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || isMobile, 'Chromium only');

  test('passes every row and records open-to-focus samples', async ({ page }) => {
    test.setTimeout(120_000);
    const results = [];
    for (const row of sampleRows) results.push(await runRow(page, 'sample', row));
    expect(
      results.filter((result) => !result.passed).map((result) => `${result.id}: ${result.error}`)
    ).toEqual([]);
    expect(results.find((result) => result.openToFocusMs)?.openToFocusMs?.length).toBe(7);
  });

  test('a broken copy fails exactly the rows guarding its planted bugs', async ({ page }) => {
    test.setTimeout(120_000);
    const failed: string[] = [];
    for (const row of sampleRows) {
      const result = await runRow(page, 'sample-broken', row);
      if (!result.passed) failed.push(result.id);
    }
    expect(failed.sort()).toEqual(['escape-returns-focus', 'scroll-released']);
  });

  test('an unknown scenario reports an error instead of hanging', async ({ page }) => {
    const result = await runRow(
      page,
      'no-such-primitive',
      sampleRows[0] as (typeof sampleRows)[number]
    );
    expect(result.passed).toBe(false);
    expect(result.error).toMatch(/No behavior scenario "no-such-primitive"/);
  });
});
