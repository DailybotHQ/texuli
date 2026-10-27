import AxeBuilder from '@axe-core/playwright';
import { expect, type Frame, type FrameLocator, type Page, test } from '@playwright/test';
import { COMPONENT_PAGES } from '../../apps/website/src/components/component-pages/load-manifests.ts';
import { AXE_TAGS, serveDist, settle } from './support/site.ts';

/*
 * texuli.com living component gallery (T-site-live-gallery), in the browser:
 * every catalog card has a preview slot and previews load lazily as they near
 * the viewport; a sample of cards (the first of each category and every
 * sixteenth card) mounts its real component in the grid and passes axe with
 * zero exclusions in its own preview document (what its frame loads) in
 * light and dark (WCAG rules for component fragments, plus best practices for
 * full-page layouts, which also run in forced colors); and the
 * interactions work: category, tag and search filters, per-preview dark and
 * right to left, the props panel driving the preview and the code, overlays
 * by pointer and keyboard, forms, and full-page layouts opening live. Every
 * component's own axe and behavior run in the fixture app (a11y-*.spec.ts,
 * tests/behavior); the stage map and props protocol are unit-tested in
 * scripts/tests/site-loaders.test.ts.
 */

const origin = serveDist();
const GALLERY = '/gallery-components/';
const CARD_COUNT = COMPONENT_PAGES.length;

/** Opens the gallery; returns the off-origin requests the page (and its frames) made. */
async function visit(page: Page): Promise<string[]> {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !/^(data|blob):/.test(url)) foreign.push(url);
  });
  await page.goto(`${origin()}${GALLERY}`);
  await settle(page);
  return foreign;
}

async function axe(page: Page, tags: string[] = AXE_TAGS): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(tags).analyze();
  return results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
  );
}

const card = (page: Page, id: string) => page.locator(`[data-tx-gallery-card="${id}"]`);
const preview = (page: Page, id: string): FrameLocator =>
  page.frameLocator(`[data-tx-preview-frame="${id}"]`);

/** Scrolls a card's preview into view and waits until its stage has mounted. */
async function showPreview(page: Page, id: string): Promise<FrameLocator> {
  // The slot exists from first paint; its iframe is created as it nears view.
  await page.locator(`[data-tx-preview-slot="${id}"]`).scrollIntoViewIfNeeded();
  const frame = page.locator(`[data-tx-preview-frame="${id}"]`);
  await expect(frame).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
  const stage = preview(page, id).locator(`[data-tx-live-stage="${id}"]`);
  await expect(stage).toBeVisible();
  await expect(stage.getByText(/^Loading (demo|chart|blocks|layout)/)).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(
    stage.getByRole('alert').filter({ hasText: /failed|No live stage|invalid/ })
  ).toHaveCount(0);
  return preview(page, id);
}

function frameFor(page: Page, id: string): Frame {
  // Exact `id` match: `id=alert` must not pick the `id=alert-dialog` preview.
  const frame = page
    .frames()
    .find((f) => f.url() !== '' && new URL(f.url()).searchParams.get('id') === id);
  if (!frame) throw new Error(`No preview frame for ${id}`);
  return frame;
}

