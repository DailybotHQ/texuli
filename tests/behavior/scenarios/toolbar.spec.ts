import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { behaviorEvents, focusedElement, gotoScenario } from '../harness/oracle.ts';

/*
 * Toolbar, held to the WAI-ARIA APG toolbar pattern: one Tab stop, arrows,
 * Home and End,
 * toggles and radios, disabled items, right to left, pointer, touch and axe.
 */

const open = (page: Page) => gotoScenario(page, 'toolbar');
const bar = (page: Page, name: string) => page.getByRole('toolbar', { name });
const formatting = (page: Page) => bar(page, 'Formatting');
const focusName = async (page: Page) => (await focusedElement(page)).name;
const events = async (page: Page) => (await behaviorEvents(page)).map((event) => event.name);

async function press(target: Locator, input: 'mouse' | 'touch') {
  if (input === 'touch') await target.tap();
  else await target.click();
}

test.describe('toolbar (APG toolbar)', () => {
  test('is one Tab stop that returns to the last item used', async ({ page }) => {
    await open(page);
    await page.locator('[data-behavior="before"]').focus();
    await page.keyboard.press('Tab');
    expect(await focusName(page)).toBe('Bold');
    await page.keyboard.press('ArrowRight');
    expect(await focusName(page)).toBe('Italic');
    // Tab leaves the toolbar; Shift+Tab comes back to Italic, not Bold.
    await page.keyboard.press('Tab');
    expect(await focusName(page)).not.toMatch(/Bold|Italic|Left|Center|Right|Save|Publish|Help/);
    await page.keyboard.press('Shift+Tab');
    expect(await focusName(page)).toBe('Italic');
  });

  test('moves with the arrows, Home and End, and wraps', async ({ page }) => {
    await open(page);
    await formatting(page).getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('End');
    expect(await focusName(page)).toBe('Help');
    await page.keyboard.press('ArrowRight');
    expect(await focusName(page)).toBe('Bold');
    await page.keyboard.press('ArrowLeft');
    expect(await focusName(page)).toBe('Help');
    await page.keyboard.press('Home');
    expect(await focusName(page)).toBe('Bold');
    const zoom = bar(page, 'Zoom');
    await expect(zoom).toHaveAttribute('aria-orientation', 'vertical');
    await zoom.getByRole('button', { name: 'Zoom in' }).focus();
    await page.keyboard.press('ArrowDown');
    expect(await focusName(page)).toBe('Zoom out');
  });

  test('presses toggles and radios with Space and Enter', async ({ page }) => {
    await open(page);
    const bold = formatting(page).getByRole('button', { name: 'Bold' });
    await bold.focus();
    await page.keyboard.press('Space');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    const center = formatting(page).getByRole('radio', { name: 'Center' });
    await center.focus();
    await page.keyboard.press('Space');
    await expect(center).toHaveAttribute('aria-checked', 'true');
    await expect(formatting(page).getByRole('radio', { name: 'Left' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  test('keeps a disabled item focusable but inert', async ({ page }) => {
    await open(page);
    const save = formatting(page).getByRole('button', { name: 'Save' });
    await save.focus();
    await page.keyboard.press('ArrowRight');
    expect(await focusName(page)).toBe('Publish');
    await page.keyboard.press('Enter');
    const right = formatting(page).getByRole('radio', { name: 'Right' });
    await expect(right).toHaveAttribute('aria-disabled', 'true');
    // Playwright waits for aria-disabled items to enable; force a real click.
    await right.click({ force: true });
    await formatting(page).getByRole('button', { name: 'Publish' }).click({ force: true });
    await expect(right).toHaveAttribute('aria-checked', 'false');
    expect(await events(page)).not.toContain('publish');
  });

  test('mirrors the arrows in right to left', async ({ page }) => {
    await open(page);
    const rtl = bar(page, 'أدوات');
    await rtl.getByRole('button', { name: 'نسخ' }).focus();
    await page.keyboard.press('ArrowLeft');
    expect(await focusName(page)).toBe('لصق');
  });

  test('works with a pointer, by mouse on desktop and by touch on the phone', async ({
    page,
  }, testInfo) => {
    const input = testInfo.project.name === 'mobile' ? 'touch' : 'mouse';
    await open(page);
    const italic = formatting(page).getByRole('button', { name: 'Italic' });
    await press(italic, input);
    await expect(italic).toHaveAttribute('aria-pressed', 'true');
    await press(formatting(page).getByRole('radio', { name: 'Center' }), input);
    await expect(formatting(page).getByRole('radio', { name: 'Center' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await press(formatting(page).getByRole('button', { name: 'Save' }), input);
    expect(await events(page)).toEqual(['styles', 'align', 'save']);
    // The pressed item becomes the toolbar's Tab stop.
    await page.locator('[data-behavior="before"]').focus();
    await page.keyboard.press('Tab');
    expect(await focusName(page)).toBe('Save');
  });

  test('passes links through the URL policy and names its groups', async ({ page }) => {
    await open(page);
    await expect(formatting(page).getByRole('link', { name: 'Help' })).toHaveAttribute(
      'href',
      'https://example.com/help'
    );
    await expect(formatting(page).getByRole('group', { name: 'Text style' })).toBeVisible();
    await expect(formatting(page).getByRole('radiogroup', { name: 'Alignment' })).toBeVisible();
    await expect(formatting(page).getByRole('separator')).toHaveCount(2);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`passes axe (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await formatting(page).getByRole('button', { name: 'Bold' }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});
