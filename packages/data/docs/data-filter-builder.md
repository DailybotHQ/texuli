# Filter builder

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/filter-builder` (also `FilterBuilder` and `applyFilter` from `@texuli/data`)  
**Model:** `packages/data/src/filter-builder/model.ts` (framework-free)  
**View:** `packages/data/src/filter-builder/`  
**Tests:** `packages/data/tests/filter-builder.test.ts`  
**Example:** `data-filter-builder`

## Goal

Author the grid engine's filter AST (`FilterGroup` and `FilterCondition`, the
same JSON a `DataGrid` takes as `filter`) with nested and/or groups, operators
that fit each field's type, and native controls that work from the keyboard
alone. The model is plain JSON: save it, load it back with `parseFilter`, and
run it anywhere with the pure `applyFilter(rows, model, fields?)`.

## Usage

```svelte
<script lang="ts">
  import { applyFilter, FilterBuilder, type FilterGroup, pruneFilter } from '@texuli/data/filter-builder';
  import { DataGrid, type DataGridColumn } from '@texuli/data/grid-core';

  const columns: DataGridColumn<Deal>[] = [
    { key: 'name', header: 'Deal', type: 'text' },
    { key: 'stage', header: 'Stage', type: 'enum', options: ['Open', 'Won', 'Lost'] },
    { key: 'amount', header: 'Amount', type: 'number' },
  ];
  let model = $state<FilterGroup>({ type: 'group', op: 'and', children: [] });
  const matches = $derived(applyFilter(deals, model, columns));
</script>

<FilterBuilder fields={columns} bind:value={model} />
<DataGrid rows={deals} {columns} getRowId={(d) => d.id} caption="Deals" filter={pruneFilter(model, columns)} />
```

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `fields` | required | `FilterField[]`: `key`, `header`, `type` (`text`, `number`, `date`, `boolean`, `enum`), `options` for enums, optional `accessor`, `group` (a field group id) and `operators` (the operators it offers, in menu order). DataGrid columns work as they are |
| `operators` | none | Host operators of a property catalog (`FilterOperatorDef[]`, below) |
| `groups` | none | `FilterFieldGroup[]` (`id`, `label`): the field menu's `<optgroup>` sections, in order |
| `value` | empty `and` group | `bind:value`: the model. `onValueChange(model)` on every edit |
| `maxDepth` | `3` | Deepest group level offered (the root is 1), capped at 5: the engine allows 6 levels and the deepest group still holds conditions |
| `disabled` | `false` | Disables every control |
| `labels` | English | Every visible and announced string, including the operator names (`resolveFilterBuilderLabels`) |
| `class` | none | Classes on the root |

## Behavior

- **Structure:** the root and each nested group are a `fieldset` with a `legend` ("Filters", "Group 2"); each condition is a `fieldset` with a hidden legend ("Condition 1"). A group's combinator is a labelled native select ("Match [all/any] of these conditions"). A new nested group starts with the other combinator.
- **Operators by type** (`operatorsFor`, the engine's `OPERATORS_BY_TYPE`): text `is`, `is not`, `contains`, `is any of`, `is empty`, `is not empty` (new text conditions start at `contains`); enums add a select of options and a multi-select for `is any of`; numbers add `is between` (two number inputs labelled From and To); dates add `is before`, `is after` and `is between` (date inputs); booleans use a Yes/No select.
- **Values:** `is any of` on text or numbers is a comma-separated text field (described as such); changing the field keeps the operator when it still fits and resets the value; changing the operator keeps the value when its shape (one value, a list, a pair) still fits.
- **Incomplete conditions** (no value yet) are part of the model while you type; `pruneFilter` and `applyFilter` skip them. Complete conditions that do not fit the fields (an enum value outside its options, text in a number field) get `aria-invalid` and a described error from `filterIssues`, and are skipped too.
- **Focus:** adding a condition focuses its field select; adding a group focuses its combinator; removing focuses the parent group's Add condition button. A polite live region says "Condition added.", "Group added." or "Removed.".
- **Keyboard:** every control is a native `select`, `input` or `button` in reading order, so Tab, Shift+Tab, the arrow keys in selects, Enter and Space are all it needs.

## Model helpers

All pure; they return a new model and never mutate the input.

| Helper | What it does |
| --- | --- |
| `emptyFilter(op?)` | An empty root group (matches every row) |
| `addCondition(root, groupPath, fields)`, `addGroup(root, groupPath, fields)` | Append a condition on the first field, or a nested group with one condition (refused past the depth limit) |
| `removeAt(root, path)`, `setCombinator(root, groupPath, op)` | Remove a node; set a group's `and`/`or` |
| `changeField`, `changeOperator`, `changeValue` | Edit the condition at a path |
| `newCondition(field)`, `defaultValue(operator, field)`, `operatorsFor(field)`, `isComplete(condition)`, `nodeAt(root, path)`, `depthOf(path)` | Building blocks |
| `pruneFilter(root, fields?)` | The runnable part: incomplete (and, with `fields`, invalid) conditions and the groups they empty removed |
| `filterIssues(root, fields)` | `{ path, message }` for complete conditions that do not fit the fields |
| `parseFilter(input, fields)` | Reads saved, untrusted JSON (bounded: 6 levels, 200 nodes), checks it against the fields and throws a `ValidationError`; a bare condition is wrapped in an `and` group. Save `pruneFilter(model)` when the model may hold incomplete conditions |
| `applyFilter(rows, model, fields?, operators?)` | The rows the model matches, in order. Without `fields`, each field reads `row[key]` and its type is inferred from the values (numbers, booleans, dates for `before`/`after`/`between`, else text). Catalog operators run through their host `test` |

Every helper that offers, defaults, completes or validates (`addCondition`,
`addGroup`, `changeField`, `changeOperator`, `newCondition`,
`defaultValue`, `operatorsFor`, `isComplete`, `pruneFilter`,
`filterIssues`, `parseFilter`) takes the same optional `operators` as its
last argument.

Paths are child indexes from the root (`[]` is the root, `[1, 0]` the first
child of the root's second child).

## Property catalog (G49)

A host with its own properties extends the builder with operators, field
groups and saved segments. The saved model stays data: a condition stores
the operator `id`, and the code that runs it lives in the catalog.

```ts
import {
  applyFilter,
  type FilterField,
  type FilterOperatorDef,
  parseSegment,
  serializeSegment,
} from '@texuli/data/filter-builder';

