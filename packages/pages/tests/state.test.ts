import type { EditorBlock } from '@texuli/core/editor-model';
import type { DocumentBlock, TexuliDocument } from '@texuli/document/model';
import { applyOperations } from '@texuli/document/ops';
import { describe, expect, it, vi } from 'vitest';
import { columnWidths, pointerSteps, resizeColumns } from '../src/editor/columns.ts';
import {
  adjacentRow,
  blockContainers,
  moveTarget,
  ROOT_LIST,
  rowOrder,
} from '../src/editor/moves.ts';
import { coreSlashItems } from '../src/editor/slash.ts';
import { PagesEditor } from '../src/editor/state.svelte.ts';
import { isTextRow, textRowOperations } from '../src/editor/text.ts';
import { DEFAULT_PAGES_LABELS } from '../src/shared/labels.ts';
import { doc, para, samplePage, text } from './fixtures.ts';

function editor(document: TexuliDocument = samplePage()) {
  let clock = 0;
  const announce = vi.fn<(message: string) => void>();
  const onChange = vi.fn();
  const state = new PagesEditor({ document, announce, onChange, now: () => clock });
  return {
    state,
    announce,
    onChange,
    tick: (ms: number) => {
      clock += ms;
    },
    ids: (parent: DocumentBlock[] = state.doc.blocks) => parent.map((block) => block.id),
  };
}

const item = (value: string) => {
  const found = coreSlashItems(DEFAULT_PAGES_LABELS, { pages: true }).find(
    (i) => i.value === value
  );
  if (!found) throw new Error(value);
  return found;
};

describe('text rows map editor edits to document operations', () => {
  it('turns typing, a split and a conversion into operations by id that the engine applies', () => {
    const before = doc([para('p1', 'Hello'), para('p2', 'World')]);
    const typed = textRowOperations(null, 0, before.blocks[0] as DocumentBlock, [
      { id: 'p1', type: 'paragraph', content: text('Hello there') } as EditorBlock,
    ]);
    expect(typed).toEqual([
      { op: 'replace-text', id: 'p1', from: 0, to: 5, content: text('Hello there') },
    ]);
    // Enter in the middle: the row keeps its id and a new block follows it.
    const split = textRowOperations(null, 0, before.blocks[0] as DocumentBlock, [
      { id: 'p1', type: 'paragraph', content: text('Hel') } as EditorBlock,
      { id: 'n1', type: 'paragraph', content: text('lo') } as EditorBlock,
    ]);
    const applied = applyOperations(before, split);
    expect(applied.ok && applied.document.blocks.map((b) => b.id)).toEqual(['p1', 'n1', 'p2']);
    // "- " turns the paragraph into a list with a new id.
    const list = {
      id: 'l1',
      type: 'list',
      kind: 'bullet',
      items: [{ id: 'i1', blocks: [{ id: 'p1', type: 'paragraph', content: text('Hello') }] }],
    } as unknown as EditorBlock;
    const converted = applyOperations(
      before,
      textRowOperations(null, 0, before.blocks[0] as DocumentBlock, [list])
    );
    expect(converted.ok && converted.document.blocks.map((b) => b.type)).toEqual([
      'list',
      'paragraph',
    ]);
    // A heading level change is an attribute, not a new node.
    const heading = doc([{ id: 'h', type: 'heading', level: 1, content: text('Title') }]);
    expect(
      textRowOperations(null, 0, heading.blocks[0] as DocumentBlock, [
        { id: 'h', type: 'heading', level: 2, content: text('Title') } as EditorBlock,
      ])
    ).toEqual([{ op: 'set-attrs', id: 'h', attrs: { level: 2 } }]);
  });

  it('edits only blocks made of editor vocabulary as text rows', () => {
    expect(isTextRow(para('p'))).toBe(true);
    expect(
      isTextRow({
        id: 'q',
        type: 'quote',
        blocks: [{ id: 'c', type: 'callout', tone: 'info', blocks: [para('x')] }],
      })
    ).toBe(false);
    expect(isTextRow({ id: 'd', type: 'divider' })).toBe(false);
  });
});

