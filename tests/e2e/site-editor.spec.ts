/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/*
 * texuli.com editor area: the live RichTextEditor (typing, marks, links at the
 * untrusted tier, undo and redo), the documented vocabularies, and the docs and
 * site navigation. Built static site only (`pnpm build` first).
 */

const DIST = resolve('apps/website/dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

let server: Server;
let origin = '';

test.beforeAll(async () => {
  if (!existsSync(join(DIST, 'editor-page', 'index.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing editor-page).');
  }
  server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? '/', 'http://site').pathname);
    let file = normalize(join(DIST, path));
    if (!file.startsWith(DIST)) file = join(DIST, '404');
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((done) => server.close(() => done())));

async function visit(page: Page, path = '/editor-page/') {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('blob:') || url.startsWith('data:')) return;
    if (!url.startsWith(origin)) foreign.push(url);
  });
  await page.goto(`${origin}${path}`);
  await page.waitForLoadState('networkidle');
  return foreign;
}

const editor = (page: Page) => page.getByRole('textbox', { name: 'Launch notes' });
const saved = (page: Page) => page.locator('[data-editor-markdown]');
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Formatting' });

/** Every same-origin page link resolves to a built page with the expected h1. */
async function expectPage(page: Page, href: string, heading: string | RegExp) {
  const url = new URL(href, origin);
  expect(url.origin).toBe(origin);
  // Leave first, so a link to an anchor on the current page is a real load.
  await page.goto('about:blank');
  const response = await page.goto(url.href);
  expect(response?.status(), href).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  if (url.hash) await expect(page.locator(url.hash)).toBeVisible();
}

