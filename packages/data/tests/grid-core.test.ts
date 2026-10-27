import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import {
  ariaSort,
  cellText,
  clampCell,
  type DataGridColumn,
  gridRows,
  moveCell,
  nextSort,
  resolveDataGridLabels,
  searchRows,
} from '../src/grid-core/index.ts';
import DataGridHarness from './fixtures/DataGridHarness.svelte';

type Row = { id: string; name: string; amount: number | null; when?: string | Date };
const columns: DataGridColumn<Row>[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'amount', header: 'Amount', type: 'number' },
  { key: 'when', header: 'When', type: 'date' },
];
const rows: Row[] = [
  { id: 'a', name: 'Café Ñandú', amount: 30, when: '2026-01-02' },
  { id: 'b', name: 'harbor notes', amount: 10 },
  { id: 'c', name: 'Harbor Lights', amount: null, when: new Date('2026-03-04T00:00:00Z') },
];

describe('grid-core model', () => {
  it('cycles a header through ascending, descending and none, and 9 related cases', () => {
    {
      // cycles a header through ascending, descending and none
      let sort = nextSort([], 'name');
      expect(sort).toEqual([{ key: 'name', direction: 'asc' }]);
      sort = nextSort(sort, 'name');
      expect(sort).toEqual([{ key: 'name', direction: 'desc' }]);
      expect(nextSort(sort, 'name')).toEqual([]);
      // A plain activation replaces other keys.
      expect(nextSort([{ key: 'amount', direction: 'asc' }], 'name')).toEqual([
        { key: 'name', direction: 'asc' },
      ]);
    }
    cleanup();
    {
      // adds, cycles and removes keys with Shift (additive)
      let sort = nextSort([{ key: 'amount', direction: 'asc' }], 'name', true);
      expect(sort).toEqual([
        { key: 'amount', direction: 'asc' },
        { key: 'name', direction: 'asc' },
      ]);
      sort = nextSort(sort, 'name', true);
      expect(sort[1]).toEqual({ key: 'name', direction: 'desc' });
      expect(nextSort(sort, 'name', true)).toEqual([{ key: 'amount', direction: 'asc' }]);
    }
    cleanup();
    {
      // announces only the primary sort key
      const sort = [
        { key: 'name', direction: 'desc' as const },
        { key: 'amount', direction: 'asc' as const },
      ];
      expect(ariaSort(sort, 'name')).toBe('descending');
      expect(ariaSort(sort, 'amount')).toBe('none');
      expect(ariaSort([{ key: 'amount', direction: 'asc' }], 'amount')).toBe('ascending');
    }
    cleanup();
    // searches every word, ignoring case and accents, in searchable columns
    expect(searchRows(rows, columns, 'harbor').map((row) => row.id)).toEqual(['b', 'c']);
    expect(searchRows(rows, columns, 'HARBOR  lights').map((row) => row.id)).toEqual(['c']);
    expect(searchRows(rows, columns, 'cafe nandu').map((row) => row.id)).toEqual(['a']);
    // Numbers are not searchable by default.
    expect(searchRows(rows, columns, '30')).toEqual([]);
    expect(searchRows(rows, columns, '   ')).toHaveLength(3);
    cleanup();
    {
      // filters with the engine AST, searches, then sorts stably
      const filter = { type: 'condition', field: 'amount', operator: 'between', value: [10, 100] };
      const result = gridRows(rows, {
        columns,
        filter,
        sort: [{ key: 'amount', direction: 'desc' }],
      });
      expect(result.map((row) => row.id)).toEqual(['a', 'b']);
      expect(
        gridRows(rows, {
          columns,
          search: 'harbor',
          sort: [{ key: 'name', direction: 'asc' }],
        }).map((row) => row.id)
      ).toEqual(['c', 'b']);
    }
    cleanup();
    // rejects an invalid filter instead of guessing
    expect(() =>
      gridRows(rows, {
        columns,
        filter: { type: 'condition', field: 'nope', operator: 'eq', value: 1 },
      })
    ).toThrow();
    expect(() =>
      gridRows(rows, {
        columns,
        filter: { type: 'condition', field: 'name', operator: 'before', value: 'x' },
      })
    ).toThrow();
    cleanup();
    {
      // formats cells as plain text
      expect(cellText(rows[0] as Row, columns[1] as DataGridColumn<Row>)).toBe('30');
      expect(cellText(rows[2] as Row, columns[1] as DataGridColumn<Row>)).toBe('');
      expect(cellText(rows[2] as Row, columns[2] as DataGridColumn<Row>)).toBe('2026-03-04');
      expect(cellText(rows[1] as Row, columns[2] as DataGridColumn<Row>)).toBe('');
      const formatted: DataGridColumn<Row> = {
        ...(columns[1] as DataGridColumn<Row>),
        format: (value) => `$${value}`,
      };
      expect(cellText(rows[0] as Row, formatted)).toBe('$30');
    }
    cleanup();
    {
      // moves the focused cell like an APG grid
      const options = { rows: 5, cols: 4 };
      const at = { row: 2, col: 1 };
      const key = (key: string, mods: Partial<KeyboardEvent> = {}) =>
        moveCell(at, { key, ctrlKey: false, metaKey: false, ...mods } as KeyboardEvent, options);
      expect(key('ArrowDown')).toEqual({ row: 3, col: 1 });
      expect(key('ArrowUp')).toEqual({ row: 1, col: 1 });
      expect(key('ArrowRight')).toEqual({ row: 2, col: 2 });
      expect(key('ArrowLeft')).toEqual({ row: 2, col: 0 });
      expect(key('Home')).toEqual({ row: 2, col: 0 });
      expect(key('End')).toEqual({ row: 2, col: 3 });
      expect(key('Home', { ctrlKey: true })).toEqual({ row: 0, col: 0 });
      expect(key('End', { metaKey: true })).toEqual({ row: 4, col: 3 });
      expect(key('PageDown')).toEqual({ row: 4, col: 1 });
      expect(key('PageUp')).toEqual({ row: 0, col: 1 });
      expect(key('a')).toBeNull();
    }
    cleanup();
    {
      // stops at the edges and mirrors left and right in RTL
      const edge = { row: 0, col: 0 };
      const press = (key: string, rtl = false) =>
        moveCell(edge, { key, ctrlKey: false, metaKey: false } as KeyboardEvent, {
          rows: 3,
          cols: 3,
          rtl,
        });
      expect(press('ArrowUp')).toEqual(edge);
      expect(press('ArrowLeft')).toEqual(edge);
      expect(press('ArrowLeft', true)).toEqual({ row: 0, col: 1 });
      expect(press('ArrowRight', true)).toEqual(edge);
      expect(clampCell({ row: 9, col: 9 }, 3, 2)).toEqual({ row: 2, col: 1 });
      expect(clampCell({ row: -1, col: -4 }, 0, 0)).toEqual({ row: 0, col: 0 });
    }
    cleanup();
    {
      // merges label overrides of the right type only
      const labels = resolveDataGridLabels({ search: 'Buscar', rowCount: 3 as never });
      expect(labels.search).toBe('Buscar');
      expect(labels.rowCount(2, 4)).toBe('2 of 4 rows');
      expect(labels.rowCount(1, 1)).toBe('1 row');
    }
  });
});

