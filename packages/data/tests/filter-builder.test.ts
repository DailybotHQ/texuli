import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addCondition,
  addGroup,
  applyFilter,
  changeField,
  changeOperator,
  changeValue,
  emptyFilter,
  type FilterField,
  type FilterGroup,
  filterIssues,
  isComplete,
  newCondition,
  nodeAt,
  parseFilter,
  pruneFilter,
  removeAt,
  setCombinator,
} from '../src/filter-builder/index.ts';
import FilterBuilderHarness from './fixtures/FilterBuilderHarness.svelte';

afterEach(() => cleanup());

type Row = { name: string; stage: string; amount: number | null; closes: string };
const fields: FilterField<Row>[] = [
  { key: 'name', header: 'Name', type: 'text' },
  { key: 'stage', header: 'Stage', type: 'enum', options: ['open', 'won', 'lost'] },
  { key: 'amount', header: 'Amount', type: 'number' },
  { key: 'closes', header: 'Closes', type: 'date' },
];
const rows: Row[] = [
  { name: 'Harbor', stage: 'won', amount: 100, closes: '2026-01-10' },
  { name: 'Atlas', stage: 'open', amount: 50, closes: '2026-03-01' },
  { name: 'Pine', stage: 'lost', amount: null, closes: '2026-02-01' },
];
const names = (list: Row[]) => list.map((row) => row.name);

describe('filter builder model (G18)', () => {
  it('edits a nested and/or model immutably, prunes incomplete conditions and applies it purely', () => {
    // A fresh model matches everything; new conditions start incomplete.
    let model = emptyFilter();
    expect(names(applyFilter(rows, model, fields))).toEqual(['Harbor', 'Atlas', 'Pine']);
    model = addCondition(model, [], fields);
    expect(nodeAt(model, [0])).toEqual({ type: 'condition', field: 'name', operator: 'contains' });
    expect(isComplete(nodeAt(model, [0]) as never)).toBe(false);
    expect(names(applyFilter(rows, model, fields))).toHaveLength(3);
    // Field changes keep a fitting operator and reset the value.
    const before = model;
    model = changeField(model, [0], fields[2] as FilterField);
    expect(nodeAt(model, [0])).toEqual({ type: 'condition', field: 'amount', operator: 'eq' });
    expect(nodeAt(before, [0])).toMatchObject({ field: 'name' });
    model = changeOperator(model, [0], 'between', fields[2] as FilterField);
    expect(nodeAt(model, [0])).toMatchObject({ value: [null, null] });
    model = changeValue(model, [0], [40, 120]);
    expect(names(applyFilter(rows, model, fields))).toEqual(['Harbor', 'Atlas']);
    // A nested group starts with the other combinator: amount 40–120 AND (stage is won OR name contains "atl").
    model = addGroup(model, [], fields);
    expect(nodeAt(model, [1])).toMatchObject({ type: 'group', op: 'or' });
    model = changeField(model, [1, 0], fields[1] as FilterField);
    expect(nodeAt(model, [1, 0])).toEqual({
      type: 'condition',
      field: 'stage',
      operator: 'eq',
      value: 'open',
    });
    model = changeValue(model, [1, 0], 'won');
    model = addCondition(model, [1], fields);
    model = changeValue(model, [1, 1], 'atl');
    expect(names(applyFilter(rows, model, fields))).toEqual(['Harbor', 'Atlas']);
    model = setCombinator(model, [], 'or');
    model = changeValue(model, [0], [0, 10]);
    expect(names(applyFilter(rows, model, fields))).toEqual(['Harbor', 'Atlas']);
    model = removeAt(model, [1]);
    expect(model.children).toHaveLength(1);
    expect(names(applyFilter(rows, model, fields))).toEqual([]);
    expect(removeAt(model, [])).toEqual(emptyFilter('or'));
    // Pruning drops incomplete conditions and the groups they empty.
    const pruned = pruneFilter({
      type: 'group',
      op: 'and',
      children: [
        { type: 'condition', field: 'name', operator: 'contains', value: '' },
        {
          type: 'group',
          op: 'or',
          children: [{ type: 'condition', field: 'amount', operator: 'in', value: [] }],
        },
        { type: 'condition', field: 'amount', operator: 'isEmpty' },
      ],
    });
    expect(pruned.children).toEqual([{ type: 'condition', field: 'amount', operator: 'isEmpty' }]);
    // Depth is capped at the engine limit (6 levels, conditions included):
    // groups nest five deep, and the deepest model still parses.
    const stageFirst = [fields[1], fields[0]] as FilterField[];
    let deep: FilterGroup = emptyFilter();
    const path: number[] = [];
    for (let level = 0; level < 8; level++) {
      const next = addGroup(deep, path, stageFirst);
      if (next === deep) break;
      deep = next;
      path.push((nodeAt(deep, path) as FilterGroup).children.length - 1);
    }
    expect(path).toHaveLength(4);
    expect(() => parseFilter(deep, fields)).not.toThrow();
    expect(addGroup(deep, path, stageFirst)).toBe(deep);
  });

  it('serializes, parses, reports issues and infers types without fields', () => {
    const model: FilterGroup = {
      type: 'group',
      op: 'and',
      children: [
        { type: 'condition', field: 'stage', operator: 'in', value: ['open', 'won'] },
        { type: 'condition', field: 'closes', operator: 'before', value: '2026-02-15' },
      ],
    };
    // JSON round trip, validated against the fields.
    expect(parseFilter(JSON.parse(JSON.stringify(model)), fields)).toEqual(model);
    expect(
      parseFilter({ type: 'condition', field: 'amount', operator: 'isEmpty' }, fields)
    ).toEqual({
      type: 'group',
      op: 'and',
      children: [{ type: 'condition', field: 'amount', operator: 'isEmpty' }],
    });
    for (const bad of [
      { type: 'condition', field: 'nope', operator: 'eq', value: 1 },
      { type: 'condition', field: 'amount', operator: 'contains', value: 'x' },
      { type: 'group', op: 'xor', children: [] },
      { type: 'condition', field: 'name', operator: 'eq', value: 'x', extra: true },
    ]) {
      expect(() => parseFilter(bad, fields)).toThrow();
    }
    expect(names(applyFilter(rows, model, fields))).toEqual(['Harbor']);
    // Issues name the complete conditions that do not fit; incomplete ones are not issues.
    const issues = filterIssues(
      {
        type: 'group',
        op: 'and',
        children: [
          { type: 'condition', field: 'stage', operator: 'eq', value: 'archived' },
          {
            type: 'group',
            op: 'or',
            children: [{ type: 'condition', field: 'amount', operator: 'eq', value: 'ten' }],
          },
          { type: 'condition', field: 'amount', operator: 'eq' },
        ],
      },
      fields
    );
    expect(issues.map((issue) => issue.path)).toEqual([[0], [1, 0]]);
    expect(issues[0]?.message).toContain('archived');
    // Without fields: row[key], with types inferred from the values.
    const inferred = applyFilter(rows, {
      type: 'group',
      op: 'and',
      children: [
        { type: 'condition', field: 'amount', operator: 'between', value: [60, 200] },
        { type: 'condition', field: 'name', operator: 'contains', value: 'HAR' },
      ],
    });
    expect(names(inferred)).toEqual(['Harbor']);
    expect(
      names(
        applyFilter(rows, {
          type: 'group',
          op: 'or',
          children: [
            { type: 'condition', field: 'closes', operator: 'after', value: '2026-02-15' },
          ],
        })
      )
    ).toEqual(['Atlas']);
    // Starting values by type.
    expect(newCondition({ key: 'won', header: 'Won', type: 'boolean' })).toMatchObject({
      operator: 'eq',
      value: true,
    });
  });
});