test.describe('texuli.com editor area', () => {
  test('renders the area, the vocabularies and no foreign network', async ({ page }) => {
    const foreign = await visit(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Editor');
    const toc = page.getByRole('navigation', { name: 'On this page' });
    for (const name of [
      'Try the editor',
      'Nodes and marks',
      'In the builder',
      'Examples',
      'What ships',
      'Package docs',
    ]) {
      await expect(toc.getByRole('link', { name, exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('heading', { level: 3, name: 'Planned' })).toBeVisible();
    const nodes = page.getByRole('table', { name: 'Block nodes' });
    const marks = page.getByRole('table', { name: 'Inline marks' });
    await expect(nodes.getByRole('row')).toHaveCount(10);
    await expect(marks.getByRole('row')).toHaveCount(6);
    await expect(page.getByText('packages/editor/README.md')).toBeVisible();
    expect(foreign).toEqual([]);
  });

  test('the live editor loads the fictional document and its Markdown', async ({ page }) => {
    await visit(page);
    await expect(editor(page)).toBeVisible({ timeout: 30_000 });
    await expect(editor(page)).toHaveAttribute('aria-multiline', 'true');
    await expect(editor(page)).toHaveAttribute('contenteditable', 'true');
    // Every node renders as a real element inside the textbox.
    await expect(editor(page).getByRole('heading', { name: 'Launch notes' })).toBeVisible();
    await expect(editor(page).locator('strong')).toHaveText('pilot');
    await expect(editor(page).locator('em')).toHaveText('Monday');
    await expect(editor(page).locator('s')).toHaveText('Friday');
    await expect(editor(page).getByRole('link', { name: 'plan' })).toHaveAttribute(
      'href',
      'https://example.com/plan'
    );
    await expect(editor(page).locator('blockquote')).toContainText('Small pieces');
    await expect(editor(page).locator('pre')).toContainText("const greeting = 'hello';");
    await expect(editor(page).locator('hr')).toHaveCount(1);
    await expect(editor(page).getByRole('checkbox')).toHaveCount(2);
    await expect(saved(page)).toContainText('## Launch notes');
    await expect(saved(page)).toContainText('- [x] Book the room');
  });

  test('type, mark, link and undo through the real editor', async ({ page }) => {
    await visit(page);
    await expect(editor(page)).toBeVisible({ timeout: 30_000 });
    const bold = toolbar(page).getByRole('button', { name: 'Bold' });
    const undo = toolbar(page).getByRole('button', { name: 'Undo' });
    const redo = toolbar(page).getByRole('button', { name: 'Redo' });
    await expect(undo).toBeDisabled();

    // Type: replace the document with one fictional sentence.
    await editor(page).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Fictional draft ');
    // The typed text keeps the first block's type (a heading); make it a paragraph.
    await expect(saved(page)).toHaveText('## Fictional draft');
    const heading2 = toolbar(page).getByRole('button', { name: 'Heading 2, H2' });
    await expect(heading2).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('ControlOrMeta+Alt+0');
    await expect(heading2).toHaveAttribute('aria-pressed', 'false');
    await expect(saved(page)).toHaveText('Fictional draft');
    await expect(undo).toBeEnabled();

    // Mark: the shortcut presses Bold, and typed text saves as strong.
    await page.keyboard.press('ControlOrMeta+b');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.type('notes');
    await expect(saved(page)).toHaveText('Fictional draft **notes**');
    await expect(editor(page).locator('strong')).toHaveText('notes');
    await page.keyboard.press('ControlOrMeta+b');
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.type(' today ');
    await expect(saved(page)).toHaveText('Fictional draft **notes** today');

    // Link: an unsafe address is refused visibly; a safe one is kept.
    await toolbar(page).getByRole('button', { name: 'Link' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit link' });
    await expect(dialog).toBeVisible();
    const address = dialog.getByRole('textbox', { name: 'Link address' });
    await expect(address).toBeFocused();
    await address.fill('javascript:alert(1)');
    await dialog.getByRole('textbox', { name: 'Link text' }).fill('plan');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog.getByText('This address is not allowed.')).toBeVisible();
    await expect(address).toHaveAttribute('aria-invalid', 'true');
    await expect(saved(page)).toHaveText('Fictional draft **notes** today');
    await address.fill('https://example.com/notes');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(editor(page).getByRole('link', { name: 'plan' })).toHaveAttribute(
      'href',
      'https://example.com/notes'
    );
    await expect(saved(page)).toContainText('[plan](https://example.com/notes)');

    // Undo and redo: the toolbar and the shortcut walk the same history.
    await undo.click();
    await expect(saved(page)).toHaveText('Fictional draft **notes** today');
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(saved(page)).toContainText('[plan](https://example.com/notes)');
    await editor(page).focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(saved(page)).toHaveText('Fictional draft **notes** today');

    // Reset brings the starting document back with a fresh history.
    await page.getByRole('button', { name: 'Reset the document' }).click();
    await expect(saved(page)).toContainText('## Launch notes');
    await expect(undo).toBeDisabled();
  });

  test('site sidebar, docs shell and example links resolve', async ({ page }) => {
    await visit(page);
    const examples = page.locator('section[aria-labelledby="examples"]');
    const hrefs = await examples
      .getByRole('link')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) await expectPage(page, href, /\S/);
    await expectPage(page, `${origin}/editor-page/#package-docs`, 'Editor');

    await visit(page, '/component-pages/');
    const sidebar = page.getByRole('link', { name: 'Editor', exact: true }).first();
    expect(await sidebar.getAttribute('href')).toMatch(/\/editor-page\/$/);
    await visit(page, '/docs-shell/');
    await expect(page.getByRole('link', { name: 'Editor overview' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Editor package docs' })).toHaveCount(1);
  });

  test(`passes axe on the editor area in light and dark`, async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await visit(page);
      await page.evaluate((mode) => {
        const root = document.documentElement;
        root.dataset.txMode = mode;
        root.classList.toggle('dark', mode === 'dark');
        root.classList.toggle('light', mode === 'light');
        root.style.colorScheme = mode;
      }, scheme);
      await expect(editor(page)).toBeVisible({ timeout: 30_000 });
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.flatMap((violation) =>
          violation.nodes.map(
            (node) => `${violation.id} ${node.target.join(', ')} ${node.failureSummary}`
          )
        )
      ).toEqual([]);
    }
  });
});
