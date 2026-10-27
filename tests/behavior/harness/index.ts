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
import { type BrowserContext, type Page, type TestInfo, test } from '@playwright/test';
import { BEHAVIOR_LIMITS, checkOpenToFocus, perfEnabled, type RowResult } from './limits.ts';
import { gotoScenario } from './oracle.ts';

export * from './limits.ts';
export * from './oracle.ts';

export interface RowContext {
  page: Page;
  primitive: string;
  /** The Playwright project the row runs on (`chromium`, `webkit`, `mobile`). */
  project: string;
  /** Record open-to-focus samples (ms), checked against the primitive's limit. */
  recordOpenToFocus(samples: number[]): void;
}

export interface ScenarioRow {
  /** Stable id within the scenario. */
  id: string;
  /** What the row shows, for the report. */
  title: string;
  /**
   * Run as its own test, in its own browser context. Only for rows that
   * change context-wide state another row would see (an installed clock).
   */
  isolate?: boolean;
  /**
   * The projects the row runs on, e.g. `['mobile']` for touch. When omitted:
   * Chromium and WebKit, plus the Pixel 7 when the row is phone-specific
   * (`runsOn`).
   */
  projects?: readonly string[];
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
  row: ScenarioRow,
  project = 'chromium'
): Promise<RowResult & { openToFocusMs?: number[] }> {
  let openToFocusMs: number[] | undefined;
  try {
    await gotoScenario(page, primitive);
    await row.run({
      page,
      primitive,
      project,
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

/** The failure of a recorded row, or of its open-to-focus limit; undefined when it passed. */
function rowFailure(primitive: string, result: RecordedRow): string | undefined {
  if (!result.passed) return `${result.id} failed: ${result.error}`;
  if (result.openToFocusMs && perfEnabled()) {
    const check = checkOpenToFocus(primitive, result.openToFocusMs);
    if (!check.ok) {
      return `${result.id}: open-to-focus p75 ${check.p75.toFixed(1)} ms is over the ${primitive} limit of ${check.limit} ms`;
    }
  }
  return undefined;
}

/**
 * What makes a row phone-specific: touch input, a branch on the project, or
 * the viewport. The Pixel 7 is Chromium again, so a row without any of these
 * (keyboard, focus, roles, axe) proves nothing there that desktop Chromium
 * has not; it runs on Chromium and WebKit only.
 */
const PHONE_SPECIFIC =
  /\b(tap|touch\w*|swipe|hasTouch|isMobile|mobile|phone|project|viewportSize|setViewportSize|dispatchTouchEvent)\b/i;

/** Whether a row runs on this project (`projects` when given; see PHONE_SPECIFIC). */
export function runsOn(row: ScenarioRow, project: string): boolean {
  if (row.projects) return row.projects.includes(project);
  if (project !== 'mobile') return true;
  return PHONE_SPECIFIC.test(`${row.title}\n${row.run.toString()}`);
}

/** Clears what a row can leave in the browser context: web storage and permissions. */
async function clearContextState(context: BrowserContext, page: Page): Promise<void> {
  // Storage is per origin and shared by the context's pages.
  await page
    .evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    })
    .catch(() => undefined);
  // Permissions are context-wide too (a row may grant the clipboard).
  await context.clearPermissions();
}

/**
 * Puts a used page back to the project's defaults before the next row
 * navigates it: no pressed button or modifier, the pointer at the corner,
 * default media and the project's viewport.
 */
async function resetPage(page: Page, testInfo: TestInfo): Promise<void> {
  await page.mouse.up().catch(() => undefined);
  for (const key of ['Shift', 'Control', 'Alt', 'Meta']) {
    await page.keyboard.up(key).catch(() => undefined);
  }
  await page.mouse.move(0, 0).catch(() => undefined);
  await page.emulateMedia({
    media: 'screen',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
  });
  const viewport = testInfo.project.use.viewport;
  const now = page.viewportSize();
  if (viewport && (now?.width !== viewport.width || now?.height !== viewport.height)) {
    await page.setViewportSize(viewport);
  }
}

/**
 * Runs rows one after another in one browser context, which keeps the HTTP
 * cache (what makes this cheaper than one test per row). Before each row the
 * context's storage and permissions are cleared and the page is reset to the
 * project's defaults (`resetPage`); the row then navigates it to a fresh
 * scenario. A failing row is retried up to `BEHAVIOR_LIMITS.retries` times,
 * each on a brand-new page. Returns the failures, one line per failed row.
 */
async function runRows(
  context: BrowserContext,
  first: Page,
  primitive: string,
  rows: readonly ScenarioRow[],
  testInfo: TestInfo
): Promise<string[]> {
  const failures: string[] = [];
  let page = first;
  let used = false;
  for (const row of rows) {
    let failure: string | undefined;
    for (let attempt = 0; attempt <= BEHAVIOR_LIMITS.retries; attempt += 1) {
      if (used) {
        await clearContextState(context, page);
        if (attempt === 0) {
          await resetPage(page, testInfo);
        } else {
          await page.close();
          page = await context.newPage();
        }
      }
      used = true;
      const result = await runRow(page, primitive, row, testInfo.project.name);
      const recorded = { ...result, primitive, project: testInfo.project.name };
      await record(testInfo, recorded);
      failure = rowFailure(primitive, recorded);
      if (!failure) break;
    }
    if (failure) failures.push(failure);
  }
  return failures;
}

/**
 * Registers a scenario. Its rows run in one test (each on a fresh page, see
 * `runRows`), which fails listing every row that failed; a row marked
 * `isolate` gets a test, and a browser context, of its own. A row with
 * `projects` runs only there. With
 * `TEXULI_PERF=1` a row also fails when its open-to-focus p75 is over the
 * primitive's limit. A flaky row gets at most two retries.
 */
export function scenario(primitive: string, rows: ScenarioRow[]): void {
  const all = defineRows(rows);
  const shared = all.filter((row) => !row.isolate);
  const isolated = all.filter((row) => row.isolate);
  test.describe(`behavior ${primitive}`, () => {
    if (shared.length > 0) {
      test(`rows: ${shared.map((row) => row.id).join(', ')}`, async ({
        context,
        page,
      }, testInfo) => {
        const mine = shared.filter((row) => runsOn(row, testInfo.project.name));
        test.skip(mine.length === 0, 'No row runs on this project');
        test.setTimeout(Math.max(60_000, mine.length * 30_000));
        const failures = await runRows(context, page, primitive, mine, testInfo);
        if (failures.length > 0) throw new Error(failures.join('\n'));
      });
    }
    for (const row of isolated) {
      test(`${row.id}: ${row.title}`, async ({ context, page }, testInfo) => {
        test.skip(!runsOn(row, testInfo.project.name), 'The row does not run on this project');
        const failures = await runRows(context, page, primitive, [row], testInfo);
        if (failures.length > 0) throw new Error(failures.join('\n'));
      });
    }
  });
}
