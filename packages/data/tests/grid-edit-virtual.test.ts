// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GridEditVirtualHarness from './fixtures/GridEditVirtualHarness.svelte';

/*
 * FIX-grid-edit-virtual: EditableDataGrid windows its rows above
 * `virtualizeAbove` (default 1000). happy-dom has no layout, so the window is
 * sized from the defaults: a 360 px viewport of 36 px rows (10 rows) plus 4
 * overscan rows on each side, plus the active row when it is out of view.
 */

afterEach(() => {
  cleanup();
  delete (globalThis as { releaseCommit?: () => void }).releaseCommit;
});

const MAX_RENDERED = 10 + 2 * 4 + 1;

const grid = () => screen.getByRole('grid', { name: 'Fictional records' });
const bodyRows = () => [...grid().querySelectorAll('tbody tr[aria-rowindex]')];
const rowAt = (index: number) => grid().querySelector(`tr[aria-rowindex="${index}"]`);
const cellOf = (rowIndex: number, col: number) =>
  rowAt(rowIndex)?.querySelector<HTMLElement>(`[aria-colindex="${col}"]`) ?? null;
const area = () => grid().closest<HTMLElement>('[data-tx-table-wrap]') as HTMLElement;

async function scrollTo(top: number): Promise<void> {
  area().scrollTop = top;
  await fireEvent.scroll(area());
  await tick();
}

describe('EditableDataGrid row windowing', () => {
  it('renders at most the window plus overscan of 100,000 editable rows', async () => {
    render(GridEditVirtualHarness);
    expect(grid().getAttribute('aria-rowcount')).toBe('100001');
    expect(bodyRows().length).toBeLessThanOrEqual(MAX_RENDERED);
    expect(rowAt(2)?.textContent).toContain('Record 1');
    // Spacers stand in for the other rows, hidden from assistive technology.
    const spacer = grid().querySelector('.tx-data-grid__spacer');
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');

    await scrollTo(36 * 50_000);
    const indices = bodyRows().map((row) => Number(row.getAttribute('aria-rowindex')));
    expect(indices.length).toBeLessThanOrEqual(MAX_RENDERED);
    expect(indices).toContain(50_002);
    expect(rowAt(50_002)?.textContent).toContain('Record 50001');
    expect(indices.every((index) => index > 49_990 && index < 50_020)).toBe(true);
  });

  it('keeps a pending edit when its row scrolls out of the window and back', async () => {
    render(GridEditVirtualHarness, { props: { hold: true } });
    const first = cellOf(2, 1) as HTMLElement;
    await fireEvent.dblClick(first.querySelector('[data-tx-edit-cell]') as HTMLElement);
    const input = await screen.findByDisplayValue('Record 1');
    await fireEvent.input(input, { target: { value: 'Record one' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(rowAt(2)?.querySelector('[data-pending="true"]')).toBeTruthy());

    // Move the active cell far away so the edited row is no longer kept.
    await scrollTo(36 * 60_000);
    const far = cellOf(60_002, 1) as HTMLElement;
    far.focus();
    await tick();
    await scrollTo(36 * 60_000 + 1);
    expect(rowAt(2)).toBeNull();
    expect(bodyRows().length).toBeLessThanOrEqual(MAX_RENDERED);

    await scrollTo(0);
    expect(rowAt(2)?.textContent).toContain('Record one');
    expect(rowAt(2)?.querySelector('[data-pending="true"]')).toBeTruthy();

    (globalThis as { releaseCommit?: () => void }).releaseCommit?.();
    await waitFor(() => expect(rowAt(2)?.querySelector('[data-pending]')).toBeNull());
    expect(rowAt(2)?.textContent).toContain('Record one');
  });

  it('keeps an open editor and its draft while the grid scrolls away and back', async () => {
    render(GridEditVirtualHarness);
    await fireEvent.dblClick(cellOf(3, 1)?.querySelector('[data-tx-edit-cell]') as HTMLElement);
    const input = await screen.findByDisplayValue('Record 2');
    await fireEvent.input(input, { target: { value: 'Draft two' } });

    await scrollTo(36 * 80_000);
    expect(bodyRows().length).toBeLessThanOrEqual(MAX_RENDERED);
    expect(screen.getByDisplayValue('Draft two')).toBe(input);
    expect(document.activeElement).toBe(input);

    await scrollTo(0);
    expect(screen.getByDisplayValue('Draft two')).toBe(input);
    await fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(rowAt(3)?.textContent).toContain('Draft two'));
  });

  it('reaches the last row with Ctrl+End and pages through the full set', async () => {
    render(GridEditVirtualHarness);
    const start = cellOf(2, 1) as HTMLElement;
    start.focus();
    await tick();
    await fireEvent.keyDown(start, { key: 'End', ctrlKey: true });
    await waitFor(() => expect(cellOf(100_001, 2)).toBe(document.activeElement));
    expect(cellOf(100_001, 2)?.textContent).toContain('100000');
    expect(bodyRows().length).toBeLessThanOrEqual(MAX_RENDERED);

    // Page Up moves a viewport of rows minus one (9) from the last row.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'PageUp' });
    await waitFor(() => expect(cellOf(99_992, 2)).toBe(document.activeElement));
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'PageDown' });
    await waitFor(() => expect(cellOf(100_001, 2)).toBe(document.activeElement));

    // Enter edits the cell that focus reached, far outside the first window.
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Enter' });
    expect(await screen.findByDisplayValue('100000')).toBeTruthy();
    await fireEvent.keyDown(screen.getByDisplayValue('100000'), { key: 'Escape' });

    // Ctrl+Home goes back to the header row.
    await fireEvent.keyDown(cellOf(100_001, 2) as HTMLElement, { key: 'Home', ctrlKey: true });
    await waitFor(() =>
      expect(
        grid().querySelector('thead [aria-colindex="1"]')?.contains(document.activeElement)
      ).toBe(true)
    );
  });

  it('renders every row below the threshold', () => {
    render(GridEditVirtualHarness, { props: { count: 40 } });
    expect(bodyRows()).toHaveLength(40);
    expect(grid().querySelector('.tx-data-grid__spacer')).toBeNull();
  });
});
