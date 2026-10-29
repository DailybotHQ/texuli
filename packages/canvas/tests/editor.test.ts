import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  type CanvasController,
  CanvasEditor,
  canvasCommand,
  DEFAULT_CANVAS_LABELS,
  formatCanvasLabel,
} from '../src/editor/index.ts';
import { type CanvasDocument, indexShapes, validateCanvas } from '../src/model/index.ts';
import { createCanvasSync } from '../src/sync/index.ts';
import { everyShape } from './fixtures.ts';

function small(): CanvasDocument {
  return {
    format: 'texuli-canvas',
    formatVersion: 1,
    meta: { title: 'Plan' },
    shapes: [
      { id: 'b', type: 'rect', x: 200, y: 0, width: 100, height: 60, text: 'Second' },
      { id: 'a', type: 'rect', x: 0, y: 0, width: 100, height: 60, text: 'First' },
      { id: 'c', type: 'sticky', x: 0, y: 200, width: 120, height: 120, text: 'Third' },
    ],
    connectors: [],
  };
}

function setup(canvas: CanvasDocument = small(), props: Record<string, unknown> = {}) {
  const messages: string[] = [];
  let controller: CanvasController | undefined;
  let latest = canvas;
  const view = render(CanvasEditor, {
    props: {
      canvas,
      announce: (message: string) => messages.push(message),
      onchange: (next: CanvasDocument) => {
        latest = next;
      },
      get controller() {
        return controller;
      },
      set controller(value: CanvasController | undefined) {
        controller = value;
      },
      ...props,
    },
  });
  const shape = (id: string) =>
    view.container.querySelector(`[data-tx-shape="${id}"]`) as SVGGElement;
  return {
    ...view,
    messages,
    shape,
    get doc() {
      return latest;
    },
    get controller() {
      return controller as CanvasController;
    },
  };
}

const key = async (target: Element, init: KeyboardEventInit) => {
  await fireEvent.keyDown(target, init);
  flushSync();
  await tick();
};

describe('the keyboard model', () => {
  it('maps every documented key to its command', () => {
    const cases: [Parameters<typeof canvasCommand>[0], 'shape' | 'surface', unknown][] = [
      [{ key: 'Tab' }, 'shape', { kind: 'next' }],
      [{ key: 'Tab', shiftKey: true }, 'shape', { kind: 'previous' }],
      [{ key: 'ArrowRight' }, 'shape', { kind: 'move', direction: 'right', fine: false }],
      [{ key: 'ArrowUp', altKey: true }, 'shape', { kind: 'move', direction: 'up', fine: true }],
      [
        { key: 'ArrowDown', shiftKey: true },
        'shape',
        { kind: 'resize', direction: 'down', fine: false },
      ],
      [{ key: ']' }, 'shape', { kind: 'rotate', degrees: 15 }],
      [{ key: '[', shiftKey: true }, 'shape', { kind: 'rotate', degrees: -1 }],
      [{ key: 'Enter' }, 'shape', { kind: 'edit' }],
      [{ key: 'F2' }, 'shape', { kind: 'edit' }],
      [{ key: 'Enter' }, 'surface', { kind: 'create' }],
      [{ key: ' ' }, 'shape', { kind: 'toggle' }],
      [{ key: 'Delete' }, 'shape', { kind: 'remove' }],
      [{ key: 'Backspace' }, 'shape', { kind: 'remove' }],
      [{ key: 'g', ctrlKey: true }, 'shape', { kind: 'group' }],
      [{ key: 'G', metaKey: true, shiftKey: true }, 'shape', { kind: 'ungroup' }],
      [{ key: 'z', metaKey: true }, 'shape', { kind: 'undo' }],
      [{ key: 'z', ctrlKey: true, shiftKey: true }, 'shape', { kind: 'redo' }],
      [{ key: 'y', ctrlKey: true }, 'shape', { kind: 'redo' }],
      [{ key: 'c', ctrlKey: true }, 'shape', { kind: 'copy' }],
      [{ key: 'x', ctrlKey: true }, 'shape', { kind: 'cut' }],
      [{ key: 'v', ctrlKey: true }, 'shape', { kind: 'paste' }],
      [{ key: 'd', ctrlKey: true }, 'shape', { kind: 'duplicate' }],
      [{ key: 'a', ctrlKey: true }, 'shape', { kind: 'selectAll' }],
      [{ key: ']', ctrlKey: true }, 'shape', { kind: 'reorder', mode: 'forward' }],
      [{ key: '[', ctrlKey: true, shiftKey: true }, 'shape', { kind: 'reorder', mode: 'back' }],
      [{ key: '+' }, 'surface', { kind: 'zoomIn' }],
      [{ key: '-' }, 'surface', { kind: 'zoomOut' }],
      [{ key: '0' }, 'surface', { kind: 'zoomReset' }],
      [{ key: '1' }, 'surface', { kind: 'fit' }],
      [{ key: '2' }, 'shape', { kind: 'zoomSelection' }],
      [{ key: 'k' }, 'shape', { kind: 'connect' }],
      [{ key: 'Escape' }, 'shape', { kind: 'escape' }],
      [{ key: 'r' }, 'surface', { kind: 'tool', tool: 'rect' }],
      [{ key: 'p' }, 'shape', { kind: 'tool', tool: 'draw' }],
      [{ key: 'q' }, 'shape', null],
      [{ key: 'k' }, 'surface', null],
    ];
    for (const [event, target, expected] of cases)
      expect(canvasCommand(event, target), `${event.key} on ${target}`).toEqual(expected);
  });
});

