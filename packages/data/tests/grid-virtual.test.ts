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
    expect(grid.getAttribute('aria-activedescendant')).toBe('tx-virtual-grid-0-1');
    expect(grid.tabIndex).toBe(0);
  });
});