const fields: FilterField<Account>[] = [
  { key: 'plan', header: 'Plan', type: 'enum', options: ['free', 'team'], group: 'billing' },
  { key: 'seats', header: 'Seats', type: 'number', group: 'usage', operators: ['eq', 'atLeast'] },
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
];
applyFilter(rows, model, fields, operators);
```

- **`FilterOperatorDef`**: `id` (`[a-z][a-zA-Z0-9_-]{0,31}`, never a
  built-in name), `label` (the menu text), `editor`, optional `types` (the
  field types that offer it when a field lists no `operators`; default
  every type), `options`, `defaultValue`, `validate(value, field)` (a
  returned message refuses the value and is shown as the condition's
  issue) and `test(cell, value, row)` (the cell is read through the field's
  `accessor`; a `test` that throws does not match). A bad or built-in id, a
  duplicate, an empty label, an unknown editor or a missing `test` throws a
  `TypeError`.
- **Editors** (`FILTER_VALUE_EDITORS`, `FilterValueEditor`): `none` (no
  value), `text`, `number`, `date`, `boolean`, `option` (one of `options`,
  default the field's), `options` (a list of 1 to 100 of them) and `range`
  (`[low, high]`: numbers, or dates on a date field). Each maps to the same
  native control the built-ins use, and the value shape is checked before
  `validate` runs.
- **Validation and running**: `catalogSchema(fields, operators)` checks a
  model (built-in conditions by the grid engine's rules, each field's
  `operators` list, and catalog values), bounded like the engine (6 levels,
  200 nodes, measured without recursion). `compileCatalogFilter(model,
  fields, operators)` returns the predicate `applyFilter` uses. The grid
  engine (`DataGrid`'s `filter`) refuses catalog operators: run them with
  `applyFilter`. `FilterAnyOperator` and `FilterCustomOperatorId` type an
  operator that may be a catalog id.
- **Field groups**: `groupFields(fields, groups?)` returns the menu
  sections: ungrouped fields first, then `groups` in order, then groups
  only named by fields (labeled by their id).
- **Saved segments** (`FilterSegment`): `id`, `name`, optional
  `description`, `owner` and `updatedAt` (ISO 8601), and `filter` (the
  model; `bind:value={segment.filter}`). `serializeSegment(segment)` writes
  JSON in a stable key order; `parseSegment(input, fields, operators?)`
  reads an object or its JSON text, bounds the metadata
  (`FILTER_SEGMENT_LIMITS`: id 128, name 120, description 2,000, owner 128
  characters, 200,000 characters of JSON), checks the filter against the
  catalog and throws a `ValidationError`.

## Verified

- `pnpm vitest run packages/data/tests/filter-builder.test.ts`: **8 tests** (3 for the property catalog: offered operators, defaults, completeness, host validation, host predicates mixed with built-ins, a throwing predicate, bad catalogs, a 5,000-deep model, field groups, segment round trip and hostile metadata, and the view's optgroups, catalog operator menu, typed editor and host issue).
  - Model: immutable edits by path, field and operator changes, nested groups and combinators, pruning, the depth limit, JSON round trip and parse errors, issues by path, type inference without fields.
  - View: labelled native controls by field type (text, number pair, enum multi-select, comma list with its hint, boolean, date), the model and the matching rows after each edit, focus after add and remove, the live announcement, `aria-invalid` with a described error, `maxDepth`, loading a saved model.
- In the browser (a scratch spec on port 4937): the `data-filter-builder` example passes axe in light, dark and forced colors on Chromium, WebKit and the Pixel 7, and on Chromium and the Pixel 7 a condition can be added, filled and removed with Tab and Enter alone (WebKit's default Tab order skips buttons, so that step was not run there).

## Limits

- No drag reordering of conditions; remove and add instead.
- Values are typed into native inputs; there is no value autocomplete from the data.
- `parseFilter` refuses incomplete conditions (the engine's schema); save the pruned model or keep drafts in your own storage.
