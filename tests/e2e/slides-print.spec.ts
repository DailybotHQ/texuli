/**
 * Print to PDF for deck model v2 (PLAN_008 T-export), Chromium only: the
 * fixture app's Vite server compiles `DeckPrintView` from the package source,
 * the page mounts it on a small v2 deck (three visible slides, one hidden,
 * reveal steps, a free slide with blocks), waits for `data-print-ready`, and
 * `page.pdf()` must give one page per visible slide at the canvas size of
 * each aspect (1px = 0.75pt), then the notes appendix after the slides.
 */
import { resolve } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../..');
const fs = (path: string) => `/@fs${resolve(ROOT, path)}`;

const ASPECTS = {
  '16:9': [960, 540],
  '4:3': [768, 576],
  '9:16': [540, 960],
  '1:1': [810, 810],
} as const;
type Aspect = keyof typeof ASPECTS;

function deck(aspect: Aspect) {
  return {
    formatVersion: 2,
    meta: { title: `Harbor print ${aspect}`, locale: 'en' },
    style: { aspect },
    slides: [
      {
        id: 'cover',
        layout: 'title-hero',
        notes: 'Open with the harbor story.',
        props: { title: 'A calm release', subtitle: 'Revealed on step one', step: 1 },
      },
      {
        id: 'options',
        layout: 'comparison-table',
        props: {
          title: 'Options',
          columns: ['Weekly', 'Daily'],
          rows: [
            { label: 'Lead time', values: ['Five days', 'Same day'] },
            { label: 'Rollback', values: [false, true] },
            { label: 'Best for', values: ['Large batches', 'Small changes'] },
          ],
        },
      },
      { id: 'backstage', layout: 'section-divider', hidden: true, props: { title: 'Hidden' } },
      {
        id: 'notes',
        layout: 'free',
        title: 'What we learned',
        blocks: [
          { type: 'heading', level: 2, text: 'What we learned' },
          { type: 'text', markdown: 'Shown at the last step.', step: 2 },
        ],
      },
    ],
  };
}

/** Page boxes (width, height in points) in page order, from the PDF page dictionaries. */
function pageBoxes(bytes: Buffer): [number, number][] {
  const source = bytes.toString('latin1');
  return [
    ...source.matchAll(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/gu),
  ].map((match) => [Number(match[3]) - Number(match[1]), Number(match[4]) - Number(match[2])]);
}

/** Mount `DeckPrintView` with the app's own Svelte runtime (the URL main.ts loaded). */
async function mountPrint(page: Page, aspect: Aspect, notes: 'none' | 'appendix') {
  await page.evaluate(
    async ({ input, notes, paths }) => {
      const runtime = performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((name) => /\/\.vite\/deps\/svelte\.js(\?|$)/u.test(name));
      if (!runtime) throw new Error('The fixture app did not load the Svelte runtime.');
      const [{ mount, unmount }, { parseDeck }, exporter] = await Promise.all([
        import(/* @vite-ignore */ runtime),
        import(/* @vite-ignore */ paths.model),
        import(/* @vite-ignore */ paths.exporter),
        import(/* @vite-ignore */ paths.styles),
      ]);
      const parsed = parseDeck(input);
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
      const scope = window as unknown as { __printView?: unknown };
      if (scope.__printView) unmount(scope.__printView);
      document.querySelector('[data-print-host]')?.remove();
      const host = document.createElement('div');
      host.dataset.printHost = '';
      document.body.append(host);
      scope.__printView = mount(exporter.DeckPrintView, {
        target: host,
        props: { deck: parsed.deck, notes, tier: 'developer' },
      });
    },
    {
      input: deck(aspect),
      notes,
      paths: {
        model: fs('packages/deck/src/model/index.ts'),
        exporter: fs('packages/slides/src/export/index.ts'),
        styles: fs('packages/slides/src/styles.css'),
      },
    }
  );
  const view = page.locator('.tx-deck-print-view[data-print-ready]').last();
  await expect(view).toHaveAttribute('data-print-ready', 'true', { timeout: 30_000 });
  return view;
}

test('a v2 deck prints one canvas-sized PDF page per visible slide, every step shown, notes after', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'page.pdf() is Chromium only.');
  test.setTimeout(120_000);
  await page.goto('/?fixture=smoke');
  await expect(page.locator('main[data-fixture="smoke"]')).toBeVisible();

  for (const aspect of Object.keys(ASPECTS) as Aspect[]) {
    await test.step(aspect, async () => {
      const view = await mountPrint(page, aspect, 'none');
      // Three visible slides (the hidden one is skipped), painted by the default layouts.
      await expect(view.locator('.tx-deck-print-view__slide')).toHaveCount(3);
      await expect(view.locator('[data-tx-deck-preview-ready="true"]')).toHaveCount(3);
      await expect(view.locator('[data-tx-deck-layout="comparison-table"] table')).toHaveCount(1);
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      const boxes = pageBoxes(pdf);
      expect(boxes).toHaveLength(3);
      for (const [width, height] of boxes) {
        expect(width).toBeCloseTo(ASPECTS[aspect][0], 0);
        expect(height).toBeCloseTo(ASPECTS[aspect][1], 0);
      }
    });
  }

  await test.step('notes appendix and final reveal state', async () => {
    const view = await mountPrint(page, '16:9', 'appendix');
    await page.emulateMedia({ media: 'print' });
    await expect(view.getByText('Revealed on step one')).toBeVisible();
    await expect(view.getByText('Shown at the last step.')).toBeVisible();
    await expect(view.locator('.tx-deck-print-view__notes')).toHaveCount(3);
    // `null` restores the default: page.pdf() renders with print media (an explicit `screen` would win).
    await page.emulateMedia({ media: null });
    const boxes = pageBoxes(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
    expect(boxes.slice(0, 3)).toEqual([
      [960, 540],
      [960, 540],
      [960, 540],
    ]);
    // The appendix starts on its own page after the slides.
    expect(boxes.length).toBeGreaterThan(3);
    expect(boxes.slice(3).every(([width, height]) => width !== 960 || height !== 540)).toBe(true);
  });
});
