import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import {
  eventNames,
  expectFocus,
  gotoScenarioWith,
  layer,
  layerClosed,
  submitForm,
} from './common.ts';

const trigger = (page: import('@playwright/test').Page) =>
  page.getByRole('combobox', { name: 'Plan' });
const listbox = (page: import('@playwright/test').Page) => page.getByRole('listbox');

scenario(
  'select',
  defineRows([
    {
      id: 'named-opens-groups-disabled',
      title:
        'the trigger is a combobox named by its field label, showing the value; a click opens a listbox of options in labelled groups, the current one selected; a disabled option is announced and cannot be chosen',
      // Focus stays on the trigger while the list is open: there is no open-to-focus time.
      async run({ page }) {
        await expect(trigger(page)).toHaveText('Free');
        await expect(page.getByRole('combobox', { name: 'Plan', expanded: false })).toBeVisible();
        await trigger(page).click();
        await expect(listbox(page)).toBeVisible();
        await expect(listbox(page).getByRole('option')).toHaveText([
          'Free',
          'Team',
          'Business',
          'Enterprise',
        ]);
        await expect(
          listbox(page).getByRole('option', { name: 'Free', selected: true })
        ).toBeVisible();
        await expect(listbox(page).getByRole('group', { name: 'Personal' })).toBeVisible();
        await expect(listbox(page).getByRole('group', { name: 'Organization' })).toBeVisible();
        await expect(listbox(page).getByRole('option', { name: 'Business' })).toHaveAttribute(
          'aria-disabled',
          'true'
        );
        await listbox(page).getByRole('option', { name: 'Business' }).click({ force: true });
        await expect(trigger(page)).toHaveText('Free');
      },
    },
    {
      id: 'consumer-ids',
      title:
        'with consumer ids, a <label for> names the trigger and it controls the list by its own id',
      async run({ page }) {
        await gotoScenarioWith(page, 'select', { ids: '1' });
        const named = page.getByRole('combobox', { name: 'Plan' });
        await expect(named).toHaveAttribute('id', 'plan-trigger');
        // Focused, it is announced by the label's text (WebKit's Tab skips buttons).
        await named.focus();
        await expectFocus(page, 'combobox', 'Plan');
        await named.click();
        await expect(listbox(page)).toBeVisible();
        await expect(listbox(page)).toHaveAttribute('id', 'plan-list');
        await expect(named).toHaveAttribute('aria-controls', 'plan-list');
      },
    },
    {
      id: 'keyboard-select-typeahead-escape',
      title:
        'the keyboard opens it, moves across groups and picks an option; typing a letter moves to the matching option; Escape closes it and focus returns to the trigger',
      async run({ page }) {
        await trigger(page).focus();
        await page.keyboard.press('Enter');
        await expect(listbox(page)).toBeVisible();
        // From Free, ArrowDown crosses into Organization: Team.
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await layerClosed(page);
        await expect(trigger(page)).toHaveText('Team');
        await expectFocus(page, 'combobox', 'Plan');
        expect(await eventNames(page)).toContain('valueChange');
        await page.keyboard.press('Enter');
        await expect(listbox(page)).toBeVisible();
        await page.keyboard.press('e');
        await page.keyboard.press('Enter');
        await layerClosed(page);
        await expect(trigger(page)).toHaveText('Enterprise');
        await trigger(page).focus();
        await page.keyboard.press('Enter');
        await expect(layer(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await layerClosed(page);
        await expectFocus(page, 'combobox', 'Plan');
      },
    },
    {
      id: 'form-value',
      title: 'the chosen value is submitted with the form',
      async run({ page }) {
        await trigger(page).click();
        await listbox(page).getByRole('option', { name: 'Team' }).click();
        await layerClosed(page);
        expect(await submitForm(page, 'Save plan')).toMatchObject({ plan: 'team' });
      },
    },
  ])
);
