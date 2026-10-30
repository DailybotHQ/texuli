import { expect, type Locator, type Page, test } from '@playwright/test';
import { axeViolations, polishProblems, serveDist, settle } from './support/site.ts';

/*
 * texuli.com /documents-page/ (PLAN_010 T-site-070), on the built site:
 *
 * 1. the workbench: the editor loads after hydration, a slash insert, a
 *    keyboard move, a column resize, a live chart embed, nested pages and
 *    the breadcrumb, the reader, the paged view with page numbers, and
 *    Markdown, DOCX and PDF downloads (Blobs); axe in light, dark and
 *    forced colors; nothing leaves the origin;
 * 2. collaboration: Ada's and Lin's editors converge, a comment reaches
 *    the other side, a suggestion is accepted, a version is restored;
 * 3. documents as agent data: the player paints the document blueprint,
 *    the bounded patch applies and undoes, the hostile patch is refused;
 * 4. at 360 px nothing overflows, nothing still says it is loading, and
 *    the view switch works from the keyboard.
 *
 * Copy, data, the patch and the exports are unit-tested in
 * apps/website/tests/site-documents.test.ts.
 */

const origin = serveDist();

/** Emulates a color scheme and waits until the switch has started and finished its transitions. */
async function useScheme(
  page: Page,
  colorScheme: 'light' | 'dark',
  forcedColors: 'active' | 'none' = 'none'
): Promise<void> {
  await page.emulateMedia({ colorScheme, forcedColors });
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
  await page.waitForFunction(
    () => document.getAnimations().every((animation) => animation.playState !== 'running'),
    undefined,
    { polling: 100, timeout: 10_000 }
  );
}

function watchForeign(page: Page): string[] {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin()) && !url.startsWith('data:') && !url.startsWith('blob:'))
      foreign.push(url);
  });
  return foreign;
}

/** Waits until the island that holds `selector` has hydrated (Astro drops `ssr`). */
async function hydrated(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect(page.locator(`astro-island:not([ssr]) ${selector}`).first()).toBeVisible({
    timeout: 20_000,
  });
}

const workbench = (page: Page) => page.locator('[data-documents-workbench]');
const row = (scope: Locator, id: string) => scope.locator(`[data-sortable-item="${id}"]`);
const textbox = (scope: Locator, id: string) => row(scope, id).locator('[role="textbox"]').first();

/** Top-level block ids of the editor, in order. */
const order = (page: Page) =>
  workbench(page)
    .locator('[data-sortable-item]')
    .evaluateAll((items) => items.map((item) => item.getAttribute('data-sortable-item')));

/**
 * Put the caret (or a selection) at UTF-16 offsets of a block's text: `leaf`
 * is the text block inside the row (a list row holds one per item); Home and
 * End differ by platform.
 */
async function place(
  scope: Locator,
  id: string,
  from: number,
  to = from,
  leaf = id
): Promise<void> {
  await textbox(scope, id).click();
  await textbox(scope, id).evaluate(
    (element, [start, end, leafId]) => {
      const host =
        element.querySelector(`[data-tx-block="${CSS.escape(leafId as string)}"]`) ?? element;
      const point = (offset: number): [Node, number] => {
        const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        let count = 0;
        for (
          let node = walker.nextNode() as Text | null;
          node;
          node = walker.nextNode() as Text | null
        ) {
          if (offset <= count + node.data.length) return [node, offset - count];
          count += node.data.length;
        }
        return [host, host.childNodes.length];
      };
      const [anchor, anchorOffset] = point(start as number);
      const [focus, focusOffset] = point(end as number);
      document.getSelection()?.setBaseAndExtent(anchor, anchorOffset, focus, focusOffset);
    },
    [from, to, leaf] as const
  );
}

async function caretAtEnd(scope: Locator, id: string, leaf = id): Promise<void> {
  const length = await textbox(scope, id).evaluate(
    (element, leafId) =>
      (element.querySelector(`[data-tx-block="${CSS.escape(leafId)}"]`) ?? element).textContent
        ?.length ?? 0,
    leaf
  );
  await place(scope, id, length, length, leaf);
}

