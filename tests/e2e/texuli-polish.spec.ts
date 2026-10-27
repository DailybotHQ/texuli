import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * Layout regressions from the component polish audit (PLAN_005 Task 11,
 * POLISH_AUDIT.md): at phone widths and in right-to-left pages, these styled
 * components and media players must not scroll the page sideways, leave the
 * viewport, or detach their parts; Button colors survive a host's cascade
 * layers. Each case names its audit finding. One page session.
 */

type Direction = 'ltr' | 'rtl';

/** Pages that already carry the right-to-left init script. */
const withDirScript = new WeakSet<Page>();

async function openExample(page: Page, id: string, width: number, dir: Direction = 'ltr') {
  await page.setViewportSize({ width, height: 900 });
  if (!withDirScript.has(page)) {
    withDirScript.add(page);
    // A right-to-left load turns the whole page right-to-left, as a host app
    // would before mount; the other loads of the session stay left-to-right.
    await page.addInitScript(() => {
      if (new URLSearchParams(location.search).get('test-dir') !== 'rtl') return;
      const apply = () => {
        if (document.documentElement) document.documentElement.dir = 'rtl';
      };
      apply();
      document.addEventListener('readystatechange', apply);
    });
  }
  await page.goto(`/?fixture=${id}&mode=light&test-dir=${dir}`);
  const host = page.locator(`[data-example-host="${id}"]`);
  await expect(host).toBeVisible({ timeout: 20_000 });
  await expect(host.locator(':scope > p[role="status"]')).toHaveCount(0, { timeout: 20_000 });
}

async function expectNoPageScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'document scroll width').toBeLessThanOrEqual(client);
}

const BUTTON_CSS = readFileSync(
  join(process.cwd(), 'packages/texuli/src/components/button/button.css'),
  'utf8'
);

