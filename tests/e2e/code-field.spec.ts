import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { createServer, type ViteDevServer } from 'vite';

/*
 * D-G-022: `CodeField` from `@texuli/blocks/code-field` (the
 * `blocks-code-field` example) in a real engine, on chromium and webkit.
 *
 * - Alignment: the field is photographed twice, once painting only the
 *   overlay's text and once painting only the textarea's own text, both in
 *   one solid color. Glyphs in the same places give the same pixels, so a
 *   drift of one pixel anywhere shows up as hundreds of changed pixels
 *   (a control shifts the overlay by 1px and checks that it is caught).
 * - Keyboard: Tab indents (and undo takes it back), Escape then Tab leaves.
 * - axe in light and dark, and forced colors (chromium): the textarea
 *   shows its own text and the overlay text is hidden.
 * - Hydration: server HTML hydrates in place, text typed before hydration is
 *   kept, and the caret keeps working.
 */

const OVERLAY_ONLY = `
  .tx-code-field__input { caret-color: transparent !important; }
  .tx-code-field__pre, .tx-code-field__pre * { color: rgb(0, 0, 0) !important; }
`;
const TEXTAREA_ONLY = `
  .tx-code-field__input { caret-color: transparent !important; color: rgb(0, 0, 0) !important; }
  .tx-code-field__text { visibility: hidden !important; }
`;

async function shot(page: Page, field: Locator, css: string): Promise<string> {
  const handle = await page.addStyleTag({ content: css });
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
  const png = await field.locator('.tx-code-field__stack').screenshot({ caret: 'hide' });
  await handle.evaluate((node) => node.remove());
  return png.toString('base64');
}

/** Pixels that differ clearly between two same-size PNGs, and the inked pixels of the second. */
async function compare(page: Page, a: string, b: string) {
  return page.evaluate(
    async ([first, second]) => {
      const load = (data: string) =>
        new Promise<HTMLImageElement>((done, fail) => {
          const image = new Image();
          image.onload = () => done(image);
          image.onerror = fail;
          image.src = `data:image/png;base64,${data}`;
        });
      const [x, y] = await Promise.all([load(first as string), load(second as string)]);
      if (x.width !== y.width || x.height !== y.height) {
        return { sameSize: false, differing: -1, inked: 0 };
      }
      const pixels = (image: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext('2d') as CanvasRenderingContext2D;
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height).data;
      };
      const p = pixels(x);
      const q = pixels(y);
      let differing = 0;
      let inked = 0;
      for (let i = 0; i < p.length; i += 4) {
        const delta = Math.max(
          Math.abs((p[i] ?? 0) - (q[i] ?? 0)),
          Math.abs((p[i + 1] ?? 0) - (q[i + 1] ?? 0)),
          Math.abs((p[i + 2] ?? 0) - (q[i + 2] ?? 0))
        );
        if (delta > 96) differing += 1;
        if ((q[i] ?? 255) < 128) inked += 1;
      }
      return { sameSize: true, differing, inked };
    },
    [a, b]
  );
}

async function expectAligned(page: Page, field: Locator, label: string) {
  const overlay = await shot(page, field, OVERLAY_ONLY);
  const native = await shot(page, field, TEXTAREA_ONLY);
  const result = await compare(page, overlay, native);
  expect(result.sameSize, label).toBe(true);
  expect(result.inked, `${label}: the textarea painted text`).toBeGreaterThan(200);
  // Antialiasing may differ on a few edge pixels; a drifted glyph changes many.
  expect(result.differing, `${label}: ${JSON.stringify(result)}`).toBeLessThan(
    Math.max(12, result.inked * 0.01)
  );
  return result;
}