describe('FilterBuilder (G18)', () => {
  const model = () => JSON.parse(screen.getByTestId('model').textContent ?? '{}') as FilterGroup;
  const matches = () => screen.getByTestId('matches').textContent;

  it('authors a nested filter with native, labelled, keyboard-reachable controls and moves focus on add and remove', async () => {
    render(FilterBuilderHarness);
    const builder = screen.getByRole('group', { name: 'Filters' });
    expect(within(builder).getByText('No conditions: every row matches.')).toBeTruthy();
    expect(matches()).toBe('d1,d2,d3');
    const match = within(builder).getByRole('combobox', { name: 'Match' });
    expect(match.getAttribute('aria-describedby')).toBeTruthy();

    // Add a condition: focus lands on its field select, and the change is announced.
    await fireEvent.click(within(builder).getByRole('button', { name: 'Add condition' }));
    await tick();
    await tick();
    const first = screen.getByRole('group', { name: 'Condition 1' });
    const field = within(first).getByRole('combobox', { name: 'Field' });
    expect(document.activeElement).toBe(field);
    expect(document.querySelector('[role="status"]')?.textContent).toBe('Condition added.');
    // Operators follow the field's type.
    const operator = () =>
      within(first).getByRole('combobox', { name: 'Operator' }) as HTMLSelectElement;
    expect([...operator().options].map((option) => option.value)).toContain('contains');
    await fireEvent.change(field, { target: { value: 'amount' } });
    expect([...operator().options].map((option) => option.value)).toEqual([
      'eq',
      'neq',
      'in',
      'between',
      'isEmpty',
      'isNotEmpty',
    ]);
    await fireEvent.change(operator(), { target: { value: 'between' } });
    const from = within(first).getByRole('spinbutton', { name: 'From' });
    const to = within(first).getByRole('spinbutton', { name: 'To' });
    await fireEvent.input(from, { target: { value: '1000' } });
    await fireEvent.input(to, { target: { value: '20000' } });
    expect(model().children[0]).toEqual({
      type: 'condition',
      field: 'amount',
      operator: 'between',
      value: [1000, 20000],
    });
    expect(matches()).toBe('d1,d2');

    // Add a nested OR group: stage is any of [won, lost] (a multi-select for enums).
    await fireEvent.click(
      within(builder).getAllByRole('button', { name: 'Add group' })[0] as HTMLElement
    );
    await tick();
    await tick();
    const group = screen.getByRole('group', { name: 'Group 2' });
    expect(document.activeElement).toBe(within(group).getByRole('combobox', { name: 'Match' }));
    expect((document.activeElement as HTMLSelectElement).value).toBe('or');
    const inner = within(group).getByRole('group', { name: 'Condition 1' });
    await fireEvent.change(within(inner).getByRole('combobox', { name: 'Field' }), {
      target: { value: 'stage' },
    });
    await fireEvent.change(within(inner).getByRole('combobox', { name: 'Operator' }), {
      target: { value: 'in' },
    });
    const multi = within(inner).getByRole('listbox', { name: 'Value' }) as HTMLSelectElement;
    for (const option of multi.options) option.selected = option.value !== 'open';
    await fireEvent.change(multi);
    expect(model().children[1]).toEqual({
      type: 'group',
      op: 'or',
      children: [{ type: 'condition', field: 'stage', operator: 'in', value: ['won', 'lost'] }],
    });
    expect(matches()).toBe('d1');

    // A text list (`in` on text) reads comma-separated values and says so.
    await fireEvent.click(within(group).getByRole('button', { name: 'Add condition' }));
    await tick();
    const second = within(group).getByRole('group', { name: 'Condition 2' });
    await fireEvent.change(within(second).getByRole('combobox', { name: 'Operator' }), {
      target: { value: 'in' },
    });
    const list = within(second).getByRole('textbox', { name: 'Value' });
    expect(list.getAttribute('aria-describedby')).toContain('hint');
    await fireEvent.change(list, { target: { value: 'Atlas pilot, , Pine expansion ' } });
    expect((model().children[1] as FilterGroup).children[1]).toMatchObject({
      value: ['Atlas pilot', 'Pine expansion'],
    });
    expect(matches()).toBe('d1,d2');

    // Booleans and dates get fitting native controls.
    await fireEvent.change(within(second).getByRole('combobox', { name: 'Field' }), {
      target: { value: 'won' },
    });
    expect(within(second).getByRole('combobox', { name: 'Value' })).toBeTruthy();
    await fireEvent.change(within(second).getByRole('combobox', { name: 'Field' }), {
      target: { value: 'closes' },
    });
    expect(within(second).getByLabelText('Value').getAttribute('type')).toBe('date');

    // Remove the nested group: focus returns to the root's add button.
    await fireEvent.click(within(group).getByRole('button', { name: 'Remove group 2' }));
    await tick();
    await tick();
    expect(screen.queryByRole('group', { name: 'Group 2' })).toBeNull();
    expect(document.activeElement).toBe(
      within(builder).getAllByRole('button', { name: 'Add condition' })[0]
    );
    expect(model().children).toHaveLength(1);
  });

  it('flags invalid values, honors maxDepth and loads a saved model', async () => {
    render(FilterBuilderHarness, {
      props: {
        maxDepth: 2,
        value: {
          type: 'group',
          op: 'and',
          children: [
            { type: 'condition', field: 'stage', operator: 'eq', value: 'archived' },
            {
              type: 'group',
              op: 'or',
              children: [{ type: 'condition', field: 'won', operator: 'eq', value: true }],
            },
          ],
        },
      },
    });
    const first = screen.getAllByRole('group', { name: 'Condition 1' })[0] as HTMLElement;
    expect(
      (within(first).getByRole('combobox', { name: 'Field' }) as HTMLSelectElement).value
    ).toBe('stage');
    const value = within(first).getByRole('combobox', { name: 'Value' });
    expect(value.getAttribute('aria-invalid')).toBe('true');
    const issueId = value.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(issueId)?.textContent).toContain('archived');
    // maxDepth 2: the root offers groups, the nested group does not.
    expect(screen.getAllByRole('button', { name: 'Add group' })).toHaveLength(1);
    await fireEvent.change(value, { target: { value: 'won' } });
    expect(value.getAttribute('aria-invalid')).toBeNull();
    expect(matches()).toBe('d1');
  });
});
