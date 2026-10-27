// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { type Component } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EditableDataGrid from '../src/grid-editing/EditableDataGrid.svelte';
import {
  applyRowValue,
  cellKey,
  createUndoStack,
  DEFAULT_GRID_EDITING_LABELS,
  draftFromValue,
  parseClipboard,
  parseEditorValue,
  pastePlan,
  serializeClipboard,
  validateCell,
} from '../src/grid-editing/index.ts';
import { type EditableColumn } from '../src/grid-editing/model.ts';
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

  it('on a clicked cell focuses the editor', async () => {
    for (const key of ['Enter', 'F2']) {
      render(Harness, { props: { readOnlyColumn: true } });
      const target = cellOf(2);
      await fireEvent.click(target.querySelector('[data-tx-edit-cell]') as HTMLElement);
      target.focus();
      await fireEvent.keyDown(target, { key });
      const editor = await screen.findByDisplayValue(first);
      expect(editor.hasAttribute('data-tx-grid-editor'), String(key)).toBe(true);
      await waitFor(() => expect(document.activeElement, String(key)).toBe(editor));

      cleanup();
    }
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

  it('closes the editor, returns focus to its cell and hands back the tab stop', async () => {
    for (const key of ['Escape', 'Enter']) {
      render(Harness, { props: { readOnlyColumn: true } });
      const target = cellOf(2);
      target.focus();
      await fireEvent.keyDown(target, { key: 'Enter' });
      const editor = await screen.findByDisplayValue(first);
      await waitFor(() => expect(document.activeElement, String(key)).toBe(editor));
      // The editor is the tab stop while it has focus; its cell leaves the tab order.
      expect(target.getAttribute('tabindex'), String(key)).toBe('-1');
      await fireEvent.keyDown(editor, { key });
      await waitFor(() =>
        expect(grid().querySelector('[data-tx-grid-editor]'), String(key)).toBeNull()
      );
      await waitFor(() => expect(document.activeElement, String(key)).toBe(cellOf(2)));
      expect(cellOf(2).getAttribute('tabindex'), String(key)).toBe('0');

      cleanup();
    }
  });
});

