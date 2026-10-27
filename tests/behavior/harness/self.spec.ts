import { expect, test } from '@playwright/test';
import { runRow } from './index.ts';
import { sampleRows } from './sample/rows.ts';

/**
 * The harness tests itself on the sample scenario (every row passes) and a
 * deliberately broken copy of it (exactly the two planted bugs are caught).
 * The harness, not an engine, is under test, so this file runs on the
 * Chromium project only (`playwright.config.ts`). The pure limit and row
 * rules are Vitest tests: `scripts/tests/behavior-harness.test.ts`.
 */

test.describe('the sample scenario', () => {
  test.describe.configure({ retries: 0 });

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
