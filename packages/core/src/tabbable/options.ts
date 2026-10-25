/**
 * Options for tabbable and focusable queries.
 *
 * Every function takes its root element or document explicitly — nothing
 * reads `document` or `window` at import time.
 */
export interface TabbableOptions {
  /**
   * When true and the root is an `Element`, include the root itself if it
   * qualifies. Default false (descendants only).
   */
  includeContainer?: boolean;
  /**
   * Document used for `getComputedStyle` and creating range checks. Defaults
   * to `root.ownerDocument` or `root` when the root is a Document.
   */
  document?: Document;
}