test('lazy previews; a card sample mounts in the grid and passes axe in its own document in every mode', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ colorScheme: 'light' });
  const foreign = await visit(page);
  const cards = page.locator('[data-tx-gallery-card]');
  await expect(cards).toHaveCount(CARD_COUNT);
  await expect(page.locator('[data-tx-preview-slot]')).toHaveCount(CARD_COUNT);
  expect(await page.locator('[data-tx-preview-frame]').count()).toBeLessThan(10);
  // The first card of each category, and every sixteenth card.
  const all = await cards.evaluateAll((nodes) =>
    nodes.map((n) => [
      n.getAttribute('data-tx-gallery-card') ?? '',
      n.getAttribute('data-category') ?? '',
    ])
  );
  const seen = new Set<string>();
  const sample = all
    .filter(([, category = ''], index) => {
      const first = !seen.has(category);
      seen.add(category);
      return first || index % 16 === 0;
    })
    .map(([id]) => id as string);
  expect(sample.length).toBeGreaterThan(6);
  for (const id of sample) {
    await showPreview(page, id);
    const stage = preview(page, id).locator(`[data-tx-live-stage="${id}"]`);
    expect(await stage.getAttribute('data-family'), id).toBeTruthy();
    expect(
      await preview(page, id).locator('[data-tx-gallery-preview], .preview--empty').count(),
      id
    ).toBe(0);
  }
  expect(foreign).toEqual([]);

  // Each preview's own document (what its frame loads), axe with zero
  // exclusions: the sample in light and dark, full-page layouts also in
  // forced colors.
  const layouts = (
    await page
      .locator('[data-tx-open-preview]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-tx-open-preview') ?? ''))
  ).filter((_, index) => index % 6 === 0);
  expect(layouts.length).toBeGreaterThanOrEqual(2);
  const found: string[] = [];
  for (const mode of ['light', 'dark', 'forced-colors'] as const) {
    await page.emulateMedia({
      colorScheme: mode === 'dark' ? 'dark' : 'light',
      forcedColors: mode === 'forced-colors' ? 'active' : 'none',
    });
    for (const id of mode === 'forced-colors' ? layouts : [...sample, ...layouts]) {
      const theme = mode === 'dark' ? 'dark' : 'light';
      await page.goto(`${origin()}/gallery-components/preview/?id=${id}&mode=${theme}&dir=ltr`);
      await settle(page);
      const stage = page.locator(`[data-tx-live-stage="${id}"]`);
      await expect(stage, id).toBeVisible();
      await expect(stage.getByText(/^Loading (demo|chart|blocks|layout)/)).toHaveCount(0, {
        timeout: 20_000,
      });
      // A component preview is a fragment shown inside the gallery page, so
      // its document alone has no h1 or landmarks: it is held to the WCAG
      // rules; a full-page layout is a page and gets the best practices too.
      const tags = layouts.includes(id)
        ? AXE_TAGS
        : AXE_TAGS.filter((tag) => tag !== 'best-practice');
      for (const violation of await axe(page, tags)) found.push(`${mode} ${id} ${violation}`);
    }
  }
  expect(found).toEqual([]);
});

