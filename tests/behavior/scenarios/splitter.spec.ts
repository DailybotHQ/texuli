import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { gotoScenario, isInert } from '../harness/oracle.ts';

/*
 * Splitter (resizable panels), held to the WAI-ARIA APG window splitter
 * pattern: keyboard, pointer and
 * touch resizing, collapse, persistence, right to left, and axe.
 */

const open = (page: Page) => gotoScenario(page, 'splitter');
const handle = (page: Page, name: string) => page.getByRole('separator', { name });
const nav = (page: Page) => handle(page, 'Resize navigation');
const width = (locator: Locator) => locator.evaluate((node) => node.getBoundingClientRect().width);
const value = (locator: Locator) => locator.getAttribute('aria-valuenow');

scenario(
  'splitter',
  defineRows([
    {
      id: 'exposes-a-named-focusable-separator-with',
      title: 'exposes a named, focusable separator with its value range',
      async run({ page }) {
        await expect(nav(page)).toHaveAttribute('aria-orientation', 'vertical');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '30');
        await expect(nav(page)).toHaveAttribute('aria-valuemin', '0');
        await expect(nav(page)).toHaveAttribute('aria-valuemax', '60');
        await expect(nav(page)).toHaveAttribute('aria-controls', 'nav-pane');
        await expect(handle(page, 'Resize terminal')).toHaveAttribute(
          'aria-orientation',
          'horizontal'
        );
        await page.getByRole('link', { name: 'Inbox' }).focus();
        await page.keyboard.press('Tab');
        await expect(nav(page)).toBeFocused();
      },
    },
    {
      id: 'resizes-with-the-keyboard-arrows-home-and',
      title: 'resizes with the keyboard: arrows, Home and End',
      async run({ page }) {
        const pane = page.locator('#nav-pane');
        const before = await width(pane);
        await nav(page).focus();
        await page.keyboard.press('ArrowRight');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '40');
        expect(await width(pane)).toBeGreaterThan(before);
        await page.keyboard.press('End');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '60');
        await page.keyboard.press('Home');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '20');
        const terminal = handle(page, 'Resize terminal');
        await terminal.focus();
        await page.keyboard.press('ArrowDown');
        await expect(terminal).toHaveAttribute('aria-valuenow', '70');
      },
    },
    {
      id: 'enter-collapses-the-pane-its-content-goes',
      title: 'Enter collapses the pane (its content goes inert) and restores it',
      async run({ page }) {
        await nav(page).focus();
        await page.keyboard.press('Enter');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '0');
        await expect(page.locator('#nav-pane')).toHaveAttribute('data-state', 'collapsed');
        expect(await width(page.locator('#nav-pane'))).toBe(0);
        expect(await isInert(page.getByRole('link', { name: 'Inbox', includeHidden: true }))).toBe(
          true
        );
        await page.keyboard.press('Enter');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '30');
        await expect(page.locator('#nav-pane')).toHaveAttribute('data-state', 'expanded');
      },
    },
    {
      id: 'mirrors-the-arrows-in-right-to-left',
      title: 'mirrors the arrows in right to left',
      async run({ page }) {
        const rtl = handle(page, 'تغيير حجم القائمة');
        await rtl.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(rtl).toHaveAttribute('aria-valuenow', '40');
        // The first pane is on the right, and it grew leftwards.
        const side = await page.locator('#rtl-side').boundingBox();
        const main = await page.locator('#rtl-main').boundingBox();
        expect(side && main && side.x > main.x).toBe(true);
      },
    },
    {
      id: 'drags-with-a-mouse',
      title: 'drags with a mouse',
      projects: ['chromium', 'webkit'],
      async run({ page }) {
        const group = await page.getByTestId('mail').boundingBox();
        const box = await nav(page).boundingBox();
        if (!group || !box) throw new Error('no layout');
        const startX = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(startX, y);
        await page.mouse.down();
        await page.mouse.move(startX + group.width * 0.15, y, { steps: 5 });
        await expect(nav(page)).toHaveAttribute('data-state', 'active');
        await page.mouse.up();
        await expect(nav(page)).toHaveAttribute('data-state', 'inactive');
        expect(Number(await value(nav(page)))).toBeGreaterThanOrEqual(44);
        expect(Number(await value(nav(page)))).toBeLessThanOrEqual(46);
      },
    },
    {
      id: 'drags-with-touch',
      title: 'drags with touch',
      projects: ['mobile'],
      async run({ page }) {
        const group = await page.getByTestId('mail').boundingBox();
        const box = await nav(page).boundingBox();
        if (!group || !box) throw new Error('no layout');
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const cdp = await page.context().newCDPSession(page);
        const touch = (type: string, px: number) =>
          cdp.send('Input.dispatchTouchEvent', {
            type,
            touchPoints: type === 'touchEnd' ? [] : [{ x: px, y }],
          });
        await touch('touchStart', x);
        for (let step = 1; step <= 5; step += 1)
          await touch('touchMove', x + (group.width * 0.15 * step) / 5);
        await touch('touchEnd', x);
        await expect.poll(async () => Number(await value(nav(page)))).toBeGreaterThanOrEqual(44);
        expect(Number(await value(nav(page)))).toBeLessThanOrEqual(46);
      },
    },
    {
      id: 'keeps-the-layout-across-a-reload',
      title: 'keeps the layout across a reload (persistence hook)',
      async run({ page }) {
        await nav(page).focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '50');
        await page.reload();
        await expect(page.locator('html[data-behavior-ready="true"]')).toHaveCount(1);
        await expect(nav(page)).toHaveAttribute('aria-valuenow', '50');
      },
    },
    {
      id: 'passes-axe-in-light-and-dark',
      title: 'passes axe in light and dark',
      async run({ page }) {
        for (const scheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          await open(page);
          await nav(page).focus();
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          expect(results.violations.map((violation) => violation.id)).toEqual([]);
        }
      },
    },
  ])
);
