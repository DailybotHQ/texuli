import { expect, type Page, test } from '@playwright/test';
import { LIVE_MARKERS } from '../../../apps/website/src/components/live/markers.ts';
import { expectLiveStage, foreignRequests } from './live-stage.ts';
import {
  axeViolations,
  expectMode,
  polishProblems,
  representatives,
  serveDist,
  settle,
  sitePaths,
  sweepSample,
} from './site.ts';

/*
 * The texuli.com page sweep (T-quality-a11y-site, T-site-visual-polish): one
 * page of each route group of dist/sitemap.xml, plus the 404 (sweepSample).
 * The pages of a group share a template, and the components of the large
 * groups (`/examples/…`, `/component-pages/…`) are axe-checked in light and
 * dark in the fixture app too (a11y-*.spec.ts). The pages are dealt into
 * twelve tests, each walking its pages in one page session, and the tests
 * into the a11y-site-<n>.spec.ts files (defineSiteSweep), so CI can balance
 * the sweep across shards:
 *  - light, then dark: axe with ZERO exclusions (no disabled rules, no
 *    excluded selectors), and the polish check (no horizontal overflow, no
 *    element escaping the viewport, no broken image, no stand-in copy);
 *  - component pages also mount their real component on the live stage,
 *    with no request to another origin;
 *  - axe under forced colors (high contrast) and a keyboard-only walk: the
 *    skip link comes first, every Tab stop is visible with a focus
 *    indicator, focus never drops to the body and never gets trapped.
 *
 * `/primitives-page/<id>/` pages are swept by site-live-primitives.spec.ts,
 * with the demo mounted and its floating content open, in light, dark and
 * forced colors; here only the group's representative runs.
 *
 * Run `pnpm build` first.
 */

const PATHS = sitePaths();
const SAMPLE = representatives(PATHS);
/**
 * Registers part `part` of `parts` of the sweep: every page lands in exactly
 * one test, and every test in exactly one part. Call at a spec's top level.
 */
export function defineSiteSweep(part: number, parts: number): void {
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

  const SWEPT = sweepSample(PATHS, 1).filter(
    (path) => !/^\/primitives-page\/[^/]+\/$/.test(path) || SAMPLE.has(path)
  );

  /** Tests the pages are dealt into, balanced by weight (a large page counts as five). */
  const CHUNKS = 12;
  const weight = (path: string) => (LARGE_PAGES.has(path) ? 5 : 1);
  const CHUNKED: string[][] = Array.from({ length: CHUNKS }, () => []);
  for (const path of [...SWEPT].sort((a, b) => weight(b) - weight(a))) {
    const lightest = CHUNKED.reduce((best, chunk) =>
      chunk.reduce((sum, p) => sum + weight(p), 0) < best.reduce((sum, p) => sum + weight(p), 0)
        ? chunk
        : best
    );
    lightest.push(path);
  }

  /** Every check of one page; returns its problems instead of stopping at the first. */
  async function sweepPage(page: Page, path: string, browserName: string): Promise<string[]> {
    const problems: string[] = [];
    const live = liveId(path);
    for (const mode of ['light', 'dark'] as const) {
      const foreign = await foreignRequests(page, origin(), () => open(page, path, mode));
      if (live && foreign.length) problems.push(`${live}: requests to another origin ${foreign}`);
      for (const found of await axeViolations(page)) problems.push(`axe ${mode}: ${found}`);
      for (const found of await polishProblems(page)) problems.push(`polish ${mode}: ${found}`);
      if (live && mode === 'light') await expectLiveStage(page, live);
    }
    await open(page, path, 'high-contrast');
    for (const found of await axeViolations(page)) problems.push(`axe forced colors: ${found}`);
    // WebKit's default Tab skips links and buttons (a macOS setting).
    if (browserName !== 'webkit') {
      await open(page, path, 'light');
      await keyboardWalk(page);
    }
    return problems.map((problem) => `${path === '/__missing__/' ? '404' : path} ${problem}`);
  }

  for (const [index, chunk] of CHUNKED.entries()) {
    if (index % parts !== part - 1) continue;
    // Sitemap order within a test, so a test's name stays stable.
    const paths = SWEPT.filter((path) => chunk.includes(path));
    if (paths.length === 0) continue;
    const names = paths.map((path) => (path === '/__missing__/' ? '404' : path));
    test(`site pages ${names.join(' ')}: axe, polish, forced colors and keyboard walk`, async ({
      page,
      browserName,
    }) => {
      // Large pages need more time, never an exclusion (the living gallery holds
      // about 146 interactive cards since PLAN_008's slides layout examples; axe
      // takes about 30 s on a loaded machine and the keyboard walk visits every card).
      test.setTimeout(
        paths.reduce((total, path) => total + (LARGE_PAGES.has(path) ? 300_000 : 60_000), 0)
      );
      const problems: string[] = [];
      for (const path of paths) {
        await test.step(path, async () => {
          problems.push(...(await sweepPage(page, path, browserName)));
        });
      }
      expect(problems).toEqual([]);
    });
  }
}