async function setValue(field: Locator, value: string) {
  await field.locator('textarea').evaluate((area: HTMLTextAreaElement, next) => {
    area.value = next;
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?fixture=blocks-code-field');
  await expect(page.locator('[data-example="blocks-code-field"] textarea').first()).toBeVisible({
    timeout: 30_000,
  });
});

test('the overlay text sits exactly on the textarea text', async ({ page }) => {
  const ts = page.locator('[data-tx-code-field]:has([data-case="ts"])');
  const wrapped = page.locator('[data-tx-code-field]:has([data-case="wrap"])');
  await expectAligned(page, ts, 'no wrap, line numbers');
  await expectAligned(page, wrapped, 'wrap, line numbers');

  // Tabs, a wrapped long line, an empty last line and markup-like text.
  await setValue(wrapped, `a:\n\tb: 1\n\t\tc: "<b>${'long '.repeat(40)}</b>"\n# done\n`);
  await expectAligned(page, wrapped, 'wrap, tabs');

  // Scrolled sideways: the overlay follows the textarea.
  await setValue(ts, `const wide = "${'x'.repeat(240)}";\n\tconst next = 2;`);
  const scroll = await ts.locator('textarea').evaluate(async (area: HTMLTextAreaElement) => {
    area.scrollLeft = 120;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return area.scrollLeft;
  });
  expect(scroll).toBeGreaterThan(0);
  await expectAligned(page, ts, 'scrolled sideways');

  // Control: a 1px drift of the overlay is caught.
  const drift = await page.addStyleTag({
    content: '[data-tx-code-field]:has([data-case="ts"]) .tx-code-field__pre { translate: 1px 0; }',
  });
  const overlay = await shot(page, ts, OVERLAY_ONLY);
  const native = await shot(page, ts, TEXTAREA_ONLY);
  const drifted = await compare(page, overlay, native);
  expect(drifted.differing).toBeGreaterThan(Math.max(12, drifted.inked * 0.01));
  await drift.evaluate((node) => node.remove());

  // Same line boxes: the textarea needs no vertical scroll in either mode.
  for (const field of [ts, wrapped]) {
    const box = await field.locator('textarea').evaluate((area: HTMLTextAreaElement) => ({
      scroll: area.scrollHeight,
      client: area.clientHeight,
    }));
    expect(box.scroll - box.client).toBeLessThanOrEqual(1);
  }
});

test('Tab indents, undo takes it back, and Escape then Tab leaves the field', async ({ page }) => {
  const ts = page.locator('textarea[data-case="ts"]');
  const wrapped = page.locator('textarea[data-case="wrap"]');
  const before = await ts.inputValue();
  await ts.focus();
  await ts.evaluate((area: HTMLTextAreaElement) => area.setSelectionRange(0, 0));
  await page.keyboard.press('Tab');
  await expect(ts).toBeFocused();
  await expect(ts).toHaveValue(`  ${before}`);
  await expect(
    page.locator('[data-tx-code-field]:has([data-case="ts"]) .tx-code-field__text').first()
  ).toHaveText('  interface Note {');
  await page.keyboard.press('Shift+Tab');
  await expect(ts).toHaveValue(before);
  await page.keyboard.press('Tab');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(ts).toHaveValue(before);
  // Enter keeps the indentation of the line.
  await ts.evaluate((area: HTMLTextAreaElement) => {
    const end = area.value.indexOf('\n', area.value.indexOf('id: string'));
    area.setSelectionRange(end, end);
  });
  await page.keyboard.press('Enter');
  await page.keyboard.type('done: boolean;');
  await expect(ts).toHaveValue(
    before.replace('  id: string;\n', '  id: string;\n  done: boolean;\n')
  );
  // Escape, then Tab, moves on; Escape, then Shift+Tab, comes back.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Tab');
  await expect(wrapped).toBeFocused();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Shift+Tab');
  await expect(ts).toBeFocused();
  await expect(ts).toHaveValue(
    before.replace('  id: string;\n', '  id: string;\n  done: boolean;\n')
  );
});

test('passes axe in light and dark', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page })
      .include('[data-example="blocks-code-field"]')
      .analyze();
    expect(
      results.violations.map((v) => [v.id, ...v.nodes.map((n) => String(n.target))]),
      colorScheme
    ).toEqual([]);
  }
});

test('shows the textarea text in forced colors', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'forced colors are emulated on chromium only');
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  const field = page.locator('[data-tx-code-field]:has([data-case="ts"])');
  const paint = await field.evaluate((root) => ({
    overlay: getComputedStyle(root.querySelector('.tx-code-field__text') as Element).visibility,
    text: getComputedStyle(root.querySelector('textarea') as Element).color,
  }));
  expect(paint.overlay).toBe('hidden');
  expect(paint.text).not.toBe('rgba(0, 0, 0, 0)');
  const results = await new AxeBuilder({ page })
    .include('[data-example="blocks-code-field"]')
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
});

test.describe('server HTML', () => {
  const entry = resolve(process.cwd(), 'packages/blocks/src/code/code-field-entry.ts');
  const props = {
    value: 'const a = 1;\nlet b = "x";',
    language: 'ts',
    'aria-label': 'Hydration probe',
  };
  let vite: ViteDevServer;
  let markup: string;

  test.beforeAll(async () => {
    vite = await createServer({
      configFile: false,
      root: process.cwd(),
      plugins: [svelte()],
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
    });
    const [{ CodeField }, { render }] = await Promise.all([
      vite.ssrLoadModule(entry),
      vite.ssrLoadModule('svelte/server'),
    ]);
    markup = render(CodeField, { props }).body;
  });

  test.afterAll(async () => {
    await vite?.close();
  });

  test('hydrates in place, keeps text typed before hydration, and the caret works', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/__code-field-ssr', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
          <body><main id="ssr-root">${markup}</main></body></html>`,
      })
    );
    await page.goto('/__code-field-ssr');
    const area = page.locator('#ssr-root textarea');
    await expect(area).toHaveValue(props.value);
    await expect(page.locator('#ssr-root .tx-code-tok--keyword').first()).toHaveText('const');
    // Typed before the scripts arrive.
    await area.focus();
    await area.evaluate((node: HTMLTextAreaElement) =>
      node.setSelectionRange(node.value.length, node.value.length)
    );
    await page.keyboard.type(' // early');
    const result = await page.evaluate(
      async ({ url, hydrateProps }) => {
        const target = document.querySelector('#ssr-root') as HTMLElement;
        const before = target.querySelector('textarea');
        const { hydrate } = await import('/node_modules/.vite/deps/svelte.js');
        const { CodeField } = await import(url);
        hydrate(CodeField, { target, props: hydrateProps });
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
        const after = target.querySelector('textarea') as HTMLTextAreaElement;
        return {
          sameNode: before === after,
          focused: document.activeElement === after,
          value: after.value,
          caret: after.selectionStart,
        };
      },
      { url: `/@fs${entry}`, hydrateProps: props }
    );
    expect(errors).toEqual([]);
    expect(result.sameNode).toBe(true);
    expect(result.value).toBe(`${props.value} // early`);
    expect(result.focused).toBe(true);
    expect(result.caret).toBe(result.value.length);
    // The caret keeps typing where it was, and the overlay follows.
    await page.keyboard.type(' ok');
    await expect(area).toHaveValue(`${props.value} // early ok`);
    await expect(page.locator('#ssr-root .tx-code-field__line').last()).toHaveText(
      'let b = "x"; // early ok'
    );
    await page.keyboard.press('Tab');
    await expect(area).toHaveValue(`${props.value} // early ok  `);
  });
});
