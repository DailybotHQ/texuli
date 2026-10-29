/**
 * G80 (T-gaps-80-85): the print view's isolation rules apply only while a
 * `data-tx-print-isolate` target is mounted. Before the fix, the rules were
 * active as soon as the view's CSS loaded, so a Ctrl/Cmd+P before the print
 * sheet mounted printed a blank page.
 *
 * On the fixture app (the Vite server compiles the package source), with
 * print media emulated:
 * 1. the print view's CSS is loaded and no target exists: the page prints;
 * 2. a `DeckPrintView` is mounted: only the view prints;
 * 3. the view is unmounted: the page prints again.
 */
import { resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../..');
const fs = (path: string) => `/@fs${resolve(ROOT, path)}`;

const PATHS = {
  model: fs('packages/deck/src/model/index.ts'),
  exporter: fs('packages/slides/src/export/index.ts'),
  pages: fs('packages/slides/src/export/DeckPrintPages.svelte'),
  styles: fs('packages/slides/src/styles.css'),
};

const DECK = {
  formatVersion: 2,
  meta: { title: 'Harbor isolation', locale: 'en' },
  slides: [
    { id: 'cover', layout: 'title-hero', props: { title: 'Printed alone' } },
    { id: 'next', layout: 'section-divider', props: { title: 'Second page' } },
  ],
};

/** The computed `display` of the fixture's main content and of the print view, if any. */
async function displays(page: Page): Promise<{ main: string; view: string | null }> {
  return page.evaluate(() => {
    const main = document.querySelector('main[data-fixture="smoke"]');
    const view = document.querySelector('.tx-deck-print-view');
    return {
      main: main ? getComputedStyle(main).display : 'missing',
      view: view ? getComputedStyle(view).display : null,
    };
  });
}

test('print isolation applies only while a print target is mounted', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?fixture=smoke');
  const main = page.locator('main[data-fixture="smoke"]');
  await expect(main).toBeVisible();

  // 1. The isolation CSS is loaded (the view's body module), with no target in the page.
  await page.evaluate(async (paths) => {
    await Promise.all([
      import(/* @vite-ignore */ paths.pages),
      import(/* @vite-ignore */ paths.styles),
    ]);
  }, PATHS);
  await expect
    .poll(() =>
      page.evaluate(() =>
        [...document.querySelectorAll('style')].some((node) =>
          node.textContent?.includes('data-tx-print-isolate')
        )
      )
    )
    .toBe(true);
  await page.emulateMedia({ media: 'print' });
  expect((await displays(page)).main).not.toBe('none');
  await expect(main).toBeVisible();

  // 2. A print view is mounted: only it prints.
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(
    async ({ input, paths }) => {
      const runtime = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/\.vite\/deps\/svelte\.js(\?|$)/u.test(name));
      if (!runtime) throw new Error('The fixture app did not load the Svelte runtime.');
      const [{ mount }, { parseDeck }, exporter] = await Promise.all([
        import(/* @vite-ignore */ runtime),
        import(/* @vite-ignore */ paths.model),
        import(/* @vite-ignore */ paths.exporter),
      ]);
      const parsed = parseDeck(input);
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
      const host = document.createElement('div');
      host.dataset.printHost = '';
      document.body.append(host);
      (window as unknown as { __printView?: unknown }).__printView = mount(exporter.DeckPrintView, {
        target: host,
        props: { deck: parsed.deck, tier: 'developer' },
      });
    },
    { input: DECK, paths: PATHS }
  );
  const view = page.locator('.tx-deck-print-view');
  await expect(view).toHaveAttribute('data-print-ready', 'true', { timeout: 30_000 });
  await page.emulateMedia({ media: 'print' });
  await expect(main).toBeHidden();
  await expect(view).toBeVisible();
  await expect(view.locator('.tx-deck-print-view__slide')).toHaveCount(2);
  const printed = await displays(page);
  expect(printed.main).toBe('none');
  expect(printed.view).not.toBe('none');

  // 3. The view is unmounted: the page prints again.
  await page.evaluate(async () => {
    const runtime = performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .find((name) => /\/\.vite\/deps\/svelte\.js(\?|$)/u.test(name));
    if (!runtime) throw new Error('The fixture app did not load the Svelte runtime.');
    const { unmount } = await import(/* @vite-ignore */ runtime);
    const scope = window as unknown as { __printView?: unknown };
    await unmount(scope.__printView);
    scope.__printView = undefined;
    document.querySelector('[data-print-host]')?.remove();
  });
  await expect(view).toHaveCount(0);
  await expect(main).toBeVisible();
  expect((await displays(page)).main).not.toBe('none');
});
