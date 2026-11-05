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

describe('Board keyboard focus across columns (G103)', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps focus on the held card when it moves to another column, without waiting a frame', async () => {
    // No frame ever runs: focus may not wait for one.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    render(BoardHarness);
    const held = () => document.activeElement as HTMLElement;
    screen.getByRole('button', { name: 'Drag Alpha task' }).focus();
    await fireEvent.keyDown(held(), { key: ' ' });
    for (const _step of [1, 2]) {
      await fireEvent.keyDown(held(), { key: 'ArrowLeft' });
      // The key after the move lands on the moved card's handle, not on <body>.
      expect(held().getAttribute('aria-label')).toBe('Drag Alpha task');
      expect(held().isConnected).toBe(true);
    }
    expect(screen.getByRole('list', { name: 'Done' }).contains(held())).toBe(true);
    await fireEvent.keyDown(held(), { key: ' ' });
    await waitFor(() => expect(screen.getByLabelText('Move count').textContent).toBe('1'));
    expect(document.querySelector('.tx-board__status')?.textContent).toContain(
      'Dropped Alpha task in Done'
    );
  });
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

describe('Board column descriptions, header snippet and column-only mode (G67, G69)', () => {
  it('shows a column description that describes its cards, and renders the header snippet', async () => {
    const { default: Harness } = await import('./fixtures/BoardColumnsHarness.svelte');
    const { container } = render(Harness);
    const description = container.querySelector('.tx-board__column-description') as HTMLElement;
    expect(description.textContent).toBe('Tickets nobody has started.');
    const todo = screen.getByRole('list', { name: 'To do' });
    expect(todo.getAttribute('aria-describedby')).toBe(description.id);
    expect(screen.getByRole('list', { name: 'Done' }).hasAttribute('aria-describedby')).toBe(false);
    // The header snippet sits in the column header with the column and its count.
    const header = screen.getByTestId('header-todo');
    expect(header.closest('.tx-board__column-header')).toBeTruthy();
    expect(header.textContent).toBe('Sort To do (2)');
    expect(screen.getByTestId('header-done').textContent).toBe('Sort Done (1)');
  });

  it('works without getRank: keeps the host order, moves across columns, refuses reordering', async () => {
    const { default: Harness } = await import('./fixtures/BoardColumnsHarness.svelte');
    render(Harness);
    const titles = (name: string) =>
      [...screen.getByRole('list', { name }).querySelectorAll('[data-board-card]')].map((card) =>
        card.textContent?.trim()
      );
    expect(titles('To do')[0]).toContain('Alpha ticket');
    expect(titles('To do')[1]).toContain('Beta ticket');
    // Reordering inside a column is refused: the host has no order to store.
    const handle = () => screen.getByRole('button', { name: 'Drag Alpha ticket' });
    await fireEvent.keyDown(handle(), { key: ' ' });
    await fireEvent.keyDown(handle(), { key: 'ArrowDown' });
    await fireEvent.keyDown(handle(), { key: 'Enter' });
    expect(document.querySelector('.tx-board__status')?.textContent).toContain(
      'Alpha ticket keeps its place'
    );
    expect(screen.getByTestId('moves').textContent).toBe('[]');
    await fireEvent.keyDown(handle(), { key: 'Escape' });
    // A move to another column goes through, and settles on the host's column.
    await fireEvent.keyDown(handle(), { key: ' ' });
    await fireEvent.keyDown(handle(), { key: 'ArrowRight' });
    await fireEvent.keyDown(handle(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('moves').textContent).toBe('[["a","done"]]'));
    await waitFor(() => expect(titles('Done').join(' ')).toContain('Alpha ticket'));
    expect(document.querySelector('[data-board-card][data-pending]')).toBeNull();
  });

  it('validateMove with reorder: false refuses a new index in the same cell, not a drop in place', () => {
    const grid = groupBoard(
      [
        { id: 'a', column: 'todo' },
        { id: 'b', column: 'todo' },
      ],
      {
        columns: [{ id: 'todo', title: 'To do' }],
        id: (item) => item.id,
        column: (item) => item.column,
        rank: (item) => (item.id === 'a' ? 'a0' : 'a1'),
      }
    );
    const moved = validateMove(grid, 'a', { columnId: 'todo', index: 1 }, { reorder: false });
    expect(moved.ok).toBe(false);
    const inPlace = validateMove(grid, 'a', { columnId: 'todo', index: 0 }, { reorder: false });
    expect(inPlace.ok && inPlace.unchanged).toBe(true);
    expect(validateMove(grid, 'a', { columnId: 'todo', index: 1 }).ok).toBe(true);
  });
});

