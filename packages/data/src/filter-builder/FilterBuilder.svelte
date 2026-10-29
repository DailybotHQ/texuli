<script lang="ts">
import { tick } from 'svelte';
import { type ClassValue, cx } from 'texuli/cx';
import { FILTER_LIMITS, type FilterGroup } from '../engines/grid/filter.ts';
import type { FilterFieldGroup, FilterOperatorDef } from './catalog.ts';
import { type FilterAction, type FilterBuilderContext, pathKey } from './context.ts';
import FilterBuilderGroup from './FilterBuilderGroup.svelte';
import { type FilterBuilderLabels, resolveFilterBuilderLabels } from './labels.ts';
import {
  addCondition,
  addGroup,
  changeField,
  changeOperator,
  changeValue,
  emptyFilter,
  type FilterField,
  filterIssues,
  nodeAt,
  removeAt,
  setCombinator,
} from './model.ts';
import './filter-builder.css';

interface Props {
  /** The fields a condition can test (DataGrid columns work as they are). */
  fields: readonly FilterField[];
  /** The model (`bind:value`): the grid engine's filter AST, an and/or group at the root. */
  value?: FilterGroup;
  /** Every edit, with the new model. Run it with `applyFilter` or a DataGrid's `filter`. */
  onValueChange?: (value: FilterGroup) => void;
  /**
   * Host operators (a property catalog): each with a label, a typed value
   * editor, optional validation and the predicate `applyFilter` runs.
   */
  operators?: readonly FilterOperatorDef[];
  /** Labels and order of the field groups the field menu shows (`field.group`). */
  groups?: readonly FilterFieldGroup[];
  /** Deepest group level offered (the root is 1). Capped at 5, where the engine's 6-level limit stops nesting. */
  maxDepth?: number;
  disabled?: boolean;
  labels?: Partial<FilterBuilderLabels>;
  class?: ClassValue;
}

let {
  fields,
  value = $bindable(emptyFilter()),
  onValueChange,
  operators,
  groups,
  maxDepth = 3,
  disabled = false,
  labels,
  class: className,
}: Props = $props();

const uid = $props.id();
const text = $derived(resolveFilterBuilderLabels(labels));
let root: HTMLDivElement | undefined = $state();
let announcement = $state('');

const issues = $derived(
  new Map(
    filterIssues(value, fields, operators).map((issue) => [pathKey(issue.path), issue.message])
  )
);

/** Focus after a change: a key from `data-filter-focus`, else the nearest group's add button. */
async function focusAfter(target: string): Promise<void> {
  await tick();
  root?.querySelector<HTMLElement>(`[data-filter-focus="${target}"]`)?.focus();
}

function commit(next: FilterGroup, message?: string): void {
  value = next;
  onValueChange?.(next);
  // Cleared first so the same message (two adds in a row) is spoken again.
  if (message) {
    announcement = '';
    void tick().then(() => (announcement = message));
  }
}

function act(action: FilterAction): void {
  const { path } = action;
  const field = (key: string) => fields.find((entry) => entry.key === key);
  switch (action.kind) {
    case 'addCondition': {
      const group = nodeAt(value, path);
      const index = group?.type === 'group' ? group.children.length : 0;
      commit(addCondition(value, path, fields, operators), text.added);
      void focusAfter(`${pathKey([...path, index])}:field`);
      return;
    }
    case 'addGroup': {
      const group = nodeAt(value, path);
      const index = group?.type === 'group' ? group.children.length : 0;
      commit(addGroup(value, path, fields, operators), text.groupAdded);
      void focusAfter(`${pathKey([...path, index])}:op`);
      return;
    }
    case 'remove':
      commit(removeAt(value, path), text.removed);
      void focusAfter(`${pathKey(path.slice(0, -1))}:add`);
      return;
    case 'combinator':
      commit(setCombinator(value, path, action.op));
      return;
    case 'field': {
      const next = field(action.key);
      if (next) commit(changeField(value, path, next, operators));
      return;
    }
    case 'operator': {
      const condition = nodeAt(value, path);
      const current = condition?.type === 'condition' ? field(condition.field) : undefined;
      if (current) commit(changeOperator(value, path, action.operator, current, operators));
      return;
    }
    case 'value':
      commit(changeValue(value, path, action.value as never));
  }
}

const ctx = $derived<FilterBuilderContext>({
  fields,
  operators,
  groups,
  labels: text,
  uid,
  maxDepth: Math.min(FILTER_LIMITS.depth - 1, Math.max(1, maxDepth)),
  disabled,
  issues,
  act,
});
</script>

<div bind:this={root} class={cx('tx-filter-builder', className)} data-tx-filter-builder>
  <FilterBuilderGroup group={value} path={[]} position={1} {ctx} />
  <p class="tx-filter-builder__sr-only" role="status" aria-live="polite">{announcement}</p>
</div>
