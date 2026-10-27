/**
 * The row model and the rules that pick where a row runs, as pure functions
 * (no browser): `index.ts` runs them, `scripts/tests/behavior-harness.test.ts`
 * tests them in Vitest.
 */
import type { Page } from '@playwright/test';

/** The profile a phone-specific row runs under (a Pixel 7 context inside the Chromium project). */
export const PHONE = 'mobile';

/** The Playwright project that also runs the phone rows: the Pixel 7 is Chromium. */
export const PHONE_HOST = 'chromium';

export interface RowContext {
  page: Page;
  primitive: string;
  /**
   * Where the row runs: `chromium` or `webkit` (desktop projects), or
   * `mobile` (the Pixel 7 profile, a touch context inside the Chromium project).
   */
  project: string;
  /** Whether the page has a touch screen (true only on `mobile`). */
  touch: boolean;
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
   * Where the row runs, e.g. `['mobile']` for touch. When omitted: Chromium
   * and WebKit, plus the Pixel 7 profile when the row is phone-specific
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

/**
 * What makes a row phone-specific: touch input, a branch on the project, or
 * the viewport. The Pixel 7 is Chromium again, so a row without any of these
 * (keyboard, focus, roles, axe) proves nothing there that desktop Chromium
 * has not; it runs on Chromium and WebKit only.
 */
const PHONE_SPECIFIC =
  /\b(tap|touch\w*|swipe|hasTouch|isMobile|mobile|phone|project|viewportSize|setViewportSize|dispatchTouchEvent)\b/i;

/** Whether a row runs on this project or profile (`projects` when given; see PHONE_SPECIFIC). */
export function runsOn(row: ScenarioRow, project: string): boolean {
  if (row.projects) return row.projects.includes(project);
  if (project !== PHONE) return true;
  return PHONE_SPECIFIC.test(`${row.title}\n${row.run.toString()}`);
}

/**
 * The rows one Playwright project runs: its desktop rows, and on the
 * Chromium project also the phone rows (in a Pixel 7 context). No other
 * project runs phone rows.
 */
export function rowsFor(
  rows: readonly ScenarioRow[],
  project: string
): { desktop: ScenarioRow[]; phone: ScenarioRow[] } {
  return {
    desktop: rows.filter((row) => runsOn(row, project)),
    phone: project === PHONE_HOST ? rows.filter((row) => runsOn(row, PHONE)) : [],
  };
}
