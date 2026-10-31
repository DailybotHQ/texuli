import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ColumnState } from '../src/engines/grid/columns.ts';
import { resolveColumns } from '../src/engines/grid/columns.ts';
import {
  ColumnGrid,
  canHideColumn,
  canMoveColumn,
  completeState,
  dropTarget,
  headerGroups,
  moveColumnBy,
  moveColumnTo,
  orderedColumns,
  parseColumnState,
  pinOffsets,
  pinsFit,
  resetColumnWidth,
  resizeColumnBy,
  resolveColumnGridLabels,
  totalWidth,
} from '../src/grid-columns/index.ts';
import type { ColumnGridProps } from '../src/grid-columns/props.ts';
import type { DataGridColumn } from '../src/grid-core/index.ts';

type Row = { id: string; name: string; owner: string; stage: string; amount: number };
const columns: DataGridColumn<Row>[] = [
  { key: 'name', header: 'Deal', type: 'text', width: 200 },
  { key: 'owner', header: 'Owner', type: 'text', width: 140 },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won'], width: 120 },
  { key: 'amount', header: 'Amount', type: 'number', width: 120, minWidth: 80, maxWidth: 300 },
];
const rows: Row[] = [
  { id: 'a', name: 'Harbor renewal', owner: 'Ada Park', stage: 'Won', amount: 1200 },
  { id: 'b', name: 'Lumen pilot', owner: 'Bea Ruiz', stage: 'Open', amount: 450 },
  { id: 'c', name: 'Quill expansion', owner: 'Ada Park', stage: 'Open', amount: 90 },
];
const keys = (state: ColumnState) =>
  orderedColumns(resolveColumns(columns, state)).map((c) => c.def.key);
const groups = [
  { id: 'deal', header: 'Deal details', columns: ['name', 'stage'] },
  { id: 'money', header: 'Money', columns: ['amount'] },
];
const TypedColumnGrid = ColumnGrid as unknown as Component<ColumnGridProps<Row>>;

