import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('Sheet family example renders overlays and passes axe in light and dark', async ({ page }) => {
  const example = page.locator('[data-example="texuli-sheet"]');

  for (const mode of ['light', 'dark'] as const) {
    await page.goto(`/?fixture=texuli-sheet&mode=${mode}`);
    await expect(example).toBeVisible();

    const scan = async () => {
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    };

    await scan();
    for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
      await example.getByRole('button', { name: `Open ${size} sheet` }).click();
      const sheet = page.getByRole('dialog', { name: `${size} sheet` });
      await expect(sheet).toHaveClass(new RegExp(`tx-sheet--${size}`));
      await expect(sheet).toHaveAttribute('data-size', size);
      if (size === 'md') await scan();
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

    const rtl = example.locator('section[dir="rtl"]');
    await rtl.getByRole('button', { name: 'فتح المرشحات' }).click();
    const rtlSheet = page.getByRole('dialog', { name: 'المرشحات' });
    await expect(rtlSheet).toHaveAttribute('data-side', 'right');
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
