/**
 * `@texuli/data/filter-builder`: a nested filter builder (and/or groups,
 * operators by field type, native keyboard-complete controls) over the grid
 * engine's filter AST, plus the framework-free model helpers and the pure
 * `applyFilter(rows, model, fields?)`.
 */
export {
  FILTER_LIMITS,
  type FilterCondition,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
  OPERATORS_BY_TYPE,
} from '../engines/grid/filter.ts';
export { default as FilterBuilder } from './FilterBuilder.svelte';
export {
  DEFAULT_FILTER_BUILDER_LABELS,
  type FilterBuilderLabels,
  resolveFilterBuilderLabels,
} from './labels.ts';
export {
  addCondition,
  addGroup,
  applyFilter,
  changeField,
  changeOperator,
  changeValue,
  defaultValue,
  depthOf,
  emptyFilter,
  type FilterField,
  type FilterIssue,
  type FilterPath,
  filterIssues,
  isComplete,
  newCondition,
  nodeAt,
  operatorsFor,
  parseFilter,
  pruneFilter,
  removeAt,
  setCombinator,
} from './model.ts';
