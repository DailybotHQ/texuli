import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { budgetFor, islandBudgetFor } from '../../src/components/perf/budgets.ts';
import SheetsDemo from '../../src/components/solutions/sheets/demo/SheetsDemo.svelte';
import SheetsPreview from '../../src/components/solutions/sheets/demo/SheetsPreview.svelte';

afterEach(cleanup);

const UI_SOURCE = resolve('apps/website/src/components/solutions/sheets/demo/SheetsDemo.svelte');

function cell(grid: HTMLElement, row: number, column: number): HTMLElement {
  const found = grid.querySelector<HTMLElement>(
    `tr[aria-rowindex="${row + 1}"] [aria-colindex="${column + 1}"]`
  );
  if (!found) throw new Error(`Missing sheet cell at row ${row}, column ${column}`);
  return found;
}

async function editCell(target: HTMLElement, value: string): Promise<void> {
  await fireEvent.click(target.querySelector('[data-tx-edit-cell]') as HTMLElement);
  target.focus();
  await fireEvent.keyDown(target, { key: 'Enter' });
  const editor = await waitFor(() => {
    const found = target.querySelector<HTMLInputElement>('[data-tx-grid-editor]');
    if (!found) throw new Error('The sheet cell editor did not open.');
    return found;
  });
  await fireEvent.input(editor, { target: { value } });
  await fireEvent.keyDown(editor, { key: 'Enter' });
}

describe('sheets solution demo island', () => {
  it('renders the Project budget fixture in the static SheetView preview', () => {
    render(SheetsPreview);

    const grid = screen.getByRole('grid', { name: 'Project budget spreadsheet preview' });
    expect(cell(grid, 2, 4).textContent).toContain('360');
    expect(cell(grid, 5, 4).textContent).toContain('766');
  });

  it('edits a quantity through SheetView, adds a line item, shows formulas, and resets', async () => {
    render(SheetsDemo);
    const demo = screen.getByRole('region', { name: 'Interactive Project budget spreadsheet' });
    const grid = () => screen.getByRole('grid', { name: 'Project budget spreadsheet' });
    const announcement = () => demo.querySelector('.sheets-demo__announcement')?.textContent ?? '';
    expect(cell(grid(), 2, 4).textContent).toContain('360');
    expect(cell(grid(), 5, 4).textContent).toContain('766');

    await editCell(cell(grid(), 2, 2), '4');
    expect(announcement()).toContain('Edited Budget!B2');
    await waitFor(() => expect(cell(grid(), 2, 4).textContent).toContain('480'));
    await waitFor(() => expect(cell(grid(), 5, 4).textContent).toContain('886'));

    await fireEvent.click(screen.getByRole('button', { name: 'Add line item' }));
    expect(cell(grid(), 6, 4).textContent).toContain('1056');
    expect(announcement()).toContain('Added an accessibility review row');

    await fireEvent.click(screen.getByRole('button', { name: 'Show formula details' }));
    expect(screen.getByText('5 formulas in this workbook')).toBeTruthy();
    expect(screen.getByText('=SUM(D2:D5)')).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'View source' }));
    expect(document.getElementById('sheets-demo-source')?.textContent).toContain('=SUM(D2:D5)');

    await fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(cell(grid(), 2, 4).textContent).toContain('360');
    expect(cell(grid(), 5, 4).textContent).toContain('766');
    expect(screen.queryByText('5 formulas in this workbook')).toBeNull();
    expect(document.getElementById('sheets-demo-source')?.hasAttribute('hidden')).toBe(true);
    expect(announcement()).toContain('Reset to the original Project budget');
  });

  it('supports keyboard grid navigation and cell editing through SheetView', async () => {
    render(SheetsDemo);
    const grid = () => screen.getByRole('grid', { name: 'Project budget spreadsheet' });
    const quantity = cell(grid(), 2, 2);
    quantity.focus();
    await fireEvent.keyDown(quantity, { key: 'ArrowRight' });
    const next = document.activeElement as HTMLElement;
    expect(next.getAttribute('role')).toBe('gridcell');
    expect(next.getAttribute('aria-colindex')).toBe('4');

    await editCell(quantity, '4');
    await waitFor(() => expect(cell(grid(), 2, 4).textContent).toContain('480'));
  });

  it('keeps touch targets, reduced-motion behavior, safe text rendering, and route limits', () => {
    const source = readFileSync(UI_SOURCE, 'utf8');
    expect(source).toContain('touch-action: manipulation');
    expect(source).toContain('min-block-size: 2.75rem');
    expect(source).toContain('prefers-reduced-motion: reduce');
    expect(source).not.toMatch(/\{@html|innerHTML|fetch\s*\(/);
    expect(source).toContain('{source}');
    expect(source).toContain("import { SheetView } from '@texuli/sheets/view'");
    expect(islandBudgetFor('/solutions/sheets/')).toBe(1);
    expect(budgetFor('/solutions/sheets/').pageGzipKb).toBe(400);
    expect(budgetFor('/solutions/sheets/').htmlGzipKb).toBe(31);
    expect(budgetFor('/solutions/sheets/').jsGzipKb).toBe(64);
  });
});
