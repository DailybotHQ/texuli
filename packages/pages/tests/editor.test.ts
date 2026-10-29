import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { detectPlatform } from '@texuli/core/keyboard';
import type { DocumentBlock, TexuliDocument } from '@texuli/document/model';
import type { OpLogEntry } from '@texuli/document/ops';
import { pointToDom } from '@texuli/editor/editor';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PageEditor from '../src/editor/PageEditor.svelte';
import { DEFAULT_COMPONENT_EMBEDS } from '../src/editor/slash.ts';
import type { PagesEditor } from '../src/editor/state.svelte.ts';
import { doc, para, samplePage, text } from './fixtures.ts';

/*
 * PageEditor in happy-dom: typing through @texuli/editor, the slash menu
 * (APG combobox), keyboard reorder (Alt+arrows and the sortable handle),
 * nested pages, columns, embeds (painted vs refused) and undo/redo, every
 * change through the document op log.
 */

const MOD = detectPlatform(navigator) === 'mac' ? { metaKey: true } : { ctrlKey: true };

function mount(document: TexuliDocument, props: Record<string, unknown> = {}) {
  const onChange = vi.fn<(doc: TexuliDocument, entry: OpLogEntry) => void>();
  const announce = vi.fn<(message: string) => void>();
  let editor: PagesEditor | undefined;
  const view = render(PageEditor, {
    props: {
      document,
      onChange,
      announce,
      motion: false,
      get editor() {
        return editor;
      },
      set editor(value: PagesEditor | undefined) {
        editor = value;
      },
      ...props,
    },
  });
  const state = () => editor as PagesEditor;
  const ids = () => state().doc.blocks.map((block) => block.id);
  return { view, onChange, announce, state, ids };
}

const row = (id: string) => document.querySelector(`[data-sortable-item="${id}"]`) as HTMLElement;
const surfaceOf = (id: string) => row(id).querySelector('[role="textbox"]') as HTMLElement;
const handleOf = (id: string) => row(id).querySelector('.tx-pages-row__handle') as HTMLElement;

function placeCaret(id: string, offset: number) {
  const surface = surfaceOf(id);
  const block = surface.querySelector('[data-tx-block]') as Element;
  const point = pointToDom(block, offset);
  surface.focus();
  document.getSelection()?.setBaseAndExtent(point.node, point.offset, point.node, point.offset);
  document.dispatchEvent(new Event('selectionchange'));
}

async function type(id: string, data: string) {
  const event = new InputEvent('beforeinput', {
    inputType: 'insertText',
    data,
    cancelable: true,
    bubbles: true,
  });
  surfaceOf(id).dispatchEvent(event);
  await tick();
}

const plain = (block: DocumentBlock | undefined) =>
  block && 'content' in block
    ? block.content.map((part) => ('text' in part ? part.text : '\n')).join('')
    : '';

describe('PageEditor text', () => {
  it('types into a text row through @texuli/editor and records each edit in the op log', async () => {
    const { onChange, state } = mount(samplePage());
    placeCaret('p1', 5);
    await type('p1', ' ');
    await type('p1', 'big');
    expect(plain(state().locate('p1')?.node as DocumentBlock)).toBe('First big paragraph');
    const entry = onChange.mock.lastCall?.[1];
    expect(entry?.operations[0]).toMatchObject({ op: 'replace-text', id: 'p1' });
    expect(
      state()
        .log()
        .every((e) => e.origin === 'local')
    ).toBe(true);
  });

  it('splits a row on Enter into a new row that takes the caret', async () => {
    const { state, ids } = mount(doc([para('p1', 'Hello world')]));
    placeCaret('p1', 5);
    surfaceOf('p1').dispatchEvent(
      new InputEvent('beforeinput', {
        inputType: 'insertParagraph',
        cancelable: true,
        bubbles: true,
      })
    );
    await tick();
    await tick();
    expect(ids()).toHaveLength(2);
    const second = ids()[1] as string;
    expect(plain(state().doc.blocks[1])).toBe(' world');
    expect(document.activeElement).toBe(surfaceOf(second));
  });

  it('undoes and redoes with the keyboard and the buttons, through the op log', async () => {
    const { state } = mount(doc([para('p1', 'Hi')]));
    placeCaret('p1', 2);
    await type('p1', '!');
    expect(plain(state().doc.blocks[0])).toBe('Hi!');
    await fireEvent.keyDown(surfaceOf('p1'), { key: 'z', ...MOD });
    await tick();
    expect(plain(state().doc.blocks[0])).toBe('Hi');
    expect(surfaceOf('p1').textContent).toBe('Hi');
    await fireEvent.keyDown(surfaceOf('p1'), { key: 'z', shiftKey: true, ...MOD });
    await tick();
    expect(plain(state().doc.blocks[0])).toBe('Hi!');
    await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(plain(state().doc.blocks[0])).toBe('Hi');
    expect(
      state()
        .log()
        .map((e) => e.kind)
    ).toEqual(['edit', 'undo', 'redo', 'undo']);
  });
});

