/// <reference types="node" />
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

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
  if (!existsSync(join(DIST, 'builder', 'index.html')) && !existsSync(join(DIST, 'builder.html'))) {
    throw new Error('Run `pnpm build` before this spec (missing /builder/).');
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

async function visit(page: Page) {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin)) foreign.push(request.url());
  });
  await page.goto(`${origin}/builder/`);
  await page.waitForLoadState('networkidle');
  expect(foreign).toEqual([]);
}

async function tabUntil(page: Page, selector: string, maximum = 500) {
  for (let index = 0; index < maximum; index += 1) {
    if (
      await page
        .locator(selector)
        .evaluate((element) => element === document.activeElement)
        .catch(() => false)
    )
      return;
    await page.keyboard.press('Tab');
  }
  const focused = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200));
  throw new Error(`Keyboard traversal did not reach ${selector}; focused element: ${focused}`);
}

/** Commit a fictional draft: a card with two texts, then a third text at the top level. */
async function loadDraft(page: Page) {
  const text = (markdown: string) => ({
    id: 'blocks-text',
    props: { block: { type: 'text', markdown } },
  });
  const draft = {
    id: 'layout-page',
    props: { title: 'Fictional outline' },
    children: [
      { id: 'layout-card', props: { title: 'Alpha' }, children: [text('one'), text('two')] },
      text('three'),
    ],
  };
  await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draft));
  await page.getByRole('button', { name: 'Commit JSON' }).click();
  await expect(page.locator('[data-builder-row="0.1"]')).toBeVisible();
}

type DraftNode = {
  id: string;
  props?: { block?: { markdown?: string; [key: string]: unknown } };
  children?: DraftNode[];
};

/** The committed draft with props read loosely (any prop shape). */
async function draft2(page: Page): Promise<{ children?: { props?: Record<string, unknown> }[] }> {
  return JSON.parse(await page.getByRole('textbox', { name: 'Blueprint JSON' }).inputValue());
}

async function draft(page: Page): Promise<DraftNode> {
  return JSON.parse(await page.getByRole('textbox', { name: 'Blueprint JSON' }).inputValue());
}

/** Text markdown in depth-first order. */
async function markdownOrder(page: Page): Promise<string[]> {
  const out: string[] = [];
  const walk = (node: DraftNode) => {
    if (node.props?.block?.markdown) out.push(node.props.block.markdown);
    node.children?.forEach(walk);
  };
  walk(await draft(page));
  return out;
}

/** Child counts of the root's children. */
async function childCounts(page: Page): Promise<number[]> {
  return ((await draft(page)).children ?? []).map((child) => child.children?.length ?? 0);
}