describe('block operations through the op log', () => {
  it('inserts from the slash menu in place of an empty paragraph or after a block, with fresh ids', async () => {
    const { state, ids, announce } = editor(doc([para('p1', 'Hello'), para('p2')]));
    expect(await state.insertItem(item('heading-2'), { anchor: 'p2', replace: true })).toBe(true);
    expect(state.doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'heading']);
    expect(await state.insertItem(item('divider'), { anchor: 'p1', replace: false })).toBe(true);
    expect(state.doc.blocks.map((b) => b.type)).toEqual(['paragraph', 'divider', 'heading']);
    expect(new Set(ids()).size).toBe(3);
    expect(announce).toHaveBeenCalledWith('Divider inserted.');
    // The page item asks the host first; no page, no insert.
    expect(await state.insertItem(item('page'), { anchor: 'p1', replace: false })).toBe(false);
    expect(
      await state.insertItem(item('page'), { anchor: 'p1', replace: false }, () => ({
        ref: 'pages/child',
        title: 'Child',
      }))
    ).toBe(true);
    expect(state.doc.blocks[1]).toMatchObject({ type: 'page-link', ref: 'pages/child' });
  });

  it('removes a block and keeps a paragraph in a list it emptied', () => {
    const { state } = editor();
    expect(state.remove('p2')).toBe(true);
    expect(state.locate('p2')).toBeNull();
    expect(state.remove('co1p')).toBe(true);
    const callout = state.locate('co1')?.node as Extract<DocumentBlock, { type: 'callout' }>;
    expect(callout.blocks).toHaveLength(1);
    expect(callout.blocks[0]).toMatchObject({ type: 'paragraph', content: [] });
  });

  it('moves blocks by keyboard steps, refuses moves past the ends and announces the position', () => {
    const { state, ids, announce } = editor();
    expect(state.moveBy('p1', 1)).toBe(true);
    expect(ids().slice(0, 3)).toEqual(['h1', 'p2', 'p1']);
    expect(announce).toHaveBeenLastCalledWith(
      'Paragraph: First paragraph moved to position 3 of 7.'
    );
    expect(state.moveBy('h1', -1)).toBe(false);
    expect(announce).toHaveBeenLastCalledWith('Heading 1: Field notes cannot move further.');
    // Into a column, as a pointer drop between lists does.
    expect(state.moveTo('p1', 'col2', 0)).toBe(true);
    expect(state.locate('p1')).toMatchObject({ parent: 'col2', index: 0 });
    // Never into itself.
    expect(state.moveTo('co1', 'co1', 0)).toBe(false);
  });

  it('undoes and redoes through the op log, typing in one block grouped into one step', () => {
    const { state, tick, onChange } = editor(doc([para('p1', '')]));
    const typeChar = (all: string) =>
      state.commitText(
        'p1',
        [{ id: 'p1', type: 'paragraph', content: text(all) } as EditorBlock],
        null
      );
    typeChar('H');
    tick(100);
    typeChar('Hi');
    tick(100);
    typeChar('Hi!');
    tick(5_000);
    expect(state.moveBy('p1', 1)).toBe(false);
    state.insertParagraphAfter('p1');
    expect(state.doc.blocks).toHaveLength(2);
    expect(state.canUndo).toBe(true);
    expect(state.undo()).toBe(true);
    expect(state.doc.blocks).toHaveLength(1);
    expect(state.undo()).toBe(true);
    expect(state.doc.blocks[0]).toMatchObject({ content: [] });
    expect(state.canUndo).toBe(false);
    expect(state.redo()).toBe(true);
    expect(state.doc.blocks[0]).toMatchObject({ content: text('Hi!') });
    expect(state.redo()).toBe(true);
    expect(state.doc.blocks).toHaveLength(2);
    // Every edit, undo and redo is an entry of the op log.
    expect(state.log().map((entry) => entry.kind)).toEqual([
      'edit',
      'edit',
      'edit',
      'edit',
      'undo',
      'undo',
      'undo',
      'undo',
      'redo',
      'redo',
      'redo',
      'redo',
    ]);
    expect(onChange).toHaveBeenCalledTimes(12);
  });

  it('joins a paragraph to the text before it on Backspace and to the next on Delete', () => {
    const { state } = editor(doc([para('p1', 'Hello '), para('p2', 'world'), para('p3', '!')]));
    expect(state.mergeBackward('p2')).toBe(true);
    expect(state.doc.blocks).toHaveLength(2);
    expect(state.doc.blocks[0]).toMatchObject({ id: 'p1', content: text('Hello world') });
    expect(state.focus).toMatchObject({ id: 'p1', leaf: 'p1', offset: 6 });
    expect(state.mergeForward('p1')).toBe(true);
    expect(state.doc.blocks[0]).toMatchObject({ content: text('Hello world!') });
    expect(state.mergeBackward('p1')).toBe(false);
  });

  it('refuses an edit the validator rejects and changes nothing', () => {
    const { state, announce } = editor(doc([para('p1', 'x')]));
    const before = state.doc;
    const result = state.apply([{ op: 'insert-node', parent: 'p1', index: 0, node: para('bad') }]);
    expect(result.ok).toBe(false);
    expect(state.doc).toBe(before);
    expect(announce.mock.lastCall?.[0]).toMatch(/^Edit refused/);
  });

  it('finds the row that holds a node', () => {
    const { state } = editor(
      doc([
        {
          id: 'l1',
          type: 'list',
          kind: 'bullet',
          items: [{ id: 'i1', blocks: [para('ip', 'item')] }],
        },
        ...samplePage().blocks,
      ])
    );
    expect(state.rowOf('ip')).toBe('l1');
    expect(state.rowOf('co1p')).toBe('co1p');
    expect(state.rowOf('col1')).toBe('cols');
    expect(state.rowOf('col2p')).toBe('col2p');
  });
});

