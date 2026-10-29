/**
 * Host seam for painting a `document` blueprint (spec 0.7.0, ADR-011).
 *
 * The player (L7) cannot import `@texuli/pages` (L8), and the document
 * validator is too large for the player's eager chunk. A host that owns
 * both supplies a {@link DocumentPlayerHost}: its `checkDocument` runs
 * inside the player's validation (`validateDraft`'s injected document
 * check, at the player's tier), and once the draft is valid the player hands
 * the `document` root to `present` instead of painting it.
 *
 * Without a host a `document` node is refused (`document-unchecked`), the
 * player shows its invalid notice, and nothing about the document paints:
 * documents never pass on structure alone. `@texuli/pages` ships the real
 * adapter (`createDocumentPlayerHost` from `@texuli/pages/host`), which
 * paints the reader lazily. Tests use a mock host.
 */

import type { RenderNode, RenderTier } from '@texuli/catalog/render/renderer';
import type { DraftDocumentCheck } from '@texuli/catalog/validate';

export type { DraftDocumentCheck };

/**
 * Read-only request the player hands a document host. `doc`, `tier` and
 * `key` are fixed for one presentation; `label`, `active` and `target` are
 * live getters (read them when needed): changing them never calls `present`
 * again.
 */
export interface DocumentPlayerHostRequest {
  /** The validated `document` node's `doc` (validated again by the host before it paints). */
  doc: unknown;
  /** The node's `label` prop, when it set one. */
  docLabel?: string;
  /** The node's `outline` prop (default `true`). */
  outline: boolean;
  /** The node's key (spec 0.7.0), when it declares one. */
  key?: string;
  /** Host-chosen tier (never from the draft). */
  tier: RenderTier;
  /** Accessible name of the player region. */
  label: string;
  /** False while the enclosing surface is inactive (`inert`). */
  active: boolean;
  /** The element the host paints into (empty, owned by the host until cleanup). */
  target: HTMLElement | null;
}

/** A host that validates and paints a document blueprint. */
export interface DocumentPlayerHost {
  /** The document validator the player injects into `validateDraft`. */
  checkDocument: DraftDocumentCheck;
  /**
   * Paint the document into `request.target`. May return a cleanup; the
   * player calls it when the blueprint, tier or host identity changes, and on
   * destroy, and only then presents again.
   */
  present(request: DocumentPlayerHostRequest): undefined | (() => void);
}

/** True when a catalog tree (or render root) is a `document` node. */
export function isDocumentTree(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).id === 'document';
}

/** The `document` render root of a validated draft, or `null`. */
export function documentRoot(
  roots: readonly RenderNode[]
): Extract<RenderNode, { kind: 'component' }> | null {
  const root = roots[0];
  return roots.length === 1 && root?.kind === 'component' && root.id === 'document' ? root : null;
}

/**
 * Record that the full document reader is owned by `@texuli/pages`: a host
 * that imports both packages passes `createDocumentPlayerHost()` as
 * `documentHost` on `Player`. This constant is the stable pointer tests and
 * docs use; it is not a runtime import of the reader.
 */
export const DOCUMENT_HOST_PACKAGE = '@texuli/pages' as const;
