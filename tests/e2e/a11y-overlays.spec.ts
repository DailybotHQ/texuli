import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const OVERLAY_EXAMPLES = [
  'ui-dialog',
  'ui-dialog-states',
  'texuli-sheet',
  'texuli-menus',
  'ui-popover',
  'texuli-tooltip',
  'ui-command',
  'texuli-sidebar',
  'ui-navigation',
] as const;

type OverlayExample = (typeof OVERLAY_EXAMPLES)[number];

/** Overlays an example renders open, so axe sees them (tooltip: five, one per axis). */
const FORCED_OPEN: Partial<Record<OverlayExample, { role: 'tooltip'; count: number }>> = {
  'texuli-tooltip': { role: 'tooltip', count: 5 },
};

async function gotoExample(page: Page, id: OverlayExample, mode: 'light' | 'dark'): Promise<void> {
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  await expect(page.locator(`[data-example-host="${id}"]`)).toBeVisible({ timeout: 30_000 });
  const root = page.locator(`[data-example="${id}"]`);
  if ((await root.count()) > 0) await expect(root.first()).toBeVisible();
  // Examples forced open for capture open their overlays after mount; check
  // them once every one is in the page.
  const open = FORCED_OPEN[id];
  if (open) await expect(page.getByRole(open.role)).toHaveCount(open.count);
}

async function expectExampleA11y(page: Page, id: OverlayExample): Promise<void> {
  const target =
    (await page.locator(`[data-example="${id}"]`).count()) > 0
      ? `[data-example="${id}"]`
      : `[data-example-host="${id}"]`;
  // Open overlays fade in (tooltips: --tx-motion-fast, 150ms). Contrast is
  // checked on the settled state, once every finite animation has finished.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    )
  );
  const results = await new AxeBuilder({ page })
    .include(target)
    // Dialogs and menus are portalled outside the example root.
    .include('[role="dialog"], [role="menu"], [role="tooltip"]')
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test.describe('overlay and navigation accessibility · light and dark', () => {
  // One page session walks every example, light then dark.
  test('every overlay example has no axe violations in light or dark', async ({ page }) => {
    test.setTimeout(OVERLAY_EXAMPLES.length * 30_000);
    for (const id of OVERLAY_EXAMPLES) {
      await test.step(id, async () => {
        await gotoExample(page, id, 'light');
        await expectExampleA11y(page, id);
        await gotoExample(page, id, 'dark');
        await expectExampleA11y(page, id);
      });
    }
  });
});

test.describe('overlay and navigation accessibility · keyboard', () => {
  test('Escape closes dialog, sheet, menu, navigation menu and drawer and restores focus', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await test.step('dialog Escape closes the top layer and restores trigger focus', async () => {
      await gotoExample(page, 'ui-dialog', 'light');
      const trigger = page.getByRole('button', { name: 'Open settings' });
      const dialog = page.getByRole('dialog', { name: 'Workspace settings' });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).toHaveCount(0);
      await trigger.click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    await test.step('sheet Escape restores focus and keeps its trigger operable', async () => {
      await gotoExample(page, 'texuli-sheet', 'light');
      const trigger = page.getByRole('button', { name: 'Open sm sheet' });
      await trigger.click();
      await expect(page.getByRole('dialog', { name: 'sm sheet' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'sm sheet' })).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    await test.step('dropdown menu Escape restores focus to its trigger', async () => {
      await gotoExample(page, 'texuli-menus', 'light');
      const trigger = page.getByRole('button', { name: 'Actions', exact: true });
      const menu = page.getByRole('menu').filter({
        has: page.getByRole('menuitem', { name: 'New note' }),
      });
      await expect(menu).toBeVisible();
      await trigger.click();
      await expect(menu).toBeHidden();
      await trigger.click();
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    await test.step('navigation menu opens by keyboard and Escape returns to its trigger', async () => {
      await gotoExample(page, 'ui-navigation', 'light');
      const trigger = page.getByRole('button', { name: 'Products' });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('link', { name: 'Analytics' })).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });

    await test.step('mobile navigation drawer opens and restores focus on close', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await gotoExample(page, 'texuli-sidebar', 'light');
      const trigger = page.getByRole('button', { name: 'Open navigation' }).last();
      await trigger.click();
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible();
      await page.getByRole('button', { name: 'Close navigation' }).click();
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
      await expect(trigger).toBeFocused();
    });
  });
});

test.describe('overlay and navigation accessibility · forced colors and RTL', () => {
  test('dialog and menu stay named under forced colors; menu and sheet in RTL', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await test.step('dialog and menu remain named under forced colors', async () => {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
      await gotoExample(page, 'ui-dialog', 'light');
      await expectExampleA11y(page, 'ui-dialog');
      await gotoExample(page, 'texuli-menus', 'light');
      await expectExampleA11y(page, 'texuli-menus');
    });

    await test.step('navigation and overlays retain names in RTL', async () => {
      await page.emulateMedia({ forcedColors: 'none' });
      await gotoExample(page, 'texuli-menus', 'light');
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      await expectExampleA11y(page, 'texuli-menus');
      await gotoExample(page, 'texuli-sheet', 'light');
      await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
      await expectExampleA11y(page, 'texuli-sheet');
    });
  });
});
