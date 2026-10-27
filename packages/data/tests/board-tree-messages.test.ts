// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BoardHarness from './fixtures/BoardHarness.svelte';
import TreeDataViewHarness from './fixtures/TreeDataViewHarness.svelte';

/*
 * T-migrate-board-tree: board and tree announcements come from localized
 * DragMessages templates (`messages`) and overridable labels (`labels`), and
 * no English sentence is left hardcoded in their components.
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const status = () => document.querySelector('.tx-board__status')?.textContent ?? '';
const treeLive = () => document.querySelector('.tx-tree-view__live')?.textContent ?? '';

const spanishMessages = {
  pickedUp: '{item} levantado: posición {position} de {total} en {container}.',
  cancelled: 'Movimiento cancelado. {item} volvió a la posición {position}.',
};

describe('board announcements are localized', () => {
  it('voices a pointer pick-up through DragMessages and the move through labels', async () => {
    render(BoardHarness, {
      props: {
        messages: spanishMessages,
        labels: {
          moved: (item, column, edge) =>
            `${item} movido a ${column} (${edge === 'top' ? 'arriba' : 'abajo'}).`,
        },
      },
    });
    const handle = screen.getByRole('button', { name: 'Drag Alpha task' });
    const done = screen.getByRole('list', { name: 'Done' });
    const root = document.querySelector('.tx-board');
    if (!root) throw new Error('Board root did not render.');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(done);
    await fireEvent.pointerDown(handle, { pointerId: 4, button: 0, clientX: 1, clientY: 1 });
    await fireEvent.pointerMove(root, { pointerId: 4, clientX: 20, clientY: 20 });
    expect(status()).toBe('Alpha task levantado: posición 1 de 1 en To do.');
    await fireEvent.pointerUp(root, { pointerId: 4, clientX: 20, clientY: 20 });
    await waitFor(() => expect(status()).toBe('Alpha task movido a Done (arriba).'));
  });

  it('voices Escape during a pointer drag through the cancelled template', async () => {
    render(BoardHarness, { props: { messages: spanishMessages } });
    const handle = screen.getByRole('button', { name: 'Drag Alpha task' });
    const root = document.querySelector('.tx-board');
    if (!root) throw new Error('Board root did not render.');
    await fireEvent.pointerDown(handle, { pointerId: 4, button: 0, clientX: 1, clientY: 1 });
    await fireEvent.pointerMove(root, { pointerId: 4, clientX: 1, clientY: 30 });
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(status()).toBe('Movimiento cancelado. Alpha task volvió a la posición 1.');
    await fireEvent.pointerUp(root, { pointerId: 4, clientX: 1, clientY: 30 });
    expect(screen.getByLabelText('Move count').textContent).toBe('0');
  });

  it('localizes the move menu and a failed save', async () => {
    render(BoardHarness, {
      props: {
        failMoves: true,
        labels: {
          moveMenu: (item) => `Mover ${item}`,
          menuTop: (column) => `${column}: arriba`,
          menuBottom: (column) => `${column}: abajo`,
          moved: (item) => `${item} movido.`,
          moveFailed: (item) => `${item} no se movió.`,
        },
      },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Mover Alpha task' }));
    const destination = await waitFor(
      () => screen.getByRole('menuitem', { name: 'Done: arriba' }),
      {
        timeout: 5_000,
      }
    );
    await fireEvent.click(destination);
    await waitFor(() => expect(status()).toBe('Alpha task no se movió.'));
  });
});

describe('board keyboard announcements are localized', () => {
  const keyboard = {
    position: ({ column, position, total }: { column: string; position: number; total: number }) =>
      `${column}, lugar ${position} de ${total}`,
    pickedUp: (item: string, where: string) => `${item} recogido. ${where}.`,
    blocked: (item: string, where: string) => `${where}. ${item} no cabe aquí.`,
    cancelled: (item: string, where: string) => `Cancelado. ${item} vuelve a ${where}.`,
    edge: () => 'Ya está en el borde.',
  };

  it('voices pick-up, moves, edges and cancel through labels.keyboard', async () => {
    render(BoardHarness, { props: { labels: { keyboard } } });
    const handle = screen.getByRole('button', { name: 'Drag Alpha task' });
    await fireEvent.keyDown(handle, { key: ' ' });
    expect(status()).toBe('Alpha task recogido. To do, lugar 1 de 1.');
    // The harness board is RTL: ArrowLeft moves toward the next column.
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(status()).toBe('Ya está en el borde.');
    await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(status()).toBe('In progress, lugar 1 de 2. Alpha task no cabe aquí.');
    await fireEvent.keyDown(handle, { key: 'Escape' });
    expect(status()).toBe('Cancelado. Alpha task vuelve a To do, lugar 1 de 1.');
  });

  it('lets DragMessages templates speak for the keyboard path too', async () => {
    render(BoardHarness, {
      props: {
        messages: {
          pickedUp: '{item} levantado: {position}/{total} en {container}.',
          dropped: '{item} soltado en {container}.',
        },
      },
    });
    const handle = screen.getByRole('button', { name: 'Drag Alpha task' });
    await fireEvent.keyDown(handle, { key: 'Enter' });
    expect(status()).toBe('Alpha task levantado: 1/1 en To do.');
    await fireEvent.keyDown(handle, { key: 'Enter' });
    expect(status()).toBe('Dropped Alpha task in its original place.');
  });
});

describe('tree announcements are localized', () => {
  it('voices expand, collapse and keyboard moves through labels', async () => {
    render(TreeDataViewHarness, {
      props: {
        labels: {
          expanded: (item) => `${item} expandido.`,
          collapsed: (item) => `${item} contraído.`,
          moved: (item) => `${item} movido.`,
        },
      },
    });
    const docs = screen.getByRole('treeitem', { name: /Docs/ });
    await fireEvent.keyDown(docs, { key: 'Enter' });
    await waitFor(() => expect(treeLive()).toMatch(/^Docs (expandido|contraído)\.$/));
    const first = treeLive();
    await fireEvent.keyDown(docs, { key: 'Enter' });
    await waitFor(() => expect(treeLive()).not.toBe(first));
    expect(treeLive()).toMatch(/^Docs (expandido|contraído)\.$/);
    const api = screen.getByRole('treeitem', { name: /API/ });
    await fireEvent.keyDown(api, { key: 'ArrowUp', altKey: true });
    await waitFor(() => expect(treeLive()).toBe('API movido.'));
  });

  it('voices a pointer drag through DragMessages and the drop through movedUnder', async () => {
    render(TreeDataViewHarness, {
      props: {
        messages: spanishMessages,
        labels: {
          movedUnder: (item, parent) => `${item} movido bajo ${parent}.`,
          topLevel: 'la raíz',
        },
      },
    });
    const handle = screen.getByRole('button', { name: 'Move API' });
    const intro = screen.getByRole('treeitem', { name: /Intro/ });
    const root = document.querySelector('[data-tree-view]');
    if (!root) throw new Error('Tree root missing');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(intro);
    await fireEvent.pointerDown(handle, { pointerId: 6, button: 0, clientX: 1, clientY: 1 });
    await fireEvent.pointerMove(root, { pointerId: 6, clientX: 40, clientY: 40 });
    expect(treeLive()).toBe('API levantado: posición 2 de 2 en Docs.');
    await fireEvent.pointerUp(root, { pointerId: 6, clientX: 40, clientY: 40 });
    await waitFor(() => expect(treeLive()).toMatch(/^API movido bajo (Intro|Guides)\.$/));
  });
});

describe('no hardcoded English in board and tree announcements', () => {
  const read = (path: string) => readFileSync(join(import.meta.dirname, '..', path), 'utf8');
  /** The script without its English defaults block (the documented fallbacks). */
  const scriptWithoutDefaults = (source: string) =>
    (source.split('</script>')[0] ?? '').replace(/const DEFAULT_LABELS[\s\S]*?\n};\n/, '');

  for (const file of ['src/board/Board.svelte', 'src/tree-view/TreeDataView.svelte']) {
    it(`${file} announces only labels and message templates`, () => {
      const script = scriptWithoutDefaults(read(file));
      expect(script).not.toMatch(/announce\(\s*[`'"]/);
      expect(script).not.toMatch(/[`'"](Moved|Dragging|Collapsed|Expanded|Picked up|Dropped)\b/);
      expect(script).not.toMatch(/was not moved|is locked and|cannot move there|the top level/);
    });
  }

  it('the board keyboard engine speaks only through BoardKeyboardText', () => {
    const source = read('src/engines/board/keyboard.ts').replace(
      /export const DEFAULT_BOARD_KEYBOARD_TEXT[\s\S]*?\n};\n/,
      ''
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(
      /Picked up|Dropped|Move cancelled|Still holding|Already at|position \$\{/
    );
    expect(code).not.toMatch(/announcement: `[A-Za-z]/);
  });

  it('board/model.ts takes its menu text from the caller', () => {
    const source = read('src/board/model.ts').replace(
      /export const DEFAULT_MOVE_MENU_TEXT[\s\S]*?\n};\n/,
      ''
    );
    expect(source).not.toMatch(/— top|— bottom|Already at/);
  });
});
