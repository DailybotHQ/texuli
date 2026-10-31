/**
 * `@texuli/data/filter-builder`: a nested filter builder (and/or groups,
 * operators by field type, native keyboard-complete controls) over the grid
 * engine's filter AST, plus the framework-free model helpers, the pure
 * `applyFilter(rows, model, fields?, operators?)`, and the property catalog
 * extension: host operators, field groups and saved segments.
 */
export {
  FILTER_LIMITS,
  type FilterCondition,
  type FilterCustomOperatorId,
  type FilterGroup,
  type FilterNode,
  type FilterOperator,
  OPERATORS_BY_TYPE,
} from '../engines/grid/filter.ts';
export {
  catalogSchema,
  compileCatalogFilter,
  FILTER_SEGMENT_LIMITS,
  FILTER_VALUE_EDITORS,
  type FilterAnyOperator,
  type FilterFieldGroup,
  type FilterFieldOption,
  type FilterOperatorDef,
  type FilterSegment,
  type FilterValue,
  type FilterValueEditor,
  groupFields,
  optionLabel,
  optionValue,
  parseSegment,
  serializeSegment,
} from './catalog.ts';
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
