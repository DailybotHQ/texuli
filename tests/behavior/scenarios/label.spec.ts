import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { defineRows, focusSequence, frame, scenario } from '../harness/index.ts';

/*
 * Label and Field (T-prim-label): a plain label (`for`), a field with a
 * description and an error, and a wrapping checkbox label. Observable
 * behavior only: accessible names and descriptions, `aria-invalid`, focus,
 * selection and axe.
 */

const root = (page: Page) => page.locator('[data-behavior="scenario"]');
const email = (page: Page) => root(page).getByRole('textbox', { name: 'Work email' });
const ERROR = 'Enter an address like name@example.com.';

/** A tap on touch projects, a click elsewhere. */
async function press(target: Locator): Promise<void> {
  if (test.info().project.use.hasTouch) await target.tap();
  else await target.click();
}

async function expectAxeClean(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page }).include('[data-behavior="scenario"]').analyze();
  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)
  ).toEqual([]);
}

scenario(
  'label',
  defineRows([
    {
      id: 'names-controls',
      title: 'labels give their controls an accessible name, by for or by wrapping',
      async run({ page }) {
        await expect(root(page).getByRole('textbox', { name: 'Company' })).toBeVisible();
        await expect(email(page)).toBeVisible();
        await expect(root(page).getByRole('checkbox', { name: 'Remember me' })).toBeVisible();
      },
    },
    {
      id: 'pointer-focuses',
      title: 'pressing a label focuses its text field and toggles its checkbox',
      async run({ page }) {
        await press(root(page).getByText('Work email', { exact: true }));
        await expect(email(page)).toBeFocused();
        await press(root(page).getByText('Company', { exact: true }));
        await expect(root(page).getByRole('textbox', { name: 'Company' })).toBeFocused();
        const checkbox = root(page).getByRole('checkbox', { name: 'Remember me' });
        await press(root(page).getByText('Remember me'));
        await expect(checkbox).toBeChecked();
        await press(root(page).getByText('Remember me'));
        await expect(checkbox).not.toBeChecked();
      },
    },
    {
      id: 'keyboard-order',
      title: 'labels never take focus; Tab reaches the text fields in order',
      async run({ page }) {
        // Text fields only: WebKit's default Tab skips buttons and checkboxes.
        await frame.before(page).focus();
        expect(await focusSequence(page, 2)).toEqual([
          { role: 'textbox', name: 'Company' },
          { role: 'textbox', name: 'Work email' },
        ]);
        const focusable = await root(page)
          .locator('label')
          .evaluateAll((labels) =>
            labels.map((label) => {
              (label as HTMLElement).focus();
              return label.ownerDocument.activeElement === label;
            })
          );
        expect(focusable).toEqual([false, false, false]);
      },
    },
    {
      id: 'description',
      title: 'the field is described by its help text',
      async run({ page }) {
        await expect(email(page)).toHaveAccessibleDescription('We send receipts here.');
        await expect(email(page)).not.toHaveAttribute('aria-invalid', 'true');
      },
    },
    {
      id: 'error-wiring',
      title: 'an invalid field says so and is described by its error, then recovers',
      async run({ page }) {
        await email(page).fill('ada');
        await root(page).getByRole('button', { name: 'Check address' }).click();
        await expect(email(page)).toHaveAttribute('aria-invalid', 'true');
        await expect(email(page)).toHaveAccessibleDescription(`We send receipts here. ${ERROR}`);
        await expect(root(page).getByText(ERROR)).toBeVisible();
        await email(page).fill('ada@example.com');
        await root(page).getByRole('button', { name: 'Check address' }).click();
        await expect(email(page)).not.toHaveAttribute('aria-invalid', 'true');
        await expect(email(page)).toHaveAccessibleDescription('We send receipts here.');
        await expect(root(page).getByText(ERROR)).toHaveCount(0);
      },
    },
    {
      id: 'error-live',
      title: 'the error is announced from a polite live region that exists before it appears',
      async run({ page }) {
        const region = root(page).locator('[aria-live="polite"]');
        await expect(region).toHaveCount(1);
        await expect(region).toHaveText('');
        await email(page).fill('ada');
        await root(page).getByRole('button', { name: 'Check address' }).click();
        await expect(region).toHaveText(ERROR);
      },
    },
    {
      id: 'no-double-click-selection',
      title: 'double-clicking a label does not select its text',
      async run({ page }) {
        await root(page).getByText('Company', { exact: true }).dblclick();
        expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
      },
    },
    {
      id: 'axe',
      title: 'axe finds no violations, valid and invalid',
      async run({ page }) {
        await expectAxeClean(page);
        await email(page).fill('ada');
        await root(page).getByRole('button', { name: 'Check address' }).click();
        await expect(email(page)).toHaveAttribute('aria-invalid', 'true');
        await expectAxeClean(page);
      },
    },
  ])
);
