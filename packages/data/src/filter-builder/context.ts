import type { FilterGroup } from '../engines/grid/filter.ts';
import type { FilterAnyOperator, FilterFieldGroup, FilterOperatorDef } from './catalog.ts';
import type { FilterBuilderLabels } from './labels.ts';
import type { FilterField, FilterPath } from './model.ts';

/** An edit a nested part asks the builder to make. */
export type FilterAction =
  | { kind: 'addCondition' | 'addGroup' | 'remove'; path: FilterPath }
  | { kind: 'combinator'; path: FilterPath; op: FilterGroup['op'] }
  | { kind: 'field'; path: FilterPath; key: string }
  | { kind: 'operator'; path: FilterPath; operator: FilterAnyOperator }
  | { kind: 'value'; path: FilterPath; value: unknown };

/** What every nested group and condition reads from the builder. */
export interface FilterBuilderContext {
  fields: readonly FilterField[];
  operators: readonly FilterOperatorDef[] | undefined;
  groups: readonly FilterFieldGroup[] | undefined;
  labels: FilterBuilderLabels;
  /** Prefix of every element id inside this builder. */
  uid: string;
  /** Deepest group level the builder offers (the root is 1). */
  maxDepth: number;
  disabled: boolean;
  /** Issue messages by condition path key (`r-0-2`): the builder's own, then the host's. */
  issues: ReadonlyMap<string, readonly string[]>;
  act: (action: FilterAction) => void;
}

/** Stable key of a path for ids and focus targets (`r` for the root, else `r-0-2`). */
export const pathKey = (path: FilterPath) => ['r', ...path].join('-');
