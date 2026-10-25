import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { gotoScenario } from '../harness/oracle.ts';

test.describe('ColorPicker', () => {
  test('supports keyboard, pointer and touch input with an accessible name and no axe violations', async ({
    page,
  }, testInfo) => {
    await gotoScenario(page, 'color-picker');

    const area = page.getByRole('slider', { name: 'Color area' });
    const hue = page.getByRole('slider', { name: 'Hue' });
    const value = page.getByRole('textbox', { name: 'Color value' });
    await expect(page.getByRole('group', { name: 'Brand color' })).toBeVisible();
    await expect(area).toHaveAccessibleDescription('Choose lightness and chroma.');

    const initialLightness = Number(await area.getAttribute('aria-valuenow'));
    await area.focus();
    await page.keyboard.press('ArrowUp');
    await expect(area).toHaveAttribute('aria-valuenow', String(initialLightness + 1));
    await hue.focus();
    const initialHue = Number(await hue.inputValue());
    await page.keyboard.press('ArrowRight');
    await expect(hue).toHaveValue(String(initialHue + 1));

    const box = await area.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 40, (box?.y ?? 0) + 30);
    await page.mouse.down();
    await expect(area).toHaveAttribute('data-state', 'active');
    await page.mouse.up();
    await expect(area).toHaveAttribute('aria-valuenow', '75');

    if (testInfo.project.name === 'mobile') {
      await page.touchscreen.tap((box?.x ?? 0) + 80, (box?.y ?? 0) + 70);
      await expect(area).toHaveAttribute('aria-valuenow', '42');
    }

    await value.fill('oklch(0.6 0.15 200 / 0.5)');
    await expect(value).toHaveAttribute('data-state', 'valid');
    await expect(value).toHaveValue(/^#[\da-f]{8}$/i);
    await page.getByRole('button', { name: 'Red' }).click();
    await expect(page.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true');

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
  });
});
