import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import {
  moveVirtualCell,
  type VirtualGridColumn,
  virtualGridWindow,
} from '../src/grid-virtual/index.ts';
import VirtualDataGrid from '../src/grid-virtual/VirtualDataGrid.svelte';

const columns: VirtualGridColumn[] = Array.from({ length: 40 }, (_, index) => ({
  key: `column-${index}`,
  header: `Column ${index + 1}`,
  width: 100,
}));

describe('virtual grid window', () => {
  it('keeps 100,000 rows and wide columns bounded to the viewport', () => {
    const window = virtualGridWindow({
      rowCount: 100_000,
      columns,
      rowSize: 32,
      scrollTop: 320_000,
      scrollLeft: 1_200,
      viewportHeight: 320,
      viewportWidth: 400,
      overscanRows: 2,
      overscanColumns: 1,
    });
    expect(window.totalHeight).toBe(3_200_000);
    expect(window.totalWidth).toBe(4_000);
    expect(window.rows.items.length).toBeLessThanOrEqual(15);
    expect(window.columns.items.length).toBeLessThanOrEqual(7);
    expect(window.rows.items[0]?.index).toBe(9_998);
    expect(window.columns.items[0]?.index).toBe(11);
  });

  it('moves within bounds and mirrors horizontal keys in RTL', () => {
    const options = { rows: 100_000, columns: 40, pageSize: 8 };
    expect(moveVirtualCell({ row: 50, col: 4 }, 'ArrowRight', options)).toEqual({
      row: 50,
      col: 5,
    });
    expect(moveVirtualCell({ row: 50, col: 4 }, 'ArrowRight', { ...options, rtl: true })).toEqual({
      row: 50,
      col: 3,
    });
    expect(moveVirtualCell({ row: 0, col: 0 }, 'ArrowLeft', options)).toBeNull();
    expect(moveVirtualCell({ row: 99_999, col: 39 }, 'ArrowDown', options)).toBeNull();
    expect(moveVirtualCell({ row: 50, col: 4 }, 'End', options)).toEqual({ row: 50, col: 39 });
    expect(moveVirtualCell({ row: 50, col: 4 }, 'PageDown', options)).toEqual({ row: 58, col: 4 });
  });

  it('reaches the grid corners with Ctrl+Home and Ctrl+End like moveCell', () => {
    const options = { rows: 10, columns: 5, pageSize: 4 };
    expect(moveVirtualCell({ row: 2, col: 1 }, 'Home', { ...options, ctrl: true })).toEqual({
      row: 0,
      col: 0,
    });
    expect(moveVirtualCell({ row: 2, col: 1 }, 'End', { ...options, ctrl: true })).toEqual({
      row: 9,
      col: 4,
    });
    // Without the modifier, Home and End keep the row.
    expect(moveVirtualCell({ row: 2, col: 1 }, 'Home', options)).toEqual({ row: 2, col: 0 });
    expect(moveVirtualCell({ row: 2, col: 1 }, 'End', options)).toEqual({ row: 2, col: 4 });
  });
});