describe('columns', () => {
  it('reads widths as shares of 12 and resizes by whole steps within the minimum', () => {
    expect(columnWidths([{}, {}])).toEqual([6, 6]);
    expect(columnWidths([{}, {}, {}])).toEqual([4, 4, 4]);
    expect(columnWidths([{ width: 8 }, { width: 4 }])).toEqual([8, 4]);
    expect(columnWidths([{ width: 3 }, { width: 3 }])).toEqual([6, 6]);
    expect(resizeColumns([6, 6], 0, 1)).toEqual([7, 5]);
    expect(resizeColumns([6, 6], 0, 9)).toEqual([10, 2]);
    expect(resizeColumns([2, 10], 0, -1)).toBeNull();
    expect(resizeColumns([6, 6], 1, 1)).toBeNull();
    expect(pointerSteps(120, 600)).toBe(2);
    expect(pointerSteps(-49, 600)).toBe(0);
  });

  it('sets widths as one undo step per resize run', () => {
    const { state } = editor();
    state.setColumnWidths('cols', [7, 5]);
    state.setColumnWidths('cols', [8, 4]);
    const columns = () => {
      const node = state.locate('cols')?.node as Extract<DocumentBlock, { type: 'columns' }>;
      return node.columns.map((c) => c.width);
    };
    expect(columns()).toEqual([8, 4]);
    state.undo();
    expect(columns()).toEqual([6, 6]);
  });
});

describe('block lists', () => {
  it('lists every block list as a sortable container and walks rows in reading order', () => {
    const page = samplePage();
    const containers = blockContainers(page);
    expect(containers.map((c) => c.id)).toEqual([ROOT_LIST, 'co1', 'col1', 'col2']);
    expect(containers.find((c) => c.id === 'col1')?.parentId).toBe('cols');
    expect(rowOrder(page)).toEqual([
      'h1',
      'p1',
      'p2',
      'co1',
      'co1p',
      'cols',
      'col1p',
      'col2p',
      'pl1',
      'd1',
    ]);
    expect(adjacentRow(page, 'co1p', 1)).toBe('cols');
    expect(adjacentRow(page, 'h1', -1)).toBeNull();
    expect(moveTarget(0, -1, 3)).toBeNull();
    expect(moveTarget(1, 1, 3)).toBe(2);
  });
});

describe('inline decks without the deck model (G136)', () => {
  const DECK = {
    formatVersion: 2,
    meta: { title: 'Launch plan' },
    slides: [{ id: 's1', layout: 'title-hero', props: { title: 'Launch plan' } }],
  };
  const embed = { id: 'e1', type: 'embed', kind: 'deck', inline: DECK } as unknown as DocumentBlock;
  const insert = [{ op: 'insert-node', parent: null, index: 0, node: embed }] as never;

  it('refuses an inline deck unless the editor has a deck validator', async () => {
    const { checkDeckPayload } = await import('@texuli/document/schema');
    const bare = new PagesEditor({ document: doc([para('p1', 'Intro')]), announce: () => {} });
    expect(bare.apply(insert).ok).toBe(false);
    const checked = new PagesEditor({
      document: doc([para('p1', 'Intro')]),
      announce: () => {},
      validateDeck: checkDeckPayload,
    });
    expect(checked.apply(insert).ok).toBe(true);
  });

  it('leaves the inline deck item out of the slash menu when decks cannot be validated', () => {
    const values = (decks?: boolean) =>
      coreSlashItems(DEFAULT_PAGES_LABELS, decks === undefined ? {} : { decks }).map(
        (i) => i.value
      );
    expect(values()).toContain('deck');
    expect(values(false)).not.toContain('deck');
  });
});
