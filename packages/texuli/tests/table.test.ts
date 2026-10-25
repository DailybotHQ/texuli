import { cleanup, render } from '@testing-library/svelte';
import { createRawSnippet, flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fillStackLabels, isScrollable } from '../src/components/table/labels.ts';
import TableCaption from '../src/components/table/TableCaption.svelte';
import TableCell from '../src/components/table/TableCell.svelte';
import TableEmpty from '../src/components/table/TableEmpty.svelte';
import TableHead from '../src/components/table/TableHead.svelte';
import TableRow from '../src/components/table/TableRow.svelte';
import {
  TABLE_DENSITIES,
  TABLE_STACKS,
  TABLE_VARIANTS,
  tableClass,
} from '../src/components/table/variants.ts';
import TableFixture from './fixtures/TableHarness.svelte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const text = (value: string) =>
  createRawSnippet(() => ({
    render: () => `<span>${value}</span>`,
  }));

function markup(html: string): HTMLTableElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector('table') as HTMLTableElement;
}

describe('tableClass', () => {
  it('maps every variant, density and stack to its class', () => {
    expect(tableClass()).toBe('tx-table');
    expect(tableClass({ variant: 'striped' })).toBe('tx-table tx-table--striped');
    expect(tableClass({ variant: 'grid' })).toBe('tx-table tx-table--grid');
    expect(tableClass({ density: 'compact' })).toBe('tx-table tx-table--compact');
    expect(tableClass({ density: 'comfortable' })).toBe('tx-table tx-table--comfortable');
    expect(tableClass({ stack: 'sm' })).toBe('tx-table tx-table--stack-sm');
    expect(tableClass({ stack: 'md', class: 'mine' })).toBe('tx-table tx-table--stack-md mine');
  });
});

