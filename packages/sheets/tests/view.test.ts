// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { EditableDataGrid } from '@texuli/data/grid-editing';
import { afterEach, describe, expect, it } from 'vitest';
import type { SheetDocument } from '../src/model/index.ts';
import { DEFAULT_SHEET_VIEW_LABELS, SheetView } from '../src/view/index.ts';

afterEach(cleanup);

const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};

const BUDGET: SheetDocument = {
  format: 'texuli-sheet',
  formatVersion: 1,
  meta: { title: 'Office budget' },
  sheets: [
    {
      id: 'costs',
      name: 'Costs',
      rows: 4,
      columns: 3,
      cells: {
        A1: 'Desk',
        B1: 120,
        A2: 'Chair',
        B2: 80,
        A3: 'Total',
        B3: '=SUM(B1:B2)',
        C3: '=B3*Rates!A1',
      },
    },
    { id: 'rates', name: 'Rates', rows: 2, columns: 2, cells: { A1: 2 } },
  ],
};

function setup(props: Record<string, unknown> = {}) {
  const emitted: SheetDocument[] = [];
  const view = render(SheetView, {
    props: { sheet: BUDGET, onchange: (doc: SheetDocument) => emitted.push(doc), ...props },
  });
  const grid = () => screen.getByRole('grid', { name: 'Office budget' });
  /** The gridcell at a 1-based sheet row and column (A is 1; 0 is the row-number column). */
  const cell = (row: number, col: number) =>
    grid().querySelector<HTMLElement>(
      `tr[aria-rowindex="${row + 1}"] [aria-colindex="${col + 1}"]`
    ) as HTMLElement;
  return { ...view, emitted, grid, cell };
}

async function edit(target: HTMLElement, value: string): Promise<void> {
  await fireEvent.click(target.querySelector('[data-tx-edit-cell]') as HTMLElement);
  target.focus();
  await fireEvent.keyDown(target, { key: 'Enter' });
  const editor = await waitFor(() => {
    const found = target.querySelector<HTMLInputElement>('[data-tx-grid-editor]');
    if (!found) throw new Error('no editor');
    return found;
  });
  await fireEvent.input(editor, { target: { value } });
  await fireEvent.keyDown(editor, { key: 'Enter' });
}

describe('SheetView', () => {
  it('paints computed values under column letters, with row numbers', () => {
    const { grid, cell } = setup();
    const headers = [...grid().querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(headers.slice(0, 4)).toEqual(['Row', 'A', 'B', 'C']);
    expect(cell(3, 0).textContent).toContain('3');
    expect(cell(3, 2).textContent).toContain('200');
    expect(cell(3, 3).textContent).toContain('400');
    expect(cell(1, 1).textContent).toContain('Desk');
  });

  it('edits the typed input, recalculates dependents and emits the new document', async () => {
    const { cell, emitted } = setup();
    // The editor opens on the formula, not the value.
    const total = cell(3, 2);
    await fireEvent.click(total.querySelector('[data-tx-edit-cell]') as HTMLElement);
    total.focus();
    await fireEvent.keyDown(total, { key: 'Enter' });
    expect(await screen.findByDisplayValue('=SUM(B1:B2)')).toBeTruthy();
    await fireEvent.keyDown(screen.getByDisplayValue('=SUM(B1:B2)'), { key: 'Escape' });

    await edit(cell(1, 2), '150');
    await waitFor(() => expect(cell(3, 2).textContent).toContain('230'));
    expect(cell(3, 3).textContent).toContain('460');
    expect(emitted.at(-1)?.sheets[0]?.cells?.B1).toBe(150);

    await edit(cell(4, 1), '=B3/0');
    await waitFor(() => expect(cell(4, 1).textContent).toContain('#DIV/0!'));
    expect(emitted.at(-1)?.sheets[0]?.cells?.A4).toBe('=B3/0');
  });

  it('refuses a formula with a syntax error and says why', async () => {
    const { cell, emitted } = setup();
    await edit(cell(4, 1), '=SUM(');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(DEFAULT_SHEET_VIEW_LABELS.formulaError(''));
    expect(emitted).toHaveLength(0);
  });

  it('shows the focused cell address and input in the formula bar', async () => {
    const { cell, container } = setup();
    const bar = container.querySelector('[data-tx-sheet-bar]') as HTMLElement;
    expect(bar.getAttribute('aria-label')).toBe('Formula bar');
    await fireEvent.focusIn(cell(3, 2));
    await waitFor(() => expect(bar.textContent).toContain('B3'));
    expect(bar.textContent).toContain('=SUM(B1:B2)');
  });

  it('switches sheets with pressed tab buttons', async () => {
    const { cell } = setup();
    const tabs = screen.getByRole('group', { name: 'Sheets' });
    const rates = screen.getByRole('button', { name: 'Rates' });
    expect(tabs.contains(rates)).toBe(true);
    expect(rates.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(rates);
    expect(rates.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => expect(cell(1, 1).textContent).toContain('2'));
  });

  it('is read-only on request and axe-clean', async () => {
    const { grid, cell, container } = setup({ readonly: true });
    expect(cell(1, 1).getAttribute('aria-readonly')).toBe('true');
    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
    expect(grid()).toBeTruthy();
  });
});

describe('EditableDataGrid onFocusCell', () => {
  it('reports the body cell that takes focus, once per move', async () => {
    const seen: string[] = [];
    render(EditableDataGrid, {
      props: {
        rows: [
          { id: 'r1', name: 'Harbor Notes' },
          { id: 'r2', name: 'Lumen Atlas' },
        ],
        columns: [{ key: 'name', header: 'Name', type: 'text', editable: true }],
        getRowId: (row: unknown) => (row as { id: string }).id,
        caption: 'Notes',
        onCommit: () => {},
        onFocusCell: (cell: { rowId: string; columnKey: string }) =>
          seen.push(`${cell.rowId}/${cell.columnKey}`),
      },
    });
    const cells = screen.getAllByRole('gridcell');
    await fireEvent.focusIn(cells[0] as HTMLElement);
    await fireEvent.focusIn(cells[0] as HTMLElement);
    await fireEvent.focusIn(cells[1] as HTMLElement);
    expect(seen).toEqual(['r1/name', 'r2/name']);
  });
});
