import { expect, type Page, test } from '@playwright/test';
import { LIVE_MARKERS } from '../../apps/website/src/components/live/markers.ts';
import { expectLiveStage, foreignRequests } from './support/live-stage.ts';
import {
  axeViolations,
  expectMode,
  polishProblems,
  representatives,
  serveDist,
  settle,
  sitePaths,
} from './support/site.ts';

/*
 * The texuli.com page sweep (T-quality-a11y-site, T-site-visual-polish). One
 * test per built page (dist/sitemap.xml, plus the 404), in one page session:
 *  - light, then dark: axe with ZERO exclusions (no disabled rules, no
 *    excluded selectors), and the polish check (no horizontal overflow, no
 *    element escaping the viewport, no broken image, no stand-in copy);
 *  - component pages also mount their real component on the live stage,
 *    with no request to another origin.
 * One page per route group (the same templates) also runs axe under forced
 * colors (high contrast) and a keyboard-only walk: the skip link comes first,
 * every Tab stop is visible with a focus indicator, focus never drops to the
 * body and never gets trapped.
 *
 * `/primitives-page/<id>/` pages are swept by site-live-primitives.spec.ts,
 * with the demo mounted and its floating content open, in light, dark and
 * forced colors; here only the group's representative runs.
 *
 * Chromium sweeps every page; the Pixel 7 runs the polish check on every page
 * and axe on the representatives; WebKit runs the representatives only.
 * Run `pnpm build` first.
 */

const PATHS = sitePaths();
const SAMPLE = representatives(PATHS);
const origin = serveDist();

/** Pages whose axe run needs more than the default time on a busy machine. */
const LARGE_PAGES = new Set(['/gallery-components/', '/examples/', '/color-explorer/']);

async function open(
  page: Page,
  path: string,
  mode: 'light' | 'dark' | 'high-contrast'
): Promise<void> {
  await page.emulateMedia({
    colorScheme: mode === 'dark' ? 'dark' : 'light',
    forcedColors: mode === 'high-contrast' ? 'active' : 'none',
    reducedMotion: 'reduce',
  });
  await page.goto(`${origin()}${path}`);
  await settle(page);
  if (mode !== 'high-contrast') await expectMode(page, mode);
}

interface FocusStop {
  label: string;
  visible: boolean;
  indicator: boolean;
  body: boolean;
}

/** One Tab press: what got focus, whether it is on screen and shows a focus indicator. */
async function tabStop(page: Page): Promise<FocusStop> {
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) {
      return { label: 'body', visible: false, indicator: false, body: true };
    }
    const tag = active.tagName.toLowerCase();
    const label = `${tag}${active.id ? `#${active.id}` : ''} "${(active.getAttribute('aria-label') ?? active.textContent ?? '').trim().slice(0, 40)}"`;
    const box = active.getBoundingClientRect();
    const style = getComputedStyle(active);
    const visible = box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
    const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
    const ring = style.boxShadow !== 'none';
    // A wrapper may draw the ring (`:has(:focus-visible)`, `:focus-within`).
    let parentRing = false;
    for (
      let node = active.parentElement, depth = 0;
      node && depth < 3;
      node = node.parentElement, depth += 1
    ) {
      const parent = getComputedStyle(node);
      if (
        (parent.outlineStyle !== 'none' && Number.parseFloat(parent.outlineWidth) > 0) ||
        parent.boxShadow !== 'none'
      ) {
        parentRing = true;
        break;
      }
    }
    return { label, visible, indicator: outline || ring || parentRing, body: false };
  });
}

/** The keyboard-only walk, from the top of a freshly loaded page. */
async function keyboardWalk(page: Page): Promise<void> {
  const first = await tabStop(page);
  expect(first.label, 'first Tab stop').toContain('Skip to content');
  const problems: string[] = [];
  const seen: string[] = [first.label];
  for (let press = 0; press < 40; press += 1) {
    const stop = await tabStop(page);
    if (stop.body) break;
    if (!stop.visible) problems.push(`not visible: ${stop.label}`);
    if (!stop.indicator) problems.push(`no focus indicator: ${stop.label}`);
    seen.push(stop.label);
    // Cycling back to the skip link means the whole page was walked.
    if (stop.label.includes('Skip to content')) break;
  }
  expect(problems, 'keyboard walk').toEqual([]);
  // No trap: Shift+Tab walks back out of wherever focus ended.
  await page.keyboard.press('Shift+Tab');
  const back = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(back).not.toBe('');
  expect(seen.length).toBeGreaterThan(1);
}

/** `/component-pages/<id>/` → `<id>` when the page has a live stage. */
function liveId(path: string): string | undefined {
  const id = /^\/component-pages\/([^/]+)\/$/.exec(path)?.[1];
  return id && LIVE_MARKERS[id] ? id : undefined;
}

const SWEPT = PATHS.filter(
  (path) => !/^\/primitives-page\/[^/]+\/$/.test(path) || SAMPLE.has(path)
);

for (const path of SWEPT) {
  const name = path === '/__missing__/' ? '404' : path;
  const sample = SAMPLE.has(path);
  test(`site ${name}: axe and polish in light and dark${sample ? ', forced colors and keyboard walk' : ''}`, async ({
    page,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName === 'webkit' && !sample, 'One page per route group on WebKit');
    // Large pages need more time, never an exclusion (the living gallery holds
    // 125 interactive cards; axe takes about 30 s on a loaded machine).
    test.setTimeout(LARGE_PAGES.has(path) ? 240_000 : 90_000);
    const desktopChromium = browserName === 'chromium' && !isMobile;
    const runAxe = desktopChromium || sample;
    // The live stage is checked once, on desktop Chromium.
    const live = desktopChromium ? liveId(path) : undefined;

    for (const mode of ['light', 'dark'] as const) {
      const foreign = await foreignRequests(page, origin(), () => open(page, path, mode));
      if (live) expect(foreign, `${live}: requests to another origin`).toEqual([]);
      if (runAxe) expect(await axeViolations(page), `axe ${mode}`).toEqual([]);
      // Lazy demos and previews on screen settle before the check (axe takes longer).
      if (!runAxe) await page.waitForTimeout(300);
      expect(await polishProblems(page), `polish ${mode}`).toEqual([]);
      if (live && mode === 'light') await expectLiveStage(page, live);
    }

    if (!sample) return;
    await open(page, path, 'high-contrast');
    expect(await axeViolations(page), 'axe forced colors').toEqual([]);
    // WebKit's default Tab skips links and buttons (a macOS setting), so the
    // keyboard walk runs on Chromium and the Pixel 7.
    if (browserName === 'webkit') return;
    await open(page, path, 'light');
    await keyboardWalk(page);
  });
}