describe('Table', () => {
  it('renders a semantic table with caption, sections, header scopes and data attributes', () => {
    const view = render(TableFixture);
    const table = view.getByRole('table', { name: 'Invoices' });
    expect(table.tagName).toBe('TABLE');
    expect(table.getAttribute('data-variant')).toBe('plain');
    expect(table.getAttribute('data-density')).toBe('default');
    expect(table.hasAttribute('role')).toBe(false);
    expect(table.querySelector('thead')).toBeTruthy();
    expect(table.querySelector('tbody')).toBeTruthy();
    expect(table.querySelector('tfoot')).toBeTruthy();
    const columns = view.getAllByRole('columnheader');
    expect(columns.map((cell) => cell.textContent?.trim())).toEqual([
      'Invoice',
      'Customer',
      'Amount',
    ]);
    expect(columns.every((cell) => cell.getAttribute('scope') === 'col')).toBe(true);
    const rowHeader = view.getByRole('rowheader', { name: 'Total' });
    expect(rowHeader.getAttribute('scope')).toBe('row');
    expect(rowHeader.getAttribute('colspan')).toBe('2');
    // Without stacking, no explicit roles clutter the native table.
    expect(table.querySelector('[role]')).toBeNull();
  });

  it('renders every variant and density', () => {
    for (const variant of TABLE_VARIANTS) {
      for (const density of TABLE_DENSITIES) {
        const view = render(TableFixture, { props: { variant, density } });
        const table = view.container.querySelector('table') as HTMLTableElement;
        expect(table.getAttribute('data-variant')).toBe(variant);
        expect(table.getAttribute('data-density')).toBe(density);
        expect(table.className).toBe(tableClass({ variant, density }));
        view.unmount();
      }
    }
  });

  it('puts class on the table and wrapperClass on the scroll wrapper, and forwards attributes', () => {
    const view = render(TableFixture, {
      props: { class: 'mine', wrapperClass: 'outer', id: 'invoices' },
    });
    const table = view.container.querySelector('table') as HTMLTableElement;
    expect(table.classList.contains('mine')).toBe(true);
    expect(table.id).toBe('invoices');
    const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
    expect(wrap.classList.contains('outer')).toBe(true);
    expect(wrap.classList.contains('tx-table-wrap')).toBe(true);
  });

  it('marks a busy table with aria-busy only while busy', () => {
    const view = render(TableFixture, { props: { busy: true } });
    expect(view.getByRole('table').getAttribute('aria-busy')).toBe('true');
    view.unmount();
    const idle = render(TableFixture);
    expect(idle.getByRole('table').hasAttribute('aria-busy')).toBe(false);
  });

  it('applies the sticky header and a safe height cap', () => {
    const view = render(TableFixture, { props: { stickyHeader: true, maxBlockSize: ' 20rem ' } });
    const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
    expect(wrap.classList.contains('tx-table-wrap--sticky')).toBe(true);
    expect(wrap.classList.contains('tx-table-wrap--capped')).toBe(true);
    expect(wrap.getAttribute('style')).toMatch(/^max-block-size: 20rem;?$/);
  });

  it('ignores a height that is not a plain length', () => {
    for (const unsafe of ['20rem; color: red', 'calc(1px)', 'url(x)', '-5px', 'tall']) {
      const view = render(TableFixture, { props: { maxBlockSize: unsafe } });
      const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
      expect(wrap.hasAttribute('style')).toBe(false);
      expect(wrap.classList.contains('tx-table-wrap--capped')).toBe(false);
      view.unmount();
    }
  });

  it('is a plain, unfocusable wrapper while the table fits', () => {
    const view = render(TableFixture);
    const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
    expect(wrap.hasAttribute('tabindex')).toBe(false);
    expect(wrap.hasAttribute('role')).toBe(false);
  });

  it('becomes a focusable region named by its label when the table overflows', () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const view = render(TableFixture, { props: { label: 'Invoices, scrollable' } });
    const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
    expect(wrap.hasAttribute('tabindex')).toBe(false);
    Object.defineProperty(wrap, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(wrap, 'clientWidth', { configurable: true, value: 300 });
    resize?.();
    flushSync();
    expect(wrap.getAttribute('tabindex')).toBe('0');
    const region = view.getByRole('region', { name: 'Invoices, scrollable' });
    expect(region).toBe(wrap);
    expect(wrap.getAttribute('data-scrollable')).toBe('true');
  });

  it('names an overflowing region by its caption when no label is given', () => {
    let resize: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      }
    );
    const view = render(TableFixture);
    const wrap = view.container.querySelector('[data-tx-table-wrap]') as HTMLElement;
    Object.defineProperty(wrap, 'scrollHeight', { configurable: true, value: 900 });
    Object.defineProperty(wrap, 'clientHeight', { configurable: true, value: 200 });
    resize?.();
    flushSync();
    const caption = view.container.querySelector('caption') as HTMLElement;
    expect(wrap.getAttribute('role')).toBe('region');
    expect(wrap.getAttribute('aria-labelledby')).toBe(caption.id);
    expect(view.getByRole('region', { name: 'Invoices' })).toBe(wrap);
  });

  it('adds explicit roles and stack labels when rows can stack', () => {
    for (const stack of TABLE_STACKS.filter((value) => value !== 'never')) {
      const view = render(TableFixture, { props: { stack } });
      flushSync();
      const table = view.container.querySelector('table') as HTMLTableElement;
      expect(table.getAttribute('role')).toBe('table');
      expect(table.classList.contains(`tx-table--stack-${stack}`)).toBe(true);
      for (const section of table.querySelectorAll('thead, tbody, tfoot')) {
        expect(section.getAttribute('role')).toBe('rowgroup');
      }
      for (const row of table.querySelectorAll('tr')) expect(row.getAttribute('role')).toBe('row');
      expect(table.querySelector('thead th')?.getAttribute('role')).toBe('columnheader');
      expect(table.querySelector('tfoot th')?.getAttribute('role')).toBe('rowheader');
      const cells = Array.from(table.querySelectorAll('tbody td'));
      expect(cells.every((cell) => cell.getAttribute('role') === 'cell')).toBe(true);
      expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual([
        'Invoice',
        'Customer',
        'Amount',
        'Invoice',
        'Customer',
        'Due on',
      ]);
      // The author label wins and is not overwritten.
      expect(cells[5]?.hasAttribute('data-tx-label-fixed')).toBe(true);
      view.unmount();
    }
  });

  it('relabels stacked cells when rows change', async () => {
    const view = render(TableFixture, { props: { stack: 'sm' } });
    flushSync();
    await view.rerender({ stack: 'sm', extraRow: true });
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const last = view.container.querySelector('tbody tr:last-child td') as HTMLElement;
    expect(last.textContent).toContain('INV-3');
    expect(last.getAttribute('data-label')).toBe('Invoice');
  });
});

