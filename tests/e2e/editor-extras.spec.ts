/**
 * PLAN_023 T-cmp-editor in the browser: the block-type menu (APG menu button, one undo step),
 * clipboard HTML through `@texuli/core/html`, "Paste as Markdown", and the export-for-chat
 * panel. axe with zero exclusions in light and dark on each example, and with the menu open.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

const EXAMPLES = [
  'editor-block-menu',
  'editor-dialect-export',
  'editor-paste',
  'editor-emoji',
] as const;
type Id = (typeof EXAMPLES)[number];

async function open(page: Page, id: Id, mode: 'light' | 'dark' = 'light'): Promise<void> {
  await page.goto(`/?fixture=${id}&mode=${mode}`);
  await expect(page.locator(`[data-example-host="${id}"]`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('textbox').first()).toBeVisible();
}

async function axe(page: Page, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map(
    (v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`
  );
}

test('every editor-extras example passes axe in light and dark', async ({ page }) => {
  test.setTimeout(EXAMPLES.length * 40_000);
  const problems: string[] = [];
  for (const id of EXAMPLES) {
    for (const mode of ['light', 'dark'] as const) {
      await open(page, id, mode);
      problems.push(...(await axe(page, `${id} (${mode})`)));
    }
  }
  expect(problems).toEqual([]);
});

test('the block-type menu is a menu button that sets the kind in one undo step', async ({
  page,
}) => {
  await open(page, 'editor-block-menu');
  const editor = page.getByRole('textbox', { name: 'Release notes' });
  await editor.getByRole('heading', { name: 'Release checklist' }).click();
  const trigger = page.getByRole('button', { name: 'Text style: Heading 2' });
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

  // The trigger is a toolbar item: reach it with the arrow keys.
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Text style: Heading 2' });
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const items = menu.getByRole('menuitemradio');
  await expect(items).toHaveCount(10);
  await expect(menu.getByRole('menuitemradio', { name: /Heading 2/ })).toHaveAttribute(
    'aria-checked',
    'true'
  );
  expect(await axe(page, 'menu open')).toEqual([]);

  // Escape closes and returns focus to the button.
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  // Choose Quote from the keyboard: End then Up lands on Quote (code block is last).
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitemradio', { name: /Quote/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu).toBeHidden();
  const markdown = page.getByLabel('Saved as Markdown');
  // Quote wraps the block as it is.
  await expect(markdown).toContainText('> ## Release checklist');
  // Focus is back in the text, and one undo restores the heading.
  await expect(editor).toBeFocused();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(markdown).toContainText('## Release checklist');
});

test('clipboard HTML is read without a DOM: scripts, handlers and unsafe links are gone', async ({
  page,
}) => {
  await open(page, 'editor-paste');
  await page.getByRole('button', { name: 'Paste sample HTML' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'html:' })).toContainText(
    '1 links removed'
  );
  const editor = page.getByRole('textbox', { name: 'Paste' });
  await expect(editor.getByRole('heading', { name: 'Meeting notes' })).toBeVisible();
  await expect(editor.getByRole('link', { name: 'doc' })).toHaveAttribute(
    'href',
    'https://example.com/doc'
  );
  await expect(editor.getByRole('link', { name: 'bad link' })).toHaveCount(0);
  const html = await editor.innerHTML();
  expect(html).not.toMatch(/onclick|steal|<script/i);
});

test('plain text stays plain unless pasted as Markdown, also from a real paste event', async ({
  page,
}) => {
  await open(page, 'editor-paste');
  await page.getByRole('button', { name: 'Paste sample text' }).click();
  const editor = page.getByRole('textbox', { name: 'Paste' });
  await expect(editor).toContainText('**Parsed**');
  await page.getByRole('button', { name: 'Paste sample as Markdown' }).click();
  await expect(editor.getByRole('heading', { name: 'From Markdown' })).toBeVisible();
  await expect(editor.locator('strong', { hasText: 'Parsed' })).toBeVisible();
  await expect(editor).toContainText('Raw <b>HTML</b> stays text');

  // A real paste event after the "Paste as Markdown" chord, when the Clipboard API is refused.
  // The caret goes to the end of the last list item through the DOM selection (the editor
  // follows selectionchange): Ctrl+End and Meta+End move it differently per platform.
  const lastItem = editor.locator('li', { hasText: 'Raw <b>HTML</b> stays text' });
  await lastItem.click();
  await lastItem.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.keyboard.press('ControlOrMeta+Alt+Shift+V');
  await page.evaluate(() => {
    const target = document.activeElement as HTMLElement;
    const data = new DataTransfer();
    data.setData('text/plain', '## Chord heading');
    target.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
    );
  });
  // The pasted heading keeps its level as a block of its own after the item's text, which is
  // unchanged (before the fix it became a plain paragraph).
  await expect(editor.getByRole('heading', { level: 2, name: 'Chord heading' })).toBeVisible();
  await expect(lastItem.locator('p').first()).toHaveText('Raw <b>HTML</b> stays text');
});

test('export for chat shows each format and what it loses, and never pings', async ({ page }) => {
  await open(page, 'editor-dialect-export');
  const region = page.getByRole('region', { name: 'Export for chat' });
  const output = region.getByRole('textbox', { name: 'Slack text' });
  await expect(output).toHaveJSProperty('readOnly', true);
  const slack = await output.inputValue();
  expect(slack).toContain('<https://example.com/beta|beta>');
  expect(slack).toContain('@\u200bhere');
  await expect(
    region.getByText('Checklist items are written with ☑ and ☐ marks. (×2)')
  ).toBeVisible();

  await region.getByRole('combobox', { name: 'Format' }).click();
  await page.getByRole('option', { name: 'Discord' }).click();
  const discord = region.getByRole('textbox', { name: 'Discord text' });
  await expect(discord).toHaveValue(/^# Standup/);
  await expect(discord).toHaveValue(/\[beta\]\(https:\/\/example\.com\/beta\)/);
});

test('the emoji button opens the picker in a popover; a choice is one undo step', async ({
  page,
}) => {
  await open(page, 'editor-emoji');
  const editor = page.getByRole('textbox', { name: 'Team update' });
  await editor.getByText('today.').click();
  await page.keyboard.press('End');
  const button = page.getByRole('button', { name: 'Emoji' });
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Insert emoji' });
  await expect(dialog).toBeVisible();
  const grid = dialog.getByRole('grid');
  await expect(grid.getByRole('gridcell').first()).toBeVisible({ timeout: 15_000 });
  expect(await axe(page, 'emoji popover open')).toEqual([]);
  // Search, then choose with the keyboard.
  await dialog.getByRole('combobox', { name: 'Search emoji' }).fill('rocket');
  const rocket = grid.getByRole('gridcell', { name: /rocket/i }).first();
  await expect(rocket).toBeVisible();
  await rocket.click();
  await expect(dialog).toBeHidden();
  await expect(editor).toContainText('today.🚀');
  await expect(editor).toBeFocused();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor).not.toContainText('🚀');
  await expect(editor).toContainText('today.');
});

test('a typed :shortcode: becomes its emoji, and one undo restores the shortcode', async ({
  page,
}) => {
  await open(page, 'editor-emoji');
  const editor = page.getByRole('textbox', { name: 'Team update' });
  await editor.getByText('today.').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' :tada:');
  await expect(editor).toContainText('today. 🎉');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor).toContainText('today. :tada:');
});