describe('grid-columns model', () => {
  it('validates persisted state and never throws, and 8 related cases', () => {
    {
      // validates persisted state and never throws
      const valid: ColumnState = [
        { key: 'owner', width: 180, pinned: 'left' },
        { key: 'name', hidden: true },
      ];
      expect(parseColumnState(valid)).toEqual(valid);
      for (const bad of [
        'nope',
        null,
        [{ key: 'name', width: 99_999 }],
        [{ key: 'name', pinned: 'top' }],
        [{ key: 'name', __proto__: { hidden: true }, extra: 1 }],
        Array.from({ length: 201 }, (_, i) => ({ key: `k${i}` })),
      ]) {
        expect(parseColumnState(bad)).toEqual([]);
      }
    }
    cleanup();
    // completes state: its order first, unknown and duplicate keys dropped, new columns appended
    expect(
      completeState(columns, [
        { key: 'amount' },
        { key: 'ghost' },
        { key: 'amount', width: 90 },
        { key: 'name' },
      ])
    ).toEqual([{ key: 'amount' }, { key: 'name' }, { key: 'owner' }, { key: 'stage' }]);
    cleanup();
    {
      // moves a column inside its pin zone only
      const state: ColumnState = completeState(columns, [{ key: 'name', pinned: 'left' }]);
      const resolved = resolveColumns(columns, state);
      expect(keys(moveColumnTo(columns, resolved, state, 'amount', 'owner', 'before'))).toEqual([
        'name',
        'amount',
        'owner',
        'stage',
      ]);
      // Across the pin boundary: unchanged.
      expect(moveColumnTo(columns, resolved, state, 'amount', 'name', 'before')).toBe(state);
      expect(keys(moveColumnBy(columns, resolved, state, 'owner', 1))).toEqual([
        'name',
        'stage',
        'owner',
        'amount',
      ]);
      expect(moveColumnBy(columns, resolved, state, 'owner', -1)).toBe(state);
      expect(canMoveColumn(resolved, 'owner', -1)).toBe(false);
      expect(canMoveColumn(resolved, 'amount', 1)).toBe(false);
      expect(canMoveColumn(resolved, 'stage', 1)).toBe(true);
      expect(canMoveColumn(resolved, 'name', 1)).toBe(false);
    }
    cleanup();
    {
      // skips hidden columns when stepping, and keeps them in the state
      const state = completeState(columns, [{ key: 'name' }, { key: 'owner', hidden: true }]);
      const resolved = resolveColumns(columns, state);
      const next = moveColumnBy(columns, resolved, state, 'name', 1);
      expect(keys(next)).toEqual(['stage', 'name', 'amount']);
      expect(next.find((entry) => entry.key === 'owner')).toEqual({ key: 'owner', hidden: true });
    }
    cleanup();
    {
      // resizes within the min and max and resets to the definition width
      const resolved = resolveColumns(columns, []);
      const wider = resizeColumnBy(columns, resolved, [], 'amount', 1000);
      expect(wider).toEqual([{ key: 'amount', width: 300 }]);
      const narrower = resizeColumnBy(columns, resolved, [], 'amount', -1000);
      expect(narrower).toEqual([{ key: 'amount', width: 80 }]);
      expect(resizeColumnBy(columns, resolved, [], 'amount', Number.NaN)).toEqual([]);
      expect(resetColumnWidth(wider, 'amount')).toEqual([{ key: 'amount' }]);
    }
    cleanup();
    {
      // computes sticky offsets from the start and end pins
      const resolved = resolveColumns(columns, [
        { key: 'owner', pinned: 'left' },
        { key: 'name', pinned: 'left' },
        { key: 'amount', pinned: 'right' },
      ]);
      const offsets = pinOffsets(resolved);
      expect(offsets.get('owner')).toEqual({ side: 'start', offset: 0, edge: false });
      expect(offsets.get('name')).toEqual({ side: 'start', offset: 140, edge: true });
      expect(offsets.get('amount')).toEqual({ side: 'end', offset: 0, edge: true });
      expect(offsets.has('stage')).toBe(false);
      expect(pinOffsets(resolved, 44).get('owner')?.offset).toBe(44);
      expect(totalWidth(resolved)).toBe(580);
      // 460 px of pins stick in a 920 px grid, not in a 900 px one; an unknown width keeps them.
      expect(pinsFit(resolved, 920)).toBe(true);
      expect(pinsFit(resolved, 900)).toBe(false);
      expect(pinsFit(resolved, 0)).toBe(true);
    }
    cleanup();
    {
      // builds group header runs, split by order and pin zones
      expect(
        headerGroups(resolveColumns(columns, []), groups).map((run) => [
          run.group?.id ?? null,
          run.start,
          run.span,
        ])
      ).toEqual([
        ['deal', 0, 1],
        [null, 1, 1],
        ['deal', 2, 1],
        ['money', 3, 1],
      ]);
      const pinned = resolveColumns(columns, [{ key: 'stage' }, { key: 'name', pinned: 'left' }]);
      expect(
        headerGroups(pinned, groups).map((run) => [run.group?.id ?? null, run.span, run.zone])
      ).toEqual([
        ['deal', 1, 'left'],
        ['deal', 1, 'center'],
        [null, 1, 'center'],
        ['money', 1, 'center'],
      ]);
      const together = resolveColumns(columns, [{ key: 'name' }, { key: 'stage' }]);
      expect(
        headerGroups(together, [...groups, { id: 'again', header: 'Again', columns: ['name'] }])[0]
      ).toMatchObject({
        span: 2,
        group: { id: 'deal' },
      });
    }
    cleanup();
    {
      // finds the drop side under a pointer, mirrored in RTL
      const cells = [
        { key: 'a', left: 0, right: 100 },
        { key: 'b', left: 100, right: 200 },
      ];
      expect(dropTarget(cells, 30)).toEqual({ key: 'a', side: 'before' });
      expect(dropTarget(cells, 160)).toEqual({ key: 'b', side: 'after' });
      expect(dropTarget(cells, 30, true)).toEqual({ key: 'a', side: 'after' });
      expect(dropTarget(cells, -50)).toEqual({ key: 'a', side: 'before' });
      expect(dropTarget(cells, 500)).toEqual({ key: 'b', side: 'after' });
      expect(dropTarget(cells, 500, true)).toEqual({ key: 'b', side: 'before' });
      expect(dropTarget([], 10)).toBeNull();
    }
    cleanup();
    {
      // never hides the last visible column
      const resolved = resolveColumns(columns, [
        { key: 'name', hidden: true },
        { key: 'owner', hidden: true },
        { key: 'stage', hidden: true },
      ]);
      expect(canHideColumn(resolved, 'amount')).toBe(false);
      expect(canHideColumn(resolveColumns(columns, []), 'amount')).toBe(true);
      expect(resolveColumnGridLabels({ hideColumn: 'Ocultar', moved: 3 as never }).hideColumn).toBe(
        'Ocultar'
      );
    }
  });
});

