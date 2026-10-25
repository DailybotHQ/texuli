import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Profile preview' });
const card = (page: import('@playwright/test').Page) => page.locator('[data-behavior-layer]');

scenario(
  'hover-card',
  defineRows([
    {
      id: 'opens-after-hover-delay',
      title: 'hover opens the named preview after a delay',
      async run({ page }) {
        await page.clock.install();
        await trigger(page).hover();
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false');
        await page.clock.runFor(100);
        await expect(page.getByRole('dialog', { name: 'Profile preview' })).toBeVisible({
          timeout: 2000,
        });
        await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true');
      },
    },
    {
      id: 'focus-opens-and-escape-closes',
      title: 'focus opens the preview and Escape closes it without moving focus',
      async run({ page }) {
        await trigger(page).focus();
        const preview = page.getByRole('dialog', { name: 'Profile preview' });
        await expect(preview).toBeVisible({ timeout: 2000 });
        await page.keyboard.press('Escape');
        await expect(preview).toBeHidden();
        await expect(trigger(page)).toBeFocused();
      },
    },
    {
      id: 'pointer-handoff',
      title: 'moving from trigger into the card keeps it open until both are left',
      async run({ page }) {
        await trigger(page).hover();
        await expect(card(page)).toBeVisible({ timeout: 2000 });
        await card(page).hover();
        await expect(card(page)).toBeVisible();
        await page.mouse.move(2, 2);
        await expect(card(page)).toBeHidden({ timeout: 2000 });
      },
    },
    {
      id: 'outside-pointer-dismisses',
      title: 'an outside pointer interaction dismisses the preview',
      async run({ page }) {
        await trigger(page).hover();
        await expect(card(page)).toBeVisible({ timeout: 2000 });
        await page.getByText('Outside area').click();
        await expect(card(page)).toBeHidden();
      },
    },
    {
      id: 'touch-toggles-preview',
      title: 'touch opens and a second touch closes the preview',
      async run({ page }) {
        const button = trigger(page);
        if ((page.viewportSize()?.width ?? 0) < 600) await button.tap();
        else await button.dispatchEvent('pointerdown', { pointerType: 'touch' });
        await expect(page.getByRole('dialog', { name: 'Profile preview' })).toBeVisible();
        if ((page.viewportSize()?.width ?? 0) < 600) await button.tap();
        else await button.dispatchEvent('pointerdown', { pointerType: 'touch' });
        await expect(page.getByRole('dialog', { name: 'Profile preview' })).toHaveCount(0);
      },
    },
    {
      id: 'open-content-is-accessible',
      title: 'the open preview has no axe violations',
      async run({ page }) {
        await trigger(page).hover();
        await expect(card(page)).toBeVisible({ timeout: 2000 });
        const results = await new AxeBuilder({ page }).include('[data-behavior-layer]').analyze();
        expect(results.violations).toEqual([]);
      },
    },
  ])
);
