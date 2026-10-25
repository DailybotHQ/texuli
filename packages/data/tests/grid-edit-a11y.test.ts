// @vitest-environment happy-dom
import { createRequire } from 'node:module';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GridEditingHarness from './fixtures/GridEditingHarness.svelte';
import GridEditVirtualHarness from './fixtures/GridEditVirtualHarness.svelte';

/*
 * FIX-grid-edit-a11y: a read-only cell of an editable grid is announced on its
 * role="gridcell" element (aria-readonly is not allowed on the plain div
 * inside), and every way of starting an edit (Enter or F2 on a clicked cell,
 * double click) puts focus in the editor, which carries data-tx-grid-editor
 * and holds the tab stop; Enter or Escape returns focus to the cell. Both the
 * plain grid and the windowed one (100,000 rows) are covered.
 */

afterEach(cleanup);

// axe-core comes with the root's @axe-core/playwright; resolve it from there.
const req = createRequire(import.meta.url);
type AxeResult = { violations: { id: string; nodes: { target: string[] }[] }[] };
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as {
  run(context: Element, options: unknown): Promise<AxeResult>;
};

const GRIDS: [string, Component<{ readOnlyColumn?: boolean }>, string, string][] = [
  ['plain', GridEditingHarness as never, 'Editable deals', 'Harbor Notes'],
  ['windowed', GridEditVirtualHarness as never, 'Fictional records', 'Record 1'],
];

describe.each(GRIDS)('EditableDataGrid accessibility (%s)', (_label, Harness, name, first) => {
  const grid = () => screen.getByRole('grid', { name });
  // Row 2 is the first body row; column 1 is the read-only Code, column 2 the editable name.
  const cellOf = (col: number) =>
    grid().querySelector<HTMLElement>(
      `tr[aria-rowindex="2"] [aria-colindex="${col}"]`
    ) as HTMLElement;

  it('puts aria-readonly on read-only gridcells only, never on the inner div', async () => {
    render(Harness, { props: { readOnlyColumn: true } });
    expect(cellOf(1).getAttribute('role')).toBe('gridcell');
    expect(cellOf(1).getAttribute('aria-readonly')).toBe('true');
    expect(cellOf(2).hasAttribute('aria-readonly')).toBe(false);
    expect(grid().querySelectorAll('[data-tx-edit-cell][aria-readonly]')).toHaveLength(0);
    const result = await axe.run(grid(), {
      runOnly: { type: 'rule', values: ['aria-allowed-attr', 'aria-required-children'] },
    });
    expect(result.violations).toEqual([]);
  });

  it.each(['Enter', 'F2'])('%s on a clicked cell focuses the editor', async (key) => {
    render(Harness, { props: { readOnlyColumn: true } });
    const target = cellOf(2);
    await fireEvent.click(target.querySelector('[data-tx-edit-cell]') as HTMLElement);
    target.focus();
    await fireEvent.keyDown(target, { key });
    const editor = await screen.findByDisplayValue(first);
    expect(editor.hasAttribute('data-tx-grid-editor')).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it('a double click focuses the editor; a read-only cell opens none', async () => {
    render(Harness, { props: { readOnlyColumn: true } });
    await fireEvent.dblClick(cellOf(1).querySelector('[data-tx-edit-cell]') as HTMLElement);
    cellOf(1).focus();
    await fireEvent.keyDown(cellOf(1), { key: 'Enter' });
    expect(grid().querySelector('[data-tx-grid-editor]')).toBeNull();
    await fireEvent.dblClick(cellOf(2).querySelector('[data-tx-edit-cell]') as HTMLElement);
    const editor = await screen.findByDisplayValue(first);
    expect(editor.hasAttribute('data-tx-grid-editor')).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it.each(['Escape', 'Enter'])(
    '%s closes the editor, returns focus to its cell and hands back the tab stop',
    async (key) => {
      render(Harness, { props: { readOnlyColumn: true } });
      const target = cellOf(2);
      target.focus();
      await fireEvent.keyDown(target, { key: 'Enter' });
      const editor = await screen.findByDisplayValue(first);
      await waitFor(() => expect(document.activeElement).toBe(editor));
      // The editor is the tab stop while it has focus; its cell leaves the tab order.
      expect(target.getAttribute('tabindex')).toBe('-1');
      await fireEvent.keyDown(editor, { key });
      await waitFor(() => expect(grid().querySelector('[data-tx-grid-editor]')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(cellOf(2)));
      expect(cellOf(2).getAttribute('tabindex')).toBe('0');
    }
  );
});