const grid = () => screen.getByRole('grid', { name: 'Deals' });
const statusLine = () => document.querySelector('.tx-data-grid__status') as HTMLElement;
const bodyNames = () =>
  within(grid())
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('gridcell')[1]?.textContent?.trim());
const press = async (key: string, init: KeyboardEventInit = {}) => {
  await fireEvent.keyDown(document.activeElement ?? document.body, { key, ...init });
  await tick();
  await tick();
};

describe('DataGrid', () => {
  it('renders deterministic vector sort indicators instead of font-dependent glyphs, and 12 related cases', async () => {
    {
      // renders deterministic vector sort indicators instead of font-dependent glyphs
      render(DataGridHarness);
      const icon = document.querySelector('.tx-data-grid__sort-icon');

      expect(icon?.querySelector('svg[aria-hidden="true"] path')).toBeTruthy();
      expect(icon?.textContent?.trim()).toBe('');
    }
    cleanup();
    {
      // renders an APG grid named by its caption, with counts and a description
      render(DataGridHarness);
      const table = grid();
      expect(table.tagName).toBe('TABLE');
      expect(table.getAttribute('aria-colcount')).toBe('6');
      expect(table.getAttribute('aria-rowcount')).toBe('5');
      expect(table.getAttribute('aria-multiselectable')).toBe('true');
      expect(table.getAttribute('aria-describedby')).toBeTruthy();
      expect(within(table).getAllByRole('columnheader')).toHaveLength(6);
      expect(within(table).getAllByRole('gridcell')).toHaveLength(24);
      expect(statusLine().textContent).toContain('4 rows');
    }
    cleanup();
    {
      // keeps exactly one tab stop in the grid
      const { container } = render(DataGridHarness);
      const stops = container.querySelectorAll('table [tabindex="0"]');
      expect(stops).toHaveLength(1);
      expect(stops[0]?.getAttribute('aria-label')).toBe('Select all rows');
    }
    cleanup();
    // sorts from the header button, cycling aria-sort, and adds keys with Shift
    await (async () => {
      render(DataGridHarness);
      const amount = screen.getByRole('button', { name: /Amount/ });
      const header = amount.closest('th') as HTMLElement;
      expect(header.getAttribute('aria-sort')).toBe('none');
      await fireEvent.click(amount);
      expect(header.getAttribute('aria-sort')).toBe('ascending');
      expect(bodyNames()).toEqual([
        'Quill & Pine',
        'Lumen Atlas pilot',
        'Harbor Notes renewal',
        'Café Ñandú',
      ]);
      await fireEvent.click(amount);
      expect(header.getAttribute('aria-sort')).toBe('descending');
      expect(bodyNames()[0]).toBe('Café Ñandú');
      const owner = screen.getByRole('button', { name: /Owner/ });
      await fireEvent.click(owner, { shiftKey: true });
      expect(screen.getByTestId('state').textContent).toContain(
        '"sort":[{"key":"amount","direction":"desc"},{"key":"owner","direction":"asc"}]'
      );
      // Only the primary key is announced.
      expect(owner.closest('th')?.getAttribute('aria-sort')).toBe('none');
      // A plain click on the descending primary key clears every key.
      await fireEvent.click(amount);
      expect(header.getAttribute('aria-sort')).toBe('none');
      expect(screen.getByTestId('state').textContent).toContain('"sort":[]');
    })();
    cleanup();
    {
      // leaves non-sortable headers without a button or aria-sort
      render(DataGridHarness);
      const stage = within(grid()).getByRole('columnheader', { name: 'Stage' });
      expect(within(stage).queryByRole('button')).toBeNull();
      expect(stage.hasAttribute('aria-sort')).toBe(false);
    }
    cleanup();
    // searches as you type and announces the count
    await (async () => {
      render(DataGridHarness);
      const box = screen.getByRole('searchbox', { name: 'Search' });
      await fireEvent.input(box, { target: { value: 'cafe' } });
      await waitFor(() => expect(bodyNames()).toEqual(['Café Ñandú']));
      expect(statusLine().textContent).toContain('1 of 4 rows');
      await fireEvent.input(box, { target: { value: 'zzz' } });
      await waitFor(() => expect(within(grid()).getByText('No rows match.')).toBeTruthy());
    })();
    cleanup();
    // applies a filter AST
    render(DataGridHarness, {
      props: { filter: { type: 'condition', field: 'owner', operator: 'eq', value: 'Ada' } },
    });
    expect(bodyNames()).toEqual(['Harbor Notes renewal', 'Quill & Pine']);
    cleanup();
    // moves focus between cells with the APG keys
    await (async () => {
      render(DataGridHarness);
      const selectAll = screen.getByRole('checkbox', { name: 'Select all rows' });
      selectAll.focus();
      await press('ArrowRight');
      expect(document.activeElement?.textContent).toContain('Deal');
      await press('ArrowDown');
      expect(document.activeElement?.textContent?.trim()).toBe('Harbor Notes renewal');
      expect(document.activeElement?.getAttribute('role')).toBe('gridcell');
      await press('End');
      expect(document.activeElement?.textContent?.trim()).toBe('2026-01-15');
      await press('End', { ctrlKey: true });
      expect(document.activeElement?.textContent?.trim()).toBe('2026-04-20');
      await press('Home');
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Select Café Ñandú');
      await press('Home', { ctrlKey: true });
      expect(document.activeElement).toBe(selectAll);
      expect(document.querySelectorAll('table [tabindex="0"]')).toHaveLength(1);
    })();
    cleanup();
    // selects rows with Space, Shift for a range, and the header checkbox
    await (async () => {
      render(DataGridHarness);
      screen.getByRole('checkbox', { name: 'Select all rows' }).focus();
      await press('ArrowDown');
      await press('ArrowRight');
      await press(' ');
      const rowsEls = within(grid()).getAllByRole('row').slice(1);
      expect(rowsEls[0]?.getAttribute('aria-selected')).toBe('true');
      await press('ArrowDown');
      await press('ArrowDown');
      await press(' ', { shiftKey: true });
      expect(rowsEls.map((row) => row.getAttribute('aria-selected'))).toEqual([
        'true',
        'true',
        'true',
        'false',
      ]);
      const all = screen.getByRole('checkbox', { name: 'Select all rows' }) as HTMLInputElement;
      expect(all.indeterminate).toBe(true);
      expect(statusLine().textContent?.trim()).toBe('4 rows · 3 selected');
      await fireEvent.click(all);
      expect(rowsEls.every((row) => row.getAttribute('aria-selected') === 'true')).toBe(true);
      await fireEvent.click(all);
      expect(rowsEls.every((row) => row.getAttribute('aria-selected') === 'false')).toBe(true);
    })();
    cleanup();
    // toggles every visible row with Ctrl or Cmd plus A, and a row checkbox by click
    await (async () => {
      render(DataGridHarness);
      screen.getByRole('checkbox', { name: 'Select all rows' }).focus();
      await press('ArrowDown');
      await press('a', { metaKey: true });
      expect(screen.getByTestId('state').textContent).toContain('"selected":["d1","d2","d3","d4"]');
      await press('a', { ctrlKey: true });
      expect(screen.getByTestId('state').textContent).toContain('"selected":[]');
      await fireEvent.click(screen.getByRole('checkbox', { name: 'Select Lumen Atlas pilot' }));
      expect(screen.getByTestId('state').textContent).toContain('"selected":["d2"]');
    })();
    cleanup();
    // activates a row with Enter on a body cell
    await (async () => {
      const activated: string[] = [];
      render(DataGridHarness, { props: { activated } });
      screen.getByRole('checkbox', { name: 'Select all rows' }).focus();
      await press('ArrowDown');
      await press('ArrowRight');
      await press('Enter');
      expect(activated).toEqual(['d1']);
    })();
    cleanup();
    {
      // shows loading, empty and translated text
      const view = render(DataGridHarness, { props: { loading: true } });
      expect(within(grid()).getByText('Loading rows…')).toBeTruthy();
      expect(grid().getAttribute('aria-busy')).toBe('true');
      view.unmount();
      render(DataGridHarness, {
        props: {
          rows: [],
          labels: { noResults: 'Sin filas.', search: 'Buscar', selectAll: 'Todas' },
        },
      });
      expect(within(grid()).getByText('Sin filas.')).toBeTruthy();
      expect(screen.getByRole('searchbox', { name: 'Buscar' })).toBeTruthy();
      expect((screen.getByRole('checkbox', { name: 'Todas' }) as HTMLInputElement).disabled).toBe(
        true
      );
    }
    cleanup();
    // renders cell values as text, never markup
    render(DataGridHarness, {
      props: {
        rows: [
          {
            id: 'x',
            name: '<img src=x onerror=alert(1)>',
            owner: '<b>me</b>',
            stage: 'open',
            amount: 1,
            closes: '2026-01-01',
          },
        ],
      },
    });
    expect(grid().querySelector('img, b')).toBeNull();
    expect(bodyNames()).toEqual(['<img src=x onerror=alert(1)>']);
  }, 20_000);
});

