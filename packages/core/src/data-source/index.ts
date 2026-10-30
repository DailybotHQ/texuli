/**
 * @texuli/core/data-source: host-registered data sources for generated
 * views (ADR-015). The host declares each source (typed fields, the
 * operations, filter and sort capabilities, pagination) and writes its
 * adapter; a blueprint names a source and sends a closed query. The loader
 * validates, deduplicates, cancels, retries, caches and invalidates; a
 * collection pages and applies optimistic writes with rollback. Errors are
 * typed, with a retryable flag and a user-facing message key.
 *
 * Framework-free and not re-exported from the `@texuli/core` root barrel.
 */

export {
  createSourceCollection,
  PENDING_ROW_PREFIX,
  type SourceCollection,
  type SourceCollectionOptions,
  type SourceCollectionState,
  type SourceCollectionStatus,
} from './collection.ts';
export {
  canRetrySourceError,
  FINAL_SOURCE_ERRORS,
  isSourceError,
  RETRYABLE_SOURCE_ERRORS,
  SOURCE_ERROR_CODES,
  SOURCE_ERROR_MESSAGES,
  type SourceError,
  type SourceErrorCode,
  type SourceErrorInit,
  type SourceErrorMessageKey,
  sourceError,
  sourceErrorMessage,
  toSourceError,
} from './errors.ts';
export {
  createSourceLoader,
  DEFAULT_SOURCE_RETRY,
  isSourceRowId,
  MAX_RETRY_AFTER_MS,
  readSourceRow,
  type SourceCallOptions,
  type SourceClock,
  type SourceInvalidation,
  type SourceListOptions,
  type SourceListResult,
  type SourceLoader,
  type SourceLoaderOptions,
  type SourceMutationOptions,
  type SourceQueryResolution,
  type SourceResult,
  type SourceRetryPolicy,
  SYSTEM_SOURCE_CLOCK,
} from './loader.ts';
export {
  checkSourceQuery,
  fitsSourceField,
  isSourceDate,
  SOURCE_QUERY_KEYS,
  type SourceFilterCondition,
  type SourceFilterGroup,
  type SourceFilterNode,
  type SourceQuery,
  type SourceQueryCheck,
  type SourceQueryIssue,
  type SourceQueryIssueCode,
  type SourceSort,
  type SourceValue,
  sourceQueryKey,
  stableJson,
} from './query.ts';
export {
  createSourceRegistry,
  type DataSource,
  defineSource,
  type SourceAdapter,
  type SourceListRequest,
  type SourcePage,
  type SourcePageRequest,
  type SourceRegistry,
  type SourceRow,
  type SourceRowId,
} from './registry.ts';
export {
  describeSource,
  isSourceFieldName,
  isSourceName,
  SOURCE_FIELD_PATTERN,
  SOURCE_FIELD_TYPES,
  SOURCE_FILTER_OPERATORS,
  SOURCE_LIMITS,
  SOURCE_NAME_PATTERN,
  SOURCE_OPERATIONS,
  SOURCE_OPERATORS_BY_TYPE,
  SOURCE_PAGINATION_STYLES,
  type SourceDescriptor,
  type SourceFieldDeclaration,
  type SourceFieldDescriptor,
  type SourceFieldType,
  type SourceFilterOperator,
  type SourceOperation,
  type SourcePaginationStyle,
  type SourceSchemaDeclaration,
  sourceField,
} from './schema.ts';
