import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { serveDist } from './support/site.ts';

/*
 * texuli.com blueprint builder (/builder/), in the browser: three sessions,
 * each a fresh load per segment (the builder keeps no state across loads).
 * The edit model, history labels, inspector rules (text, choice, number,
 * structured, media), list focus rules, F6 order and outline operations are
 * unit-tested in scripts/tests/site-builder*.test.ts; this is what needs a
 * real page: keyboard and focus, pointer and touch drags, the mounted
 * player, layout of the preview, the share link and axe on edited states.
 * axe on the bare page runs in the page sweep, a11y-site.spec.ts.
 */

const origin = serveDist();

async function visit(page: Page, hash = '') {
  const foreign: string[] = [];
  const onRequest = (request: { url: () => string }) => {
    if (!request.url().startsWith(origin())) foreign.push(request.url());
  };
  page.on('request', onRequest);
  await page.goto(`${origin()}/builder/${hash}`);
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.txPageReady === 'true' ||
      (!document.querySelector('script[data-tx-ready-script]') &&
        document.readyState === 'complete'),
    undefined,
    { polling: 100 }
  );
  page.off('request', onRequest);
  expect(foreign).toEqual([]);
}

async function tabUntil(page: Page, selector: string, maximum = 500, key = 'Tab') {
  for (let index = 0; index < maximum; index += 1) {
    if (
      await page
        .locator(selector)
        .evaluate((element) => element === document.activeElement)
        .catch(() => false)
    )
      return;
    await page.keyboard.press(key);
  }
  throw new Error(`Keyboard traversal did not reach ${selector}`);
}

const payload = (page: Page) => page.getByRole('textbox', { name: 'Blueprint JSON' });
const row = (page: Page, key: string) => page.locator(`[data-builder-row="${key}"]`);
const outlineStatus = (page: Page) => page.locator('[data-outline-status]');
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo', exact: true });

async function commitDraft(page: Page, value: unknown) {
  await payload(page).fill(JSON.stringify(value));
  await page.getByRole('button', { name: 'Commit JSON' }).click();
}

const textNode = (markdown: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});

/** Commit a fictional draft: a card with two texts, then a third text at the top level. */
async function loadDraft(page: Page) {
  await commitDraft(page, {
    id: 'layout-page',
    props: { title: 'Fictional outline' },
    children: [
      {
        id: 'layout-card',
        props: { title: 'Alpha' },
        children: [textNode('one'), textNode('two')],
      },
      textNode('three'),
    ],
  });
  await expect(row(page, '0.1')).toBeVisible();
}

type DraftNode = {
  id: string;
  props?: Record<string, unknown> & { block?: Record<string, unknown> & { markdown?: string } };
  children?: DraftNode[];
};

async function draft(page: Page): Promise<DraftNode> {
  return JSON.parse(await payload(page).inputValue());
}