describe('grid editing', () => {
  afterEach(() => cleanup());

  interface Deal {
    id: string;
    name: string;
    stage: string;
    amount: number;
    active: boolean;
  }

  const columns: EditableColumn<Deal>[] = [
    { key: 'name', header: 'Deal', type: 'text', editable: true },
    {
      key: 'stage',
      header: 'Stage',
      type: 'enum',
      options: ['Open', 'Won', 'Lost'],
      editable: true,
    },
    { key: 'amount', header: 'Amount', type: 'number', editable: true },
    { key: 'active', header: 'Active', type: 'boolean', editable: true },
  ];

  const dueColumn: EditableColumn<{ id: string }> = {
    key: 'due',
    header: 'Due',
    type: 'date',
    editable: true,
  };

  describe('grid editing engine', () => {
    it('parses drafts by column type, and 5 related cases', () => {
      // parses drafts by column type
      expect(parseEditorValue(columns[0]!, 'Harbor')).toBe('Harbor');
      expect(parseEditorValue(columns[2]!, '42.5')).toBe(42.5);
      expect(parseEditorValue(columns[2]!, '')).toBeNull();
      expect(parseEditorValue(columns[3]!, true)).toBe(true);
      expect(draftFromValue(columns[3]!, true, { id: 'x' } as Deal)).toBe(true);
      expect(draftFromValue(columns[2]!, 10, { id: 'x' } as Deal)).toBe('10');
      cleanup();
      {
        // validates numbers, enums and custom rules
        expect(validateCell(columns[2]!, { id: 'd1' } as Deal, '12').ok).toBe(true);
        expect(validateCell(columns[2]!, { id: 'd1' } as Deal, 'nope').ok).toBe(false);
        expect(validateCell(columns[1]!, { id: 'd1' } as Deal, 'Won').ok).toBe(true);
        expect(validateCell(columns[1]!, { id: 'd1' } as Deal, 'Maybe').ok).toBe(false);

        const required: EditableColumn<Deal> = {
          ...columns[0]!,
          validate: (value) => (value ? null : 'Name is required.'),
        };
        expect(validateCell(required, { id: 'd1' } as Deal, '').ok).toBe(false);
        expect(validateCell(required, { id: 'd1' } as Deal, 'Ok').ok).toBe(true);
      }
      cleanup();
      // rejects an invalid date with the date message, not the number one
      expect(validateCell(dueColumn, { id: 'd1' }, 'not-a-date')).toMatchObject({
        ok: false,
        message: 'Enter a valid date.',
      });
      expect(
        validateCell(dueColumn, { id: 'd1' }, 'nope', {
          ...DEFAULT_GRID_EDITING_LABELS,
          invalidDate: 'Use YYYY-MM-DD.',
        })
      ).toMatchObject({ ok: false, message: 'Use YYYY-MM-DD.' });
      cleanup();
      {
        // serializes and parses TSV clipboard blocks
        const tsv = serializeClipboard([
          ['Ada', 'Open'],
          ['Bea\tRuiz', 'Won'],
        ]);
        expect(tsv).toContain('\t');
        const block = parseClipboard(tsv);
        expect(block).toEqual([
          ['Ada', 'Open'],
          ['Bea\tRuiz', 'Won'],
        ]);
        expect(parseClipboard('a\tb\nc\td\n')).toEqual([
          ['a', 'b'],
          ['c', 'd'],
        ]);
        expect(pastePlan(block)).toEqual([
          { rowOffset: 0, colOffset: 0, value: 'Ada' },
          { rowOffset: 0, colOffset: 1, value: 'Open' },
          { rowOffset: 1, colOffset: 0, value: 'Bea\tRuiz' },
          { rowOffset: 1, colOffset: 1, value: 'Won' },
        ]);
      }
      cleanup();
      {
        // undo stack pushes, undoes and redoes within the limit
        const stack = createUndoStack({ limit: 2 });
        stack.push({ rowId: 'a', columnKey: 'n', previous: '1', next: '2' });
        stack.push({ rowId: 'a', columnKey: 'n', previous: '2', next: '3' });
        stack.push({ rowId: 'a', columnKey: 'n', previous: '3', next: '4' });
        expect(stack.past()).toHaveLength(2);
        expect(stack.undo()?.next).toBe('4');
        expect(stack.canRedo()).toBe(true);
        expect(stack.redo()?.next).toBe('4');
        stack.clear();
        expect(stack.canUndo()).toBe(false);
      }
      cleanup();
      {
        // applyRowValue patches immutably
        const row = { id: 'd1', name: 'A', stage: 'Open', amount: 1, active: true };
        const next = applyRowValue(row, 'name', 'B');
        expect(next.name).toBe('B');
        expect(row.name).toBe('A');
        expect(cellKey('d1', 'name')).toBe('d1\u0000name');
      }
    });
  });

  describe('EditableDataGrid', () => {
    it('renders the grid and undo toolbar, and 13 related cases', async () => {
      // renders the grid and undo toolbar
      render(GridEditingHarness);
      expect(screen.getByRole('grid', { name: 'Editable deals' })).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(
        true
      );
      expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(
        true
      );
      expect(screen.getByText('Harbor Notes')).toBeTruthy();
      cleanup();
      // edits a text cell on double-click, Enter saves, Escape cancels
      await (async () => {
        render(GridEditingHarness);
        const name = screen.getByText('Harbor Notes');
        await fireEvent.dblClick(name.closest('[data-tx-edit-cell]')!);
        const input = await screen.findByDisplayValue('Harbor Notes');
        await fireEvent.input(input, { target: { value: 'Harbor Notes Plus' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => {
          expect(screen.getByText('Harbor Notes Plus')).toBeTruthy();
        });
        expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(
          false
        );

        await fireEvent.dblClick(screen.getByText('Lumen Atlas').closest('[data-tx-edit-cell]')!);
        const second = await screen.findByDisplayValue('Lumen Atlas');
        await fireEvent.input(second, { target: { value: 'Nope' } });
        await fireEvent.keyDown(second, { key: 'Escape' });
        await waitFor(() => {
          expect(screen.queryByDisplayValue('Nope')).toBeNull();
        });
        expect(screen.getByText('Lumen Atlas')).toBeTruthy();
      })();
      cleanup();
      // rejects invalid numbers and keeps the previous value
      await (async () => {
        render(GridEditingHarness);
        const amount = screen.getByText('120');
        await fireEvent.dblClick(amount.closest('[data-tx-edit-cell]')!);
        const input = await screen.findByDisplayValue('120');
        await fireEvent.input(input, { target: { value: 'abc' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => {
          expect(screen.getByRole('alert').textContent).toMatch(/number/i);
        });
        expect(screen.getByText('120')).toBeTruthy();
      })();
      cleanup();
      // undo restores the previous value through onApply
      await (async () => {
        render(GridEditingHarness);
        await fireEvent.dblClick(screen.getByText('Harbor Notes').closest('[data-tx-edit-cell]')!);
        const input = await screen.findByDisplayValue('Harbor Notes');
        await fireEvent.input(input, { target: { value: 'Renamed' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByText('Renamed')).toBeTruthy());

        await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
        await waitFor(() => expect(screen.getByText('Harbor Notes')).toBeTruthy());
        expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(
          false
        );
      })();
      cleanup();
      // surfaces commit failures as alerts
      await (async () => {
        render(GridEditingHarness, { props: { failCommit: true } });
        await fireEvent.dblClick(screen.getByText('Harbor Notes').closest('[data-tx-edit-cell]')!);
        const input = await screen.findByDisplayValue('Harbor Notes');
        await fireEvent.input(input, { target: { value: 'Boom' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => {
          expect(screen.getByRole('alert').textContent).toContain('Harbor refused the write.');
        });
        expect(screen.getByText('Harbor Notes')).toBeTruthy();
      })();
      cleanup();
      // commits an enum editor on blur like the text editor
      await (async () => {
        render(GridEditingHarness);
        await fireEvent.dblClick(screen.getByText('Open').closest('[data-tx-edit-cell]')!);
        const select = await screen.findByDisplayValue('Open');
        await fireEvent.change(select, { target: { value: 'Lost' } });
        await fireEvent.blur(select);
        await waitFor(() => expect(screen.queryByDisplayValue('Lost')).toBeNull());
        await waitFor(() => expect(screen.getByText('Lost')).toBeTruthy());
      })();
      cleanup();
      // commits the boolean switch on blur
      await (async () => {
        render(GridEditingHarness);
        await fireEvent.dblClick(screen.getByText('No').closest('[data-tx-edit-cell]')!);
        const booleanEditor = await screen.findByRole('switch', { name: 'Active' });
        await fireEvent.click(booleanEditor);
        // Focus leaves the editor for another cell: the draft commits.
        const outside = screen.getByText('Harbor Notes').closest<HTMLElement>('[role=gridcell]')!;
        await fireEvent.blur(booleanEditor, { relatedTarget: outside });
        await fireEvent.focusOut(booleanEditor, { relatedTarget: outside });
        await waitFor(() => expect(screen.queryByRole('switch')).toBeNull());
        // d1 already shows "Yes"; after the blur commit d2 joins it.
        await waitFor(() => expect(screen.getAllByText('Yes')).toHaveLength(2));
      })();
      cleanup();
      // keeps the boolean editor open when Tab moves focus to its Save button
      await (async () => {
        render(GridEditingHarness);
        await fireEvent.dblClick(screen.getByText('No').closest('[data-tx-edit-cell]')!);
        const booleanEditor = await screen.findByRole('switch', { name: 'Active' });
        await fireEvent.click(booleanEditor);
        const save = screen.getByRole('button', { name: 'Save' });
        await fireEvent.blur(booleanEditor, { relatedTarget: save });
        await fireEvent.focusOut(booleanEditor, { relatedTarget: save });
        // The editor is still mounted and its Save button is reachable.
        expect(screen.getByRole('switch', { name: 'Active' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Save' }).isConnected).toBe(true);
        expect(screen.getAllByText('Yes')).toHaveLength(1);
      })();
      cleanup();
      // commits from the Save button and returns focus to the cell, not <body>
      await (async () => {
        render(GridEditingHarness);
        await fireEvent.dblClick(screen.getByText('No').closest('[data-tx-edit-cell]')!);
        const booleanEditor = await screen.findByRole('switch', { name: 'Active' });
        await fireEvent.click(booleanEditor);
        const save = screen.getByRole('button', { name: 'Save' });
        const gridcell = save.closest<HTMLElement>('[role=gridcell]')!;
        save.focus();
        await fireEvent.focusOut(booleanEditor, { relatedTarget: save });
        await fireEvent.click(save);
        await waitFor(() => expect(screen.queryByRole('switch')).toBeNull());
        await waitFor(() => expect(screen.getAllByText('Yes')).toHaveLength(2));
        await waitFor(() => expect(document.activeElement).toBe(gridcell));
        expect(document.activeElement).not.toBe(document.body);
      })();
      cleanup();
      // marks the reopened editor invalid and links the cell error
      await (async () => {
        render(GridEditingHarness);
        await fireEvent.dblClick(screen.getByText('120').closest('[data-tx-edit-cell]')!);
        const input = await screen.findByDisplayValue('120');
        await fireEvent.input(input, { target: { value: 'abc' } });
        await fireEvent.keyDown(input, { key: 'Enter' });
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());

        await fireEvent.dblClick(screen.getByText('120').closest('[data-tx-edit-cell]')!);
        const reopened = await screen.findByDisplayValue('120');
        expect(reopened.getAttribute('aria-invalid')).toBe('true');
        const describedBy = reopened.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();
        expect(document.getElementById(describedBy!)?.textContent).toMatch(/number/i);
      })();
      cleanup();
      // announces how many cells a paste wrote
      await (async () => {
        render(GridEditingHarness);
        const name = screen.getByText('Harbor Notes').closest('[data-tx-edit-cell]') as HTMLElement;
        name.focus();
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { readText: async () => 'Alpha\nBeta' },
        });
        try {
          await fireEvent.keyDown(name, { key: 'v', ctrlKey: true });
          await waitFor(() => expect(screen.getByText('Pasted 2 cells.')).toBeTruthy());
          await waitFor(() => expect(screen.getByText('Alpha')).toBeTruthy());
        } finally {
          delete (navigator as unknown as { clipboard?: unknown }).clipboard;
        }
      })();
      cleanup();
      // labels the boolean save button through labels.save
      await (async () => {
        render(EditableDataGrid, {
          props: {
            rows: [
              { id: 'b1', name: 'Beacon', active: false },
              { id: 'b2', name: 'Cairn', active: true },
            ],
            columns: [
              { key: 'name', header: 'Deal', type: 'text' },
              { key: 'active', header: 'Active', type: 'boolean', editable: true },
            ],
            getRowId: (row: unknown) => (row as Deal).id,
            caption: 'Switch grid',
            onCommit: () => {},
            labels: { save: 'Keep' },
          },
        });
        await fireEvent.dblClick(screen.getByText('No').closest('[data-tx-edit-cell]')!);
        expect(await screen.findByRole('button', { name: 'Keep' })).toBeTruthy();
      })();
      cleanup();
      // leaves the date editor typeable on touch keyboards
      await (async () => {
        render(EditableDataGrid, {
          props: {
            rows: [{ id: 't1', name: 'Tempora', due: '2026-01-31' }],
            columns: [{ key: 'due', header: 'Due', type: 'date', editable: true }],
            getRowId: (row: unknown) => (row as { id: string }).id,
            caption: 'Date grid',
            onCommit: () => {},
          },
        });
        await fireEvent.dblClick(screen.getByText('2026-01-31').closest('[data-tx-edit-cell]')!);
        const input = await screen.findByDisplayValue('2026-01-31');
        // inputmode="none" hides the soft keyboard entirely: a phone user could
        // never type the draft.
        expect(input.getAttribute('inputmode')).not.toBe('none');
      })();
      cleanup();
      {
        // keeps grid-editing.css free of hardcoded color literals
        const css = readFileSync(
          join(import.meta.dirname, '../src/grid-editing/grid-editing.css'),
          'utf8'
        );
        const literals = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
        expect(literals).toEqual([]);
      }
    });
  });
});
