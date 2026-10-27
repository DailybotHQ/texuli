import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusedElement, pointerOutside } from '../harness/oracle.ts';
import { eventNames, expectFocus } from './common.ts';

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const trigger = (page: Page, name: string) => nav(page).getByRole('button', { name });
const link = (page: Page, name: string) => nav(page).getByRole('link', { name });

async function expanded(page: Page, name: string, value: boolean) {
  await expect(nav(page).getByRole('button', { name, expanded: value })).toBeVisible();
}

async function openWithKeyboard(page: Page, name = 'Products') {
  await trigger(page, name).focus();
  await page.keyboard.press('Enter');
  await expanded(page, name, true);
  await expect(link(page, name === 'Products' ? 'Analytics' : 'Docs')).toBeVisible();
}

scenario(
  'navigation-menu',
  defineRows([
    {
      id: 'landmark-triggers-arrows',
      title:
        'a named navigation landmark of collapsed disclosure buttons, the active link is the current page, and arrow keys move between the top-level triggers and links',
      async run({ page }) {
        await expect(nav(page)).toBeVisible();
        await expanded(page, 'Products', false);
        await expanded(page, 'Resources', false);
        await expect(link(page, 'Analytics')).toHaveCount(0);
        await expect(link(page, 'Pricing')).toHaveAttribute('aria-current', 'page');
        await trigger(page, 'Products').focus();
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'button', 'Resources');
        await page.keyboard.press('ArrowRight');
        await expectFocus(page, 'link', 'Pricing');
        await page.keyboard.press('ArrowLeft');
        await expectFocus(page, 'button', 'Resources');
      },
    },
    {
      id: 'keyboard-open-escape-tab',
      title:
        'Enter and Space toggle the item; Escape from inside the content closes it and returns focus; Tab moves from the open trigger into its links, then on to the next trigger',
      async run({ page }) {
        await openWithKeyboard(page);
        await page.keyboard.press('Enter');
        await expanded(page, 'Products', false);
        await page.keyboard.press(' ');
        await expanded(page, 'Products', true);
        await page.keyboard.press('Tab');
        await expectFocus(page, 'link', 'Analytics');
        await page.keyboard.press('Escape');
        await expanded(page, 'Products', false);
        await expectFocus(page, 'button', 'Products');
        await openWithKeyboard(page);
        const stops: string[] = [];
        for (let index = 0; index < 3; index += 1) {
          await page.keyboard.press('Tab');
          stops.push((await focusedElement(page)).name);
        }
        expect(stops).toEqual(['Analytics', 'Automation', 'Resources']);
      },
    },
    {
      id: 'pointer-toggle-outside-select-hover',
      title:
        'a click opens the item and a second click closes it; pressing outside closes it; choosing a link runs it and closes it; resting the pointer on a trigger opens its item',
      async run({ page }) {
        await trigger(page, 'Products').click();
        await expanded(page, 'Products', true);
        await expect(link(page, 'Analytics')).toBeVisible();
        await trigger(page, 'Products').click();
        await expanded(page, 'Products', false);
        await expect(link(page, 'Analytics')).toHaveCount(0);
        await trigger(page, 'Products').click();
        await expanded(page, 'Products', true);
        await pointerOutside(page);
        await expanded(page, 'Products', false);
        await trigger(page, 'Products').click();
        await link(page, 'Analytics').click();
        await expanded(page, 'Products', false);
        expect(await eventNames(page)).toContain('select');
        await trigger(page, 'Resources').hover();
        await expanded(page, 'Resources', true);
        await expect(link(page, 'Docs')).toBeVisible();
      },
    },
    {
      id: 'axe-clean-and-unsafe-href-blocked',
      title:
        'axe finds no violations with an item closed and open, and a javascript: href never reaches the DOM',
      async run({ page }) {
        const violations = async () =>
          (await new AxeBuilder({ page }).include('nav').analyze()).violations.map((v) => v.id);
        expect(await violations()).toEqual([]);
        await openWithKeyboard(page);
        expect(await violations()).toEqual([]);
        await trigger(page, 'Resources').click();
        const status = nav(page).getByText('Status', { exact: true });
        await expect(status).toBeVisible();
        const href = await status.getAttribute('href');
        expect(href === null || !/^\s*javascript:/i.test(href)).toBe(true);
      },
    },
    {
      id: 'touch-tap-toggles',
      title: 'on a touch screen, a tap opens the item and a second tap closes it',
      async run({ page, touch }) {
        const press = (name: string) =>
          touch ? trigger(page, name).tap() : trigger(page, name).click();
        await press('Products');
        await expanded(page, 'Products', true);
        await expect(link(page, 'Analytics')).toBeVisible();
        await press('Products');
        await expanded(page, 'Products', false);
      },
    },
  ])
);
