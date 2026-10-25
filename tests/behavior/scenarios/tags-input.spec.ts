import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { behaviorEvents, gotoScenario } from '../harness/oracle.ts';
import { expectFocus } from './common.ts';

/*
 * TagsInput, held to APG-aligned behavior: keyboard, paste, pointer and
 * touch, forms and axe.
 */

const open = (page: Page) => gotoScenario(page, 'tags-input');
const input = (page: Page) => page.getByRole('textbox', { name: 'Add a topic' });
const tags = (page: Page) => page.getByRole('group', { name: 'Topics' }).getByRole('listitem');
const status = (page: Page) => page.getByRole('status');
/** The tag names, without the remove buttons. */
const names = (page: Page) => tags(page).locator('span');

test.describe('tags-input', () => {
  test('is a labelled group with a list of tags and one Tab stop', async ({
    page,
    browserName,
  }) => {
    await open(page);
    await expect(page.getByRole('group', { name: 'Topics' })).toBeVisible();
    await expect(names(page)).toHaveText(['design', 'research']);
    await expect(page.getByRole('button', { name: 'Remove design' })).toBeVisible();
    await input(page).focus();
    // WebKit, like Safari's default setting, moves to buttons only with Alt+Tab.
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expectFocus(page, 'button', 'Save topics');
  });

  test('adds with Enter and the comma, and refuses a duplicate with an announcement', async ({
    page,
  }) => {
    await open(page);
    await input(page).fill('testing');
    await page.keyboard.press('Enter');
    await input(page).pressSequentially('ux,');
    await expect(names(page)).toHaveText(['design', 'research', 'testing', 'ux']);
    await expect(input(page)).toHaveValue('');
    await input(page).fill('design');
    await page.keyboard.press('Enter');
    await expect(status(page)).toHaveText('design is already added');
    await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(tags(page)).toHaveCount(4);
  });

  test('navigates and removes tags by keyboard', async ({ page }) => {
    await open(page);
    await input(page).focus();
    await page.keyboard.press('Backspace');
    await expect(tags(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tags(page).nth(0)).toBeFocused();
    await page.keyboard.press('Delete');
    await expect(names(page)).toHaveText(['research']);
    await expect(tags(page).nth(0)).toBeFocused();
    await expect(status(page)).toHaveText('design removed');
    await page.keyboard.press('ArrowRight');
    await expect(input(page)).toBeFocused();
  });

  test('splits pasted text into tags', async ({ page }) => {
    await open(page);
    await input(page).focus();
    await input(page).evaluate((node) => {
      const data = new DataTransfer();
      data.setData('text/plain', 'mobile, web\nqa');
      node.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
      );
    });
    await expect(names(page)).toHaveText(['design', 'research', 'mobile', 'web', 'qa']);
  });

  test('removes a tag with the pointer and returns focus to the input', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Remove design' }).click();
    await expect(names(page)).toHaveText(['research']);
    await expect(input(page)).toBeFocused();
  });

  test('removes a tag with a tap on a touch screen', async ({ page }) => {
    test.skip(!test.info().project.use.hasTouch, 'Touch runs on the Pixel 7 project.');
    await open(page);
    await page.getByRole('button', { name: 'Remove research' }).tap();
    await expect(names(page)).toHaveText(['design']);
  });

  test('submits one field per tag', async ({ page }) => {
    await open(page);
    await input(page).fill('ops');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Save topics' }).click();
    await expect
      .poll(
        async () =>
          (await behaviorEvents(page)).findLast((event) => event.name === 'submit')?.detail
      )
      .toEqual({ topic: ['design', 'research', 'ops'] });
  });

  test('has no axe violations', async ({ page }) => {
    await open(page);
    await tags(page).nth(0).focus();
    const results = await new AxeBuilder({ page }).include('.behavior-tags').analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
