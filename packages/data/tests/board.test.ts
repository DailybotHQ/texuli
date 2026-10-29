import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import * as boardModule from '@texuli/data/board';
import { groupBoard, placementsOf, validateMove } from '@texuli/data/board';
import { midpointIndex } from '@texuli/drag/collision';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { moveMenuDestinations } from '../src/board/model.ts';
import BoardHarness from './fixtures/BoardHarness.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('@texuli/data/board', () => {
  it('exports pure pointer placement helpers and includes every reranked item, and 7 related cases', async () => {
    // exports pure pointer placement helpers and includes every reranked item
    // Pointer placement now comes from the shared engine; the local copy is gone.
    expect(midpointIndex([10, 30], 20)).toBe(1);
    expect(midpointIndex([10, 30], 40)).toBe(2);
    expect('indexFromPointer' in boardModule).toBe(false);
    expect('DRAG_THRESHOLD_PX' in boardModule).toBe(false);
    expect(
      placementsOf({
        itemId: 'a',
        fromColumnId: 'todo',
        fromLaneId: '',
        columnId: 'done',
        laneId: '',
        index: 1,
        rank: '1h',
        rerank: [{ itemId: 'b', rank: '1h' }],
      })
    ).toEqual({
      a: { columnId: 'done', laneId: '', rank: '1h' },
      b: { columnId: 'done', laneId: '', rank: '1h' },
    });
    cleanup();
    vi.restoreAllMocks();
    // lets keyboard users pick up, move and drop a card with a live announcement
    await (async () => {
      render(BoardHarness);
      const handle = screen.getByRole('button', { name: 'Drag Alpha task' });

      await fireEvent.keyDown(handle, { key: ' ' });
      expect(document.querySelector('.tx-board__status')?.textContent).toContain(
        'Picked up Alpha task'
      );
      await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      expect(screen.getByRole('list', { name: 'Done' }).textContent).toContain('Alpha task');
      const previewHandle = screen.getByRole('button', { name: 'Drag Alpha task' });
      previewHandle.focus();
      await fireEvent.keyDown(previewHandle, { key: 'Enter' });

      await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
      expect(document.querySelector('.tx-board__status')?.textContent).toContain(
        'Dropped Alpha task in Done'
      );
      expect(screen.getByRole('list', { name: 'Done' }).textContent).toContain('Alpha task');
    })();
    cleanup();
    vi.restoreAllMocks();
    // keeps a hard WIP limit and explains the rejected keyboard drop
    await (async () => {
      render(BoardHarness);
      // The count must reach assistive tech as text, not as a label on a
      // roleless span; the 1/1 fraction stays visual-only.
      const announced = screen.getByText('1 card, limit 1');
      expect(announced).toBeTruthy();
      const count = announced.closest('.tx-board__count');
      expect(count?.getAttribute('dir')).toBe('ltr');
      expect(count?.querySelector('[aria-hidden="true"]')?.textContent).toBe('1/1');
      const handle = screen.getByRole('button', { name: 'Drag Alpha task' });

      await fireEvent.keyDown(handle, { key: ' ' });
      await fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      await fireEvent.keyDown(handle, { key: ' ' });

      expect(screen.getByLabelText('Move count').textContent).toBe('0');
      expect(document.querySelector('.tx-board__status')?.textContent).toContain(
        'Cannot move Alpha task'
      );
      expect(
        screen.getByRole('button', { name: 'Drag Alpha task' }).getAttribute('aria-pressed')
      ).toBe('true');
    })();
    cleanup();
    vi.restoreAllMocks();
    // moves a pointer drag to the cell under the pointer
    await (async () => {
      render(BoardHarness);
      const handle = screen.getByRole('button', { name: 'Drag Alpha task' });
      const done = screen.getByRole('list', { name: 'Done' });
      const root = document.querySelector('.tx-board');
      if (!root) throw new Error('Board root did not render.');
      vi.spyOn(document, 'elementFromPoint').mockReturnValue(done);

      await fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientX: 1, clientY: 1 });
      await fireEvent.pointerMove(root, { pointerId: 7, clientX: 20, clientY: 20 });
      await fireEvent.pointerUp(root, { pointerId: 7, clientX: 20, clientY: 20 });

      await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
      expect(done.textContent).toContain('Alpha task');
    })();
    cleanup();
    vi.restoreAllMocks();
    // offers a Move menu with column top/bottom destinations and moves with focus follow
    await (async () => {
      render(BoardHarness);
      const menu = screen.getByRole('button', { name: 'Move Alpha task' });
      await fireEvent.click(menu);
      // Lazy menu chunk: wait for data-ready, then destinations.
      await waitFor(
        () => expect(document.querySelector('[data-board-move-menu-ready]')).toBeTruthy(),
        {
          timeout: 5_000,
        }
      );
      const dest = await waitFor(() => screen.getByRole('menuitem', { name: 'Done — top' }), {
        timeout: 5_000,
      });
      await fireEvent.click(dest);
      await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
      expect(document.querySelector('.tx-board__status')?.textContent).toContain(
        'Moved Alpha task to Done'
      );
      expect(screen.getByRole('list', { name: 'Done' }).textContent).toContain('Alpha task');
      const card = document.querySelector('[data-item-id="alpha"]');
      expect(card?.closest('[data-board-cell]')?.getAttribute('aria-label')).toBe('Done');
      expect(card?.querySelector('[data-board-move-menu]')).toBeTruthy();
    })();
    cleanup();
    vi.restoreAllMocks();
    // disables the Move menu when the card is locked
    render(BoardHarness, { props: { lockedIds: ['alpha'] } });
    expect(screen.getByRole('button', { name: 'Move Alpha task' }).hasAttribute('disabled')).toBe(
      true
    );
    expect(screen.getByRole('button', { name: 'Drag Alpha task' }).hasAttribute('disabled')).toBe(
      true
    );
    cleanup();
    vi.restoreAllMocks();
    {
      // builds pure move-menu destinations with WIP-disabled targets
      const tasks = [
        { id: 'alpha', column: 'todo', rank: 'a0' },
        { id: 'beta', column: 'doing', rank: 'a0' },
      ];
      const grid = groupBoard(tasks, {
        columns: [
          { id: 'todo', title: 'To do' },
          { id: 'doing', title: 'In progress', wip: { hard: 1 } },
          { id: 'done', title: 'Done' },
        ],
        id: (task) => task.id,
        column: (task) => task.column,
        rank: (task) => task.rank,
      });
      const destinations = moveMenuDestinations(grid, 'alpha');
      expect(destinations.some((d) => d.id === 'done::top' && !d.disabled)).toBe(true);
      expect(destinations.find((d) => d.id === 'doing::top')?.disabled).toBe(true);
    }
    cleanup();
    vi.restoreAllMocks();
    {
      // rejects a full WIP target at the framework-free engine seam
      const tasks = [
        { id: 'alpha', column: 'todo', rank: 'a0' },
        { id: 'beta', column: 'doing', rank: 'a0' },
      ];
      const grid = groupBoard(tasks, {
        columns: [
          { id: 'todo', title: 'To do' },
          { id: 'doing', title: 'In progress', wip: { hard: 1 } },
        ],
        id: (task) => task.id,
        column: (task) => task.column,
        rank: (task) => task.rank,
      });
      expect(validateMove(grid, 'alpha', { columnId: 'doing', index: 0 })).toMatchObject({
        ok: false,
      });
    }
  }, 20_000);
});