test.describe('texuli.com blueprint builder', () => {
  test('palette, structure, generated inspector, JSON and player stay connected', async ({
    page,
  }) => {
    await visit(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Blueprint builder' })).toBeVisible();
    await expect(page.getByRole('tree', { name: 'Structure' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Untrusted draft preview' })).toBeVisible();

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await tabUntil(page, '#palette-search');
    await page.keyboard.type('blocks-text');
    await page.keyboard.press('Enter');

    const row = page.getByRole('treeitem', { name: /Text blocks/ });
    await expect(row).toBeVisible();
    await expect(row).toBeFocused();
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Text blocks', exact: true })).toBeVisible();

    const payload = page.getByRole('textbox', { name: 'Blueprint JSON' });
    await tabUntil(page, 'textarea[aria-label="Blueprint JSON"]');
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(
      '{"id":"layout-page","children":[{"id":"blocks-text","props":{"block":{"type":"heading","level":2,"text":"Keyboard report"}}}]}'
    );
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('[data-tx-player-surface]')).toContainText('Keyboard report');
    const committed = await payload.inputValue();
    // The panel shows canonical JSON (sorted keys) with a 2-space indent.
    const canonical =
      '{"children":[{"id":"blocks-text","props":{"block":{"level":2,"text":"Keyboard report","type":"heading"}}}],"id":"layout-page"}';
    expect(committed).toBe(JSON.stringify(JSON.parse(canonical), null, 2));
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(payload).toHaveValue(committed);

    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('{ invalid');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('[data-tx-builder]')).toContainText('JSON parse failed');
    await expect(page.locator('[data-tx-player-surface]')).toContainText('Keyboard report');
  });

  test('palette: keyboard-only search, arrow selection and insert', async ({ page }) => {
    await visit(page);
    const search = page.getByRole('combobox', { name: 'Search components' });
    await tabUntil(page, '#palette-search');
    await expect(search).toBeFocused();
    const count = page.locator('[data-palette-count]');
    const total = Number((await count.textContent())?.match(/(\d+) components/)?.[1]);
    expect(total).toBeGreaterThan(30);

    // Searching narrows the list, announces the count and auto-selects the first match.
    await page.keyboard.type('chart');
    await expect(count).toContainText(/of \d+ components/);
    const firstActive = await search.getAttribute('aria-activedescendant');
    expect(firstActive).toBeTruthy();
    await expect(page.locator(`[id="${firstActive}"]`)).toHaveAttribute('aria-selected', 'true');

    // ArrowDown moves the active option; Enter inserts exactly that component.
    await page.keyboard.press('ArrowDown');
    const nextActive = await search.getAttribute('aria-activedescendant');
    expect(nextActive).not.toBe(firstActive);
    const option = page.locator(`[id="${nextActive}"]`);
    await expect(option).toHaveAttribute('aria-selected', 'true');
    const label = (await option.locator('.palette__option-label').textContent())?.trim() ?? '';
    await expect(search).toBeFocused();
    await page.keyboard.press('Enter');
    const row = page.getByRole('treeitem', { name: new RegExp(label) });
    await expect(row).toBeFocused();

    // Escape clears the search and restores the full list.
    await tabUntil(page, '#palette-search');
    await page.keyboard.press('Escape');
    await expect(search).toHaveValue('');
    await expect(count).toHaveText(`${total} components`);
  });

  test('palette: Tier U growth the builder cannot insert is disabled and explained', async ({
    page,
  }) => {
    await visit(page);
    const option = page.locator('[data-palette-option="chat-thread"]');
    await expect(option).toHaveAttribute('aria-disabled', 'true');
    await expect(option).toContainText('the player has no painter for it here');
    await expect(page.locator('[data-palette-option="layout-deck"]')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    const rows = await page.getByRole('treeitem').count();
    const search = page.getByRole('combobox', { name: 'Search components' });
    await search.fill('chat thread');
    // No insertable match: nothing is auto-selected, and Enter inserts nothing.
    await expect(search).not.toHaveAttribute('aria-activedescendant', /.+/);
    await search.press('ArrowDown');
    await search.press('Enter');
    await expect(page.locator('[data-palette-count]')).toContainText('cannot be inserted');
    await expect(page.getByRole('treeitem')).toHaveCount(rows);
  });

  test('outline: Alt+Arrow keys move nodes through edit ops, with announcements', async ({
    page,
  }) => {
    await visit(page);
    await loadDraft(page);
    const row = (key: string) => page.locator(`[data-builder-row="${key}"]`);
    const status = page.locator('[data-outline-status]');

    await row('0.0').click();
    await expect(row('0.0')).toBeFocused();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(row('0.1')).toBeFocused();
    await expect(status).toHaveText('Moved Text blocks into Card layout, position 2 of 2.');
    expect(await markdownOrder(page)).toEqual(['two', 'one', 'three']);

    // Alt+Left outdents: the node becomes the card's next sibling.
    await page.keyboard.press('Alt+ArrowLeft');
    await expect(row('1')).toBeFocused();
    expect(await markdownOrder(page)).toEqual(['two', 'one', 'three']);
    expect(await childCounts(page)).toEqual([1, 0, 0]);

    // A refused move explains itself and changes nothing.
    await row('0.0').click();
    await page.keyboard.press('Alt+ArrowUp');
    await expect(status).toContainText('Already first in its group.');
    expect(await childCounts(page)).toEqual([1, 0, 0]);
  });

  test('outline: in a right-to-left page the horizontal arrows swap (tree pattern)', async ({
    page,
  }) => {
    await visit(page);
    await loadDraft(page);
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const row = (key: string) => page.locator(`[data-builder-row="${key}"]`);

    // ArrowLeft enters the card; ArrowRight returns to it.
    await row('0').click();
    await page.keyboard.press('ArrowLeft');
    await expect(row('0.0')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(row('0')).toBeFocused();

    // Alt+ArrowRight outdents in RTL, as Alt+ArrowLeft does in LTR.
    await row('0.0').click();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(row('1')).toBeFocused();
    expect(await childCounts(page)).toEqual([1, 0, 0]);
  });

  test('outline: dragging a row into a card uses the same move op', async ({ page }) => {
    await visit(page);
    await loadDraft(page);
    const source = page.locator('[data-builder-row="1"]');
    const card = page.locator('[data-builder-row="0"]');
    const box = await card.boundingBox();
    if (!box) throw new Error('card row has no box');
    await source.dragTo(card, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.locator('[data-outline-status]')).toHaveText(
      'Moved Text blocks into Card layout, position 3 of 3.'
    );
    expect(await childCounts(page)).toEqual([3]);
    expect(await markdownOrder(page)).toEqual(['one', 'two', 'three']);
  });

  test('outline: Escape cancels an in-progress drag and announces cancellation', async ({
    page,
  }) => {
    await visit(page);
    await loadDraft(page);
    const row = page.locator('[data-builder-row="1"]');
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    if (!box) throw new Error('row has no box');
    // A pointer press that travels past the drag threshold starts the drag.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 12);
    await expect(row).toHaveClass(/outline__item--dragging/);
    await page.keyboard.press('Escape');
    await expect(row).not.toHaveClass(/outline__item--dragging/);
    await expect(page.locator('[data-outline-status]')).toHaveText('Move cancelled.');
    await page.mouse.up();
    expect(await markdownOrder(page)).toEqual(['one', 'two', 'three']);
  });

  test('builder uses no modal overlay state', async ({ page }) => {
    await visit(page);
    await expect(page.locator('[inert]')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  });

  test('outline: Delete and the Remove button remove the selected component', async ({ page }) => {
    await visit(page);
    await loadDraft(page);
    const status = page.locator('[data-outline-status]');
    // The tree owns only treeitems; removal lives outside it.
    await expect(page.getByRole('tree', { name: 'Structure' }).getByRole('button')).toHaveCount(0);

    await page.locator('[data-builder-row="0.1"]').click();
    await page.keyboard.press('Delete');
    await expect(status).toContainText('Removed');
    await expect(page.locator('[data-builder-row="0"]')).toBeFocused();
    expect(await markdownOrder(page)).toEqual(['one', 'three']);

    await page.locator('[data-builder-row="1"]').click();
    await page.getByRole('button', { name: /^Remove Text/ }).click();
    expect(await markdownOrder(page)).toEqual(['one']);
    await page.locator('[data-builder-row=""]').click();
    await expect(page.getByRole('button', { name: 'Remove selected component' })).toBeDisabled();
  });

  test('inspector: a text block is edited through structured fields, not JSON', async ({
    page,
  }) => {
    await visit(page);
    await loadDraft(page);
    await page.locator('[data-builder-row="0.0"]').click();
    const editor = page.locator('[data-tx-text-editor]');
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Block type')).toHaveValue('text');

    const body = editor.getByRole('textbox', { name: /^Text/ });
    await body.fill('Fictional **launch** notes.');
    await expect(page.locator('[data-tx-player-surface]')).toContainText('launch notes');
    let node = (await draft(page)).children?.[0]?.children?.[0];
    expect(node?.props?.block).toEqual({ type: 'text', markdown: 'Fictional **launch** notes.' });

    // A refused link is explained before it paints.
    await body.fill('Read [this](javascript:alert(1)) first.');
    await expect(editor.locator('[data-link-kept="false"]')).toContainText(
      'refused by the URL policy'
    );

    // Switching type keeps the text; list items are edited one by one.
    await editor.getByLabel('Block type').selectOption('list');
    await expect(editor.getByRole('textbox', { name: 'Item 1' })).toHaveValue(
      'Read [this](javascript:alert(1)) first.'
    );
    await editor.getByRole('button', { name: 'Add item' }).click();
    await editor.getByRole('textbox', { name: 'Item 2' }).fill('Second fictional point');
    await expect(editor.getByText('2 of 12 items')).toBeVisible();
    node = (await draft(page)).children?.[0]?.children?.[0];
    expect(node?.props?.block).toEqual({
      type: 'list',
      items: [
        { text: 'Read [this](javascript:alert(1)) first.' },
        { text: 'Second fictional point' },
      ],
    });

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
  });

  test('inspector: enum and boolean props use closed choices and flag refused values', async ({
    page,
  }) => {
    await visit(page);
    const hostile = {
      id: 'layout-doc',
      props: { title: 'Fictional doc', toc: 'yes' },
      children: [
        {
          id: 'charts-line',
          props: {
            title: 'Fictional signups',
            description: 'Signups per week.',
            series: [{ id: 'a', label: 'A', points: [{ x: 'W1', y: 3 }] }],
            mode: 'evil',
            renderer: 'svg',
          },
        },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(hostile));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    const propsAt = async (index?: number) => {
      const root = (await draft(page)) as {
        props?: Record<string, unknown>;
        children?: { props?: Record<string, unknown> }[];
      };
      return index === undefined ? (root.props ?? {}) : (root.children?.[index]?.props ?? {});
    };

    // A refused boolean is explained and can be cleared; the switch then shows its default.
    await page.locator('[data-builder-row=""]').click();
    const toc = page.locator('[data-tx-choice="toc"]');
    await expect(toc).toHaveAttribute('data-state', 'invalid');
    await expect(toc).toContainText('will be refused at paint');
    await toc.getByRole('button', { name: 'Clear invalid toc' }).click();
    expect('toc' in (await propsAt())).toBe(false);
    const tocSwitch = toc.getByRole('switch', { name: 'toc' });
    await expect(tocSwitch).toBeChecked();
    await tocSwitch.click();
    expect((await propsAt()).toc).toBe(false);
    await toc.getByRole('button', { name: 'Reset toc to default' }).click();
    expect('toc' in (await propsAt())).toBe(false);

    // A refused enum selects nothing until a value from the closed set is picked.
    await page.locator('[data-builder-row="0"]').click();
    const mode = page.locator('[data-tx-choice="mode"]');
    await expect(mode).toHaveAttribute('data-state', 'invalid');
    await expect(mode.getByRole('radio', { checked: true })).toHaveCount(0);
    await mode.getByRole('radio', { name: 'dark' }).check();
    await expect(mode).toHaveAttribute('data-state', 'set');
    expect((await propsAt(0)).mode).toBe('dark');
    await expect(
      page.locator('[data-tx-choice="renderer"]').getByRole('radio', { name: 'svg' })
    ).toBeChecked();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id} ${node.target.join(', ')}`)
      )
    ).toEqual([]);
  });

  test('payload: refused text names each line and changes nothing', async ({ page }) => {
    await visit(page);
    await loadDraft(page);
    const payload = page.getByRole('textbox', { name: 'Blueprint JSON' });
    const good = await payload.inputValue();
    // One good edit and one unknown prop in the same text: none of it applies.
    const edited = good
      .replace('"Fictional outline"', '"Renamed outline"')
      .replace('"title": "Alpha"', '"title": "Alpha",\n          "colour": "red"');
    await payload.fill(edited);
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    const line = edited.split('\n').findIndex((row) => row.includes('"colour"')) + 1;
    const issue = page.getByRole('list', { name: 'Commit issues' }).getByRole('button');
    await expect(issue).toHaveText(
      new RegExp(`^Line ${line}, column \\d+: "layout-card" has no "colour" prop\\.`)
    );
    await expect(page.locator('[data-builder-payload]')).toContainText('The draft was not changed');
    await expect(page.locator('[data-tx-player-surface]')).not.toContainText('Renamed outline');
    await expect(payload).toHaveValue(edited);

    // Choosing the issue puts the caret on that line.
    await issue.click();
    await expect(payload).toBeFocused();
    const caretLine = await payload.evaluate(
      (element: HTMLTextAreaElement) =>
        element.value.slice(0, element.selectionStart).split('\n').length
    );
    expect(caretLine).toBe(line);
  });

  test('payload: a structured edit never overwrites uncommitted JSON', async ({ page }) => {
    await visit(page);
    await loadDraft(page);
    const payload = page.getByRole('textbox', { name: 'Blueprint JSON' });
    const typed = (await payload.inputValue()).replace('"Alpha"', '"Typed but not committed"');
    await payload.fill(typed);
    // An outline edit changes the draft while the text has uncommitted work.
    await page.locator('[data-builder-row="0"]').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-builder-row="0.1"]')).toHaveCount(0);
    await expect(payload).toHaveValue(typed);
    await expect(page.locator('[data-builder-payload]')).toContainText('Your text is kept');
    await page.getByRole('button', { name: 'Reload draft' }).click();
    await expect(payload).not.toHaveValue(typed);
    expect((await draft(page)).children?.length).toBe(1);
  });

  test('inspector: number props store finite numbers and flag refused or out-of-range values', async ({
    page,
  }) => {
    await visit(page);
    const draftJson = {
      id: 'layout-page',
      props: { title: 'Fictional health' },
      children: [{ id: 'charts-gauge', props: { label: 'Uptime', value: '12', size: -5 } }],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draftJson));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    const gaugeProps = async () =>
      ((await draft(page)) as { children?: { props?: Record<string, unknown> }[] }).children?.[0]
        ?.props ?? {};
    await page.locator('[data-builder-row="0"]').click();

    // A string where a number belongs is refused at paint, shown, and replaceable.
    const value = page.locator('[data-tx-number="value"]');
    await expect(value).toHaveAttribute('data-state', 'invalid');
    await expect(value).toContainText('will be refused at paint');
    await expect(value).toContainText('"12"');
    await value.getByRole('spinbutton').fill('42');
    await expect(value).toHaveAttribute('data-state', 'set');
    expect((await gaugeProps()).value).toBe(42);

    // Outside the chart schema's range is a warning, not a refusal; the renderer accepts it.
    const size = page.locator('[data-tx-number="size"]');
    await expect(size).toContainText('Outside the documented range (greater than 0)');
    await expect(size.getByRole('spinbutton')).not.toHaveAttribute('aria-invalid', 'true');
    await size.getByRole('button', { name: 'Reset size to default' }).click();
    expect('size' in (await gaugeProps())).toBe(false);

    // Schema defaults are placeholders only.
    const thickness = page.locator('[data-tx-number="thickness"]');
    await expect(thickness.getByRole('spinbutton')).toHaveAttribute('placeholder', '12');
    await expect(thickness).toContainText('Default: 12. A default is not saved.');
    expect('thickness' in (await gaugeProps())).toBe(false);

    // A non-finite entry is refused and never stored.
    await thickness.getByRole('spinbutton').fill('1e400');
    await thickness.getByRole('spinbutton').press('Tab');
    await expect(thickness).toContainText('Enter a finite number.');
    expect('thickness' in (await gaugeProps())).toBe(false);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id} ${node.target.join(', ')}`)
      )
    ).toEqual([]);
  });

  test('inspector: structured props are edited field by field from the chart schema', async ({
    page,
  }) => {
    await visit(page);
    const draftJson = {
      id: 'layout-page',
      props: { title: 'Fictional sales' },
      children: [
        {
          id: 'charts-pie',
          props: {
            title: 'Share',
            description: 'Fictional share by region.',
            data: [
              { id: 'a', label: 'Alpha', value: 3, color: 'red' },
              { id: 'a', label: '', value: 'x' },
            ],
            labels: {},
          },
        },
        { id: 'charts-gauge', props: { label: 'Uptime', value: 1, thresholds: 'oops' } },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draftJson));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    const propsOf = async (index: number) =>
      ((await draft(page)) as { children?: { props?: Record<string, unknown> }[] }).children?.[
        index
      ]?.props ?? {};
    await page.locator('[data-builder-row="0"]').click();

    // Closed sub-field editors, no JSON box; every schema break sits next to its field.
    const data = page.locator('[data-tx-struct="data"]');
    await expect(data).toHaveAttribute('data-state', 'set');
    await expect(data.locator('textarea')).toHaveCount(0);
    await expect(data.locator('[data-verdict="warning"]')).toContainText('may not draw');
    await expect(data.locator('[data-unknown-key="color"]')).toContainText(
      'Unknown key "color" is not in the schema.'
    );
    await expect(data.locator('[data-struct-path="1.id"]')).toContainText(
      'Duplicate id (also item 1).'
    );
    await expect(data.locator('[data-struct-path="1.label"]')).toContainText('Must not be empty.');
    await expect(data.locator('[data-struct-path="1.value"]')).toContainText(
      'Expected a finite number, got a string.'
    );

    // Unknown keys are refused visibly and removed with one button.
    await data.getByRole('button', { name: 'Remove unknown key color' }).click();
    expect(((await propsOf(0)).data as Record<string, unknown>[])[0]).toEqual({
      id: 'a',
      label: 'Alpha',
      value: 3,
    });

    await data.locator('[data-struct-path="1.id"]').getByRole('textbox').fill('b');
    await data.locator('[data-struct-path="1.label"]').getByRole('textbox').fill('Beta');
    await data.locator('[data-struct-path="1.value"]').getByRole('spinbutton').fill('5');
    await expect(data.locator('[data-verdict]')).toHaveCount(0);
    expect((await propsOf(0)).data).toEqual([
      { id: 'a', label: 'Alpha', value: 3 },
      { id: 'b', label: 'Beta', value: 5 },
    ]);

    // Add, move and remove list items; a new item gets a free unique id.
    await data.getByRole('button', { name: 'Add data item' }).click();
    await data.getByRole('button', { name: 'Move data item 3 up' }).click();
    expect(((await propsOf(0)).data as { id: string }[]).map((slice) => slice.id)).toEqual([
      'a',
      'item-3',
      'b',
    ]);
    await data.getByRole('button', { name: 'Remove data item 2' }).click();
    expect(((await propsOf(0)).data as { id: string }[]).map((slice) => slice.id)).toEqual([
      'a',
      'b',
    ]);

    // The renderer's own refusal of a wrong container, and a union picked by its shape.
    await page.locator('[data-builder-row="1"]').click();
    const thresholds = page.locator('[data-tx-struct="thresholds"]');
    await expect(thresholds).toHaveAttribute('data-state', 'invalid');
    await expect(thresholds).toContainText('Refused by the renderer');
    await thresholds.getByRole('button', { name: 'Clear invalid thresholds' }).click();
    expect('thresholds' in (await propsOf(1))).toBe(false);

    const format = page.locator('[data-tx-struct="format"]');
    expect('format' in (await propsOf(1))).toBe(false);
    await format.getByRole('button', { name: 'Add format' }).click();
    expect((await propsOf(1)).format).toEqual({ type: 'number' });
    await format.getByRole('combobox', { name: 'Number style' }).selectOption('percent');
    expect((await propsOf(1)).format).toEqual({ type: 'number', style: 'percent' });
    await format.getByRole('combobox', { name: 'format shape' }).selectOption({ label: 'date' });
    expect((await propsOf(1)).format).toEqual({ type: 'date' });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id} ${node.target.join(', ')}`)
      )
    ).toEqual([]);
  });

  test('inspector: media props show the renderer and URL-policy verdicts, and blocks-media picks its source', async ({
    page,
  }) => {
    await visit(page);
    const draftJson = {
      id: 'layout-page',
      props: { title: 'Fictional gallery' },
      children: [
        {
          id: 'media-image',
          props: {
            src: 'http://images.example.com/cat.png',
            alt: '',
            href: 'javascript:alert(1)',
          },
        },
        {
          id: 'blocks-media',
          props: {
            block: {
              type: 'image',
              src: 'https://images.example.com/cat.png',
              alt: 'A fictional cat',
              width: 640,
              height: 480,
            },
          },
        },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draftJson));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    const propsOf = async (index: number) =>
      ((await draft(page)) as { children?: { props?: Record<string, unknown> }[] }).children?.[
        index
      ]?.props ?? {};
    await page.locator('[data-builder-row="0"]').click();

    // HTTP is a developer-tier source; the player paints blueprint images untrusted.
    const src = page.locator('[data-tx-media-url="src"]');
    const srcField = src.getByRole('textbox', { name: 'src' });
    await expect(srcField).toBeVisible();
    await expect(src).toHaveAttribute('data-state', 'blocked');
    await expect(src).toContainText('Blocked by the URL policy (untrusted tier)');
    await expect(src).toContainText('allowed only at the developer tier');
    await srcField.fill('<b>cat</b>');
    await expect(src).toHaveAttribute('data-state', 'refused');
    await expect(src).toContainText('Refused by the renderer');
    await srcField.fill('https://images.example.com/cat.png');
    await expect(src).toHaveAttribute('data-state', 'painted');
    expect((await propsOf(0)).src).toBe('https://images.example.com/cat.png');

    const href = page.locator('[data-tx-media-url="href"]');
    const hrefField = href.getByRole('textbox', { name: 'href' });
    await expect(hrefField).toBeVisible();
    await expect(href).toContainText('Script URLs are blocked at every tier.');
    await hrefField.fill('');
    expect('href' in (await propsOf(0))).toBe(false);

    // A blank alt is legal, and the player replaces it; the field says so.
    const alt = page.locator('[data-tx-media-alt]');
    await expect(alt).toHaveAttribute('data-state', 'replaced');
    await expect(alt).toContainText('"no description" label');
    await alt.getByRole('textbox').fill('A fictional cat');
    await expect(alt).toHaveAttribute('data-state', 'set');

    // blocks-media: remote URLs are refused by the block schema; pick an avatar, a file, a path.
    await page.locator('[data-builder-row="1"]').click();
    const editor = page.locator('[data-tx-media-editor]');
    const source = editor.locator('[data-tx-media-source="Image source"]');
    await expect(source.getByRole('textbox', { name: 'Path' })).toBeVisible();
    await expect(source).toContainText('Refused by the block schema');
    await expect(editor.locator('textarea')).toHaveCount(0);
    const blockOf = async () => (await propsOf(1)).block as Record<string, unknown>;

    await source.getByRole('radio', { name: 'Avatar' }).check();
    await source.getByRole('combobox', { name: 'Avatar' }).selectOption('av-007');
    expect((await blockOf()).src).toBe('avatar:av-007');
    await expect(source).toContainText('Accepted by the block schema: avatar.');

    await source.getByRole('radio', { name: 'Embedded file' }).check();
    await source.getByLabel('File (image)').setInputFiles({
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
    await expect(source).toContainText('Accepted by the block schema: embedded file.');
    expect(String((await blockOf()).src)).toMatch(/^data:image\/png;base64,/);

    await source.getByRole('radio', { name: 'Relative path' }).check();
    await source.getByRole('textbox', { name: 'Path' }).fill('images/cat.svg');
    await expect(source).toContainText('Refused by the block schema');
    await source.getByRole('textbox', { name: 'Path' }).fill('images/cat.png');
    await expect(source).toContainText('Accepted by the block schema: relative path.');

    // Type switch keeps the image; a gallery adds images within its cap.
    await editor.getByRole('combobox', { name: 'Block type' }).selectOption('gallery');
    await editor.getByRole('button', { name: 'Add image' }).click();
    const gallery = await blockOf();
    expect(gallery.type).toBe('gallery');
    expect((gallery.items as Record<string, unknown>[]).map((item) => item.src)).toEqual([
      'images/cat.png',
      expect.stringMatching(/^data:image\/png;base64,/),
    ]);
    await expect(editor).toContainText('The block schema accepts this block.');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id} ${node.target.join(', ')}`)
      )
    ).toEqual([]);
  });

  test('JSON import reports duplicate keys without changing the preview', async ({ page }) => {
    await visit(page);
    const payload = page.getByRole('textbox', { name: 'Blueprint JSON' });
    await payload.fill('{"id":"layout-page","props":{"title":"first","title":"second"}}');
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    await expect(page.locator('[data-tx-builder]')).toContainText('Duplicate JSON keys');
    await expect(page.locator('[data-tx-player-surface]')).not.toContainText('second');
  });

  test('preview: player diagnostics reach the issues area and select their node', async ({
    page,
  }) => {
    await visit(page);
    const issues = page.getByRole('region', { name: 'Draft issues' });
    await expect(issues.getByRole('status')).toHaveText('No issues: the draft passes validation.');

    // A fictional draft whose second text has no block: invalid, previewed with a placeholder.
    const draft = {
      id: 'layout-page',
      props: { title: 'Fictional issues' },
      children: [
        { id: 'blocks-text', props: { block: { type: 'text', markdown: 'still paints' } } },
        { id: 'blocks-text', props: {} },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draft));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    await expect(issues).toContainText('Required prop "block" is missing.');
    await expect(issues.getByRole('status')).toContainText('the preview paints the rest');
    await expect(page.locator('[data-tx-player-surface]')).toContainText('still paints');

    const select = issues.getByRole('button', { name: 'Select Text blocks' }).first();
    await select.focus();
    await page.keyboard.press('Enter');
    const row = page.locator('[data-builder-row="1"]');
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(row).toBeFocused();

    draft.children[1] = {
      id: 'blocks-text',
      props: { block: { type: 'text', markdown: 'fixed' } },
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draft));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    await expect(issues.getByRole('status')).toHaveText('No issues: the draft passes validation.');
    await expect(issues.getByRole('listitem')).toHaveCount(0);
  });

  test('inspector: record keys have contextual accessible names', async ({ page }) => {
    await visit(page);
    const value = {
      id: 'layout-page',
      children: [
        {
          id: 'charts-geo-map',
          props: { data: { 'co.example.north': 4 } },
        },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(value));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    await page.locator('[data-builder-row="0"]').click();

    const record = page.locator('[data-tx-struct="data"]');
    await expect(record.getByRole('textbox', { name: 'data key 1' })).toHaveValue(
      'co.example.north'
    );
    await expect(record.getByRole('button', { name: 'Add entry to data' })).toBeVisible();
  });

  test('preview: edits update the mounted player in place', async ({ page }) => {
    await visit(page);
    await loadDraft(page);
    const player = page.locator('[data-builder-preview] [data-tx-player]');
    await player.evaluate((element) => element.setAttribute('data-test-mounted', 'first'));
    await page.locator('[data-builder-row="1"]').click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('[data-builder-preview] [data-tx-player-surface]')).not.toContainText(
      'Fictional outline'
    );
    await expect(player).toHaveAttribute('data-test-mounted', 'first');
  });

  test('history: undo and redo announce what came back and restore the selection', async ({
    page,
  }) => {
    await visit(page);
    await loadDraft(page);
    const status = page.locator('.builder__status');
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    const redo = page.getByRole('button', { name: 'Redo', exact: true });
    await expect(redo).toBeDisabled();

    await page.locator('[data-builder-row="0.1"]').click();
    await page.keyboard.press('Delete');
    await expect(page.locator('[data-builder-row="0.1"]')).toHaveCount(0);
    await expect(undo).toHaveAttribute('title', 'Undo: Remove Text blocks');

    // The shortcut works from the outline; the removed text comes back selected.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(status).toHaveText('Undid: Remove Text blocks.');
    await expect(page.locator('[data-builder-row="0.1"]')).toHaveAttribute('aria-selected', 'true');
    await expect(redo).toBeEnabled();
    await expect(redo).toHaveAttribute('title', 'Redo: Remove Text blocks');

    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(status).toHaveText('Redid: Remove Text blocks.');
    await expect(page.locator('[data-builder-row="0.1"]')).toHaveCount(0);
    await expect(page.locator('[data-builder-row="0"]')).toHaveAttribute('aria-selected', 'true');

    await undo.click();
    await expect(status).toHaveText('Undid: Remove Text blocks.');
    await expect(redo).toBeEnabled();
    // A new edit clears redo.
    await page.locator('[data-builder-row="1"]').click();
    await page.keyboard.press('Delete');
    await expect(redo).toBeDisabled();

    await undo.click();
    await undo.click();
    await expect(status).toHaveText('Undid: Commit JSON.');
    await expect(page.locator('[data-builder-row="0"]')).toHaveCount(0);
  });

  test('history: Cmd/Ctrl+Z in the JSON text undoes the text, and Undo keeps the buffer', async ({
    page,
  }) => {
    await visit(page);
    await loadDraft(page);
    const status = page.locator('.builder__status');
    const payload = page.getByRole('textbox', { name: 'Blueprint JSON' });
    const committed = await payload.inputValue();
    await payload.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('  ');
    await page.keyboard.press('ControlOrMeta+z');
    // The text field kept its own undo: the draft did not move.
    await expect(status).not.toContainText('Undid');
    await expect(page.locator('[data-builder-row="0.1"]')).toBeVisible();

    const typed = committed.replace('"Alpha"', '"Typed but not committed"');
    await payload.fill(typed);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(status).toHaveText('Undid: Commit JSON.');
    await expect(payload).toHaveValue(typed);
    await expect(page.locator('[data-builder-payload]')).toContainText('Your text is kept');
  });

  for (const scheme of ['light', 'dark', 'forced-colors'] as const) {
    test(`has no axe violations in ${scheme} mode`, async ({ page }) => {
      await page.emulateMedia(
        scheme === 'forced-colors' ? { forcedColors: 'active' } : { colorScheme: scheme }
      );
      await visit(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.flatMap((violation) =>
          violation.nodes.map(
            (node) => `${scheme} ${violation.id} ${node.target.join(', ')} ${node.html}`
          )
        )
      ).toEqual([]);
    });
  }
  test('keyboard: Tab walks the panes in order, with no trap and no dead stop', async ({
    page,
  }, testInfo) => {
    // WebKit's default Tab skips links and buttons (a macOS setting), so the
    // pane walk runs on Chromium and Pixel 7.
    test.skip(testInfo.project.name === 'webkit', 'WebKit Tab order depends on a system setting');
    await visit(page);
    await loadDraft(page);
    const region = () =>
      page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return 'body';
        const pane = element.closest(
          '.builder__toolbar, [data-tx-palette], [data-builder-preview], .builder__outline, .builder__inspector, [data-builder-payload]'
        );
        if (!pane) return 'outside';
        if (pane.matches('.builder__toolbar')) return 'toolbar';
        if (pane.matches('[data-tx-palette]'))
          return element.getAttribute('role') === 'listbox' ? 'palette-listbox' : 'palette';
        if (pane.matches('[data-builder-preview]')) return 'preview';
        if (pane.matches('.builder__outline')) return 'outline';
        if (pane.matches('.builder__inspector')) return 'inspector';
        return 'payload';
      });
    const walk = async (key: string) => {
      const seen: string[] = [];
      for (let step = 0; step < 300; step += 1) {
        await page.keyboard.press(key);
        const where = await region();
        if (where === 'body')
          throw new Error(`${key} dropped focus to the body after ${seen.join(' > ')}`);
        if (seen[seen.length - 1] !== where) seen.push(where);
        if (where === 'outside') return seen;
      }
      throw new Error(`${key} never left the builder (a trap): ${seen.join(' > ')}`);
    };
    // The structure row is selected, so the inspector has fields.
    await page.locator('[data-builder-row="0"]').click();
    await page.getByRole('button', { name: 'Undo', exact: true }).focus();
    expect(await walk('Tab')).toEqual([
      'toolbar',
      'palette',
      'outline',
      'preview',
      'inspector',
      'payload',
      'outside',
    ]);
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).focus();
    expect(await walk('Shift+Tab')).toEqual([
      'payload',
      'inspector',
      'preview',
      'outline',
      'palette',
      'toolbar',
      'outside',
    ]);
  });

  test('keyboard: list items move with Alt+Arrow, focus follows the item, and it is announced', async ({
    page,
  }) => {
    await visit(page);
    const draft = {
      id: 'layout-page',
      props: { title: 'Fictional checklist' },
      children: [
        {
          id: 'blocks-text',
          props: {
            block: {
              type: 'list',
              items: [{ text: 'Harbor' }, { text: 'Pier' }, { text: 'Ledger' }],
            },
          },
        },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draft));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    await page.locator('[data-builder-row="0"]').click();
    const items = async () =>
      (
        ((await draft2(page)).children?.[0]?.props?.block ?? { items: [] }) as {
          items: { text: string }[];
        }
      ).items.map((item) => item.text);
    const third = page.getByRole('textbox', { name: 'Item 3' });
    await third.focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(items).toEqual(['Harbor', 'Ledger', 'Pier']);
    // The same field of the moved item keeps focus, and the move is announced.
    await expect(page.getByRole('textbox', { name: 'Item 2' })).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Item 2' })).toHaveValue('Ledger');
    await expect(page.locator('.builder__inspector [data-list-status]')).toHaveText(
      'Item moved to position 2 of 3.'
    );

    // A Move button keeps focus with the item too; at the top edge focus stays on a live control.
    await page.getByRole('button', { name: 'Move item 2 up' }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(items).toEqual(['Ledger', 'Harbor', 'Pier']);
    const active = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? 'body');
    await expect.poll(active).toMatch(/item 1/);

    // Removing the last item never drops focus to the page.
    await page.getByRole('button', { name: 'Remove item 3' }).focus();
    await page.keyboard.press('Space');
    await expect.poll(items).toEqual(['Ledger', 'Harbor']);
    await expect.poll(active).toBe('Remove item 2');
    await expect(page.locator('.builder__inspector [data-list-status]')).toHaveText(
      'Item removed. 2 left.'
    );
  });

  test('keyboard: gallery images and chart series points reorder from the keyboard', async ({
    page,
  }) => {
    await visit(page);
    const draft = {
      id: 'layout-page',
      props: { title: 'Fictional media' },
      children: [
        {
          id: 'blocks-media',
          props: {
            block: {
              type: 'gallery',
              items: [
                { src: 'https://example.com/north.png', alt: 'North pier' },
                { src: 'https://example.com/south.png', alt: 'South pier' },
              ],
            },
          },
        },
        {
          id: 'charts-line',
          props: {
            title: 'Fictional signups',
            description: 'Signups per week.',
            series: [
              {
                id: 'a',
                label: 'A',
                points: [
                  { x: 'W1', y: 3 },
                  { x: 'W2', y: 5 },
                ],
              },
            ],
          },
        },
      ],
    };
    await page.getByRole('textbox', { name: 'Blueprint JSON' }).fill(JSON.stringify(draft));
    await page.getByRole('button', { name: 'Commit JSON' }).click();
    const read = async () => (await draft2(page)).children ?? [];

    await page.locator('[data-builder-row="0"]').click();
    await page.getByRole('button', { name: 'Move image 2 up' }).focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () =>
        (
          ((await read())[0]?.props?.block ?? { items: [] }) as { items: { alt: string }[] }
        ).items.map((item) => item.alt)
      )
      .toEqual(['South pier', 'North pier']);
    await expect(page.locator('.builder__inspector [data-list-status]').first()).toHaveText(
      'Image moved to position 1 of 2.'
    );
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.textContent?.trim()))
      .toMatch(/image 1/);

    await page.locator('[data-builder-row="1"]').click();
    const second = page.getByRole('button', { name: /Move .*Points item 2 up/ });
    await second.focus();
    await page.keyboard.press('Alt+ArrowUp');
    await expect
      .poll(async () =>
        (((await read())[1]?.props?.series ?? []) as { points: { x: string }[] }[])[0]?.points.map(
          (p) => p.x
        )
      )
      .toEqual(['W2', 'W1']);
  });
  test('keyboard: F6 cycles the panes and each pane restores its last focus', async ({ page }) => {
    await visit(page);
    await loadDraft(page);
    await page.locator('[data-builder-row="0"]').click();
    const pane = () =>
      page.evaluate(() => {
        const element = document.activeElement;
        const marked = element?.closest('[data-builder-pane]');
        if (!marked) return 'none';
        if (marked.matches('.builder__toolbar')) return 'toolbar';
        if (marked.matches('.builder__palette')) return 'palette';
        if (marked.matches('[data-builder-preview]')) return 'preview';
        if (marked.matches('.builder__outline')) return 'outline';
        if (marked.matches('.builder__inspector')) return 'inspector';
        return 'payload';
      });
    await page.locator('#palette-search').focus();
    const forward: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('F6');
      forward.push(await pane());
    }
    expect(forward).toEqual(['outline', 'preview', 'inspector', 'payload', 'toolbar', 'palette']);
    const back: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      await page.keyboard.press('Shift+F6');
      back.push(await pane());
    }
    expect(back).toEqual(['toolbar', 'payload', 'inspector', 'preview', 'outline', 'palette']);

    // The inspector remembers the field last used in it.
    const title = page.locator('.builder__inspector input').first();
    await title.focus();
    await page.keyboard.press('F6');
    expect(await pane()).toBe('payload');
    await page.keyboard.press('Shift+F6');
    await expect(title).toBeFocused();
  });
});