const manyDeals = Array.from({ length: 30 }, (_, index) => ({
  id: `v${index}`,
  name: `Deal ${index}`,
  owner: 'Ada',
  stage: 'open',
  amount: index * 10,
  closes: '2026-01-01',
}));
const scrollArea = () => document.querySelector('.tx-table-wrap') as HTMLElement;

async function scrollBy(scrollTop: number): Promise<void> {
  const area = scrollArea();
  area.scrollTop = scrollTop;
  area.dispatchEvent(new Event('scroll', { bubbles: true }));
  await tick();
  await tick();
}

describe('DataGrid windowing', () => {
  it('renders the rows in view plus overscan and spacers for the rest, and 2 related cases', async () => {
    // renders the rows in view plus overscan and spacers for the rest
    await (async () => {
      render(DataGridHarness, { props: { rows: manyDeals, virtualizeAbove: 0 } });
      expect(document.querySelector('[data-tx-data-grid]')?.getAttribute('data-virtual')).toBe(
        'true'
      );
      expect(grid().getAttribute('aria-rowcount')).toBe('31');
      // Viewport 360px at rowSize 36 = 10 rows, plus 4 above and 4 below overscan.
      const body = document.querySelector('.tx-table__body') as HTMLElement;
      const dataRows = body.querySelectorAll('tr:not(.tx-data-grid__spacer)');
      expect(dataRows).toHaveLength(14);
      const spacers = body.querySelectorAll('.tx-data-grid__spacer');
      expect(spacers).toHaveLength(1);
      const spacerCell = body.querySelector('.tx-data-grid__spacer > td') as HTMLElement | null;
      expect(spacerCell?.style.blockSize).toBe('576px');
      // Following the scroll moves the window.
      await scrollBy(360);
      expect(
        (document.querySelector('[data-tx-grid-cell="11:1"]') as HTMLElement).textContent?.trim()
      ).toBe('Deal 10');
    })();
    cleanup();
    // keeps the focused row rendered while the window scrolls past it
    await (async () => {
      render(DataGridHarness, { props: { rows: manyDeals, virtualizeAbove: 0 } });
      (document.querySelector('[data-tx-grid-cell="1:0"]') as HTMLElement).focus();
      await tick();
      await scrollBy(720);
      // The window moved to rows 16-29, and the focused row is still rendered.
      expect(
        (document.querySelector('[data-tx-grid-cell="21:1"]') as HTMLElement).textContent?.trim()
      ).toBe('Deal 20');
      expect(document.querySelector('[data-tx-grid-cell="1:0"]')).toBeTruthy();
      // Exactly one tab stop still, with the focused cell carrying it.
      expect(document.querySelectorAll('table [tabindex="0"]')).toHaveLength(1);
    })();
    cleanup();
    {
      // keeps windowed rows on one line so the rowSize math holds at every width
      // Windowed grids derive row positions from `rowSize`; a wrapped row is
      // taller and breaks the scroll math (spacers assume single-line rows), so
      // windowed cells never wrap — the table scrolls sideways instead.
      const css = readFileSync(
        join(process.cwd(), 'packages/data/src/grid-core/grid-core.css'),
        'utf8'
      );
      expect(css).toMatch(/\.tx-data-grid\[data-virtual\][^{]*\{[^}]*white-space: nowrap;/);
    }
  });
});
