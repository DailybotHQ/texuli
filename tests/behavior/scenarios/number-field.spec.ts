import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { behaviorEvents, frame, gotoScenario } from '../harness/oracle.ts';

/*
 * NumberField (T-prim-number-field), held to the WAI-ARIA APG spinbutton
 * pattern: keyboard, typing for a locale, pointer, touch, form submission
 * and axe.
 */

const quantity = (page: Page) => page.getByRole('spinbutton', { name: 'Quantity' });
const price = (page: Page) => page.getByRole('spinbutton', { name: 'Price' });
const increase = (page: Page) => page.getByRole('button', { name: 'Increase' }).first();
const decrease = (page: Page) => page.getByRole('button', { name: 'Decrease' }).first();

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoScenario(page, 'number-field');
  await expect(quantity(page)).toBeVisible();
  return errors;
}

async function expectAxeClean(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).include('[data-behavior="scenario"]').analyze();
  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)
  ).toEqual([]);
}

scenario(
  'number-field',
  defineRows([
    {
      id: 'the-apg-keys-step-page-and-jump-to-the',
      title: 'the APG keys step, page, and jump to the bounds; Tab skips the steppers',
      async run({ page }) {
        const errors = await open(page);
        await frame.before(page).focus();
        await page.keyboard.press('Tab');
        await expect(quantity(page)).toBeFocused();
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '2');
        await expect(quantity(page)).toHaveAttribute('aria-valuemin', '0');
        await expect(quantity(page)).toHaveAttribute('aria-valuemax', '10');
        await page.keyboard.press('ArrowUp');
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '3');
        await page.keyboard.press('PageUp');
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '10');
        await expect(increase(page)).toBeDisabled();
        await page.keyboard.press('Home');
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '0');
        await expect(decrease(page)).toBeDisabled();
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowDown');
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '9');
        await expect(quantity(page)).toHaveValue('9');
        // The steppers are out of the Tab order: the next stop is the next field.
        await page.keyboard.press('Tab');
        await expect(price(page)).toBeFocused();
        expect(errors).toEqual([]);
      },
    },
    {
      id: 'typing-commits-a-number-for-the-locale-and',
      title: 'typing commits a number for the locale, and letters are refused',
      async run({ page }) {
        await expect(price(page)).toHaveAttribute('aria-valuenow', '1234.5');
        const shown = await price(page).inputValue();
        expect(shown).toMatch(/^1\.234,50\s\u20ac$/);
        await price(page).fill('99,95');
        await price(page).press('Enter');
        await expect(price(page)).toHaveAttribute('aria-valuenow', '99.95');
        await expect(price(page)).toHaveAttribute('aria-valuetext', /^99,95\s\u20ac$/);
        // A letter cannot be typed; digits can.
        await price(page).fill('');
        await price(page).pressSequentially('7x');
        await expect(price(page)).toHaveValue('7');
        await page.keyboard.press('Tab');
        await expect(price(page)).toHaveAttribute('aria-valuenow', '7');
        // Text that is not a number for the locale (two decimal commas) reverts on blur.
        await price(page).fill('1,2,3');
        await frame.after(page).focus();
        await expect(price(page)).toHaveAttribute('aria-valuenow', '7');
      },
    },
    {
      id: 'a-mouse-press-steps-keeps-focus-in-the',
      title: 'a mouse press steps, keeps focus in the field, and repeats while held',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        await increase(page).click();
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '3');
        await expect(quantity(page)).toBeFocused();
        await decrease(page).click();
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '2');
        const box = await increase(page).boundingBox();
        if (!box) throw new Error('no stepper box');
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(700);
        await page.mouse.up();
        const held = Number(await quantity(page).getAttribute('aria-valuenow'));
        expect(held).toBeGreaterThanOrEqual(5);
        await page.waitForTimeout(300);
        expect(Number(await quantity(page).getAttribute('aria-valuenow'))).toBe(held);
      },
    },
    {
      id: 'a-touch-tap-steps-without-moving-focus-into',
      title: 'a touch tap steps without moving focus into the field (no keyboard pops up)',
      projects: ['mobile'],
      async run({ page }) {
        await frame.before(page).focus();
        await increase(page).tap();
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '3');
        await expect(quantity(page)).not.toBeFocused();
        await decrease(page).tap();
        await decrease(page).tap();
        await expect(quantity(page)).toHaveAttribute('aria-valuenow', '1');
      },
    },
    {
      id: 'the-form-submits-the-numbers-not-the',
      title: 'the form submits the numbers, not the formatted text',
      async run({ page }) {
        await quantity(page).focus();
        await page.keyboard.press('ArrowUp');
        await page.getByRole('button', { name: 'Save' }).click();
        await expect
          .poll(
            async () =>
              (await behaviorEvents(page)).findLast((event) => event.name === 'submit')?.detail
          )
          .toEqual({ quantity: '3', price: '1234.5' });
        const changes = (await behaviorEvents(page))
          .filter((event) => event.name === 'valueChange')
          .map((event) => event.detail);
        expect(changes).toEqual([3]);
      },
    },
    {
      id: 'axe-finds-no-violations-at-rest-and-at-a',
      title: 'axe finds no violations, at rest and at a bound',
      async run({ page }) {
        await expectAxeClean(page);
        await quantity(page).focus();
        await page.keyboard.press('End');
        await expect(increase(page)).toBeDisabled();
        await expectAxeClean(page);
      },
    },
  ])
);