describe('Board collapsible lanes and cell footers (P-T-03, P-T-04)', () => {
  const toggles = (lane: string) =>
    screen.getAllByRole('button', { name: new RegExp(`^${lane}\\b`) }) as HTMLButtonElement[];

  it('collapses a lane behind a disclosure that keeps it in the totals and WIP limits', async () => {
    const { default: Harness } = await import('./fixtures/BoardLanesHarness.svelte');
    const changes: string[][] = [];
    const { container } = render(Harness, {
      props: {
        collapsed: ['api'],
        onCollapsedLanesChange: (next: string[]) => changes.push([...next]),
      },
    });
    const todo = container.querySelector('.tx-board__column') as HTMLElement;
    for (const [expanded, apiCards] of [
      [false, 0],
      [true, 1],
    ] as const) {
      // One toggle per column, in the lane heading, for the whole lane.
      for (const [index, button] of toggles('API').entries()) {
        expect(button.closest('.tx-board__lane-title')?.tagName).toBe('H4');
        expect(button.getAttribute('aria-expanded')).toBe(String(expanded));
        const controlled = (button.getAttribute('aria-controls') ?? '').split(' ');
        expect(controlled).toHaveLength(2);
        const lists = controlled.map((id) => document.getElementById(id));
        expect(lists.map((list) => list?.getAttribute('aria-label'))).toEqual([
          'To do, API',
          'Done, API',
        ]);
        expect(lists.every((list) => list?.hidden === !expanded)).toBe(true);
        // Collapsed, the toggle shows how many cards its cell hides.
        expect(button.textContent?.trim()).toBe(expanded ? 'API' : 'API (1 hidden)');
        expect(lists[index]?.querySelectorAll('[data-board-card]').length).toBe(apiCards);
      }
      // The collapsed card still counts: To do is at its hard limit either way.
      expect(todo.dataset.wip).toBe('blocked');
      expect(todo.querySelector('.tx-board__count')?.textContent).toContain('2 cards, limit 2');
      expect(screen.getAllByTestId('column-footer').map((f) => f.textContent)).toEqual([
        'todo (2)',
        'done (1)',
      ]);
      expect(toggles('Web')[0]?.getAttribute('aria-expanded')).toBe('true');
      if (!expanded) await fireEvent.click(toggles('API')[1] as HTMLElement);
    }
    expect(changes).toEqual([[]]);
    await fireEvent.click(toggles('API')[0] as HTMLElement);
    expect(changes).toEqual([[], ['api']]);
    expect(screen.getByTestId('collapsed').textContent).toBe('api');
  });

  it('opens a collapsed lane when a held card enters it, keeping the card focused', async () => {
    const { default: Harness } = await import('./fixtures/BoardLanesHarness.svelte');
    const changes: string[][] = [];
    render(Harness, {
      props: {
        collapsed: ['api'],
        labels: { hiddenCards: (count: number) => `${count} folded` },
        onCollapsedLanesChange: (next: string[]) => changes.push([...next]),
      },
    });
    expect(toggles('API')[0]?.textContent?.trim()).toBe('API (1 folded)');
    const held = () => document.activeElement as HTMLElement;
    screen.getByRole('button', { name: 'Drag Alpha task' }).focus();
    await fireEvent.keyDown(held(), { key: ' ' });
    await fireEvent.keyDown(held(), { key: 'ArrowDown', shiftKey: true });
    expect(changes).toEqual([[]]);
    expect(held().getAttribute('aria-label')).toBe('Drag Alpha task');
    expect(screen.getByRole('list', { name: 'To do, API' }).contains(held())).toBe(true);
    await fireEvent.keyDown(held(), { key: ' ' });
    await waitFor(() =>
      expect(
        screen.getByRole('list', { name: 'To do, API' }).querySelectorAll('[data-board-card]')
      ).toHaveLength(2)
    );
  });

  it('renders a cell footer per column and lane, and per column without lanes', async () => {
    const { default: Harness } = await import('./fixtures/BoardLanesHarness.svelte');
    for (const [props, expected] of [
      [{}, ['todo/web', 'todo/api', 'done/web', 'done/api']],
      // A collapsed lane hides its cell footers with its cards.
      [{ collapsed: ['api'] }, ['todo/web', 'done/web']],
      // Without lanes the cell is the column, and the lane is DEFAULT_LANE (id '').
      [{ lanes: false }, ['todo/', 'done/']],
    ] as const) {
      const { container } = render(Harness, {
        props: { ...props, collapsed: [...(props.collapsed ?? [])] },
      });
      const footers = screen.getAllByTestId('cell-footer');
      expect(footers.map((footer) => footer.textContent?.replace('Add to ', ''))).toEqual(expected);
      // Each sits right after its cell's card list; the column footer stays last.
      for (const footer of footers) {
        expect(footer.parentElement?.previousElementSibling?.getAttribute('role')).toBe('list');
      }
      const column = container.querySelector('.tx-board__column') as HTMLElement;
      expect(column.lastElementChild?.classList.contains('tx-board__column-footer')).toBe(true);
      if (props.lanes === false)
        expect(screen.queryAllByRole('button', { name: /^Web/ })).toEqual([]);
      cleanup();
    }
  });
});