async function propsOf(page: Page, index: number): Promise<Record<string, unknown>> {
  return (await draft(page)).children?.[index]?.props ?? {};
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

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id} ${node.target.join(', ')}`)
  );
}

/** Press on one element, travel past the drag threshold, release on another (real mouse events). */
async function mouseDrag(page: Page, from: Locator, to: Locator) {
  await from.scrollIntoViewIfNeeded();
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error('drag ends have no box');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 8, { steps: 2 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 6 });
  await page.mouse.up();
}

test('keyboard: palette, JSON, outline moves, history, Tab order and F6 panes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await visit(page);
  // No modal state: nothing inert, no dialog, the page scrolls.
  await expect(page.locator('[inert]')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');

  // Palette: keyboard-only search, arrow selection and insert.
  const search = page.getByRole('combobox', { name: 'Search components' });
  await tabUntil(page, '#palette-search');
  const count = page.locator('[data-palette-count]');
  const total = Number((await count.textContent())?.match(/(\d+) components/)?.[1]);
  expect(total).toBeGreaterThan(30);
  await page.keyboard.type('chart');
  await expect(count).toContainText(/of \d+ components/);
  const firstActive = await search.getAttribute('aria-activedescendant');
  expect(firstActive).toBeTruthy();
  await page.keyboard.press('ArrowDown');
  const nextActive = await search.getAttribute('aria-activedescendant');
  expect(nextActive).not.toBe(firstActive);
  const option = page.locator(`[id="${nextActive}"]`);
  await expect(option).toHaveAttribute('aria-selected', 'true');
  const label = (await option.locator('.palette__option-label').textContent())?.trim() ?? '';
  await page.keyboard.press('Enter');
  await expect(page.getByRole('treeitem', { name: new RegExp(label) })).toBeFocused();
  await tabUntil(page, '#palette-search', 100, 'Shift+Tab');
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(count).toHaveText(`${total} components`);
  // Growth the builder cannot insert is disabled, explained, and Enter inserts nothing.
  await expect(page.locator('[data-palette-option="chat-thread"]')).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  const rows = await page.getByRole('treeitem').count();
  await search.fill('chat thread');
  await expect(search).not.toHaveAttribute('aria-activedescendant', /.+/);
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(count).toContainText('cannot be inserted');
  await expect(page.getByRole('treeitem')).toHaveCount(rows);

  // JSON: Ctrl/Cmd+Enter commits canonical JSON to the player; a parse error changes nothing.
  await payload(page).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(
    '{"id":"layout-page","children":[{"id":"blocks-text","props":{"block":{"type":"heading","level":2,"text":"Keyboard report"}}}]}'
  );
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('[data-tx-player-surface]')).toContainText('Keyboard report');
  expect(await payload(page).inputValue()).toBe(
    JSON.stringify(
      {
        children: [
          {
            id: 'blocks-text',
            props: { block: { level: 2, text: 'Keyboard report', type: 'heading' } },
          },
        ],
        id: 'layout-page',
      },
      null,
      2
    )
  );
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('{ invalid');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(page.locator('[data-tx-builder]')).toContainText('JSON parse failed');
  await expect(page.locator('[data-tx-player-surface]')).toContainText('Keyboard report');

  // Outline: Alt+Arrow moves through edit ops, announced; refused moves explain themselves.
  await visit(page);
  await loadDraft(page);
  await row(page, '0.0').click();
  await page.keyboard.press('Alt+ArrowDown');
  await expect(row(page, '0.1')).toBeFocused();
  await expect(outlineStatus(page)).toHaveText(
    'Moved Text blocks into Card layout, position 2 of 2.'
  );
  expect(await markdownOrder(page)).toEqual(['two', 'one', 'three']);
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(row(page, '1')).toBeFocused();
  expect(await childCounts(page)).toEqual([1, 0, 0]);
  await row(page, '0.0').click();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(outlineStatus(page)).toContainText('Already first in its group.');

  // History: the shortcuts undo and redo with announcements and restore the selection.
  await visit(page);
  await loadDraft(page);
  const status = page.locator('.builder__status');
  await row(page, '0.1').click();
  await page.keyboard.press('Delete');
  await expect(outlineStatus(page)).toContainText('Removed');
  await expect(row(page, '0')).toBeFocused();
  await expect(undoButton(page)).toHaveAttribute('title', 'Undo: Remove Text blocks');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(status).toHaveText('Undid: Remove Text blocks.');
  await expect(row(page, '0.1')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(status).toHaveText('Redid: Remove Text blocks.');
  await expect(row(page, '0.1')).toHaveCount(0);

  // Right to left: the tree's horizontal arrows swap.
  await visit(page);
  await loadDraft(page);
  await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
  await row(page, '0').click();
  await page.keyboard.press('ArrowLeft');
  await expect(row(page, '0.0')).toBeFocused();
  await page.keyboard.press('Alt+ArrowRight');
  await expect(row(page, '1')).toBeFocused();
  expect(await childCounts(page)).toEqual([1, 0, 0]);

  // Tab walks the panes in order, with no trap and no dead stop; F6 cycles them.
  await visit(page);
  await loadDraft(page);
  await row(page, '0').click();
  const region = () =>
    page.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return 'body';
      const pane = element.closest(
        '.builder__toolbar, [data-tx-palette], [data-builder-preview], .builder__outline, .builder__inspector, [data-builder-payload]'
      );
      if (!pane) return 'outside';
      if (pane.matches('.builder__toolbar')) return 'toolbar';
      if (pane.matches('[data-tx-palette]')) return 'palette';
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
      if (where === 'body') throw new Error(`${key} dropped focus after ${seen.join(' > ')}`);
      if (seen[seen.length - 1] !== where) seen.push(where);
      if (where === 'outside') return seen;
    }
    throw new Error(`${key} never left the builder (a trap): ${seen.join(' > ')}`);
  };
  await undoButton(page).focus();
  expect(await walk('Tab')).toEqual([
    'toolbar',
    'palette',
    'outline',
    'preview',
    'inspector',
    'payload',
    'outside',
  ]);
  await payload(page).focus();
  expect(await walk('Shift+Tab')).toEqual([
    'payload',
    'inspector',
    'preview',
    'outline',
    'palette',
    'toolbar',
    'outside',
  ]);
  const pane = () =>
    page.evaluate(() => {
      const marked = document.activeElement?.closest('[data-builder-pane]');
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
  const title = page.locator('.builder__inspector input').first();
  await title.focus();
  await page.keyboard.press('F6');
  expect(await pane()).toBe('payload');
  await page.keyboard.press('Shift+F6');
  await expect(title).toBeFocused();

  // List items move with Alt+Arrow, focus follows the item, and it is announced.
  await visit(page);
  await commitDraft(page, {
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
  });
  await row(page, '0').click();
  await page.getByRole('textbox', { name: 'Item 3' }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect
    .poll(async () =>
      ((await propsOf(page, 0)).block as { items: { text: string }[] }).items.map((i) => i.text)
    )
    .toEqual(['Harbor', 'Ledger', 'Pier']);
  await expect(page.getByRole('textbox', { name: 'Item 2' })).toBeFocused();
  await expect(page.locator('.builder__inspector [data-list-status]')).toHaveText(
    'Item moved to position 2 of 3.'
  );
});

test('inspector and payload: structured edits, refused values and issues, axe clean', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // A text block is edited through the rich text editor and stored as Markdown.
  await visit(page);
  await loadDraft(page);
  await row(page, '0.0').click();
  const editor = page.locator('[data-tx-text-editor]');
  const body = editor.getByRole('textbox', { name: /^Text/ });
  await expect(body).toHaveAttribute('contenteditable', 'true');
  await body.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('Fictional ');
  const firstStep = await undoButton(page).getAttribute('title');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type('launch');
  await page.keyboard.press('ControlOrMeta+b');
  await page.keyboard.type(' notes.');
  await expect(page.locator('[data-tx-player-surface]')).toContainText('launch notes');
  expect((await draft(page)).children?.[0]?.children?.[0]?.props?.block).toEqual({
    type: 'text',
    markdown: 'Fictional **launch** notes.',
  });
  // Text edits coalesce into one labeled builder step; Undo takes it back.
  await expect(undoButton(page)).toHaveAttribute('title', firstStep ?? '');
  await undoButton(page).click();
  await expect(body).toHaveText('one');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(editor.locator('strong')).toHaveText('launch');
  // A refused link is explained in the source and shown as text in the editor.
  const sourceToggle = editor.getByRole('button', { name: 'Markdown source' });
  await sourceToggle.click();
  await editor
    .getByRole('textbox', { name: /^Text/ })
    .fill('Read [this](javascript:alert(1)) first.');
  await expect(editor.locator('[data-link-kept="false"]')).toContainText(
    'refused by the URL policy'
  );
  await sourceToggle.click();
  await expect(body).toHaveText('Read this first.');
  await expect(body.getByRole('link')).toHaveCount(0);
  expect(await axe(page), 'text editor').toEqual([]);

  // Payload: refused text names its line, changes nothing, and moves the caret there.
  await visit(page);
  await loadDraft(page);
  const good = await payload(page).inputValue();
  const edited = good
    .replace('"Fictional outline"', '"Renamed outline"')
    .replace('"title": "Alpha"', '"title": "Alpha",\n          "colour": "red"');
  await payload(page).fill(edited);
  await page.getByRole('button', { name: 'Commit JSON' }).click();
  const line = edited.split('\n').findIndex((text) => text.includes('"colour"')) + 1;
  const issue = page.getByRole('list', { name: 'Commit issues' }).getByRole('button');
  await expect(issue).toHaveText(
    new RegExp(`^Line ${line}, column \\d+: "layout-card" has no "colour" prop\\.`)
  );
  await expect(page.locator('[data-tx-player-surface]')).not.toContainText('Renamed outline');
  await issue.click();
  await expect(payload(page)).toBeFocused();
  expect(
    await payload(page).evaluate(
      (element: HTMLTextAreaElement) =>
        element.value.slice(0, element.selectionStart).split('\n').length
    )
  ).toBe(line);
  // An outline edit never overwrites uncommitted JSON.
  await page.getByRole('button', { name: 'Reload draft' }).click();
  await payload(page).fill(good.replace('"Alpha"', '"Typed but not committed"'));
  await row(page, '1').click();
  await page.keyboard.press('Delete');
  await expect(payload(page)).toHaveValue(good.replace('"Alpha"', '"Typed but not committed"'));
  await expect(page.locator('[data-builder-payload]')).toContainText('Your text is kept');
  // Duplicate keys are reported without changing the preview.
  await payload(page).fill('{"id":"layout-page","props":{"title":"first","title":"second"}}');
  await page.getByRole('button', { name: 'Commit JSON' }).click();
  await expect(page.locator('[data-tx-builder]')).toContainText('Duplicate JSON keys');
  await expect(page.locator('[data-tx-player-surface]')).not.toContainText('second');

  // Player diagnostics reach the issues area and select their node.
  await visit(page);
  const issues = page.getByRole('region', { name: 'Draft issues' });
  await commitDraft(page, {
    id: 'layout-page',
    props: { title: 'Fictional issues' },
    children: [textNode('still paints'), { id: 'blocks-text', props: {} }],
  });
  await expect(issues).toContainText('Required prop "block" is missing.');
  await expect(page.locator('[data-tx-player-surface]')).toContainText('still paints');
  await issues.getByRole('button', { name: 'Select Text blocks' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(row(page, '1')).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, '1')).toBeFocused();

  // Closed choices, numbers, chart structures and media verdicts in one draft.
  await visit(page);
  await commitDraft(page, {
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
      { id: 'charts-gauge', props: { label: 'Uptime', value: '12', size: -5 } },
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
      {
        id: 'media-image',
        props: { src: 'http://images.example.com/cat.png', alt: '', href: 'javascript:alert(1)' },
      },
    ],
  });
  await row(page, '').click();
  const toc = page.locator('[data-tx-choice="toc"]');
  await expect(toc).toHaveAttribute('data-state', 'invalid');
  await expect(toc).toContainText('will be refused at paint');
  await toc.getByRole('button', { name: 'Clear invalid toc' }).click();
  expect('toc' in ((await draft(page)).props ?? {})).toBe(false);

  await row(page, '0').click();
  const mode = page.locator('[data-tx-choice="mode"]');
  await expect(mode.getByRole('radio', { checked: true })).toHaveCount(0);
  await mode.getByRole('radio', { name: 'dark' }).check();
  expect((await propsOf(page, 0)).mode).toBe('dark');

  await row(page, '1').click();
  const value = page.locator('[data-tx-number="value"]');
  await expect(value).toHaveAttribute('data-state', 'invalid');
  await value.getByRole('spinbutton').fill('42');
  expect((await propsOf(page, 1)).value).toBe(42);
  await expect(page.locator('[data-tx-number="size"]')).toContainText(
    'Outside the documented range (greater than 0)'
  );
  const thickness = page.locator('[data-tx-number="thickness"]');
  await thickness.getByRole('spinbutton').fill('1e400');
  await thickness.getByRole('spinbutton').press('Tab');
  await expect(thickness).toContainText('Enter a finite number.');
  expect('thickness' in (await propsOf(page, 1))).toBe(false);

  await row(page, '2').click();
  const data = page.locator('[data-tx-struct="data"]');
  await expect(data.locator('textarea')).toHaveCount(0);
  await expect(data.locator('[data-struct-path="1.id"]')).toContainText(
    'Duplicate id (also item 1).'
  );
  await data.getByRole('button', { name: 'Remove unknown key color' }).click();
  await data.locator('[data-struct-path="1.id"]').getByRole('textbox').fill('b');
  await data.locator('[data-struct-path="1.label"]').getByRole('textbox').fill('Beta');
  await data.locator('[data-struct-path="1.value"]').getByRole('spinbutton').fill('5');
  await expect(data.locator('[data-verdict]')).toHaveCount(0);
  expect((await propsOf(page, 2)).data).toEqual([
    { id: 'a', label: 'Alpha', value: 3 },
    { id: 'b', label: 'Beta', value: 5 },
  ]);

  await row(page, '3').click();
  const src = page.locator('[data-tx-media-url="src"]');
  await expect(src).toHaveAttribute('data-state', 'blocked');
  await expect(src).toContainText('Blocked by the URL policy (untrusted tier)');
  await src.getByRole('textbox', { name: 'src' }).fill('https://images.example.com/cat.png');
  await expect(src).toHaveAttribute('data-state', 'painted');
  await expect(page.locator('[data-tx-media-url="href"]')).toContainText(
    'Script URLs are blocked at every tier.'
  );
  await expect(page.locator('[data-tx-media-alt]')).toHaveAttribute('data-state', 'replaced');
  expect(await axe(page), 'media inspector').toEqual([]);
});

test('pointer, preview and share: drags, starters, widths, modes and links', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  // Dragging a row into a card uses the move op; Escape cancels a drag.
  await visit(page);
  await loadDraft(page);
  const card = row(page, '0');
  const box = await card.boundingBox();
  if (!box) throw new Error('card row has no box');
  await row(page, '1').dragTo(card, { targetPosition: { x: box.width / 2, y: box.height / 2 } });
  await expect(outlineStatus(page)).toHaveText(
    'Moved Text blocks into Card layout, position 3 of 3.'
  );
  expect(await childCounts(page)).toEqual([3]);
  await visit(page);
  await loadDraft(page);
  const third = row(page, '1');
  await third.scrollIntoViewIfNeeded();
  const start = await third.boundingBox();
  if (!start) throw new Error('row has no box');
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 12);
  await expect(third).toHaveClass(/outline__item--dragging/);
  await page.keyboard.press('Escape');
  await expect(third).not.toHaveClass(/outline__item--dragging/);
  await expect(outlineStatus(page)).toHaveText('Move cancelled.');
  await page.mouse.up();
  expect(await markdownOrder(page)).toEqual(['one', 'two', 'three']);
  // A refused drop is shown and changes nothing.
  const before = await draft(page);
  await mouseDrag(page, row(page, '0'), row(page, '0.1'));
  await expect(outlineStatus(page)).toHaveText('A component cannot move into itself.');
  expect(await draft(page)).toEqual(before);
  // Duplicate, copy and paste through the buttons and keys.
  await row(page, '1').click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  expect(await markdownOrder(page)).toEqual(['one', 'two', 'three', 'three']);
  await row(page, '0.0').click();
  await page.keyboard.press('Control+c');
  await expect(outlineStatus(page)).toContainText('Copied Text blocks.');
  await row(page, '0').click();
  await page.keyboard.press('Control+v');
  expect(await childCounts(page)).toEqual([3, 0, 0]);

  // A multi-selection drags into a card together, as one undoable step.
  await visit(page);
  await commitDraft(page, {
    id: 'layout-page',
    props: { title: 'Fictional pier notes' },
    children: [
      { id: 'layout-card', props: { title: 'Box' }, children: [] },
      textNode('alpha'),
      textNode('bravo'),
    ],
  });
  await row(page, '1').click();
  await row(page, '2').click({ modifiers: ['ControlOrMeta'] });
  await expect(page.locator('[role="treeitem"][aria-selected="true"]')).toHaveCount(2);
  await mouseDrag(page, row(page, '1'), row(page, '0'));
  await expect(outlineStatus(page)).toHaveText('Moved 2 components.');
  expect(await childCounts(page)).toEqual([2]);
  await expect(undoButton(page)).toHaveAttribute('title', 'Undo: Move Text blocks and 1 more');

  // Starters replace the draft as one undoable step; edits update the mounted player in place.
  await visit(page);
  await page.locator('[data-builder-starter="dashboard"]').click();
  await expect(page.locator('[data-builder-preview-stage]')).toContainText('Fleet operations');
  await expect(undoButton(page)).toHaveAttribute('title', 'Undo: Start from Operations dashboard');
  const player = page.locator('[data-builder-preview] [data-tx-player]');
  await player.evaluate((element) => element.setAttribute('data-test-mounted', 'first'));
  await undoButton(page).click();
  await expect(page.getByRole('treeitem')).toHaveCount(1);
  await expect(player).toHaveAttribute('data-test-mounted', 'first');

  // Preview width is a real container width, never a zoom; the color mode is scoped.
  await page.locator('[data-builder-starter="report"]').click();
  const stage = page.locator('[data-builder-preview-stage]');
  await expect(stage).toContainText('Lighthouse weekly report');
  const widths = page.getByLabel('Preview width');
  await widths.getByText('Mobile', { exact: true }).click();
  await expect(stage).toHaveAttribute('data-width', 'mobile');
  expect(Math.round((await stage.boundingBox())?.width ?? 0)).toBe(390);
  expect(await stage.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await widths.getByText('Tablet', { exact: true }).click();
  expect(Math.round((await stage.boundingBox())?.width ?? 0)).toBe(768);
  const background = () => stage.evaluate((element) => getComputedStyle(element).backgroundColor);
  const light = await background();
  await page.getByLabel('Preview color mode').getByText('Dark', { exact: true }).click();
  await expect(stage).toHaveAttribute('data-tx-mode', 'dark');
  await expect.poll(background).not.toBe(light);
  await expect(page.locator('html')).toHaveAttribute('data-tx-mode', 'light');

  // Share: the link restores the exact draft and view in a new page, with no network.
  await widths.getByText('Mobile', { exact: true }).click();
  await page.getByRole('button', { name: 'Share link' }).click();
  const url = await page.locator('[data-builder-share-url]').inputValue();
  expect(new URL(url).hash).toMatch(/^#draft=1\.[A-Za-z0-9_-]+$/);
  const original = await draft(page);
  const second = await page.context().newPage();
  await visit(second, new URL(url).hash);
  await expect(second.locator('.builder__status')).toContainText('Opened the shared draft');
  expect(await draft(second)).toEqual(original);
  await expect(second.locator('[data-builder-preview-stage]')).toHaveAttribute(
    'data-width',
    'mobile'
  );
  await expect(second.locator('[data-builder-preview-stage]')).toHaveAttribute(
    'data-tx-mode',
    'dark'
  );
  await second.close();
  // A damaged link opens the empty draft and says why.
  await visit(page, '#draft=1.AAAA');
  await page.reload();
  await expect(page.locator('.builder__status')).toContainText('could not be opened');
  await expect(page.getByRole('treeitem')).toHaveCount(1);

  // Touch: a drag from the grip handle moves the row.
  const touch = await browser.newContext({ hasTouch: true });
  const phone = await touch.newPage();
  await visit(phone);
  await loadDraft(phone);
  const handle = phone.locator('[data-outline-row="1"] .outline__handle');
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await row(phone, '0').boundingBox();
  if (!from || !to) throw new Error('drag ends have no box');
  const send = (type: string, x: number, y: number) =>
    handle.dispatchEvent(type, {
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      clientX: x,
      clientY: y,
      bubbles: true,
    });
  await send('pointerdown', from.x + from.width / 2, from.y + from.height / 2);
  await send('pointermove', from.x + from.width / 2, from.y + from.height / 2 + 10);
  await send('pointermove', to.x + to.width / 2, to.y + to.height / 2);
  await send('pointerup', to.x + to.width / 2, to.y + to.height / 2);
  await expect(outlineStatus(phone)).toHaveText(
    'Moved Text blocks into Card layout, position 3 of 3.'
  );
  await touch.close();
});
