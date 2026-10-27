import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { serveDist, settle } from './support/site.ts';

/*
 * texuli.com editor area, in the browser: the live RichTextEditor loads the
 * fictional document, then typing, a mark shortcut, a link at the untrusted
 * tier (an unsafe address refused visibly), undo, redo and reset all go
 * through the real editor; axe runs on the mounted editor in light and dark.
 * The page links are checked by the built-site link audit (site-seo.spec.ts).
 */

const origin = serveDist();
const editor = (page: Page) => page.getByRole('textbox', { name: 'Launch notes' });
const saved = (page: Page) => page.locator('[data-editor-markdown]');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatting' });

test('type, mark, link, undo and reset through the real editor, axe clean in light and dark', async ({
  page,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  });
  await page.goto(`${origin()}/editor-page/`);
  await settle(page);
  await expect(editor(page)).toBeVisible({ timeout: 30_000 });
  await expect(editor(page)).toHaveAttribute('contenteditable', 'true');
  await expect(editor(page).locator('strong')).toHaveText('pilot');
  await expect(editor(page).getByRole('checkbox')).toHaveCount(2);
  await expect(saved(page)).toContainText('## Launch notes');

  const bold = toolbar(page).getByRole('button', { name: 'Bold' });
  const undo = toolbar(page).getByRole('button', { name: 'Undo' });
  const redo = toolbar(page).getByRole('button', { name: 'Redo' });
  await expect(undo).toBeDisabled();
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Fictional draft ');
  await expect(saved(page)).toHaveText('## Fictional draft');
  await page.keyboard.press('ControlOrMeta+Alt+0');
  await expect(saved(page)).toHaveText('Fictional draft');
  await page.keyboard.press('ControlOrMeta+b');
  await expect(bold).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.type('notes');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type(' today ');
  await expect(saved(page)).toHaveText('Fictional draft **notes** today');

  await toolbar(page).getByRole('button', { name: 'Link' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit link' });
  const address = dialog.getByRole('textbox', { name: 'Link address' });
  await expect(address).toBeFocused();
  await address.fill('javascript:alert(1)');
  await dialog.getByRole('textbox', { name: 'Link text' }).fill('plan');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog.getByText('This address is not allowed.')).toBeVisible();
  await expect(address).toHaveAttribute('aria-invalid', 'true');
  await address.fill('https://example.com/notes');
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(saved(page)).toContainText('[plan](https://example.com/notes)');

  await undo.click();
  await expect(saved(page)).toHaveText('Fictional draft **notes** today');
  await redo.click();
  await expect(saved(page)).toContainText('[plan](https://example.com/notes)');
  await editor(page).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(saved(page)).toHaveText('Fictional draft **notes** today');
  await page.getByRole('button', { name: 'Reset the document' }).click();
  await expect(saved(page)).toContainText('## Launch notes');
  await expect(undo).toBeDisabled();

  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-tx-mode', scheme);
    await expect(editor(page)).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${scheme} ${v.id}`)).toEqual([]);
  }
  expect(foreign).toEqual([]);
});
