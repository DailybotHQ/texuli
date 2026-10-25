import { createAxis, type GridWindow, windowGrid } from '../engines/grid/virtual.ts';

export interface VirtualGridColumn {
  key: string;
  header: string;
  width?: number;
}

export interface VirtualGridOptions {
  rowCount: number;
  columns: readonly VirtualGridColumn[];
  rowSize?: number;
  overscanRows?: number;
  overscanColumns?: number;
}

export interface VirtualCellPosition {
  row: number;
  col: number;
}

/** A bounded two-axis render range; row and column counts may be very large. */
export function virtualGridWindow(
  options: VirtualGridOptions & {
    scrollTop: number;
    scrollLeft: number;
    viewportHeight: number;
    viewportWidth: number;
  }
): GridWindow {
  const widths = options.columns.map((column) =>
    Number.isFinite(column.width) && (column.width as number) > 0 ? (column.width as number) : 160
  );
  const rowAxis = createAxis({ count: options.rowCount, size: options.rowSize ?? 36 });
  const columns = createAxis({
    count: widths.length,
    size: 1,
    sizes: new Map(widths.map((width, index) => [index, width])),
  });
  return windowGrid({
    rows: rowAxis,
    columns,
    scrollTop: options.scrollTop,
    scrollLeft: options.scrollLeft,
    viewportHeight: options.viewportHeight,
    viewportWidth: options.viewportWidth,
    overscanRows: options.overscanRows,
    overscanColumns: options.overscanColumns,
  });
}

/** Move one cell with spreadsheet-style arrows, Home/End and page keys. */
export function moveVirtualCell(
  position: VirtualCellPosition,
  key: string,
  options: { rows: number; columns: number; pageSize: number; rtl?: boolean }
): VirtualCellPosition | null {
  const rowMax = Math.max(0, Math.floor(options.rows) - 1);
  const colMax = Math.max(0, Math.floor(options.columns) - 1);
  const row = Math.max(0, Math.min(rowMax, Math.floor(position.row)));
  const col = Math.max(0, Math.min(colMax, Math.floor(position.col)));
  const horizontal =
    key === 'ArrowRight'
      ? options.rtl
        ? -1
        : 1
      : key === 'ArrowLeft'
        ? options.rtl
          ? 1
          : -1
        : 0;
  let next: VirtualCellPosition | null = null;
  if (horizontal) next = { row, col: Math.max(0, Math.min(colMax, col + horizontal)) };
  else if (key === 'ArrowDown') next = { row: Math.min(rowMax, row + 1), col };
  else if (key === 'ArrowUp') next = { row: Math.max(0, row - 1), col };
  else if (key === 'Home') next = { row, col: 0 };
  else if (key === 'End') next = { row, col: colMax };
  else if (key === 'PageDown')
    next = { row: Math.min(rowMax, row + Math.max(1, options.pageSize)), col };
  else if (key === 'PageUp') next = { row: Math.max(0, row - Math.max(1, options.pageSize)), col };
  return next && (next.row !== row || next.col !== col) ? next : null;
}