describe('Table parts', () => {
  it('marks a selected row and leaves others alone', () => {
    const selected = render(TableRow, { props: { selected: true, children: text('x') } });
    expect(selected.container.querySelector('tr')?.getAttribute('data-state')).toBe('selected');
    selected.unmount();
    const plain = render(TableRow, { props: { children: text('x') } });
    expect(plain.container.querySelector('tr')?.hasAttribute('data-state')).toBe(false);
  });

  it('aligns numeric cells to the end with tabular figures unless align says otherwise', () => {
    const numeric = render(TableCell, { props: { numeric: true, children: text('12') } });
    const cell = numeric.container.querySelector('td') as HTMLElement;
    expect(cell.classList.contains('tx-table__cell--end')).toBe(true);
    expect(cell.classList.contains('tx-table__cell--numeric')).toBe(true);
    numeric.unmount();
    const centered = render(TableCell, {
      props: { numeric: true, align: 'center', children: text('12') },
    });
    const center = centered.container.querySelector('td') as HTMLElement;
    expect(center.classList.contains('tx-table__cell--center')).toBe(true);
    expect(center.classList.contains('tx-table__cell--end')).toBe(false);
    centered.unmount();
    const head = render(TableHead, { props: { numeric: true, children: text('Amount') } });
    const th = head.container.querySelector('th') as HTMLElement;
    expect(th.getAttribute('scope')).toBe('col');
    expect(th.classList.contains('tx-table__cell--end')).toBe(true);
  });

  it('sets a fixed stack label only when the author passes one', () => {
    const labelled = render(TableCell, { props: { label: 'Due', children: text('Mon') } });
    const cell = labelled.container.querySelector('td') as HTMLElement;
    expect(cell.getAttribute('data-label')).toBe('Due');
    expect(cell.hasAttribute('data-tx-label-fixed')).toBe(true);
    labelled.unmount();
    const bare = render(TableCell, { props: { children: text('Mon') } });
    const plain = bare.container.querySelector('td') as HTMLElement;
    expect(plain.hasAttribute('data-label')).toBe(false);
    expect(plain.hasAttribute('data-tx-label-fixed')).toBe(false);
  });

  it('renders an empty row spanning the columns', () => {
    const view = render(TableEmpty, { props: { colspan: 4.7, children: text('No rows yet') } });
    const cell = view.container.querySelector('td') as HTMLElement;
    expect(cell.getAttribute('colspan')).toBe('4');
    expect(cell.textContent).toContain('No rows yet');
    expect(view.container.querySelector('[data-tx-table-empty]')).toBeTruthy();
    view.unmount();
    const clamped = render(TableEmpty, { props: { colspan: 0, children: text('None') } });
    expect(clamped.container.querySelector('td')?.getAttribute('colspan')).toBe('1');
  });

  it('hides a caption visually while keeping it, and keeps an author id', () => {
    const view = render(TableCaption, {
      props: { hidden: true, id: 'cap', children: text('Ledger') },
    });
    const caption = view.container.querySelector('caption') as HTMLElement;
    expect(caption.id).toBe('cap');
    expect(caption.classList.contains('tx-table__sr-only')).toBe(true);
    expect(caption.textContent).toContain('Ledger');
  });
});

describe('fillStackLabels', () => {
  it('copies the last header row onto body and footer cells, honoring colspan', () => {
    const table = markup(`<table>
      <thead>
        <tr><th colspan="3">Group</th></tr>
        <tr><th>Name</th><th colspan="2">Contact</th></tr>
      </thead>
      <tbody>
        <tr><td>Ada</td><td>ada@example.com</td><td>Mon</td></tr>
        <tr><td colspan="2">Merged</td><td>Tue</td></tr>
      </tbody>
      <tfoot><tr><th>Total</th><td>2</td><td>-</td></tr></tfoot>
    </table>`);
    expect(fillStackLabels(table)).toBe(7);
    const labels = (selector: string) =>
      Array.from(table.querySelectorAll(selector)).map((cell) => cell.getAttribute('data-label'));
    expect(labels('tbody tr:first-child td')).toEqual(['Name', 'Contact', 'Contact']);
    // A merged cell gets no label; the next one keeps its own column.
    expect(labels('tbody tr:last-child td')).toEqual([null, 'Contact']);
    expect(labels('tfoot tr > *')).toEqual(['Name', 'Contact', 'Contact']);
  });

  it('leaves author labels alone and removes stale labels where no header exists', () => {
    const table = markup(`<table>
      <thead><tr><th>Name</th></tr></thead>
      <tbody><tr>
        <td data-label="Mine" data-tx-label-fixed>Ada</td>
        <td data-label="Old">extra</td>
      </tr></tbody>
    </table>`);
    fillStackLabels(table);
    const [first, second] = Array.from(table.querySelectorAll('td'));
    expect(first?.getAttribute('data-label')).toBe('Mine');
    expect(second?.hasAttribute('data-label')).toBe(false);
  });

  it('collapses header whitespace and handles a table without a header', () => {
    const named = markup(
      '<table><thead><tr><th>\n  Due\n   on </th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>'
    );
    fillStackLabels(named);
    expect(named.querySelector('td')?.getAttribute('data-label')).toBe('Due on');
    const bare = markup('<table><tbody><tr><td>x</td></tr></tbody></table>');
    expect(fillStackLabels(bare)).toBe(0);
    expect(bare.querySelector('td')?.hasAttribute('data-label')).toBe(false);
  });
});

describe('isScrollable', () => {
  it('reports overflow on either axis past a one-pixel tolerance', () => {
    const box = document.createElement('div');
    const set = (sw: number, cw: number, sh: number, ch: number) => {
      Object.defineProperty(box, 'scrollWidth', { configurable: true, value: sw });
      Object.defineProperty(box, 'clientWidth', { configurable: true, value: cw });
      Object.defineProperty(box, 'scrollHeight', { configurable: true, value: sh });
      Object.defineProperty(box, 'clientHeight', { configurable: true, value: ch });
    };
    set(100, 100, 50, 50);
    expect(isScrollable(box)).toBe(false);
    set(101, 100, 50, 50);
    expect(isScrollable(box)).toBe(false);
    set(120, 100, 50, 50);
    expect(isScrollable(box)).toBe(true);
    set(100, 100, 80, 50);
    expect(isScrollable(box)).toBe(true);
  });
});
