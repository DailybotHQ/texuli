import type { FilterOperator } from '../engines/grid/filter.ts';

/** Every visible or announced string of the filter builder. Pass translations to override. */
export interface FilterBuilderLabels {
  /** The builder's accessible name (its outer group). */
  builder: string;
  /** Legend of a nested group, by its position in its parent (from 1). */
  group: (position: number) => string;
  /** Legend of a condition, by its position in its group (from 1). */
  condition: (position: number) => string;
  /** The combinator: "Match [all/any] of these". */
  match: string;
  matchSuffix: string;
  and: string;
  or: string;
  field: string;
  operator: string;
  value: string;
  /** The two ends of `between`. */
  from: string;
  to: string;
  /** Under a comma-separated list field (`in` on text or numbers). */
  listHint: string;
  /** Placeholder option of a select with nothing chosen yet. */
  choose: string;
  yes: string;
  no: string;
  operators: Record<FilterOperator, string>;
  addCondition: string;
  addGroup: string;
  removeCondition: (position: number) => string;
  removeGroup: (position: number) => string;
  /** Shown in a group without conditions. */
  emptyGroup: string;
  /** Announced after each structural change. */
  added: string;
  groupAdded: string;
  removed: string;
}

export const DEFAULT_FILTER_BUILDER_LABELS: Readonly<FilterBuilderLabels> =
  /* @__PURE__ */ Object.freeze({
    builder: 'Filters',
    group: (position: number) => `Group ${position}`,
    condition: (position: number) => `Condition ${position}`,
    match: 'Match',
    matchSuffix: 'of these conditions',
    and: 'all',
    or: 'any',
    field: 'Field',
    operator: 'Operator',
    value: 'Value',
    from: 'From',
    to: 'To',
    listHint: 'Separate values with commas.',
    choose: 'Choose…',
    yes: 'Yes',
    no: 'No',
    operators: {
      eq: 'is',
      neq: 'is not',
      contains: 'contains',
      in: 'is any of',
      between: 'is between',
      before: 'is before',
      after: 'is after',
      isEmpty: 'is empty',
      isNotEmpty: 'is not empty',
    },
    addCondition: 'Add condition',
    addGroup: 'Add group',
    removeCondition: (position: number) => `Remove condition ${position}`,
    removeGroup: (position: number) => `Remove group ${position}`,
    emptyGroup: 'No conditions: every row matches.',
    added: 'Condition added.',
    groupAdded: 'Group added.',
    removed: 'Removed.',
  });

/** Merges overrides over the English defaults (operators merge one by one). */
export function resolveFilterBuilderLabels(
  overrides: Partial<FilterBuilderLabels> = {}
): FilterBuilderLabels {
  return {
    ...DEFAULT_FILTER_BUILDER_LABELS,
    ...overrides,
    operators: { ...DEFAULT_FILTER_BUILDER_LABELS.operators, ...overrides.operators },
  };
}
