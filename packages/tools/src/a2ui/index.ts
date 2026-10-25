/**
 * `@texuli/tools/a2ui` — experimental A2UI v0.9 adapter.
 *
 * Converts catalog trees to A2UI-shaped server-to-client messages and back,
 * checked against a Texuli subset of the v0.9 message schema. Plain data
 * only: no DOM, no network.
 */

export { a2uiToCatalogTree, type FromA2uiOptions, type FromA2uiResult } from './from-a2ui.ts';
export {
  A2UI_MESSAGE_SCHEMA,
  checkJsonSchema,
  type JsonSchema,
  validateA2uiMessages,
} from './schema.ts';
export { catalogTreeToA2ui, type ToA2uiOptions, type ToA2uiResult } from './to-a2ui.ts';
export {
  A2UI_RESERVED_KEYS,
  A2UI_ROOT_ID,
  A2UI_ROOTS_COMPONENT,
  A2UI_VERSION,
  type A2uiChildList,
  type A2uiComponent,
  type A2uiCreateSurfaceMessage,
  type A2uiDeleteSurfaceMessage,
  type A2uiDiagnostic,
  type A2uiIssueCode,
  type A2uiLimits,
  type A2uiMessage,
  type A2uiUpdateComponentsMessage,
  type A2uiUpdateDataModelMessage,
} from './types.ts';