test('filters, per-preview mode and direction, props panel, overlays, forms and live layouts', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await visit(page)).toEqual([]);
  const cards = page.locator('[data-tx-gallery-card]');
  await expect(cards).toHaveCount(CARD_COUNT);

  await page
    .getByRole('group', { name: 'Category', exact: true })
    .getByRole('button', { name: 'overlays', exact: true })
    .click();
  const categories = await cards.evaluateAll((nodes) => [
    ...new Set(nodes.map((n) => n.getAttribute('data-category'))),
  ]);
  expect(categories).toEqual(['overlays']);
  await page
    .getByRole('group', { name: 'Category', exact: true })
    .getByRole('button', { name: 'All', exact: true })
    .click();

  await page
    .getByRole('group', { name: 'Tag', exact: true })
    .getByRole('button', { name: '@texuli/charts', exact: true })
    .click();
  const charts = await cards.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('data-tx-gallery-card') ?? '')
  );
  expect(charts.length).toBeGreaterThan(10);
  expect(charts.every((id) => id.startsWith('charts-'))).toBe(true);
  await page
    .getByRole('group', { name: 'Tag', exact: true })
    .getByRole('button', { name: 'All', exact: true })
    .click();

  // A tag chip on a card filters too, and pressing it again clears the filter.
  const chip = card(page, 'badge').getByRole('button', { name: 'display' });
  await chip.click();
  await expect(page.locator('[data-tx-gallery-card="tag"]')).toBeVisible();
  expect(await cards.count()).toBeLessThan(CARD_COUNT);
  await card(page, 'badge').getByRole('button', { name: 'display' }).click();
  await expect(cards).toHaveCount(CARD_COUNT);

  await page.getByLabel('Search').fill('sparkline');
  await expect(card(page, 'charts-sparkline')).toBeVisible();
  expect(await cards.count()).toBeLessThan(5);
  await page.getByLabel('Search').fill('');
  await expect(cards).toHaveCount(CARD_COUNT);

  // One preview switches to dark and to right to left; the page keeps its own mode.
  await showPreview(page, 'alert');
  const frame = frameFor(page, 'alert');
  expect(await frame.locator('html').getAttribute('data-tx-mode')).toBe('light');

  const tools = card(page, 'alert').locator('[data-tx-demo-frame]');
  await tools.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(frame.locator('html')).toHaveAttribute('data-tx-mode', 'dark', {
    timeout: 15_000,
  });
  // Dark must look dark: the preview's background is a dark color.
  const lightness = await frame.locator('body').evaluate((body) => {
    const [r, g, b] = (getComputedStyle(body).backgroundColor.match(/\d+/g) ?? []).map(Number);
    return ((r ?? 255) + (g ?? 255) + (b ?? 255)) / 3;
  });
  expect(lightness).toBeLessThan(80);
  // The rest of the page keeps its own mode.
  expect(await page.locator('html').getAttribute('data-tx-mode')).toBe('light');

  await tools.getByRole('button', { name: 'RTL', exact: true }).click();
  await expect(frame.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 15_000 });
  await tools.getByRole('button', { name: 'LTR', exact: true }).click();
  await expect(frame.locator('html')).toHaveAttribute('dir', 'ltr', { timeout: 15_000 });

  // The props panel drives the preview and the code sample.
  const live = await showPreview(page, 'button');
  const button = card(page, 'button');
  await button.getByRole('button', { name: 'Props and code' }).click();
  const panel = button.locator('[data-tx-props-panel]');
  await expect(panel).toBeVisible();

  // enum -> segmented control
  await panel.getByRole('button', { name: 'outline', exact: true }).first().click();
  await expect(live.getByRole('button', { name: 'Save note' })).toHaveAttribute(
    'data-variant',
    'outline'
  );
  await expect(button.locator('[data-tx-code-sample] code')).toContainText('variant="outline"');
  await expect(button.locator('[data-tx-code-sample] code')).toContainText(
    "import { Button } from 'texuli/button';"
  );
  // boolean -> switch
  await panel.getByRole('switch', { name: 'disabled' }).click();
  await expect(live.getByRole('button', { name: 'Save note' })).toBeDisabled();
  await expect(button.locator('[data-tx-code-sample] code')).toContainText('disabled');

  // string -> input
  const alert = card(page, 'alert');
  const alertLive = await showPreview(page, 'alert');
  await alert.getByRole('button', { name: 'Props and code' }).click();
  const title = alert.locator('[data-tx-props-panel]').getByRole('textbox').first();
  await title.fill('Restock today');
  await expect(alertLive.getByText('Restock today')).toBeVisible();
  await expect(alert.locator('[data-tx-code-sample] code')).toContainText('title="Restock today"');

  // number -> number field
  const pagination = card(page, 'pagination');
  const pages = await showPreview(page, 'pagination');
  await pagination.getByRole('button', { name: 'Props and code' }).click();
  const count = pagination.locator('[data-tx-props-panel] input[type="number"]').nth(1);
  await count.fill('3');
  await expect(pages.getByRole('button', { name: /3/ }).first()).toBeVisible();
  await expect(pages.getByRole('button', { name: /^(Page )?12$/ })).toHaveCount(0);

  // Overlays open by click and by keyboard and close with Escape; forms take typing.
  expect(await visit(page)).toEqual([]);
  const dialog = await showPreview(page, 'dialog');
  await dialog.getByRole('button', { name: 'Edit note' }).click();
  await expect(dialog.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('dialog')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Edit note' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('dialog', { name: 'Edit note' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.getByRole('status')).toContainText('Saved');

  const menu = await showPreview(page, 'dropdown-menu');
  const trigger = menu.getByRole('button', { name: 'Actions' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('menu')).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('menu')).toHaveCount(0);
  await expect(menu.getByRole('status')).toContainText('Chose');

  const select = await showPreview(page, 'select');
  await select.getByRole('combobox').click();
  await select.getByRole('option', { name: /Team/ }).click();
  await expect(select.getByRole('status')).toContainText('team');

  const sheet = await showPreview(page, 'sheet');
  await sheet.getByRole('button', { name: 'Open filters' }).click();
  await expect(sheet.getByRole('dialog', { name: 'Filters' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet.getByRole('dialog')).toHaveCount(0);
  const input = await showPreview(page, 'input');
  const name = input.getByRole('textbox', { name: 'Full name' });
  await name.fill('Grace Example');
  await expect(name).toHaveValue('Grace Example');

  const form = await showPreview(page, 'form');
  await form.getByRole('button', { name: 'Save team' }).click();
  await expect(form.getByText('Enter a team name.')).toBeVisible();
  await form.getByRole('textbox', { name: /Team name/ }).fill('Harbor design');
  await form.getByRole('textbox', { name: /Contact email/ }).fill('ada@example.com');
  await form.getByRole('button', { name: 'Save team' }).click();
  await expect(form.getByRole('status')).toContainText('Saved team Harbor design');

  // Full-page layouts render inert in the grid and open live in their own document.
  const layout = await showPreview(page, 'layout-sidebar');
  const layoutFrame = page.locator('[data-tx-preview-frame="layout-sidebar"]');
  await expect(layoutFrame).toHaveAttribute('inert', '');
  await expect(layoutFrame).toHaveAttribute('aria-hidden', 'true');
  await expect(layout.locator('main')).toHaveCount(1);
  const open = card(page, 'layout-sidebar').getByRole('link', { name: /Open the live layout/ });
  await open.click();
  await expect(page).toHaveURL(/\/gallery-components\/preview\/\?id=layout-sidebar/);
  await expect(page.locator('[data-tx-live-stage="layout-sidebar"] main')).toBeVisible();
});
