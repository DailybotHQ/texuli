// @vitest-environment node

import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { describe, expect, it } from 'vitest';
import {
  announceMove,
  createBuilderUndo,
  describeEdit,
  historyShortcut,
  ownsTextUndo,
  selectionAfterMove,
} from '../../apps/website/src/components/builder/history/model.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';
import {
  createBuilderHistory,
  inspectorFields,
  refusedPropName,
} from '../../apps/website/src/components/builder/model.ts';

const labels: Record<string, string> = {
  'layout-page': 'Page layout',
  'layout-card': 'Card layout',
  'blocks-text': 'Text blocks',
};
const labelOf = (id: string) => labels[id] ?? id;
const text = (markdown: string): CatalogTreeInput => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});
const start: CatalogTreeInput = {
  id: 'layout-page',
  props: { title: 'Fictional' },
  children: [
    { id: 'layout-card', props: { title: 'Alpha' }, children: [text('one')] },
    text('two'),
  ],
};
const fresh = () => createBuilderUndo(createBuilderHistory(start), labelOf);
const key = (overrides: Partial<Parameters<typeof historyShortcut>[0]>) => ({
  key: 'z',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
});

describe('builder history labels', () => {
  it('names each edit by its op and the node it touched', () => {
    expect(
      describeEdit(start, [{ op: 'setProp', path: [0], name: 'title', value: 'B' }], labelOf)
    ).toBe('Set title on Card layout');
    expect(describeEdit(start, [{ op: 'unsetProp', path: [], name: 'title' }], labelOf)).toBe(
      'Clear title on Page layout'
    );
    expect(describeEdit(start, [{ op: 'remove', path: [1] }], labelOf)).toBe('Remove Text blocks');
    expect(
      describeEdit(start, [{ op: 'insert', parent: [], index: 2, node: text('x') }], labelOf)
    ).toBe('Insert Text blocks');
    expect(describeEdit(start, [{ op: 'move', path: [1], parent: [0], index: 0 }], labelOf)).toBe(
      'Move Text blocks'
    );
    expect(describeEdit(start, [{ op: 'replaceAll', tree: start }], labelOf)).toBe(
      'Replace the draft'
    );
  });

  it('announces what came back, and redo is cleared by a new edit', () => {
    const history = fresh();
    history.apply({ op: 'setProp', path: [0], name: 'title', value: 'Beta' });
    history.apply({ op: 'remove', path: [1] });
    expect(history.undoLabel).toBe('Remove Text blocks');

    const undone = history.undo();
    expect(undone && announceMove(undone)).toBe('Undid: Remove Text blocks.');
    expect(history.redoLabel).toBe('Remove Text blocks');
    expect(history.undoLabel).toBe('Set title on Card layout');

    const redone = history.redo();
    expect(redone && announceMove(redone)).toBe('Redid: Remove Text blocks.');

    history.undo();
    expect(history.canRedo).toBe(true);
    history.apply({ op: 'setProp', path: [], name: 'title', value: 'New' });
    expect(history.canRedo).toBe(false);
    expect(history.redoLabel).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('keeps one label for coalesced typing, and an explicit label wins', () => {
    const history = fresh();
    for (const value of ['B', 'Be', 'Bet']) {
      history.apply(
        { op: 'setProp', path: [0], name: 'title', value },
        { coalesceKey: 'prop:0:title' }
      );
    }
    history.apply({ op: 'replaceAll', tree: start }, { label: 'Commit JSON' });
    expect(history.undo()?.label).toBe('Commit JSON');
    expect(history.undo()?.label).toBe('Set title on Card layout');
    expect(history.canUndo).toBe(false);
    expect(history.undoLabel).toBeNull();
  });

  it('records no step for an edit that changes nothing or is refused', () => {
    const history = fresh();
    history.apply({ op: 'unsetProp', path: [], name: 'subtitle' });
    history.apply({ op: 'remove', path: [9] });
    expect(history.canUndo).toBe(false);
    expect(history.undoLabel).toBeNull();
  });
});

describe('selection after a history move', () => {
  it('follows what came back: a prop change, a reinserted node, a moved node', () => {
    const history = fresh();
    history.apply({
      op: 'setProp',
      path: [0, 0],
      name: 'block',
      value: text('changed').props?.block,
    });
    const propUndo = history.undo();
    expect(propUndo && selectionAfterMove(propUndo, [])).toEqual([0, 0]);

    history.apply({ op: 'remove', path: [1] });
    const removeUndo = history.undo();
    expect(removeUndo && selectionAfterMove(removeUndo, [])).toEqual([1]);
    const removeRedo = history.redo();
    expect(removeRedo && selectionAfterMove(removeRedo, [1])).toEqual([]);

    history.undo();
    history.apply({ op: 'move', path: [1], parent: [0], index: 0 });
    const moveUndo = history.undo();
    expect(moveUndo && selectionAfterMove(moveUndo, [0, 0])).toEqual([1]);
  });

  it('keeps the selection on a whole-draft replacement when the node still exists', () => {
    const history = fresh();
    history.apply({ op: 'replaceAll', tree: { id: 'layout-page', props: {}, children: [] } });
    const undone = history.undo();
    expect(undone && selectionAfterMove(undone, [0, 0])).toEqual([0, 0]);
    const redone = history.redo();
    expect(redone && selectionAfterMove(redone, [0, 0])).toEqual([]);
  });
});

describe('history shortcuts', () => {
  it('maps Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y', () => {
    expect(historyShortcut(key({ metaKey: true }))).toBe('undo');
    expect(historyShortcut(key({ ctrlKey: true }))).toBe('undo');
    expect(historyShortcut(key({ key: 'Z', metaKey: true, shiftKey: true }))).toBe('redo');
    expect(historyShortcut(key({ key: 'y', ctrlKey: true }))).toBe('redo');
    expect(historyShortcut(key({}))).toBeNull();
    expect(historyShortcut(key({ metaKey: true, altKey: true }))).toBeNull();
    expect(historyShortcut(key({ key: 'y', metaKey: true }))).toBeNull();
  });

  it('leaves text fields their own undo', () => {
    expect(ownsTextUndo({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(ownsTextUndo({ tagName: 'INPUT', type: 'text' } as unknown as EventTarget)).toBe(true);
    expect(ownsTextUndo({ tagName: 'INPUT', type: 'number' } as unknown as EventTarget)).toBe(true);
    expect(
      ownsTextUndo({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)
    ).toBe(true);
    expect(ownsTextUndo({ tagName: 'INPUT', type: 'checkbox' } as unknown as EventTarget)).toBe(
      false
    );
    expect(ownsTextUndo({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(ownsTextUndo(null)).toBe(false);
  });
});

describe('inspector fields (Task 77 visual finding)', () => {
  it('never offers a prop the closed rule refuses, nor slots and events', () => {
    const props = [
      { name: 'title', kind: 'string' },
      { name: 'class', kind: 'string' },
      { name: 'style', kind: 'string' },
      { name: 'onclick', kind: 'event' },
      { name: 'onready', kind: 'string' },
      { name: 'children', kind: 'slot' },
      { name: 'toc', kind: 'boolean' },
    ];
    expect(inspectorFields(props).map((prop) => prop.name)).toEqual(['title', 'toc']);
    // Every builder manifest: no inspector field can only produce refusals.
    for (const manifest of BUILDER_MANIFESTS) {
      for (const field of inspectorFields(manifest.props)) {
        expect(refusedPropName(field.name), `${manifest.id}.${field.name}`).toBe(false);
      }
    }
  });
});
