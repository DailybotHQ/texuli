import { createWorkbook, displayValue, validateSheet } from '@texuli/sheets/model';
import { describe, expect, it } from 'vitest';
import { createProjectBudgetFixture } from '../../src/components/solutions/sheets/demo/fixtures/project-budget.ts';
import { createSheetsDemoModel } from '../../src/components/solutions/sheets/demo/model.ts';

describe('sheets solution demo model', () => {
  it('starts from a deterministic Project budget with real calculated totals', () => {
    const fixture = createProjectBudgetFixture();
    const checked = validateSheet(fixture);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const workbook = createWorkbook(checked.sheet);
    const model = createSheetsDemoModel();
    expect(createProjectBudgetFixture()).toEqual(fixture);
    expect(model.state.document).toEqual(workbook.toDocument());
    expect([
      displayValue(workbook.value('budget', 1, 3)),
      displayValue(workbook.value('budget', 2, 3)),
      displayValue(workbook.value('budget', 3, 3)),
      displayValue(workbook.value('budget', 4, 3)),
    ]).toEqual(['360', '196', '210', '766']);
  });

  it('edits a quantity and exposes the formulas the real engine recalculated', () => {
    const model = createSheetsDemoModel();
    const state = model.dispatch({ type: 'edit-cell', address: 'B2', value: '4' });
    const checked = validateSheet(state.document);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const workbook = createWorkbook(checked.sheet);
    expect(displayValue(workbook.value('budget', 1, 3))).toBe('480');
    expect(displayValue(workbook.value('budget', 4, 3))).toBe('886');
    expect(state.recalculated).toEqual(['Budget!B2', 'Budget!D2', 'Budget!D5']);
    expect(state.lastAction).toContain('2 formulas evaluated');
    expect(state.formulas).toEqual([]);
  });

  it('reveals formula text, computed values and static dependencies on request', () => {
    const model = createSheetsDemoModel();
    const hidden = model.state;
    expect(hidden.showFormulas).toBe(false);
    expect(hidden.formulaCount).toBe(4);
    expect(hidden.formulas).toEqual([]);

    const shown = model.dispatch({ type: 'toggle-formulas' });
    expect(shown.showFormulas).toBe(true);
    expect(shown.formulas).toHaveLength(4);
    expect(shown.formulas.find(({ address }) => address === 'D2')).toMatchObject({
      formula: '=B2*C2',
      value: '360',
      reads: ['B2', 'C2'],
    });
    expect(shown.formulas.find(({ address }) => address === 'D5')).toMatchObject({
      formula: '=SUM(D2:D4)',
      value: '766',
      reads: ['D2:D4'],
    });
    expect(model.dispatch({ type: 'toggle-formulas' }).formulas).toEqual([]);
  });

  it('adds a budget line and lets the package rewrite and recalculate the total range', () => {
    const model = createSheetsDemoModel();
    const state = model.dispatch({ type: 'add-line-item' });
    const checked = validateSheet(state.document);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    const workbook = createWorkbook(checked.sheet);
    expect(workbook.input('budget', 3, 0)).toBe('Accessibility review');
    expect(workbook.input('budget', 5, 3)).toBe('=SUM(D2:D5)');
    expect(displayValue(workbook.value('budget', 3, 3))).toBe('170');
    expect(displayValue(workbook.value('budget', 5, 3))).toBe('936');
    expect(state.formulaCount).toBe(5);
  });

  it('reset restores the fixture, clears formula details and resets the add-row position', () => {
    const model = createSheetsDemoModel();
    model.dispatch({ type: 'edit-cell', address: 'B2', value: '4' });
    model.dispatch({ type: 'add-line-item' });
    model.dispatch({ type: 'toggle-formulas' });

    const reset = model.dispatch({ type: 'reset' });
    const checked = validateSheet(createProjectBudgetFixture());
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(reset.document).toEqual(createWorkbook(checked.sheet).toDocument());
    expect(reset.showFormulas).toBe(false);
    expect(reset.formulas).toEqual([]);
    expect(reset.formulaCount).toBe(4);
    expect(reset.lastAction).toBe('Reset to the original Project budget.');

    const afterResetAdd = model.dispatch({ type: 'add-line-item' });
    expect(afterResetAdd.document.sheets[0]?.cells?.A4).toBe('Accessibility review');
  });

  it('rejects cell addresses outside the fixture without changing its document', () => {
    const model = createSheetsDemoModel();
    const before = model.state.document;
    const state = model.dispatch({ type: 'edit-cell', address: 'Z99', value: '12' });

    expect(state.error).toBe('Choose a cell inside the Project budget sheet.');
    expect(state.document).toEqual(before);
    expect(state.lastAction).toBe('The cell edit was not applied.');
  });
});