describe('VirtualDataGrid', () => {
  it('renders only visible cells from 100,000 rows with complete grid counts', () => {
    const rows = Array.from({ length: 100_000 }, (_, index) => ({
      id: `r-${index}`,
      value: `Row ${index}`,
    }));
    const { container } = render(VirtualDataGrid, {
      props: {
        rows,
        columns: [
          { key: 'value', header: 'Value', width: 100 },
          { key: 'id', header: 'ID', width: 100 },
          { key: 'value', header: 'Copy', width: 100 },
        ],
        getRowId: (row: unknown) => (row as { id: string }).id,
        caption: 'Large records',
        viewportHeight: 120,
        viewportWidth: 200,
        rowSize: 30,
        overscanRows: 1,
        overscanColumns: 0,
      },
    });
    const grid = screen.getByRole('grid', { name: 'Large records' });
    expect(grid.getAttribute('aria-rowcount')).toBe('100001');
    expect(grid.getAttribute('aria-colcount')).toBe('3');
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(10);
    expect(container.querySelectorAll('[role="row"]')).toHaveLength(6);
    expect(container.querySelectorAll('[role="columnheader"]')).toHaveLength(2);
  });

  it('keeps a single tab stop and updates the active cell with RTL keyboard movement', async () => {
    const { container } = render(VirtualDataGrid, {
      props: {
        rows: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'id', header: 'ID' },
        ],
        getRowId: (row: unknown) => (row as { id: string }).id,
        caption: 'RTL records',
        viewportHeight: 120,
        viewportWidth: 320,
      },
    });
    const grid = screen.getByRole('grid', { name: 'RTL records' });
    container.dir = 'rtl';
    grid.style.direction = 'rtl';
    grid.focus();
    await fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    const secondCell = grid.querySelector('[aria-rowindex="2"] [aria-colindex="2"]');
    expect(grid.getAttribute('aria-activedescendant')).toBe(secondCell?.id);
    expect(grid.tabIndex).toBe(0);
  });

  it('scopes cell ids to the component instance so two grids never collide', () => {
    const shared = {
      rows: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      columns: [
        { key: 'name', header: 'Name' },
        { key: 'id', header: 'ID' },
      ],
      getRowId: (row: unknown) => (row as { id: string }).id,
      viewportHeight: 120,
      viewportWidth: 320,
    };
    render(VirtualDataGrid, { props: { ...shared, caption: 'First grid' } });
    render(VirtualDataGrid, { props: { ...shared, caption: 'Second grid' } });

    const grids = [
      screen.getByRole('grid', { name: 'First grid' }),
      screen.getByRole('grid', { name: 'Second grid' }),
    ];
    const ids = grids.flatMap((grid) =>
      [...grid.querySelectorAll<HTMLElement>('[id]')].map((element) => element.id)
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const grid of grids) {
      const activeId = grid.getAttribute('aria-activedescendant') ?? '';
      expect(grid.querySelector(`[id="${activeId}"]`)).not.toBeNull();
    }
  });

  it('marks the active cell so sighted keyboard users can see it', async () => {
    const { container } = render(VirtualDataGrid, {
      props: {
        rows: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'id', header: 'ID' },
        ],
        getRowId: (row: unknown) => (row as { id: string }).id,
        caption: 'Active records',
        viewportHeight: 120,
        viewportWidth: 320,
      },
    });
    const grid = screen.getByRole('grid', { name: 'Active records' });
    // The active cell starts on the first body cell and is marked from the start.
    const initial = container.querySelector<HTMLElement>('[data-tx-active="true"]');
    expect(initial?.getAttribute('role')).toBe('gridcell');
    expect(initial?.closest('[role="row"]')?.getAttribute('aria-rowindex')).toBe('2');
    grid.focus();
    await fireEvent.keyDown(grid, { key: 'ArrowDown' });
    const marked = container.querySelector<HTMLElement>('[data-tx-active="true"]');
    expect(marked?.getAttribute('role')).toBe('gridcell');
    expect(marked?.closest('[role="row"]')?.getAttribute('aria-rowindex')).toBe('3');
    expect(marked?.getAttribute('aria-colindex')).toBe('1');
    expect(grid.getAttribute('aria-activedescendant')).toBe(marked?.id);
  });

  it('moves to the grid corners with Ctrl+Home and Ctrl+End', async () => {
    render(VirtualDataGrid, {
      props: {
        rows: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
        columns: [
          { key: 'name', header: 'Name' },
          { key: 'id', header: 'ID' },
        ],
        getRowId: (row: unknown) => (row as { id: string }).id,
        caption: 'Corner records',
        viewportHeight: 120,
        viewportWidth: 320,
      },
    });
    const grid = screen.getByRole('grid', { name: 'Corner records' });
    grid.focus();
    await fireEvent.keyDown(grid, { key: 'End', ctrlKey: true });
    const lastCell = grid.querySelector(
      '[aria-rowindex="3"] [aria-colindex="2"]'
    ) as HTMLElement | null;
    expect(grid.getAttribute('aria-activedescendant')).toBe(lastCell?.id);
    await fireEvent.keyDown(grid, { key: 'Home', ctrlKey: true });
    // Ctrl+Home goes to the first body cell: the header row is not addressable.
    const firstCell = grid.querySelector(
      '[aria-rowindex="2"] [aria-colindex="1"]'
    ) as HTMLElement | null;
    expect(grid.getAttribute('aria-activedescendant')).toBe(firstCell?.id);
  });
});