function widths(container: HTMLElement): number[] {
  return [...container.querySelectorAll('col')].map((col) =>
    Number(/inline-size:\s*(\d+)px/.exec(col.getAttribute('style') ?? '')?.[1])
  );
}

function headers() {
  return screen
    .getAllByRole('columnheader')
    .filter((th) => th.hasAttribute('data-column-key'))
    .map((th) => th.getAttribute('data-column-key'));
}

async function menuFor(header: string) {
  return waitFor(
    () => {
      const trigger = screen.getByRole('button', { name: `Column options for ${header}` });
      expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
      return trigger;
    },
    { timeout: 5000 }
  );
}

describe('ColumnGrid', () => {
  // The column menu chunk loads lazily after the first paint; load it here so
  // a slow first transform under the parallel suite never meets a test wait.
  beforeAll(async () => {
    await import('../src/grid-columns/ColumnMenu.svelte');
  });
  it('renders deterministic vector sort indicators instead of font-dependent glyphs, and 13 related cases', async () => {
    {
      // renders deterministic vector sort indicators instead of font-dependent glyphs
      render(TypedColumnGrid, {
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals' },
      });
      const icon = document.querySelector('.tx-data-grid__sort-icon');

      // Sibling DataGrid sets the bar (grid-core.test.ts): the direction marker
      // is drawn by the stylesheet's own SVG paths, never by a font glyph that
      // varies (or turns into emoji) across platforms.
      expect(icon?.querySelector('svg[aria-hidden="true"] path')).toBeTruthy();
      expect(icon?.textContent?.trim()).toBe('');
    }
    cleanup();
    {
      // renders the state: order, widths, pins and group headers
      const { container } = render(TypedColumnGrid, {
        props: {
          rows,
          columns,
          getRowId: (r: Row) => r.id,
          caption: 'Deals',
          groups,
          columnState: [
            { key: 'amount', pinned: 'left', width: 150 },
            { key: 'owner', hidden: true },
          ],
        },
      });
      expect(headers()).toEqual(['amount', 'name', 'stage']);
      const grid = screen.getByRole('grid', { name: 'Deals' });
      expect(grid.getAttribute('aria-rowcount')).toBe('5');
      expect(grid.getAttribute('aria-colcount')).toBe('3');
      expect(grid.getAttribute('style')).toContain('inline-size: 470px');
      expect(widths(container)).toEqual([150, 200, 120]);
      const amount = container.querySelector('th[data-column-key="amount"]') as HTMLElement;
      expect(amount.dataset.pin).toBe('start');
      expect(amount.getAttribute('style')).toContain('inset-inline-start: 0px');
      expect(container.querySelector('td[data-tx-grid-cell="1:0"]')?.getAttribute('data-pin')).toBe(
        'start'
      );
      const groupCells = [...container.querySelectorAll('th[scope="colgroup"]')];
      expect(groupCells.map((th) => [th.textContent?.trim(), th.getAttribute('colspan')])).toEqual([
        ['Money', '1'],
        ['Deal details', '2'],
      ]);
    }
    cleanup();
    {
      // lets pins scroll with the rest when they would cover most of a narrow grid
      const rect = vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 300,
        height: 400,
        left: 0,
        top: 0,
        right: 300,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
      const { container } = render(TypedColumnGrid, {
        props: {
          rows,
          columns,
          getRowId: (r: Row) => r.id,
          caption: 'Deals',
          columnState: [{ key: 'name', pinned: 'left' }],
        },
      });
      rect.mockRestore();
      const frame = container.querySelector('[data-tx-grid-columns]') as HTMLElement;
      expect(frame.dataset.pins).toBe('static');
      expect(
        container.querySelector('th[data-column-key="name"]')?.getAttribute('style')
      ).toBeNull();
    }
    cleanup();
    // ignores hostile column state and shows the definition order
    render(TypedColumnGrid, {
      props: {
        rows,
        columns,
        getRowId: (r: Row) => r.id,
        caption: 'Deals',
        columnState: 'x' as never,
      },
    });
    expect(headers()).toEqual(['name', 'owner', 'stage', 'amount']);
    cleanup();
    // opens a column menu from the keyboard and moves the column, keeping focus on it
    await (async () => {
      const onColumnStateChange = vi.fn();
      const { container } = render(TypedColumnGrid, {
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals', onColumnStateChange },
      });
      await menuFor('Deal');
      const sortName = screen.getByRole('button', { name: /^Deal/ });
      sortName.focus();
      await fireEvent.keyDown(sortName, { key: 'ArrowDown', altKey: true });
      const menu = await screen.findByRole('menu');
      await waitFor(() =>
        expect(document.activeElement?.textContent?.trim()).toBe('Sort ascending')
      );
      expect(
        within(menu).getByRole('menuitem', { name: 'Move earlier' }).getAttribute('aria-disabled')
      ).toBe('true');
      await fireEvent.click(within(menu).getByRole('menuitem', { name: 'Move later' }));
      expect(headers()).toEqual(['owner', 'name', 'stage', 'amount']);
      expect(onColumnStateChange).toHaveBeenLastCalledWith([
        { key: 'owner' },
        { key: 'name' },
        { key: 'stage' },
        { key: 'amount' },
      ]);
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Deal/ }))
      );
      expect(
        container.querySelector('th[data-column-key="name"]')?.getAttribute('aria-colindex')
      ).toBe('2');
      expect(screen.getByText('Deal moved to position 2 of 4')).toBeTruthy();
    })();
    cleanup();
    // pins, resizes and hides from the menu, and Shift+F10 opens it too
    await (async () => {
      const onSortChange = vi.fn();
      const { container } = render(TypedColumnGrid, {
        props: {
          rows,
          columns,
          getRowId: (r: Row) => r.id,
          caption: 'Deals',
          sort: [{ key: 'stage', direction: 'asc' as const }],
          onSortChange,
        },
      });
      await menuFor('Stage');
      const open = async (header: string) => {
        const button = screen.getByRole('button', { name: new RegExp(`^${header}`) });
        button.focus();
        await fireEvent.keyDown(button, { key: 'F10', shiftKey: true });
        return screen.findByRole('menu');
      };
      let menu = await open('Stage');
      await fireEvent.click(within(menu).getByRole('menuitem', { name: 'Pin to start' }));
      expect(headers()).toEqual(['stage', 'name', 'owner', 'amount']);
      expect(
        (container.querySelector('th[data-column-key="stage"]') as HTMLElement).dataset.pin
      ).toBe('start');
      expect(screen.getByText('Stage pinned to the start')).toBeTruthy();

      menu = await open('Amount');
      await fireEvent.click(within(menu).getByRole('menuitem', { name: 'Wider' }));
      // Wider keeps the menu open, so it can repeat.
      expect(screen.getByRole('menu')).toBeTruthy();
      await fireEvent.click(
        within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Wider' })
      );
      expect(widths(container)[3]).toBe(184);
      expect(screen.getByText('Amount is 184 pixels wide')).toBeTruthy();
      await fireEvent.click(
        within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Reset width' })
      );
      expect(widths(container)[3]).toBe(120);

      menu = await open('Stage');
      await fireEvent.click(within(menu).getByRole('menuitem', { name: 'Hide column' }));
      expect(headers()).toEqual(['name', 'owner', 'amount']);
      expect(screen.getByText('Stage hidden')).toBeTruthy();
      // A hidden column stops sorting.
      expect(onSortChange).toHaveBeenLastCalledWith([]);
    })();
    cleanup();
    // shows and hides columns from the chooser, never the last one, and resets
    await (async () => {
      const onColumnStateChange = vi.fn();
      render(TypedColumnGrid, {
        props: {
          rows,
          columns,
          getRowId: (r: Row) => r.id,
          caption: 'Deals',
          columnState: [
            { key: 'owner', hidden: true },
            { key: 'stage', hidden: true },
            { key: 'name', hidden: true },
          ],
          onColumnStateChange,
        },
      });
      const toggle = screen.getByRole('button', { name: /^Columns/ });
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      await fireEvent.click(toggle);
      const chooser = screen.getByRole('group', { name: 'Columns' });
      const amount = within(chooser).getByRole('checkbox', { name: 'Amount' }) as HTMLInputElement;
      expect(amount.checked).toBe(true);
      expect(amount.disabled).toBe(true);
      await fireEvent.click(within(chooser).getByRole('checkbox', { name: 'Owner' }));
      // A shown column comes back at its place in the state order.
      expect(headers()).toEqual(['owner', 'amount']);
      expect(screen.getByText('Owner shown')).toBeTruthy();
      await fireEvent.click(within(chooser).getByRole('button', { name: 'Show all' }));
      expect(headers()).toEqual(['owner', 'stage', 'name', 'amount']);
      await fireEvent.click(within(chooser).getByRole('button', { name: 'Reset columns' }));
      expect(headers()).toEqual(['name', 'owner', 'stage', 'amount']);
      expect(onColumnStateChange).toHaveBeenLastCalledWith([
        { key: 'name' },
        { key: 'owner' },
        { key: 'stage' },
        { key: 'amount' },
      ]);
    })();
    cleanup();
    // resizes by dragging the header edge and resets on double click
    await (async () => {
      const { container } = render(TypedColumnGrid, {
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals' },
      });
      const handle = container.querySelector(
        'th[data-column-key="owner"] .tx-grid-columns__resize'
      ) as HTMLElement;
      expect(handle.getAttribute('aria-hidden')).toBe('true');
      await fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300 });
      await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 360 });
      await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 360 });
      expect(widths(container)[1]).toBe(200);
      expect(screen.getByText('Owner is 200 pixels wide')).toBeTruthy();
      await fireEvent.dblClick(handle);
      expect(widths(container)[1]).toBe(140);
    })();
    cleanup();
    // resizes toward the inline end in a right-to-left grid
    await (async () => {
      const target = document.body.appendChild(document.createElement('div'));
      target.dir = 'rtl';
      target.style.direction = 'rtl';
      const { container } = render(TypedColumnGrid, {
        target,
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals' },
      });
      const handle = container.querySelector(
        'th[data-column-key="owner"] .tx-grid-columns__resize'
      ) as HTMLElement;
      await fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 300 });
      await fireEvent.pointerMove(handle, { pointerId: 1, clientX: 260 });
      await fireEvent.pointerUp(handle, { pointerId: 1, clientX: 260 });
      expect(widths(container)[1]).toBe(180);
      target.remove();
    })();
    cleanup();
    // reorders by dragging a header, and the drag does not sort
    await (async () => {
      const onSortChange = vi.fn();
      const { container } = render(TypedColumnGrid, {
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals', onSortChange },
      });
      const ths = [...container.querySelectorAll<HTMLElement>('th[data-column-key]')];
      ths.forEach((th, index) => {
        th.getBoundingClientRect = () => ({
          left: index * 100,
          right: index * 100 + 100,
          top: 0,
          bottom: 40,
          width: 100,
          height: 40,
          x: index * 100,
          y: 0,
          toJSON: () => ({}),
        });
      });
      const amountButton = within(ths[3] as HTMLElement).getByRole('button', { name: /^Amount/ });
      await fireEvent.pointerDown(amountButton, { pointerId: 1, button: 0, clientX: 350 });
      await fireEvent.pointerMove(window, { pointerId: 1, clientX: 120 });
      expect(
        container.querySelector('th[data-column-key="owner"]')?.getAttribute('data-drop')
      ).toBe('before');
      await fireEvent.pointerUp(window, { pointerId: 1, clientX: 120 });
      await fireEvent.click(amountButton);
      expect(headers()).toEqual(['name', 'amount', 'owner', 'stage']);
      expect(onSortChange).not.toHaveBeenCalled();
      expect(screen.getByText('Amount moved to position 2 of 4')).toBeTruthy();
      // A plain click still sorts.
      await fireEvent.click(screen.getByRole('button', { name: /^Amount/ }));
      expect(onSortChange).toHaveBeenLastCalledWith([{ key: 'amount', direction: 'asc' }]);
    })();
    cleanup();
    // navigates the reordered columns by keyboard and searches only visible columns
    await (async () => {
      const { container } = render(TypedColumnGrid, {
        props: {
          rows,
          columns,
          getRowId: (r: Row) => r.id,
          caption: 'Deals',
          searchable: true,
          columnState: [{ key: 'amount' }, { key: 'owner', hidden: true }],
        },
      });
      const first = container.querySelector('[data-tx-grid-cell="1:0"]') as HTMLElement;
      first.focus();
      await fireEvent.keyDown(first, { key: 'ArrowRight' });
      expect(document.activeElement?.textContent).toBe('Harbor renewal');
      // "Ada" is only in the hidden Owner column.
      await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), {
        target: { value: 'Ada' },
      });
      expect(screen.getByText('0 of 3 rows')).toBeTruthy();
      await fireEvent.input(screen.getByRole('searchbox', { name: 'Search' }), {
        target: { value: 'lumen' },
      });
      expect(screen.getByText('1 of 3 rows')).toBeTruthy();
    })();
    cleanup();
    // offers no menu or chooser when every operation is off and columns are not sortable
    render(TypedColumnGrid, {
      props: {
        rows,
        columns: columns.map((column) => ({ ...column, sortable: false })),
        getRowId: (r: Row) => r.id,
        caption: 'Deals',
        resizable: false,
        reorderable: false,
        pinnable: false,
        hideable: false,
      },
    });
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    {
      // marks grouped grids so keyboard scrolling can clear both sticky header rows
      // A focused body row must stop below the group row AND the column header
      // row (5rem of sticky chrome), not under the second one.
      const plain = render(TypedColumnGrid, {
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals' },
      });
      expect(
        (plain.container.querySelector('[data-tx-grid-columns]') as HTMLElement).hasAttribute(
          'data-grouped'
        )
      ).toBe(false);
      plain.unmount();
      const grouped = render(TypedColumnGrid, {
        props: { rows, columns, getRowId: (r: Row) => r.id, caption: 'Deals', groups },
      });
      expect(
        (grouped.container.querySelector('[data-tx-grid-columns]') as HTMLElement).hasAttribute(
          'data-grouped'
        )
      ).toBe(true);
    }
    cleanup();
    {
      // doubles the sticky scroll padding on grouped grids in the stylesheet
      const css = readFileSync(
        join(process.cwd(), 'packages/data/src/grid-columns/grid-columns.css'),
        'utf8'
      );
      expect(css).toMatch(
        /\.tx-grid-columns\[data-grouped\] \.tx-table-wrap--sticky \{[^}]*scroll-padding-block-start: 5rem;/
      );
    }
  }, 20_000);
});

describe('ColumnGrid per-column classes (G107)', () => {
  it('adds class to body cells and headerClass to the header, keeping its own classes', () => {
    const styled: DataGridColumn<Row>[] = [
      { key: 'name', header: 'Deal', type: 'text', class: 'cell-name', headerClass: 'head-name' },
      { key: 'amount', header: 'Amount', type: 'number' },
    ];
    const { container } = render(TypedColumnGrid, {
      props: { rows, columns: styled, getRowId: (r: Row) => r.id, caption: 'Deals' },
    });
    const head = container.querySelector('th[data-column-key="name"]') as HTMLElement;
    expect(head.classList.contains('head-name')).toBe(true);
    expect(head.classList.contains('tx-grid-columns__head')).toBe(true);
    const bodyRows = [...container.querySelectorAll('tbody tr')];
    expect(bodyRows).toHaveLength(3);
    for (const row of bodyRows) {
      const [name, amount] = [...row.querySelectorAll('td')];
      expect(name?.classList.contains('cell-name')).toBe(true);
      expect(name?.classList.contains('tx-grid-columns__cell')).toBe(true);
      expect(amount?.classList.contains('cell-name')).toBe(false);
    }
    cleanup();
  });
});