describe('PageEditor slash menu', () => {
  async function openMenu() {
    const view = mount(doc([para('p1', 'Intro'), para('p2')]), {
      createPage: () => ({ ref: 'pages/child', title: 'Child page' }),
    });
    placeCaret('p2', 0);
    await type('p2', '/');
    const input = await screen.findByRole('combobox', { name: 'Insert block' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    return { ...view, input: input as HTMLInputElement };
  }

  const options = () => screen.queryAllByRole('option').map((o) => o.textContent?.trim() ?? '');

  it('opens on / in an empty paragraph as a combobox with a listbox, filters as you type and inserts with Enter', async () => {
    const { input, state, view } = await openMenu();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const listbox = screen.getByRole('listbox');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    // The slash is not typed into the paragraph.
    expect(state().doc.blocks[1]).toMatchObject({ content: [] });
    await fireEvent.input(input, { target: { value: 'head' } });
    await tick();
    expect(options().slice(0, 3)).toEqual([
      expect.stringContaining('Heading 1'),
      expect.stringContaining('Heading 2'),
      expect.stringContaining('Heading 3'),
    ]);
    // The first match is active, so Enter takes it; ArrowDown moves on.
    const active = () => document.getElementById(input.getAttribute('aria-activedescendant') ?? '');
    await waitFor(() => expect(active()?.textContent).toContain('Heading 1'));
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(active()?.textContent).toContain('Heading 2');
    await fireEvent.keyDown(input, { key: 'Enter' });
    await tick();
    await tick();
    expect(state().doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'heading']);
    expect(state().doc.blocks[1]).toMatchObject({ level: 2 });
    expect(screen.queryByRole('combobox')).toBeNull();
    const heading = state().doc.blocks[1]?.id as string;
    await waitFor(() => expect(document.activeElement).toBe(surfaceOf(heading)));
    view.unmount();
  });

  it('closes on Escape or Backspace on an empty filter and returns to the text', async () => {
    const { input, state } = await openMenu();
    await fireEvent.keyDown(input, { key: 'Escape' });
    await tick();
    expect(screen.queryByRole('combobox')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(surfaceOf('p2')));
    await type('p2', '/');
    const again = await screen.findByRole('combobox');
    await fireEvent.keyDown(again, { key: 'Backspace' });
    await tick();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(state().doc.blocks).toHaveLength(2);
    expect(state().log()).toHaveLength(0);
  });

  it('types a slash in a paragraph that has text', async () => {
    const { state } = mount(doc([para('p1', 'a')]));
    placeCaret('p1', 1);
    await type('p1', '/');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(plain(state().doc.blocks[0])).toBe('a/');
  });

  it('inserts a nested page link from the host and every content block family once they load', async () => {
    const { input, state } = await openMenu();
    await fireEvent.input(input, { target: { value: 'page' } });
    await tick();
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(state().doc.blocks[1]).toMatchObject({ type: 'page-link', ref: 'pages/child' })
    );
  });

  it('lists content blocks of every family after they load', async () => {
    const { input } = await openMenu();
    await fireEvent.input(input, { target: { value: 'poll' } });
    await waitFor(() => expect(options().join(' ')).toContain('Poll'));
    await fireEvent.input(input, { target: { value: 'zzzz' } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('No block type'));
  });
});

describe('PageEditor reorder and selection', () => {
  it('moves the block with Alt+Arrow keys from the text and the handle, and announces it', async () => {
    const { ids, announce } = mount(samplePage());
    placeCaret('p1', 0);
    await fireEvent.keyDown(surfaceOf('p1'), { key: 'ArrowDown', altKey: true });
    await tick();
    expect(ids().slice(0, 3)).toEqual(['h1', 'p2', 'p1']);
    expect(announce).toHaveBeenCalledWith('Paragraph: First paragraph moved to position 3 of 7.');
    await waitFor(() => expect(document.activeElement).toBe(surfaceOf('p1')));
    handleOf('d1').focus();
    await fireEvent.keyDown(handleOf('d1'), { key: 'ArrowUp', altKey: true });
    await tick();
    expect(ids().at(-1)).toBe('pl1');
    await waitFor(() => expect(document.activeElement).toBe(handleOf('d1')));
  });

  it('picks a block up with Space, moves it with the arrows and drops it, or cancels with Escape', async () => {
    const { ids } = mount(samplePage());
    const handle = handleOf('d1');
    handle.focus();
    await fireEvent.keyDown(handle, { key: ' ' });
    await fireEvent.keyDown(handleOf('d1'), { key: 'ArrowUp' });
    await fireEvent.keyDown(handleOf('d1'), { key: 'Escape' });
    await tick();
    expect(ids().at(-1)).toBe('d1');
    handleOf('d1').focus();
    await fireEvent.keyDown(handleOf('d1'), { key: ' ' });
    await fireEvent.keyDown(handleOf('d1'), { key: 'ArrowUp' });
    await fireEvent.keyDown(handleOf('d1'), { key: ' ' });
    await tick();
    expect(ids().slice(-2)).toEqual(['d1', 'pl1']);
  });

  it('selects a block with Escape from its text, removes it with Delete and returns with Escape', async () => {
    const { ids, state } = mount(samplePage());
    placeCaret('p2', 0);
    await fireEvent.keyDown(surfaceOf('p2'), { key: 'Escape' });
    await tick();
    expect(document.activeElement).toBe(handleOf('p2'));
    expect(row('p2').hasAttribute('data-block-selected')).toBe(true);
    await fireEvent.keyDown(handleOf('p2'), { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(surfaceOf('p2')));
    await fireEvent.keyDown(surfaceOf('p2'), { key: 'Escape' });
    await fireEvent.keyDown(handleOf('p2'), { key: 'Delete' });
    await tick();
    expect(ids()).not.toContain('p2');
    expect(state().canUndo).toBe(true);
  });

  it('hands the caret to the next and previous row with the arrow keys at the edges', async () => {
    mount(samplePage());
    placeCaret('p1', 'First paragraph'.length);
    await fireEvent.keyDown(surfaceOf('p1'), { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement).toBe(surfaceOf('p2')));
    placeCaret('p2', 0);
    await fireEvent.keyDown(surfaceOf('p2'), { key: 'ArrowLeft' });
    await waitFor(() => expect(document.activeElement).toBe(surfaceOf('p1')));
  });
});

describe('PageEditor nesting, columns and embeds', () => {
  it('navigates nested pages through page links and the breadcrumb', async () => {
    const onNavigate = vi.fn();
    mount(samplePage(), {
      onNavigate,
      trail: [{ ref: 'pages/home', title: 'Home' }],
    });
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(crumbs.querySelector('[aria-current="page"]')?.textContent).toBe('Field notes');
    await fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onNavigate).toHaveBeenLastCalledWith('pages/home');
    await fireEvent.click(screen.getByRole('button', { name: 'Open page Roadmap' }));
    expect(onNavigate).toHaveBeenLastCalledWith('pages/roadmap');
  });

  it('renders container blocks as nested block lists and resizes columns by keyboard steps', async () => {
    const { state } = mount(samplePage());
    expect(row('co1').querySelector('[data-sortable-item="co1p"]')).not.toBeNull();
    const separator = screen.getByRole('separator', { name: 'Resize columns 1 and 2' });
    expect(separator.getAttribute('aria-valuenow')).toBe('6');
    await fireEvent.keyDown(separator, { key: 'ArrowRight' });
    await tick();
    expect(separator.getAttribute('aria-valuenow')).toBe('7');
    await fireEvent.keyDown(separator, { key: 'End' });
    await tick();
    expect(separator.getAttribute('aria-valuenow')).toBe('10');
    const columns = state().locate('cols')?.node as Extract<DocumentBlock, { type: 'columns' }>;
    expect(columns.columns.map((c) => c.width)).toEqual([10, 2]);
  });

  it('paints a valid component embed with the player and refuses one that fails validation', async () => {
    const donut =
      DEFAULT_COMPONENT_EMBEDS.find((option) => option.id === 'charts-donut')?.props ?? {};
    mount(
      doc([
        {
          id: 'ok',
          type: 'embed',
          kind: 'component',
          title: 'Tickets',
          inline: { id: 'charts-donut', props: donut },
        },
        {
          id: 'bad',
          type: 'embed',
          kind: 'component',
          title: 'Unknown',
          inline: { id: 'no-such-component', props: {} },
        },
        { id: 'byref', type: 'embed', kind: 'component', ref: 'embeds/kpi', title: 'By ref' },
        { id: 'sheet', type: 'embed', kind: 'sheet', ref: 'sheets/budget', title: 'Budget' },
      ]),
      {
        resolveEmbed: ({ ref }: { ref: string }) =>
          ref === 'embeds/kpi'
            ? { id: 'charts-donut', props: { ...donut, title: 'From the host' } }
            : null,
      }
    );
    const figure = (id: string) => row(id).querySelector('figure') as HTMLElement;
    await waitFor(() => expect(figure('ok').querySelector('[data-tx-player]')).not.toBeNull(), {
      timeout: 30_000,
    });
    await waitFor(() => expect(figure('ok').textContent).toContain('Tickets by channel'), {
      timeout: 30_000,
    });
    expect(figure('ok').dataset.state).toBe('painted');
    expect(figure('ok').textContent).toContain('Untrusted content');
    await waitFor(() => expect(figure('bad').dataset.state).toBe('refused'), { timeout: 30_000 });
    expect(figure('bad').textContent).toContain('This embed was refused');
    expect(figure('bad').querySelector('[data-tx-player-surface]')).toBeNull();
    await waitFor(() => expect(figure('byref').textContent).toContain('From the host'), {
      timeout: 30_000,
    });
    expect(figure('sheet').dataset.state).toBe('reference');
  }, 60_000);

  it('paints a wrapped @texuli/blocks block with its family renderer', async () => {
    mount(
      doc([
        {
          id: 'stat',
          type: 'block',
          family: 'data',
          block: 'stat',
          props: { items: [{ label: 'Uptime', value: '99.9%' }] },
        },
      ])
    );
    await waitFor(() => expect(row('stat').textContent).toContain('99.9%'), { timeout: 30_000 });
  }, 60_000);

  it('keeps the document free of HTML sinks: markup in text stays text', async () => {
    mount(doc([{ id: 'p', type: 'paragraph', content: text('<img src=x onerror=alert(1)>') }]));
    expect(surfaceOf('p').querySelector('img')).toBeNull();
    expect(surfaceOf('p').textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('loads a new document from outside and restarts history', async () => {
    const { view, state } = mount(doc([para('p1', 'One')]));
    placeCaret('p1', 3);
    await type('p1', '!');
    expect(state().canUndo).toBe(true);
    await view.rerender({ document: doc([para('q1', 'Two')]) });
    await tick();
    expect(state().doc.blocks[0]?.id).toBe('q1');
    expect(state().canUndo).toBe(false);
    expect(surfaceOf('q1').textContent).toBe('Two');
  });
});
