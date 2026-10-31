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
  defaultValue,
  emptyFilter,
  FilterBuilder,
  type FilterField,
  type FilterGroup,
  type FilterOperatorDef,
  type FilterSegment,
  filterIssues,
  groupFields,
  isComplete,
  newCondition,
  nodeAt,
  operatorsFor,
  parseFilter,
  parseSegment,
  pruneFilter,
  removeAt,
  serializeSegment,
  setCombinator,
} from '../src/filter-builder/index.ts';
import FilterBuilderHarness from './fixtures/FilterBuilderHarness.svelte';
import FilterCatalogHarness from './fixtures/FilterCatalogHarness.svelte';

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

  it('keeps typed decimals in number and range inputs while they read as the model value', async () => {
    render(FilterBuilderHarness, {
      props: {
        value: {
          type: 'group',
          op: 'and',
          children: [
            { type: 'condition', field: 'amount', operator: 'eq' },
            { type: 'condition', field: 'amount', operator: 'between', value: [null, null] },
          ],
        },
      },
    });
    const first = screen.getByRole('group', { name: 'Condition 1' });
    const second = screen.getByRole('group', { name: 'Condition 2' });
    const one = within(first).getByRole('spinbutton', { name: 'Value' }) as HTMLInputElement;
    const from = within(second).getByRole('spinbutton', { name: 'From' }) as HTMLInputElement;
    // Typing "1.05": "1." reads as empty in a browser (happy-dom does not
    // sanitize, so the events carry what a browser reports), then "1.0", "1.05".
    for (const input of [one, from]) {
      for (const [typed, read] of [
        ['', ''],
        ['1.0', '1.0'],
        ['1.05', '1.05'],
      ] as const) {
        await fireEvent.input(input, { target: { value: typed } });
        await tick();
        expect(input.value, typed).toBe(read);
      }
    }
    expect(model().children).toEqual([
      { type: 'condition', field: 'amount', operator: 'eq', value: 1.05 },
      { type: 'condition', field: 'amount', operator: 'between', value: [1.05, null] },
    ]);
    await fireEvent.input(one, { target: { value: '2.50' } });
    await tick();
    expect(one.value).toBe('2.50');
    // A model change from outside still replaces the text.
    await fireEvent.click(screen.getByRole('button', { name: 'Set first value to 7' }));
    await tick();
    expect(one.value).toBe('7');
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

describe('filter builder property catalog (G49)', () => {
  type Account = { name: string; plan: string; seats: number; tags: string[]; renews: string };
  const accounts: Account[] = [
    { name: 'Harbor', plan: 'team', seats: 40, tags: ['beta'], renews: '2026-11-01' },
    { name: 'Atlas', plan: 'free', seats: 3, tags: [], renews: '2027-01-15' },
    { name: 'Pine', plan: 'enterprise', seats: 900, tags: ['beta', 'vip'], renews: '2026-12-01' },
  ];
  const catalogFields: FilterField<Account>[] = [
    { key: 'name', header: 'Account', type: 'text' },
    {
      key: 'plan',
      header: 'Plan',
      type: 'enum',
      options: ['free', 'team', 'enterprise'],
      group: 'billing',
    },
    { key: 'seats', header: 'Seats', type: 'number', group: 'usage', operators: ['eq', 'atLeast'] },
    {
      key: 'tags',
      header: 'Tags',
      type: 'text',
      operators: ['hasTag', 'isEmpty'],
      accessor: (row) => row.tags.join(','),
    },
    { key: 'renews', header: 'Renews', type: 'date', group: 'billing' },
  ];
  const operators: FilterOperatorDef<Account>[] = [
    {
      id: 'atLeast',
      label: 'is at least',
      editor: 'number',
      types: ['number'],
      validate: (value) => ((value as number) < 0 ? 'Seats are never negative' : null),
      test: (cell, value) => typeof cell === 'number' && cell >= (value as number),
    },
    {
      id: 'hasTag',
      label: 'has tag',
      editor: 'option',
      options: ['beta', 'vip'],
      types: ['text'],
      test: (_cell, value, row) => row.tags.includes(value as string),
    },
    {
      id: 'renewsWithin',
      label: 'renews between',
      editor: 'range',
      types: ['date'],
      test: (cell, value) => {
        const [low, high] = (value as string[]).map((day) => Date.parse(day));
        const at = Date.parse(String(cell));
        return at >= (low as number) && at <= (high as number);
      },
    },
    {
      id: 'explodes',
      label: 'explodes',
      editor: 'none',
      types: ['enum'],
      test: () => {
        throw new Error('host bug');
      },
    },
  ];
  const named = (list: Account[]) => list.map((row) => row.name);
  const condition = (field: string, operator: string, value?: unknown): FilterGroup => ({
    type: 'group',
    op: 'and',
    children: [
      { type: 'condition', field, operator, ...(value === undefined ? {} : { value }) } as never,
    ],
  });

  it('offers, defaults, completes, validates and runs host operators through applyFilter', () => {
    const seats = catalogFields[2] as FilterField;
    const tags = catalogFields[3] as FilterField;
    // A field's own list wins; otherwise built-ins then fitting catalog operators.
    expect(operatorsFor(seats, operators as never)).toEqual(['eq', 'atLeast']);
    expect(operatorsFor(tags, operators as never)).toEqual(['hasTag', 'isEmpty']);
    expect(operatorsFor(catalogFields[4] as FilterField, operators as never)).toContain(
      'renewsWithin'
    );
    expect(operatorsFor(catalogFields[0] as FilterField, operators as never)).not.toContain(
      'atLeast'
    );
    // Defaults and completeness follow the editor.
    expect(newCondition(tags, operators as never)).toEqual({
      type: 'condition',
      field: 'tags',
      operator: 'hasTag',
      value: 'beta',
    });
    expect(
      defaultValue('renewsWithin', catalogFields[4] as FilterField, operators as never)
    ).toEqual([null, null]);
    expect(
      isComplete({ type: 'condition', field: 'seats', operator: 'atLeast' }, operators as never)
    ).toBe(false);
    // Host predicates run (with the row, and the cell through the accessor).
    expect(
      named(applyFilter(accounts, condition('seats', 'atLeast', 40), catalogFields, operators))
    ).toEqual(['Harbor', 'Pine']);
    expect(
      named(applyFilter(accounts, condition('tags', 'hasTag', 'vip'), catalogFields, operators))
    ).toEqual(['Pine']);
    expect(
      named(
        applyFilter(
          accounts,
          condition('renews', 'renewsWithin', ['2026-10-01', '2026-11-30']),
          catalogFields,
          operators
        )
      )
    ).toEqual(['Harbor']);
    // A host test that throws matches nothing; mixed with built-ins in groups.
    expect(applyFilter(accounts, condition('plan', 'explodes'), catalogFields, operators)).toEqual(
      []
    );
    const mixed: FilterGroup = {
      type: 'group',
      op: 'or',
      children: [
        { type: 'condition', field: 'plan', operator: 'eq', value: 'free' },
        { type: 'condition', field: 'seats', operator: 'atLeast', value: 500 },
      ],
    };
    expect(named(applyFilter(accounts, mixed, catalogFields, operators))).toEqual([
      'Atlas',
      'Pine',
    ]);
    // Validation: value shape, options, host message, offered operators, unknown ids.
    expect(
      filterIssues(condition('seats', 'atLeast', -1), catalogFields, operators as never)
    ).toEqual([{ path: [0], message: 'Seats are never negative' }]);
    expect(
      filterIssues(condition('seats', 'atLeast', 'many'), catalogFields, operators as never)[0]
        ?.message
    ).toContain('a number');
    expect(
      filterIssues(condition('tags', 'hasTag', 'gold'), catalogFields, operators as never)[0]
        ?.message
    ).toContain('not an option');
    expect(
      filterIssues(condition('seats', 'neq', 3), catalogFields, operators as never)[0]?.message
    ).toContain('does not apply');
    expect(
      filterIssues(condition('name', 'atLeast', 3), catalogFields, operators as never)[0]?.message
    ).toContain('does not apply');
    expect(() => parseFilter(condition('seats', 'atLeast', 3), catalogFields)).toThrow();
    expect(
      parseFilter(condition('seats', 'atLeast', 3), catalogFields, operators as never)
    ).toEqual(condition('seats', 'atLeast', 3));
    // A catalog operator of the same value shape keeps the value.
    const changed = changeOperator(
      condition('seats', 'eq', 3),
      [0],
      'atLeast',
      seats,
      operators as never
    );
    expect(nodeAt(changed, [0])).toMatchObject({ operator: 'atLeast', value: 3 });
    // Bad catalogs are developer errors.
    const bad = (def: Partial<FilterOperatorDef>) => () =>
      applyFilter(
        [],
        emptyFilter(),
        [],
        [{ label: 'x', editor: 'none', test: () => true, id: 'ok', ...def } as FilterOperatorDef]
      );
    expect(bad({ id: 'eq' })).toThrow(TypeError);
    expect(bad({ id: 'Bad id' })).toThrow(TypeError);
    expect(bad({ editor: 'slider' as never })).toThrow(TypeError);
    // Hostile models stay bounded.
    let deep: unknown = { type: 'condition', field: 'seats', operator: 'atLeast', value: 1 };
    for (let level = 0; level < 5_000; level += 1)
      deep = { type: 'group', op: 'and', children: [deep] };
    expect(() => parseFilter(deep, catalogFields, operators as never)).toThrow(/limited/);
  });

  it('groups fields and carries saved-segment metadata with the model', () => {
    expect(
      groupFields(catalogFields, [{ id: 'usage', label: 'Usage' }]).map((section) => [
        section.group?.label ?? null,
        section.fields.map((field) => field.key),
      ])
    ).toEqual([
      [null, ['name', 'tags']],
      ['Usage', ['seats']],
      ['billing', ['plan', 'renews']],
    ]);
    const segment: FilterSegment = {
      filter: condition('seats', 'atLeast', 40),
      updatedAt: '2026-10-28T09:30:00Z',
      owner: 'user-7',
      description: 'Accounts with 40 seats or more',
      name: 'Large accounts',
      id: 'seg-1',
    };
    const text = serializeSegment(segment);
    expect(Object.keys(JSON.parse(text))).toEqual([
      'id',
      'name',
      'description',
      'owner',
      'updatedAt',
      'filter',
    ]);
    const read = parseSegment(text, catalogFields, operators as never);
    expect(read).toEqual(JSON.parse(text));
    expect(serializeSegment(read)).toBe(text);
    expect(named(applyFilter(accounts, read.filter, catalogFields, operators))).toEqual([
      'Harbor',
      'Pine',
    ]);
    // Untrusted metadata is bounded and checked.
    for (const input of [
      { ...segment, updatedAt: 'yesterday' },
      { ...segment, name: '' },
      { ...segment, id: 'x'.repeat(200) },
      { ...segment, extra: true },
      { ...segment, filter: condition('seats', 'atLeast', -5) },
      'not json',
    ]) {
      expect(() => parseSegment(input, catalogFields, operators as never)).toThrow();
    }
    // Optional metadata is optional; a bare condition is wrapped.
    expect(
      parseSegment(
        {
          id: 's',
          name: 'S',
          filter: { type: 'condition', field: 'name', operator: 'contains', value: 'a' },
        },
        catalogFields
      )
    ).toEqual({ id: 's', name: 'S', filter: condition('name', 'contains', 'a') });
  });
});

describe('FilterBuilder with a property catalog (G49)', () => {
  const model = () => JSON.parse(screen.getByTestId('model').textContent ?? '{}') as FilterGroup;
  const matches = () => screen.getByTestId('matches').textContent;

  it('groups the field menu, offers host operators with their typed editor and flags host validation', async () => {
    render(FilterCatalogHarness, {
      props: { value: condition('seats', 'eq', 3) },
    });
    const first = screen.getByRole('group', { name: 'Condition 1' });
    const fieldSelect = within(first).getByRole('combobox', { name: 'Field' });
    expect([...fieldSelect.querySelectorAll('optgroup')].map((group) => group.label)).toEqual([
      'Billing',
      'Usage',
    ]);
    const operator = within(first).getByRole('combobox', { name: 'Operator' }) as HTMLSelectElement;
    const option = [...operator.options].find((entry) => entry.value === 'atLeastSeats');
    expect(option?.textContent).toBe('has at least');
    await fireEvent.change(operator, { target: { value: 'atLeastSeats' } });
    expect(model().children[0]).toMatchObject({ operator: 'atLeastSeats', value: 3 });
    const value = within(first).getByRole('spinbutton', { name: 'Value' }) as HTMLInputElement;
    await fireEvent.input(value, { target: { value: '40' } });
    expect(matches()).toBe('a1,a3');
    await fireEvent.input(value, { target: { value: '5000' } });
    await tick();
    expect(value.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(value.getAttribute('aria-describedby') ?? '')?.textContent).toBe(
      'At most 1000 seats'
    );
    // An invalid condition is skipped, so every account matches.
    expect(matches()).toBe('a1,a2,a3');
  });

  function condition(field: string, operator: string, value: unknown): FilterGroup {
    return {
      type: 'group',
      op: 'and',
      children: [{ type: 'condition', field, operator, value } as never],
    };
  }
});

describe('FilterBuilder host issues and labelled options (G101)', () => {
  const labelled: FilterField<Row>[] = [
    { key: 'name', header: 'Name', type: 'text' },
    {
      key: 'stage',
      header: 'Stage',
      type: 'enum',
      options: [
        { value: 'open', label: 'Open deal' },
        { value: 'won', label: 'Closed won' },
        'lost',
      ],
    },
    { key: 'amount', header: 'Amount', type: 'number' },
    { key: 'closes', header: 'Closes', type: 'date' },
  ];
  const model: FilterGroup = {
    type: 'group',
    op: 'and',
    children: [
      { type: 'condition', field: 'stage', operator: 'eq', value: 'archived' },
      { type: 'condition', field: 'name', operator: 'isEmpty' },
      {
        type: 'group',
        op: 'or',
        children: [{ type: 'condition', field: 'amount', operator: 'between', value: [1, 2] }],
      },
    ],
  };
  const describedText = (element: HTMLElement) =>
    (element.getAttribute('aria-describedby') ?? '')
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' | ');

  it('merges host issues into each condition and marks its value control, or its operator when it has none', async () => {
    const view = render(FilterBuilder, {
      props: {
        fields: labelled,
        value: model,
        issues: [
          { path: [0], message: 'Stage is locked for this segment' },
          { path: [1], message: 'Name is never empty here' },
          { path: [2, 0], message: 'Use a wider range' },
          // A group path and a missing path are ignored.
          { path: [2], message: 'ignored group' },
          { path: [9], message: 'ignored missing' },
        ],
      },
    });
    const [first, second] = screen.getAllByRole('group', { name: 'Condition 1' }) as HTMLElement[];
    const stage = within(first as HTMLElement).getByRole('combobox', { name: 'Value' });
    expect(stage.getAttribute('aria-invalid')).toBe('true');
    // The built-in issue and the host's, in that order.
    expect(describedText(stage)).toMatch(/archived is not an option of Stage.*Stage is locked/);
    const name = screen.getByRole('group', { name: 'Condition 2' });
    const operator = within(name).getByRole('combobox', { name: 'Operator' });
    expect(operator.getAttribute('aria-invalid')).toBe('true');
    expect(describedText(operator)).toBe('Name is never empty here');
    for (const end of [
      within(second as HTMLElement).getByRole('spinbutton', { name: 'From' }),
      within(second as HTMLElement).getByRole('spinbutton', { name: 'To' }),
    ]) {
      expect(end.getAttribute('aria-invalid')).toBe('true');
      expect(describedText(end)).toBe('Use a wider range');
    }
    expect(document.body.textContent).not.toMatch(/ignored/);
    // Clearing the host issues leaves only the built-in one.
    await view.rerender({ fields: labelled, value: model, issues: [] });
    expect(describedText(stage)).not.toMatch(/locked/);
    expect(operator.getAttribute('aria-invalid')).toBeNull();
    expect(operator.hasAttribute('aria-describedby')).toBe(false);
  });

  it('accepts enum options as { value, label } or strings: labels show, values are stored and checked', async () => {
    const stage = labelled[1] as FilterField;
    expect(defaultValue('eq', stage)).toBe('open');
    expect(names(applyFilter(rows, condition('stage', 'in', ['open', 'lost']), labelled))).toEqual([
      'Atlas',
      'Pine',
    ]);
    expect(parseFilter(condition('stage', 'eq', 'won'), labelled).children).toHaveLength(1);
    expect(() => parseFilter(condition('stage', 'eq', 'Closed won'), labelled)).toThrow(/option/);
    expect(filterIssues(condition('stage', 'eq', 'archived'), labelled)).toHaveLength(1);
    render(FilterBuilder, { props: { fields: labelled, value: condition('stage', 'eq', 'won') } });
    const value = screen.getByRole('combobox', { name: 'Value' }) as HTMLSelectElement;
    expect(value.value).toBe('won');
    expect([...value.options].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'Choose…'],
      ['open', 'Open deal'],
      ['won', 'Closed won'],
      ['lost', 'lost'],
    ]);
    const operator = screen.getByRole('combobox', { name: 'Operator' });
    await fireEvent.change(operator, { target: { value: 'in' } });
    const many = screen.getByRole('listbox', { name: 'Value' }) as HTMLSelectElement;
    expect([...many.options].map((option) => option.textContent)).toEqual([
      'Open deal',
      'Closed won',
      'lost',
    ]);
  });

  function condition(field: string, operator: string, value: unknown): FilterGroup {
    return {
      type: 'group',
      op: 'and',
      children: [{ type: 'condition', field, operator, value } as never],
    };
  }
});
