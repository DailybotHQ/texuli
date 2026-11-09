import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * PLAN_016 T-t4-e2e (kit API §7, §8): the design-system kit (`texuli/ds-kit`) on the fixture
 * app (tests/fixtures/app/ds-kit.html): the acme document locked to a small allow set, a
 * library preview, a previous version. axe in light, dark and both views; the mode switch
 * and the section navigation from the keyboard; every allowed state reachable (prop-backed
 * states rendered, pseudo-states reached with the keyboard and the pointer); no request
 * leaves the origin.
 */

const KIT = '[data-tx-ds-kit]';

async function open(page: Page, mode: 'light' | 'dark', view: 'both' | 'light' | 'dark' = 'both') {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: mode });
  await page.goto(`/ds-kit.html?mode=${mode}&view=${view}`);
  await expect(page.locator('html[data-ds-kit-ready="true"]')).toBeAttached({ timeout: 60_000 });
  // The lazily loaded matrix samples have painted.
  await expect(
    page.locator('[data-tx-ds-kit-cell] [data-tx-component="button"]').first()
  ).toBeVisible();
}

async function axe(page: Page) {
  const result = await new AxeBuilder({ page }).include(KIT).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.help}`);
}

for (const mode of ['light', 'dark'] as const) {
  test(`passes axe in ${mode} mode, with both views and with one view`, async ({ page }) => {
    await open(page, mode);
    for (const section of ['foundations', 'voice', 'matrix', 'library', 'changes'])
      await expect(page.locator(`[data-tx-ds-kit-section="${section}"]`), section).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await open(page, mode, mode);
    expect(await axe(page)).toEqual([]);
  });
}

test('switches the mode view from the keyboard', async ({ page }) => {
  await open(page, 'light');
  const matrixModes = () =>
    page
      .locator('#tx-ds-kit-matrix-button [data-tx-ds-kit-mode]')
      .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-tx-ds-kit-mode')))]);
  expect(await matrixModes()).toEqual(['light', 'dark']);
  const radios = page.locator('[data-tx-ds-kit-modes] input[type="radio"]');
  await radios.first().focus();
  await expect(radios.first()).toBeChecked();
  // Arrow keys move through the radio group and select.
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeChecked();
  await expect(page.locator(KIT)).toHaveAttribute('data-tx-ds-kit-mode-view', /^(light|dark)$/);
  const view = await page.locator(KIT).getAttribute('data-tx-ds-kit-mode-view');
  expect(await matrixModes()).toEqual([view]);
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(2)).toBeChecked();
  expect((await matrixModes()).length).toBe(1);
});

test('reaches every section and item from the navigation with the keyboard', async ({ page }) => {
  await open(page, 'light');
  const link = page.locator('[data-tx-ds-kit-nav="matrix"]');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#tx-ds-kit-matrix$/);
  await expect(link).toHaveAttribute('aria-current', 'true');
  // The section's items appear under it: one per enabled component, in catalog order.
  const items = page.locator('[data-tx-ds-kit-nav-item]');
  await expect(items.first()).toBeVisible();
  expect(
    await items.evaluateAll((els) => els.map((el) => el.getAttribute('data-tx-ds-kit-nav-item')))
  ).toEqual(['alert', 'badge', 'button', 'card', 'checkbox', 'chip', 'input', 'switch']);
  await page.locator('[data-tx-ds-kit-nav-item="button"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#tx-ds-kit-matrix-button$/);
  await expect(page.locator('#tx-ds-kit-matrix-button')).toBeInViewport();
  // Library: the entry with a live preview.
  await page.locator('[data-tx-ds-kit-nav="library"]').focus();
  await page.keyboard.press('Enter');
  await expect(
    page.locator('#tx-ds-kit-library-pricing-card [data-library-preview="pricing-card"]')
  ).toHaveCount(2);
});

test('renders exactly the allowed combinations and every allowed state', async ({
  page,
  browserName,
}) => {
  await open(page, 'light', 'light');
  const button = page.locator('#tx-ds-kit-matrix-button');
  // 2 variants × 2 sizes, then disabled and loading, then the live sample.
  await expect(
    button.locator('[data-tx-ds-kit-cell-kind="grid"] [data-tx-component="button"]')
  ).toHaveCount(4);
  await expect(button.locator('[data-tx-component="button"][data-tx-variant="ghost"]')).toHaveCount(
    0
  );
  await expect(button.locator('[data-tx-ds-kit-disallowed="variant"]')).toContainText('ghost');
  // Prop-backed states are rendered by their props.
  await expect(
    button.locator('[data-tx-ds-kit-state="disabled"] [data-tx-component="button"]')
  ).toBeDisabled();
  await expect(
    button.locator('[data-tx-ds-kit-state="loading"] [data-tx-component="button"]')
  ).toHaveAttribute('aria-busy', 'true');
  const chip = page.locator('#tx-ds-kit-matrix-chip');
  await expect(
    chip.locator('[data-tx-ds-kit-state="selected"] [data-tx-component="chip"]')
  ).toHaveAttribute('aria-pressed', 'true');
  const checkbox = page.locator('#tx-ds-kit-matrix-checkbox');
  await expect(
    checkbox
      .locator(
        '[data-tx-ds-kit-state="checked"] [role="checkbox"], [data-tx-ds-kit-state="checked"] input[type="checkbox"]'
      )
      .first()
  ).toBeChecked();

  // Pseudo-states: the live sample takes focus from the keyboard, the pointer and a press.
  const live = button.locator('[data-tx-ds-kit-cell="live"] [data-tx-component="button"]');
  // WebKit's default Tab skips buttons (a macOS setting); Option+Tab reaches them.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await live.focus();
  await page.keyboard.press(`Shift+${tab}`);
  await page.keyboard.press(tab);
  await expect(live).toBeFocused();
  expect(await live.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
  await live.hover();
  expect(await live.evaluate((el) => el.matches(':hover'))).toBe(true);
  await page.mouse.down();
  expect(await live.evaluate((el) => el.matches(':active'))).toBe(true);
  await page.mouse.up();
});

test('makes no request outside the origin', async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
  const outside: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol !== 'data:' && url.protocol !== 'blob:' && url.origin !== origin)
      outside.push(request.url());
  });
  await open(page, 'dark');
  await page.locator('[data-tx-ds-kit-nav="changes"]').click();
  await expect(page.locator('[data-tx-ds-kit-changes="allow"]')).toContainText('button');
  expect(outside).toEqual([]);
});