test('the workbench edits, reads, paginates and exports one document', async ({ page }) => {
  test.setTimeout(180_000);
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/documents-page/`);
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Documents people edit and agents write'
  );
  await expect(
    page.getByText('@texuli/pages · @texuli/document · in development · on npm from 0.7.0')
  ).toBeVisible();

  await hydrated(page, '[data-documents-workbench]');
  const editor = page.getByRole('region', { name: 'Harbor team handbook (editor)' });
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await expect(workbench(page).locator('[data-documents-loading]')).toHaveCount(0);

  // The live embed: a catalog chart painted by the player inside the page.
  await expect(row(editor, 'chart').locator('figure').first()).toBeVisible({ timeout: 30_000 });

  // Slash menu: a new paragraph after the intro, "/", filter, Enter.
  const before = (await order(page)).length;
  await caretAtEnd(editor, 'intro');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  const combobox = page.getByRole('combobox', { name: 'Insert block' });
  await expect(combobox).toBeFocused();
  await page.keyboard.type('quo');
  await expect(page.getByRole('listbox').getByRole('option').first()).toContainText('Quote');
  await page.keyboard.press('Enter');
  await expect(combobox).toHaveCount(0);
  await expect.poll(async () => (await order(page)).length).toBeGreaterThan(before);
  await page.keyboard.type('Quoted from the menu');
  await expect(editor).toContainText('Quoted from the menu');

  // Keyboard move: Alt+Down moves the intro below the next block, announced.
  const start = await order(page);
  const at = start.indexOf('intro');
  await caretAtEnd(editor, 'intro');
  await page.keyboard.press('Alt+ArrowDown');
  await expect.poll(async () => (await order(page)).indexOf('intro')).toBe(at + 1);
  await expect(textbox(editor, 'intro')).toBeFocused();

  // Columns: the window splitter resizes by one twelfth from the keyboard.
  const splitter = editor.getByRole('separator').first();
  const width = await splitter.getAttribute('aria-valuenow');
  await splitter.focus();
  await page.keyboard.press('ArrowRight');
  await expect(splitter).not.toHaveAttribute('aria-valuenow', width ?? '');

  // Nested pages: open Onboarding, then come back through the breadcrumb.
  await row(editor, 'link-onboarding')
    .getByRole('button', { name: 'Open page Onboarding' })
    .click();
  await expect(page.locator('[data-documents-page="pages/onboarding"]')).toBeVisible();
  const nested = page.getByRole('region', { name: 'Onboarding (editor)' });
  await expect(nested).toBeVisible({ timeout: 20_000 });
  await nested
    .getByRole('navigation', { name: /Breadcrumb/i })
    .getByRole('button', { name: 'Harbor team handbook' })
    .click();
  await expect(page.locator('[data-documents-page="pages/handbook"]')).toBeVisible();
  // The edits survive the round trip.
  await expect(page.getByRole('region', { name: 'Harbor team handbook (editor)' })).toContainText(
    'Quoted from the menu'
  );

  // Reader and pages.
  await page.getByRole('radio', { name: 'Read' }).check();
  const reader = workbench(page).getByRole('article', { name: 'Harbor team handbook' });
  await expect(reader).toBeVisible({ timeout: 20_000 });
  await expect(reader).toContainText('Quoted from the menu');
  await page.getByRole('radio', { name: 'Pages' }).check();
  await expect(page.locator('[data-documents-page-count]')).toHaveText(/^\d+ pages, A4 portrait/, {
    timeout: 30_000,
  });
  const pages = workbench(page).getByRole('group', { name: /^Page 1 of \d+$/ });
  await expect(pages).toBeVisible();
  await expect(workbench(page).locator('.tx-pages-paged__band').first()).toBeAttached();

  // Export: three real downloads from Blobs, no navigation.
  for (const [format, extension] of [
    ['Markdown', '.md'],
    ['DOCX', '.docx'],
    ['PDF', '.pdf'],
  ] as const) {
    const download = page.waitForEvent('download');
    await page
      .getByRole('group', { name: 'Export this page' })
      .getByRole('button', { name: format, exact: true })
      .click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(new RegExp(`\\${extension}$`));
    await expect(page.locator('[data-documents-export-status]')).toHaveText(
      new RegExp(`^Saved .+\\${extension} \\(`),
      { timeout: 30_000 }
    );
  }
  expect(page.url()).toBe(`${origin()}/documents-page/`);

  for (const view of ['Edit', 'Pages'] as const) {
    await page.getByRole('radio', { name: view }).check();
    for (const scheme of ['light', 'dark'] as const) {
      await useScheme(page, scheme);
      expect(await axeViolations(page), `${view} ${scheme}`).toEqual([]);
    }
    await useScheme(page, 'light', 'active');
    expect(await axeViolations(page), `${view} forced colors`).toEqual([]);
    await page.emulateMedia({ forcedColors: 'none' });
  }
  expect(foreign).toEqual([]);
});

test('two editors converge: comments, suggestions and versions reach the other side', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/documents-page/#collab`);
  await settle(page);
  await hydrated(page, '[data-documents-collab]');
  const ada = page.locator('[data-documents-pane="ada"]');
  const lin = page.locator('[data-documents-pane="lin"]');
  await expect(textbox(ada, 'rn-search')).toBeVisible({ timeout: 30_000 });
  await expect(textbox(lin, 'rn-search')).toBeVisible();

  // Typing converges.
  await caretAtEnd(ada, 'rn-search');
  await page.keyboard.type(' Ada was here.');
  await expect(row(lin, 'rn-search')).toContainText('Ada was here.');

  // A comment on a selection reaches Lin's feed.
  await place(ada, 'rn-intro', 4, 22);
  await ada.getByRole('button', { name: 'Comment', exact: true }).click();
  const composer = ada.getByLabel(/^Comment on “/);
  await expect(composer).toBeFocused();
  await composer.fill('Name the release here.');
  await ada.locator('.tx-pages-collab__composer button[type="submit"]').click();
  const thread = lin.locator('.tx-pages-collab__thread').first();
  await expect(thread).toContainText('Name the release here.');
  await expect(thread).toContainText('Ada on “');

  // Lin suggests; Ada accepts.
  const suggesting = lin.getByRole('button', { name: 'Suggesting' });
  await suggesting.click();
  await expect(suggesting).toHaveAttribute('aria-pressed', 'true');
  await caretAtEnd(lin, 'rn-list', 'rn-1-text');
  await page.keyboard.type(' and sorting');
  const suggestion = ada.locator('[data-suggestion]').first();
  await expect(suggestion).toContainText('Suggestion by Lin');
  await expect(suggestion).toContainText('Insert “ and sorting”');
  await suggestion.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(ada.locator('[data-suggestion]')).toHaveCount(0);
  await expect(row(lin, 'rn-list')).toContainText('Filters remember your last choice and sorting');
  await suggesting.click();

  // A named version, an edit, and a restore that reaches both editors.
  const history = ada.getByRole('button', { name: 'Version history' });
  await history.click();
  await expect(history).toHaveAttribute('aria-expanded', 'true');
  await ada.getByLabel('Version name').fill('Reviewed');
  await ada.getByRole('button', { name: 'Save version' }).click();
  await caretAtEnd(lin, 'rn-search');
  await page.keyboard.type(' Late edit.');
  await expect(row(ada, 'rn-search')).toContainText('Late edit.');
  await ada.getByRole('button', { name: 'Restore “Reviewed”' }).click();
  await expect(row(lin, 'rn-search')).not.toContainText('Late edit.');
  await expect(row(lin, 'rn-search')).toContainText('Ada was here.');

  for (const scheme of ['light', 'dark'] as const) {
    await useScheme(page, scheme);
    expect(await axeViolations(page), scheme).toEqual([]);
  }
  await useScheme(page, 'light', 'active');
  expect(await axeViolations(page), 'forced colors').toEqual([]);

  // Start over: two fresh replicas on the original draft.
  await page.emulateMedia({ forcedColors: 'none' });
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(row(page.locator('[data-documents-pane="lin"]'), 'rn-search')).not.toContainText(
    'Ada was here.'
  );
  expect(foreign).toEqual([]);
});

