/** The A2UI protocol version this adapter reads and writes. */
export const A2UI_VERSION = 'v0.9';

/** The component id A2UI requires as the root of a surface's tree. */
export const A2UI_ROOT_ID = 'root';

/**
 * Component a payload uses as its root when the catalog tree has zero or
 * several top-level nodes. `a2uiToCatalogTree` unwraps it.
 */
export const A2UI_ROOTS_COMPONENT = 'texuli-roots';

/** Keys of an A2UI component that are structure, not props. */
export const A2UI_RESERVED_KEYS: readonly string[] = ['id', 'component', 'children', 'child'];

/** A static list of child ids, or a data-bound template (not supported here). */
export type A2uiChildList = readonly string[] | { componentId: string; path: string };

/** One flat A2UI component: id, type and its props side by side. */
export interface A2uiComponent {
  id: string;
  component: string;
  children?: A2uiChildList;
  child?: string;
  [prop: string]: unknown;
}

export interface A2uiCreateSurfaceMessage {
  version: typeof A2UI_VERSION;
  createSurface: {
    surfaceId: string;
    catalogId: string;
    theme?: Record<string, unknown>;
    sendDataModel?: boolean;
  };
}

export interface A2uiUpdateComponentsMessage {
  version: typeof A2UI_VERSION;
  updateComponents: { surfaceId: string; components: A2uiComponent[] };
}

export interface A2uiUpdateDataModelMessage {
  version: typeof A2UI_VERSION;
  updateDataModel: { surfaceId: string; path?: string; value?: unknown };
}

export interface A2uiDeleteSurfaceMessage {
  version: typeof A2UI_VERSION;
  deleteSurface: { surfaceId: string };
}

/** One server-to-client message. */
export type A2uiMessage =
  | A2uiCreateSurfaceMessage
  | A2uiUpdateComponentsMessage
  | A2uiUpdateDataModelMessage
  | A2uiDeleteSurfaceMessage;

/** Why a conversion failed. */
export type A2uiIssueCode =
  | 'schema'
  | 'surface'
  | 'missing-root'
  | 'missing-child'
  | 'cycle'
  | 'shared-child'
  | 'template-children'
  | 'binding'
  | 'reserved-prop'
  | 'unsafe-key'
  | 'not-json'
  | 'invalid-node'
  | 'limit';

export interface A2uiDiagnostic {
  code: A2uiIssueCode;
  /** JSONPath-style location, e.g. `$[1].updateComponents.components[2].text`. */
  path: string;
  message: string;
}

/** Size guards for untrusted payloads. */
export interface A2uiLimits {
  /** Most components in one surface (default 1000). */
  maxComponents?: number;
  /** Deepest nesting, the root at depth 1 (default 64). */
  maxDepth?: number;
}
