/**
 * The behavior suite: one scenario page per primitive and a list of rows that
 * drive it as a user would, asserting only observable behavior (`oracle.ts`).
 *
 *   pnpm exec playwright test tests/behavior/scenarios/<primitive>.spec.ts
 *   TEXULI_PERF=1 pnpm exec playwright test tests/behavior   also asserts open-to-focus limits
 *   pnpm exec tsx tests/behavior/harness/limits-cli.ts [<primitive>]
 *
 * Each row's result (and any open-to-focus samples) is written to
 * `tmp/behavior-results/<project>/<primitive>.<row>.json` for `limits-cli.ts`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Page, type TestInfo, test } from '@playwright/test';
import { BEHAVIOR_LIMITS, checkOpenToFocus, perfEnabled, type RowResult } from './limits.ts';
import { gotoScenario } from './oracle.ts';

export * from './limits.ts';
export * from './oracle.ts';

export interface RowContext {
  page: Page;
  primitive: string;
  /** Record open-to-focus samples (ms), checked against the primitive's limit. */
  recordOpenToFocus(samples: number[]): void;
}

export interface ScenarioRow {
  /** Stable id within the scenario. */
  id: string;
  /** What the row shows, for the test title. */
  title: string;
  run(context: RowContext): Promise<void>;
}

/** Types a scenario's rows (identity at runtime). */
export function defineRows(rows: ScenarioRow[]): ScenarioRow[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!/^[a-z0-9-]+$/.test(row.id))
      throw new Error(`row id "${row.id}" must be a lowercase slug`);
    if (ids.has(row.id)) throw new Error(`duplicate row id "${row.id}"`);
    ids.add(row.id);
  }
  return rows;
}

/** Where row results are written (git-ignored scratch space, kept across runs). */
export const RESULTS_DIR = join(process.cwd(), 'tmp', 'behavior-results');

export function resultPath(project: string, primitive: string, rowId: string): string {
  return join(RESULTS_DIR, project, `${primitive}.${rowId}.json`);
}

export interface RecordedRow extends RowResult {
  primitive: string;
  project: string;
  openToFocusMs?: number[];
}

/**
 * Runs one row on a fresh scenario page and returns its result; never throws.
 * This is the seam both `scenario()` and the self test use.
 */
export async function runRow(
  page: Page,
  primitive: string,
  row: ScenarioRow
): Promise<RowResult & { openToFocusMs?: number[] }> {
  let openToFocusMs: number[] | undefined;
  try {
    await gotoScenario(page, primitive);
    await row.run({
      page,
      primitive,
      recordOpenToFocus: (samples) => {
        openToFocusMs = samples;
      },
    });
    return { id: row.id, passed: true, ...(openToFocusMs ? { openToFocusMs } : {}) };
  } catch (error) {
    return {
      id: row.id,
      passed: false,
      error: (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? '',
    };
  }
}

async function record(testInfo: TestInfo, recorded: RecordedRow): Promise<void> {
  const path = resultPath(recorded.project, recorded.primitive, recorded.id);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(recorded, null, 2)}\n`);
  testInfo.annotations.push({
    type: 'behavior-row',
    description: `${recorded.id}: ${recorded.passed ? 'pass' : 'fail'}`,
  });
}

/**
 * Registers a scenario: one test per row. A row's test fails when the row
 * fails, and (with `TEXULI_PERF=1`) when its open-to-focus p75 is over the
 * primitive's limit. A flaky row gets at most two retries.
 */
export function scenario(primitive: string, rows: ScenarioRow[]): void {
  test.describe(`behavior ${primitive}`, () => {
    test.describe.configure({ retries: BEHAVIOR_LIMITS.retries });
    for (const row of defineRows(rows)) {
      test(`${row.id}: ${row.title}`, async ({ page }, testInfo) => {
        const result = await runRow(page, primitive, row);
        await record(testInfo, { ...result, primitive, project: testInfo.project.name });
        if (!result.passed) throw new Error(`${row.id} failed: ${result.error}`);
        if (result.openToFocusMs && perfEnabled()) {
          const check = checkOpenToFocus(primitive, result.openToFocusMs);
          if (!check.ok) {
            throw new Error(
              `${row.id}: open-to-focus p75 ${check.p75.toFixed(1)} ms is over the ${primitive} limit of ${check.limit} ms`
            );
          }
        }
      });
    }
  });
}