describe('CanvasEditor', () => {
  it('renders an application region, a toolbar and a shape tree in reading order, text as text', () => {
    const hostile = small();
    (hostile.shapes[0] as { text: string }).text = '<img src=x onerror=alert(1)>';
    const view = setup(hostile);
    const app = screen.getByRole('application');
    expect(app.getAttribute('aria-roledescription')).toBe('infinite canvas');
    expect(app.getAttribute('aria-label')).toBe('Canvas: Plan');
    expect(screen.getByRole('toolbar', { name: 'Canvas tools' })).toBeTruthy();
    const tree = screen.getByRole('tree', { name: 'Shapes' });
    const items = within(tree)
      .getAllByRole('treeitem')
      .map((item) => item.dataset.txShapeItem);
    expect(items).toEqual(['a', 'b', 'c']);
    // Hostile text paints as a text node, never markup.
    expect(view.container.querySelector('img')).toBeNull();
    expect(view.shape('b').textContent).toContain('<img src=x onerror=alert(1)>');
    // One roving tab stop: the first shape in reading order.
    expect(view.shape('a').getAttribute('tabindex')).toBe('0');
    expect(view.shape('b').getAttribute('tabindex')).toBe('-1');
  });

  it('tabs through shapes in reading order, moves with arrows and resizes with Shift, announcing each', async () => {
    const view = setup();
    view.shape('a').focus();
    await key(view.shape('a'), { key: 'Tab' });
    expect(document.activeElement).toBe(view.shape('b'));
    expect(view.controller.selection.has('b')).toBe(true);
    await key(view.shape('b'), { key: 'ArrowRight' });
    expect(indexShapes(view.doc).get('b')?.shape).toMatchObject({ x: 208 });
    expect(view.messages.at(-1)).toBe('Moved Second to 208, 0.');
    await key(view.shape('b'), { key: 'ArrowDown', shiftKey: true });
    expect(indexShapes(view.doc).get('b')?.shape).toMatchObject({ height: 68 });
    expect(view.messages.at(-1)).toBe('Resized Second to 100 by 68.');
    await key(view.shape('b'), { key: ']' });
    expect(indexShapes(view.doc).get('b')?.shape).toMatchObject({ rotation: 15 });
    // Shift+Tab back; Tab past the last shape leaves the canvas (no preventDefault).
    await key(view.shape('b'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(view.shape('a'));
    view.shape('c').focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    view.shape('c').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('edits text with Enter (Escape commits), removes with Delete and undoes with Ctrl+Z', async () => {
    const view = setup();
    view.shape('a').focus();
    await key(view.shape('a'), { key: 'Enter' });
    const box = screen.getByRole('textbox', { name: 'Edit text' }) as HTMLTextAreaElement;
    await waitFor(() => expect(document.activeElement).toBe(box));
    box.value = 'Kickoff';
    await key(box, { key: 'Escape' });
    expect(indexShapes(view.doc).get('a')?.shape).toMatchObject({ text: 'Kickoff' });
    expect(screen.queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(view.shape('a')));
    await key(view.shape('a'), { key: 'Delete' });
    expect(indexShapes(view.doc).has('a')).toBe(false);
    expect(view.messages.at(-1)).toBe('Deleted 1 item.');
    const next = view.container.querySelector('[data-tx-shape]') as SVGGElement;
    await key(next, { key: 'z', ctrlKey: true });
    expect(indexShapes(view.doc).has('a')).toBe(true);
    await key(next, { key: 'y', ctrlKey: true });
    expect(indexShapes(view.doc).has('a')).toBe(false);
  });

  it('groups with Ctrl+G, ungroups with Ctrl+Shift+G, and connects by keyboard with K', async () => {
    const view = setup();
    view.controller.select(['a', 'b']);
    view.shape('a').focus();
    await key(view.shape('a'), { key: 'g', ctrlKey: true });
    const group = view.doc.shapes.find((shape) => shape.type === 'group');
    expect(group).toBeTruthy();
    expect(view.messages.at(-1)).toBe('Grouped 2 shapes.');
    await waitFor(() => expect(document.activeElement).toBe(view.shape(group?.id as string)));
    await key(view.shape(group?.id as string), { key: 'G', ctrlKey: true, shiftKey: true });
    expect(view.doc.shapes.some((shape) => shape.type === 'group')).toBe(false);
    view.shape('a').focus();
    await key(view.shape('a'), { key: 'k' });
    expect(view.messages.at(-1)).toMatch(/^Connecting from First/);
    await key(view.shape('a'), { key: 'Tab' });
    expect(view.messages.at(-1)).toBe('Connect to Second?');
    await key(view.shape('b'), { key: 'Enter' });
    expect(view.doc.connectors).toEqual([
      expect.objectContaining({ from: { shape: 'a' }, to: { shape: 'b' }, routing: 'elbow' }),
    ]);
    expect(view.messages.at(-1)).toBe('Connected First to Second.');
    expect(validateCanvas(view.doc).ok).toBe(true);
  });

  it('creates shapes from a tool key and Enter, zooms with keys, and pans the empty surface', async () => {
    const view = setup({ ...small(), shapes: [] });
    const app = screen.getByRole('application');
    expect(app.getAttribute('tabindex')).toBe('0');
    app.focus();
    await key(app, { key: 's' });
    expect(view.controller.tool).toBe('sticky');
    await key(app, { key: 'Enter' });
    expect(view.doc.shapes).toEqual([expect.objectContaining({ type: 'sticky' })]);
    // A new sticky opens its text box.
    expect(screen.getByRole('textbox', { name: 'Edit text' })).toBeTruthy();
    view.controller.cancelEdit();
    const before = view.controller.view;
    await key(app, { key: 'ArrowLeft' });
    expect(view.controller.view.x).toBe(before.x + 48);
    await key(app, { key: '+' });
    expect(view.controller.view.zoom).toBeCloseTo(before.zoom * 1.25);
    expect(view.messages.at(-1)).toMatch(/^Zoom \d+%\.$/);
  });

  it('copies and pastes through validated JSON and refuses a hostile paste', async () => {
    const view = setup();
    view.controller.select(['a']);
    expect(view.controller.copy()).toContain('texuli-canvas-clipboard');
    expect(view.controller.paste()).toBe(true);
    expect(view.doc.shapes).toHaveLength(4);
    expect(
      view.controller.paste(
        '{"format":"texuli-canvas-clipboard","version":1,"shapes":[{"id":"x","type":"script"}],"connectors":[]}'
      )
    ).toBe(false);
    expect(view.messages.at(-1)).toBe(formatCanvasLabel(DEFAULT_CANVAS_LABELS.pasteRefused));
    expect(view.doc.shapes).toHaveLength(4);
  });

  it('selects and moves with the pointer, and the shape tree follows the selection', async () => {
    const view = setup();
    const target = view.shape('a').querySelector('rect') as SVGRectElement;
    await fireEvent.pointerDown(target, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientX: 10,
      clientY: 10,
    });
    await fireEvent.pointerMove(target, {
      pointerId: 1,
      isPrimary: true,
      clientX: 50,
      clientY: 30,
    });
    await fireEvent.pointerUp(target, { pointerId: 1, isPrimary: true, clientX: 50, clientY: 30 });
    flushSync();
    const moved = indexShapes(view.doc).get('a')?.shape as { x: number; y: number };
    expect(moved.x).not.toBe(0);
    const item = screen.getAllByRole('treeitem').find((each) => each.dataset.txShapeItem === 'a');
    expect(item?.getAttribute('aria-selected')).toBe('true');
  });

  it('edits a collaborative session and paints every shape type of the fixture', () => {
    const sync = createCanvasSync({ replica: 'ada', canvas: everyShape() });
    const view = setup(undefined, { sync });
    for (const id of [
      'frame',
      'idea',
      'review',
      'start',
      'choice',
      'note',
      'pair',
      'a1',
      'pointer',
      'scribble',
      'logo',
    ])
      expect(view.shape(id), id).toBeTruthy();
    expect(view.container.querySelectorAll('[data-tx-connector]')).toHaveLength(3);
    view.controller.select(['start']);
    view.controller.nudge('right');
    expect(indexShapes(sync.canvas).get('start')?.shape).toMatchObject({ x: 728 });
    view.controller.undo();
    expect(indexShapes(sync.canvas).get('start')?.shape).toMatchObject({ x: 720 });
  });

  it('keeps readonly editors from changing the canvas', async () => {
    const view = setup(small(), { readonly: true });
    view.shape('a').focus();
    await key(view.shape('a'), { key: 'Delete' });
    await key(view.shape('a'), { key: 'ArrowRight' });
    expect(view.doc).toEqual(small());
    const buttons = within(screen.getByRole('toolbar')).getAllByRole('button');
    expect(buttons.filter((button) => button.hasAttribute('aria-pressed'))).toHaveLength(2);
  });
});
