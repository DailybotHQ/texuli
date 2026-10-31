/**
 * `@texuli/tools/ops`: the operations registry (ADR-017). Every capability
 * an agent can call is one named operation with JSON Schema input and
 * output, annotations, a runtime class, limits and worked examples. The MCP
 * server and the CLI run them through `texuliOps.invoke()`, which validates
 * input and output and returns stable error codes. Framework-free.
 */
import { TEXULI_ALIASES, TEXULI_REMOVED_NAMES } from './aliases.ts';
import { blockList, blockSchema } from './blocks.ts';
import { blueprintTheme, blueprintValidate } from './blueprint.ts';
import { catalogSearch, catalogValidate, componentGet, exampleSearch } from './catalog.ts';
import { deckRun } from './deck.ts';
import {
  dsCompile,
  dsContrast,
  dsDiff,
  dsImport,
  dsPreview,
  dsSave,
  dsSuggest,
  dsValidate,
} from './design-system.ts';
import { documentExport, documentRun } from './document.ts';
import { createOperationRegistry } from './registry.ts';
import { sitePages, siteRead, siteSearch } from './site.ts';
import { themeGet, themePreview, themeSearch } from './themes.ts';
import type { Operation } from './types.ts';

export { ALIASES_REMOVED_IN, TEXULI_ALIASES, TEXULI_REMOVED_NAMES } from './aliases.ts';
export { loadOpsCatalog } from './catalog.ts';
export { DS_INPUT_BYTES, DS_PIXEL_VALUES, MINIMAL_DESIGN_SYSTEM } from './design-system.ts';
export { EXPORT_COMMANDS, RUN_COMMANDS } from './document.ts';
export {
  createOperationRegistry,
  defineOperation,
  type OperationRegistry,
  operationDescription,
  removedNameMessage,
} from './registry.ts';
export {
  type JsonSchema,
  type JsonSchemaType,
  type SchemaIssue,
  SUPPORTED_SCHEMA_KEYWORDS,
  schemaKeywordIssues,
  validateJson,
} from './schema.ts';
export {
  normalizeSitePath,
  rankSitePages,
  SITE_MANIFEST_PATH,
  SITE_READ_MAX_BYTES,
  type SitePage,
  type SitePathResult,
  type SiteSearchHit,
  siteIndexPages,
  siteSearchTerms,
} from './site.ts';
export {
  buildThemePreview,
  PREVIEW_TOKENS,
  searchThemes,
  THEME_SEARCH_MAX,
  type ThemeFilters,
  type ThemePreview,
  type ThemeSummary,
  themeCss,
  themeExists,
  themeSummary,
} from './themes.ts';
export {
  type InvokeFailure,
  type InvokeOptions,
  type InvokeResult,
  LOCAL_RUNTIMES,
  type LocalFiles,
  OPERATION_ERROR_CODES,
  type Operation,
  type OperationAlias,
  type OperationAnnotations,
  type OperationContext,
  OperationError,
  type OperationErrorCode,
  type OperationExample,
  type OperationLimits,
  type OperationRuntime,
  REMOTE_RUNTIMES,
  type RemovedOperationName,
  type SiteAssets,
  type SiteContext,
} from './types.ts';
export { TOOLS_VERSION } from './version.ts';

/** Every Texuli operation, in the order doors list them. */
export const TEXULI_OPERATIONS: readonly Operation[] = Object.freeze([
  catalogSearch,
  catalogValidate,
  componentGet,
  exampleSearch,
  blueprintValidate,
  blueprintTheme,
  blockList,
  blockSchema,
  themeSearch,
  themeGet,
  themePreview,
  dsValidate,
  dsCompile,
  dsContrast,
  dsSuggest,
  dsImport,
  dsDiff,
  dsPreview,
  dsSave,
  deckRun,
  documentRun,
  documentExport,
  sitePages,
  siteRead,
  siteSearch,
]);

/** The shared registry every door uses. */
export const texuliOps = createOperationRegistry(
  TEXULI_OPERATIONS,
  TEXULI_ALIASES,
  TEXULI_REMOVED_NAMES
);
