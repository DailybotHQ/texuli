/**
 * Accessibility sweep: overlays and navigation. axe with zero exclusions on
 * every example in light and dark (one page session), then one session for
 * Escape and focus return, forced colors, RTL and the Sheet family (every
 * size, side and RTL, axe with each kind of sheet open in light and dark).
 */
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

test('Escape restores focus; forced colors and RTL; every sheet size, side and kind', async ({
  page,
}) => {
  test.setTimeout(180_000);
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

  await test.step('every sheet size and side opens, and each kind passes axe open, light and dark', async () => {
    const example = page.locator('[data-example="texuli-sheet"]');
    const scan = async () => {
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    };
    for (const mode of ['light', 'dark'] as const) {
      await gotoExample(page, 'texuli-sheet', mode);
      for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
        await example.getByRole('button', { name: `Open ${size} sheet` }).click();
        const sheet = page.getByRole('dialog', { name: `${size} sheet` });
        await expect(sheet).toHaveClass(new RegExp(`tx-sheet--${size}`));
        await expect(sheet).toHaveAttribute('data-size', size);
        await page.keyboard.press('Escape');
        await expect(sheet).toBeHidden();
      }
      const side = example.getByLabel('Side');
      for (const edge of ['end', 'top', 'bottom'] as const) {
        await side.selectOption(edge);
        await example.getByRole('button', { name: 'Open md sheet' }).click();
        const sheet = page.getByRole('dialog', { name: 'md sheet' });
        await expect(sheet).toHaveAttribute('data-side', edge === 'end' ? 'right' : edge);
        await page.keyboard.press('Escape');
        await expect(sheet).toBeHidden();
      }
      await example
        .locator('section[dir="rtl"]')
        .getByRole('button', { name: 'فتح المرشحات' })
        .click();
      await expect(page.getByRole('dialog', { name: 'المرشحات' })).toHaveAttribute(
        'data-side',
        'right'
      );
      await scan();
      await page.keyboard.press('Escape');
      for (const [trigger, title] of [
        ['Open md sheet', 'md sheet'],
        ['Open drawer', 'Cart'],
        ['Show order details', 'Order orbit-001'],
        ['Share order', 'Share order'],
      ] as const) {
        await example.getByRole('button', { name: trigger }).click();
        await expect(page.getByRole('dialog', { name: title })).toBeVisible();
        await scan();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: title })).toBeHidden();
      }
    }
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
