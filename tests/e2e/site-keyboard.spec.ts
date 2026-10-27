import { expect, type Page, test } from '@playwright/test';
import { serveDist } from './support/site.ts';

/*
 * texuli.com keyboard walk (PLAN_006 T-88). a11y-site.spec.ts already checks
 * the first Tab stops of a page per route group (skip link first, visible
 * focus, no body drop); this spec adds what that sweep does not: the skip
 * link moves focus into the main landmark, and a whole-page walk on one page
 * per class (Tab to the end without a trap or a drop, Shift+Tab retraces the
 * same stops); and the tool islands' single-letter shortcuts stay inactive
 * until the focus is inside the tool (WCAG 2.1.4). The shortcut scoping rules
 * are unit-tested in apps/website/tests/studios.test.ts; the phone drawer's
 * trap is in site-docs-nav.spec.ts. Built site only; run `pnpm build` first.
 */

const origin = serveDist();

async function open(page: Page, path: string): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${origin()}${path}`);
  await page.waitForLoadState('networkidle');
}

/** A stable label for the focused element, or `body` when focus dropped. */
function activeLabel(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) return 'body';
    const text = (active.getAttribute('aria-label') ?? active.textContent ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    return `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''} "${text}"`;
  });
}

/**
 * Tab from the top until the walk is back at its first stop. Focus on `body`
 * is either the real end (Chromium leaves the document past the last stop,
 * and one more Tab wraps to the first one) or a mid-page drop (an element
 * removed or hidden on focus; the next Tab continues from where it was).
 * One more Tab tells them apart: only a real end lands on the first stop.
 */
async function walkTabStops(
  page: Page,
  limit: number
): Promise<{ stops: string[]; drop: string | null }> {
  const stops: string[] = [];
  for (let press = 0; press < limit; press += 1) {
    await page.keyboard.press('Tab');
    const label = await activeLabel(page);
    if (stops.length > 0 && label === stops[0]) break;
    if (label === 'body') {
      if (stops.length === 0) return { stops, drop: 'focus never left body' };
      await page.keyboard.press('Tab');
      const next = await activeLabel(page);
      if (next !== stops[0])
        return {
          stops,
          drop: `focus dropped to body after stop ${stops.length} (${stops.at(-1)}); the next Tab reached ${next}, not the first stop`,
        };
      break;
    }
    stops.push(label);
  }
  return { stops, drop: null };
}

/** One page per class from the T-88 walk (walks/keyboard.md). */
const PAGE_CLASSES: ReadonlyArray<{ path: string; limit: number }> = [
  { path: '/', limit: 200 },
  { path: '/guides/getting-started/', limit: 400 },
  { path: '/component-pages/button/', limit: 400 },
  { path: '/theme-studio/', limit: 400 },
  { path: '/__missing__/', limit: 400 },
];

test('every page class: the skip link reaches main, Tab walks to the end without a drop, Shift+Tab retraces', async ({
  page,
}) => {
  test.setTimeout(180_000);
  // The walk itself: a focus drop mid-page fails it instead of ending it.
  await page.setContent(`<!doctype html><html lang="en"><body>
    <a href="#a">one</a> <button id="vanish" type="button">vanish</button> <a href="#c">three</a>
    <script>
      document.getElementById('vanish').addEventListener('focus', (event) => event.target.remove());
    </script></body></html>`);
  expect((await walkTabStops(page, 50)).drop).toContain('focus dropped to body');

  for (const { path, limit } of PAGE_CLASSES) {
    await open(page, path);
    await page.keyboard.press('Tab');
    expect(await activeLabel(page), path).toContain('Skip to content');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const inMain = await page.evaluate(
      () => document.activeElement?.closest('main, #main') !== null
    );
    expect(inMain, `${path}: first stop after the skip link: ${await activeLabel(page)}`).toBe(
      true
    );

    await open(page, path);
    const { stops, drop } = await walkTabStops(page, limit);
    expect(drop, `${path}: focus must not drop to body before the last stop`).toBeNull();
    expect(stops[0], path).toContain('Skip to content');
    expect(stops.length, `${path}: the walk hit its limit (a trap?)`).toBeLessThan(limit);
    // From past the end, Shift+Tab lands on the last stop (one extra press
    // when the walk wrapped), then retraces the stops before it.
    const last = stops.length - 1;
    let landed = '';
    for (let press = 0; press < 2 && landed !== stops[last]; press += 1) {
      await page.keyboard.press('Shift+Tab');
      landed = await activeLabel(page);
    }
    expect(landed, path).toBe(stops[last]);
    const back: string[] = [];
    const count = Math.min(8, last);
    for (let press = 0; press < count; press += 1) {
      await page.keyboard.press('Shift+Tab');
      back.push(await activeLabel(page));
    }
    expect(back, path).toEqual(stops.slice(last - count, last).reverse());
  }
});

/** Tool islands: the page, the island root, and its keyboard-map disclosure. */
const TOOLS: ReadonlyArray<{ path: string; root: string; keys: string }> = [
  { path: '/theme-studio/', root: '[data-tx-theme-studio]', keys: '[data-tx-studio-keys]' },
  { path: '/color-explorer/', root: '[data-tx-color-explorer]', keys: '[data-tx-explorer-keys]' },
  { path: '/playground/', root: '[data-tx-playground]', keys: '[data-tx-playground-keys]' },
];

test('tool shortcuts stay inactive with the focus outside the tool and work inside it (WCAG 2.1.4)', async ({
  page,
}) => {
  for (const tool of TOOLS) {
    await open(page, tool.path);
    const keys = page.locator(tool.keys);
    await expect(keys).toHaveCount(1);
    // On the page body (nothing focused) and on the skip link: `?` does nothing.
    await page.keyboard.press('Shift+Slash');
    await expect(keys).not.toHaveAttribute('open', '');
    await page.keyboard.press('Tab');
    expect(await activeLabel(page)).toContain('Skip to content');
    await page.keyboard.press('Shift+Slash');
    await expect(keys).not.toHaveAttribute('open', '');
    // With the focus on a control inside the tool, `?` toggles the key map.
    await keys.locator('summary').focus();
    await page.keyboard.press('Shift+Slash');
    await expect(keys).toHaveAttribute('open', '');
    await page.keyboard.press('Shift+Slash');
    await expect(keys).not.toHaveAttribute('open', '');
  }
});