describe('Board column footers and heading levels (G14)', () => {
  it('renders a footer per column and honors the heading level', async () => {
    const { default: BoardFooterHarness } = await import('./fixtures/BoardFooterHarness.svelte');
    const headings = (level: number) =>
      screen.queryAllByRole('heading', { level }).map((heading) => heading.textContent?.trim());
    for (const [headingLevel, lanes, expected] of [
      // default: hidden board title h2, columns h3
      [undefined, false, { title: 2, columns: 3, lanes: 0 }],
      [4, true, { title: 3, columns: 4, lanes: 5 }],
      // level 2: the board title is not a heading; lanes are capped below columns
      [2, true, { title: 0, columns: 2, lanes: 3 }],
      [6, true, { title: 5, columns: 6, lanes: 6 }],
    ] as const) {
      const { container } = render(BoardFooterHarness, {
        props: { ...(headingLevel ? { headingLevel } : {}), lanes },
      });
      if (expected.title) expect(headings(expected.title)).toContain('Board');
      else
        expect(screen.queryAllByRole('heading').map((h) => h.textContent)).not.toContain('Board');
      expect(headings(expected.columns)).toEqual(expect.arrayContaining(['To do', 'Done']));
      if (expected.lanes) expect(headings(expected.lanes)).toEqual(expect.arrayContaining(['Web']));
      // The board stays named by its title, heading or not.
      const board = container.querySelector('section.tx-board') as HTMLElement;
      expect(
        document.getElementById(board.getAttribute('aria-labelledby') ?? '')?.textContent
      ).toBe('Board');
      // One footer per column, after its cells, receiving the column and its count.
      const footers = [...container.querySelectorAll('.tx-board__column-footer')];
      expect(footers.map((footer) => footer.textContent?.trim())).toEqual([
        'Add to To do (2)',
        'Add to Done (1)',
      ]);
      expect(footers[0]?.parentElement?.lastElementChild).toBe(footers[0]);
      cleanup();
    }
  });
});
