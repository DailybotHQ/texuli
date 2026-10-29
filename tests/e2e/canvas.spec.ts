import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * `@texuli/canvas/editor` in a real browser (fixture page `canvas.html`):
 * draw a shape with the pointer, connect shapes by keyboard, move by
 * keyboard and pointer, zoom, undo, export SVG and PNG, and pass axe in
 * light, dark and forced colors.
 */

type Shape = { id: string; type: string; x: number; y: number; width: number; height: number };
type Canvas = {
  shapes: Shape[];
  connectors: { id: string; from: { shape?: string }; to: { shape?: string } }[];
};

declare global {
  interface Window {
    txCanvas: { doc: () => Canvas; svg: () => string; png: () => Promise<number[]> };
  }
}

async function open(page: Page, query = '') {
  await page.goto(`/canvas.html${query}`);
  await expect(page.locator('#canvas-status')).toHaveText('Ready', { timeout: 30_000 });
  await expect(shape(page, 'start')).toBeVisible();
}

const shape = (page: Page, id: string) => page.locator(`[data-tx-shape="${id}"]`);
const doc = (page: Page) => page.evaluate(() => window.txCanvas.doc());
const find = async (page: Page, id: string) =>
  (await doc(page)).shapes.find((each) => each.id === id) as Shape;

test.describe('canvas editor', () => {
  test('draws a rectangle with the pointer and undoes it', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Rectangle (R)' }).click();
    const box = await page.getByRole('application').boundingBox();
    if (!box) throw new Error('no surface');
    const x = box.x + box.width - 260;
    const y = box.y + box.height - 160;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 40, { steps: 4 });
    await page.mouse.move(x + 120, y + 80, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await doc(page)).shapes.length).toBe(4);
    const added = (await doc(page)).shapes.at(-1) as Shape;
    expect(added.type).toBe('rect');
    expect(added.width).toBeGreaterThan(20);
    // The new shape is selected and focused; undo removes it.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await doc(page)).shapes.length).toBe(3);
  });

  test('tabs in reading order, moves by keyboard, resizes with Shift and connects with K', async ({
    page,
  }) => {
    await open(page);
    await shape(page, 'start').focus();
    await page.keyboard.press('Tab');
    await expect(shape(page, 'triage')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(shape(page, 'note')).toBeFocused();
    const before = await find(page, 'note');
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await find(page, 'note')).x).toBe(before.x + 8);
    await page.keyboard.press('Shift+ArrowDown');
    await expect.poll(async () => (await find(page, 'note')).height).toBe(before.height + 8);
    // Undo the resize, then the move.
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await find(page, 'note')).x).toBe(before.x);
    await page.keyboard.press('k');
    await page.keyboard.press('Shift+Tab');
    await expect(shape(page, 'triage')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () =>
        (await doc(page)).connectors.some((c) => c.from.shape === 'note' && c.to.shape === 'triage')
      )
      .toBe(true);
    await expect(shape(page, 'note')).toBeFocused();
    // Past the last shape, Tab leaves the canvas.
    await page.keyboard.press('Tab');
    await expect(shape(page, 'note')).not.toBeFocused();
  });

  test('moves a shape with the pointer and zooms with keys and buttons', async ({ page }) => {
    await open(page);
    const before = await find(page, 'start');
    const box = await shape(page, 'start').boundingBox();
    if (!box) throw new Error('no shape');
    const zoom = await page.evaluate(() => {
      const world = document.querySelector('.tx-canvas-surface__world') as SVGGElement;
      return new DOMMatrix(getComputedStyle(world).transform).a;
    });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 6 });
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 60, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => (await find(page, 'start')).x)
      .toBeGreaterThan(before.x + 40 / zoom);
    // Keys zoom around the view center; the zoom-out button zooms back.
    await shape(page, 'start').focus();
    await page.keyboard.press('+');
    const scale = () =>
      page.evaluate(() => {
        const world = document.querySelector('.tx-canvas-surface__world') as SVGGElement;
        return new DOMMatrix(getComputedStyle(world).transform).a;
      });
    await expect.poll(scale).toBeCloseTo(zoom * 1.25, 2);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect.poll(scale).toBeCloseTo(zoom, 2);
    await page.getByRole('button', { name: 'Zoom to fit' }).click();
    await expect(page.getByRole('application')).toBeVisible();
  });

  test('exports escaped SVG and a PNG', async ({ page }) => {
    await open(page);
    const svg = await page.evaluate(() => window.txCanvas.svg());
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('Docs were ready');
    const png = await page.evaluate(() => window.txCanvas.png());
    expect(png).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });

  for (const mode of ['light', 'dark', 'forced colors'] as const) {
    test(`passes axe with a selection, a focused shape and the shape tree (${mode})`, async ({
      page,
    }) => {
      if (mode === 'forced colors') await page.emulateMedia({ forcedColors: 'active' });
      await open(page, mode === 'dark' ? '?mode=dark' : '');
      await shape(page, 'start').focus();
      await page.keyboard.press('Tab');
      await expect(shape(page, 'triage')).toBeFocused();
      await expect(page.locator('[data-tx-shape-item="triage"]')).toHaveAttribute(
        'aria-selected',
        'true'
      );
      const results = await new AxeBuilder({ page })
        .include('#canvas')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (violation) =>
            `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`
        )
      ).toEqual([]);
    });
  }
});