test('the player paints the agent document, applies the bounded patch and refuses the hostile one', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const foreign = watchForeign(page);
  await page.goto(`${origin()}/documents-page/#agents`);
  await settle(page);
  await hydrated(page, '[data-documents-agent]');
  const stage = page.locator('[data-documents-agent-stage]');
  await expect(stage.getByRole('article', { name: 'Launch brief' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(stage.locator('[data-tx-player-trust="untrusted"]')).toHaveText('Untrusted content');
  await expect(stage.getByText('Invite 40 pilot teams')).toBeVisible();

  await page.getByRole('button', { name: 'Apply the patch' }).click();
  await expect(page.locator('[data-documents-agent-status]')).toContainText('Patched');
  await expect(stage.getByRole('article', { name: 'Launch brief, revised' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(stage.getByText('Publish the pilot report')).toBeVisible();

  await page.getByRole('button', { name: 'Send a hostile patch' }).click();
  await expect(page.locator('[data-documents-agent-refused]')).toContainText(
    'Refused (invalid-value)'
  );
  await expect(stage.getByRole('article', { name: 'Launch brief, revised' })).toBeVisible();

  await page.getByRole('button', { name: 'Undo the patch' }).click();
  await expect(page.locator('[data-documents-agent-status]')).toContainText('Undone');
  await expect(stage.getByRole('article', { name: 'Launch brief' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(stage.getByText('Publish the pilot report')).toHaveCount(0);

  expect(await axeViolations(page)).toEqual([]);
  expect(foreign).toEqual([]);
});

test('at 360 px nothing overflows, nothing still loads, and the views switch from the keyboard', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(`${origin()}/documents-page/`);
  await settle(page);
  for (const selector of [
    '[data-documents-workbench]',
    '[data-documents-collab]',
    '[data-documents-agent]',
  ]) {
    await hydrated(page, selector);
  }
  await expect(page.locator('[data-documents-loading]')).toHaveCount(0, { timeout: 30_000 });
  await expect(
    page.locator('[data-documents-agent-stage]').getByRole('article', { name: 'Launch brief' })
  ).toBeVisible({ timeout: 30_000 });
  expect(await polishProblems(page)).toEqual([]);

  const edit = page.getByRole('radio', { name: 'Edit' });
  await edit.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Read' })).toBeChecked();
  await expect(workbench(page).getByRole('article', { name: 'Harbor team handbook' })).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Pages' })).toBeChecked();
  await expect(page.locator('[data-documents-page-count]')).toHaveText(/^\d+ pages/, {
    timeout: 30_000,
  });
  expect(await polishProblems(page)).toEqual([]);
});

test('the vocabulary: every block type, every slash item and every embed kind, read from the packages', async ({
  page,
}) => {
  await page.goto(`${origin()}/documents-page/#blocks`);
  await settle(page);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Every block, every slash item, every embed' })
  ).toBeVisible();
  await expect(page.locator('[data-documents-block-types] tbody tr')).toHaveCount(13);
  await expect(page.locator('[data-documents-block-type="columns"]')).toContainText('Columns 2');
  await expect(page.locator('[data-documents-block-type="block"]')).toContainText(
    /\d{2}: Heading, Paragraph/
  );
  const slashItems = page.locator('[data-documents-slash] li li');
  expect(await slashItems.count()).toBeGreaterThan(40);
  await expect(page.locator('[data-documents-embeds] tbody tr')).toHaveCount(4);
  await expect(page.locator('[data-documents-embed="canvas"]')).toContainText('planned');
  await expect(page.getByRole('link', { name: 'Canvas', exact: true }).last()).toHaveAttribute(
    'href',
    '/canvas-page/'
  );
  expect(await axeViolations(page)).toEqual([]);
});