function pageHtml(extraHead: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
:root {
  --tx-primary: #1e3a5f;
  --tx-primary-foreground: #ffffff;
  --tx-link: #47658d;
}
@layer site-base, tx.base, tx.components, site-overrides;
@layer site-base {
  a { color: var(--tx-link); }
}
${BUTTON_CSS}
${extraHead}
</style>
</head>
<body>${body}</body>
</html>`;
}

const cases: { id: string; finding: string; widths: number[]; dirs: Direction[] }[] = [
  { id: 'texuli-tabs-accordion', finding: 'P1-03', widths: [320, 1280], dirs: ['ltr', 'rtl'] },
  { id: 'texuli-choice', finding: 'P1-04', widths: [320], dirs: ['ltr', 'rtl'] },
  { id: 'texuli-slider', finding: 'P1-05', widths: [320], dirs: ['rtl'] },
  { id: 'ui-carousel-states', finding: 'P1-06', widths: [320], dirs: ['ltr', 'rtl'] },
  { id: 'texuli-rating', finding: 'P1-08', widths: [320], dirs: ['ltr', 'rtl'] },
  { id: 'texuli-number-pin', finding: 'P1-09', widths: [320], dirs: ['ltr', 'rtl'] },
];

test('component polish: no sideways scroll, parts stay attached, forced colors, media players, Button cascade layers', async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (const { id, finding, widths, dirs } of cases) {
    for (const width of widths) {
      for (const dir of dirs) {
        await test.step(`${id} (${finding}) at ${width}px ${dir}`, async () => {
          await openExample(page, id, width, dir);
          await expectNoPageScroll(page);
        });
      }
    }
  }

  await test.step('the open hover card stays inside a 320px viewport (P1-07)', async () => {
    await openExample(page, 'ui-popover-states', 320);
    const card = page.locator('.tx-hover-card').first();
    await expect(card).toBeVisible();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('no hover card box');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  });

  await test.step('the slider thumb sits on the end of its range in RTL (P1-05)', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      await openExample(page, 'texuli-slider', 480, dir);
      const slider = page.locator('.tx-slider--horizontal').first();
      const geometry = await slider.evaluate((root) => {
        const thumb = root.querySelector('.tx-slider__thumb')?.getBoundingClientRect();
        const range = root.querySelector('.tx-slider__range')?.getBoundingClientRect();
        return thumb && range
          ? {
              thumbCenter: thumb.left + thumb.width / 2,
              rangeStart: range.left,
              rangeEnd: range.right,
            }
          : null;
      });
      expect(geometry, dir).not.toBeNull();
      if (!geometry) continue;
      // A single-thumb range runs from the inline start to the thumb.
      const edge = dir === 'rtl' ? geometry.rangeStart : geometry.rangeEnd;
      expect(
        Math.abs(geometry.thumbCenter - edge),
        `${dir} thumb center vs range edge`
      ).toBeLessThan(1.5);
    }
  });

  await test.step('color swatches keep their fill and show selection in forced colors (P1-10)', async () => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openExample(page, 'texuli-tags-color', 1280);
    // One picker's presets (the example has more than one picker).
    const swatches = page
      .locator('.tx-color-picker__swatches')
      .first()
      .locator('.tx-color-picker__swatch');
    await expect(swatches.first()).toBeVisible();
    const styles = await swatches.evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          pressed: element.getAttribute('aria-pressed') === 'true',
          background: style.backgroundColor,
          border: `${style.borderTopWidth} ${style.borderTopColor}`,
        };
      })
    );
    // Each preset keeps its own color instead of collapsing to the system canvas.
    expect(new Set(styles.map((style) => style.background)).size).toBe(styles.length);
    const selected = styles.filter((style) => style.pressed);
    const others = styles.filter((style) => !style.pressed);
    expect(selected.length).toBeGreaterThan(0);
    expect(others.length).toBeGreaterThan(0);
    for (const style of selected) {
      for (const other of others) expect(style.border).not.toBe(other.border);
    }
    await page.emulateMedia({ forcedColors: 'none' });
  });

  await test.step('the audio waveform spans its player (P1-14)', async () => {
    for (const width of [412, 1280]) {
      await openExample(page, 'media-audio', width);
      const host = page.locator('[data-example-host="media-audio"]');
      // The drawn peaks, not the SVG box: the box was always full width, the
      // drawing inside it was letterboxed to about 150px.
      const sizes = await host
        .locator('.tx-audio-waveform')
        .first()
        .evaluate((svg) => {
          const bars = [...svg.querySelectorAll('rect')].map((bar) => bar.getBoundingClientRect());
          const start = Math.min(...bars.map((bar) => bar.left));
          const end = Math.max(...bars.map((bar) => bar.right));
          return { drawn: end - start, box: svg.getBoundingClientRect().width };
        });
      expect(sizes.drawn, `${width}px: drawn peaks vs the waveform box`).toBeGreaterThan(
        sizes.box * 0.95
      );
    }
  });

  await test.step('video controls are token-styled with real touch targets (P1-15)', async () => {
    await openExample(page, 'media-video', 412);
    const host = page.locator('[data-example-host="media-video"]');
    const controls = host.locator('[data-tx-video-controls]').first();
    const play = controls.getByRole('button', { name: 'Play video' });
    const playBox = await play.boundingBox();
    expect(playBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(await play.locator('svg').count()).toBe(1);
    const seek = await controls.locator('input[type="range"]').boundingBox();
    expect(seek?.height ?? 0, 'seek hit area').toBeGreaterThanOrEqual(24);
    const appearances = await controls
      .locator('select')
      .evaluateAll((selects) => selects.map((select) => getComputedStyle(select).appearance));
    expect(appearances.length).toBeGreaterThan(0);
    expect(new Set(appearances)).toEqual(new Set(['none']));
    // The transport (play, seek, time) shares one row on a phone.
    expect(
      Math.abs(
        (seek?.y ?? 0) + (seek?.height ?? 0) / 2 - ((playBox?.y ?? 0) + (playBox?.height ?? 0) / 2)
      )
    ).toBeLessThan(4);
  });

  // Host CSS layer contract for anchor Buttons: a host that layers its element
  // defaults before Texuli's keeps Button colors, and a later host layer can
  // still override them. Cascade layers need a real browser engine.
  await test.step('Button keeps primary-foreground under a layered host a { color }; a later host layer wins', async () => {
    await page.setContent(
      pageHtml(
        '',
        '<a class="tx-button tx-button--default tx-button--md" href="#get-started">Start free</a>'
      )
    );
    expect(
      await page.locator('a.tx-button--default').evaluate((el) => getComputedStyle(el).color)
    ).toMatch(/rgb\(\s*255,\s*255,\s*255\s*\)/);
    await page.setContent(
      pageHtml(
        '@layer site-overrides { .tx-button.consumer-ink { color: rgb(10, 20, 30); } }',
        '<a class="tx-button tx-button--default tx-button--md consumer-ink" href="#x">Override me</a>'
      )
    );
    expect(
      await page.locator('a.consumer-ink').evaluate((el) => getComputedStyle(el).color)
    ).toMatch(/rgb\(\s*10,\s*20,\s*30\s*\)/);
  });
});
