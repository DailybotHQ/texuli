import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { behaviorEvents } from '../harness/oracle.ts';
import { expectFocus } from './common.ts';

const input = (page: Page) => page.getByRole('textbox', { name: 'Verification code' });
const shown = (page: Page) => page.locator('[data-behavior-value]');

/**
 * Pastes `text` the way a person does: through the system clipboard and the
 * paste shortcut, so the browser's own paste runs (a synthetic event would not).
 */
async function paste(page: Page, text: string) {
  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => {});
  await input(page).focus();
  await page.evaluate((clip) => navigator.clipboard.writeText(clip), text);
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+v' : 'Control+v');
}

const completes = async (page: Page) =>
  (await behaviorEvents(page)).filter((event) => event.name === 'complete');

scenario(
  'pin-input',
  defineRows([
    {
      id: 'named-one-time-code',
      title: 'one named text field, offered for one-time-code autofill',
      async run({ page }) {
        await expect(input(page)).toBeVisible();
        await expect(input(page)).toHaveAttribute('autocomplete', 'one-time-code');
        await expect(input(page)).toHaveAttribute('maxlength', '6');
      },
    },
    {
      id: 'type-digits',
      title: 'typing digits fills the code',
      async run({ page }) {
        await input(page).focus();
        await page.keyboard.type('123');
        await expect(shown(page)).toHaveText('123');
      },
    },
    {
      id: 'refuse-letters',
      title: 'characters outside the pattern are refused',
      async run({ page }) {
        await input(page).focus();
        await page.keyboard.type('1a2');
        await expect(shown(page)).toHaveText('12');
      },
    },
    {
      id: 'length-limit',
      title: 'the code stops at its length',
      async run({ page }) {
        await input(page).focus();
        await page.keyboard.type('12345678');
        await expect(shown(page)).toHaveText('123456');
      },
    },
    {
      id: 'backspace',
      title: 'Backspace removes the last character',
      async run({ page }) {
        await input(page).focus();
        await page.keyboard.type('123');
        await page.keyboard.press('Backspace');
        await expect(shown(page)).toHaveText('12');
      },
    },
    {
      id: 'complete-once',
      title: 'filling the last cell reports the code once',
      async run({ page }) {
        await input(page).focus();
        await page.keyboard.type('123456');
        await expect
          .poll(async () => (await completes(page)).map((e) => e.detail))
          .toEqual(['123456']);
      },
    },
    {
      id: 'paste-code',
      title: 'pasting a code fills every cell and completes it',
      async run({ page }) {
        await paste(page, '654321');
        await expect(shown(page)).toHaveText('654321');
        await expect.poll(async () => (await completes(page)).length).toBe(1);
      },
    },
    {
      id: 'paste-spaced-code',
      title: 'pasting a code with spaces ("123 456") fills it',
      async run({ page }) {
        await paste(page, '123 456');
        await expect(shown(page)).toHaveText('123456');
      },
    },
    {
      id: 'pointer-focuses',
      title: 'a click or tap on the cells focuses the field',
      async run({ page }) {
        const box = await page.locator('.behavior-pin').boundingBox();
        if (!box) throw new Error('no cells');
        const x = box.x + box.width * 0.6;
        const y = box.y + box.height / 2;
        if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await expectFocus(page, 'textbox', 'Verification code');
        await page.keyboard.type('7');
        await expect(shown(page)).toHaveText('7');
      },
    },
    {
      id: 'axe-clean',
      title: 'axe finds no violations, empty and filled',
      async run({ page }) {
        // Scoped to the component: the fixture page itself has no h1.
        const violations = async () =>
          (
            await new AxeBuilder({ page })
              .include('.behavior-pin')
              .include('label[for="behavior-pin"]')
              .analyze()
          ).violations.map((v) => v.id);
        expect(await violations()).toEqual([]);
        await input(page).focus();
        await page.keyboard.type('123456');
        expect(await violations()).toEqual([]);
      },
    },
  ])
);
