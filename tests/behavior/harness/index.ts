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
import {
  type Browser,
  type BrowserContext,
  devices,
  type Page,
  type TestInfo,
  test,
} from '@playwright/test';
import { BEHAVIOR_LIMITS, checkOpenToFocus, perfEnabled, type RowResult } from './limits.ts';
import { gotoScenario } from './oracle.ts';
import { defineRows, PHONE, rowsFor, type ScenarioRow } from './rows.ts';

export * from './limits.ts';
export * from './oracle.ts';
export * from './rows.ts';

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
  project = 'chromium',
  touch = project === PHONE
): Promise<RowResult & { openToFocusMs?: number[] }> {
  let openToFocusMs: number[] | undefined;
  try {
    await gotoScenario(page, primitive);
    await row.run({
      page,
      primitive,
      project,
      touch,
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

/** Where a batch of rows runs: the project (or the Pixel 7 profile) and its viewport. */
interface Profile {
  project: string;
  touch: boolean;
  viewport: { width: number; height: number } | null | undefined;
}

/**
 * Puts a used page back to the profile's defaults before the next row
 * navigates it: no pressed button or modifier, the pointer at the corner,
 * default media and the profile's viewport.
 */
async function resetPage(page: Page, profile: Profile): Promise<void> {
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
  const viewport = profile.viewport;
  const now = page.viewportSize();
  if (viewport && (now?.width !== viewport.width || now?.height !== viewport.height)) {
    await page.setViewportSize(viewport);
  }
}

/**
 * Runs rows one after another in one browser context, which keeps the HTTP
 * cache (what makes this cheaper than one test per row). Before each row the
 * context's storage and permissions are cleared and the page is reset to the
 * profile's defaults (`resetPage`); the row then navigates it to a fresh
 * scenario. A failing row is retried up to `BEHAVIOR_LIMITS.retries` times,
 * each on a brand-new page. Returns the failures, one line per failed row.
 */
async function runRows(
  context: BrowserContext,
  first: Page,
  primitive: string,
  rows: readonly ScenarioRow[],
  profile: Profile,
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
          await resetPage(page, profile);
        } else {
          await page.close();
          page = await context.newPage();
        }
      }
      used = true;
      const result = await runRow(page, primitive, row, profile.project, profile.touch);
      const recorded = { ...result, primitive, project: profile.project };
      await record(testInfo, recorded);
      failure = rowFailure(primitive, recorded);
      if (!failure) break;
    }
    if (failure) failures.push(profile.touch ? `${PHONE}: ${failure}` : failure);
  }
  return failures;
}

/** The Pixel 7 profile: Chromium with touch, a phone viewport and a mobile user agent. */
const PIXEL_7 = devices['Pixel 7'];

/**
 * Runs the desktop rows in the test's own context, then (Chromium project
 * only) the phone rows in a fresh Pixel 7 context on the same browser.
 */
async function runProject(
  fixtures: { browser: Browser; context: BrowserContext; page: Page; baseURL: string | undefined },
  primitive: string,
  rows: readonly ScenarioRow[],
  testInfo: TestInfo
): Promise<void> {
  const project = testInfo.project.name;
  const { desktop, phone } = rowsFor(rows, project);
  test.skip(desktop.length + phone.length === 0, 'No row runs on this project');
  test.setTimeout(Math.max(60_000, (desktop.length + phone.length) * 30_000));
  const failures = await runRows(
    fixtures.context,
    fixtures.page,
    primitive,
    desktop,
    { project, touch: false, viewport: testInfo.project.use.viewport },
    testInfo
  );
  if (phone.length > 0) {
    const { defaultBrowserType: _, ...options } = PIXEL_7;
    const context = await fixtures.browser.newContext({ ...options, baseURL: fixtures.baseURL });
    try {
      const page = await context.newPage();
      const profile = { project: PHONE, touch: true, viewport: PIXEL_7.viewport };
      failures.push(...(await runRows(context, page, primitive, phone, profile, testInfo)));
    } finally {
      await context.close();
    }
  }
  if (failures.length > 0) throw new Error(failures.join('\n'));
}

/**
 * Registers a scenario. Its rows run in one test per project (each on a
 * fresh page, see `runRows`), which fails listing every row that failed; a
 * row marked `isolate` gets a test, and a browser context, of its own. A row
 * with `projects` runs only there. The phone-specific rows (`runsOn`) run
 * inside the Chromium project's test, in a Pixel 7 context, so there is no
 * separate phone project and no skipped test. With `TEXULI_PERF=1` a row also
 * fails when its open-to-focus p75 is over the primitive's limit. A flaky row
 * gets at most two retries.
 */
export function scenario(primitive: string, rows: ScenarioRow[]): void {
  const all = defineRows(rows);
  const shared = all.filter((row) => !row.isolate);
  const isolated = all.filter((row) => row.isolate);
  test.describe(`behavior ${primitive}`, () => {
    if (shared.length > 0) {
      test(`rows: ${shared.map((row) => row.id).join(', ')}`, async ({
        browser,
        context,
        page,
        baseURL,
      }, testInfo) => {
        await runProject({ browser, context, page, baseURL }, primitive, shared, testInfo);
      });
    }
    for (const row of isolated) {
      test(`${row.id}: ${row.title}`, async ({ browser, context, page, baseURL }, testInfo) => {
        await runProject({ browser, context, page, baseURL }, primitive, [row], testInfo);
      });
    }
  });
}
