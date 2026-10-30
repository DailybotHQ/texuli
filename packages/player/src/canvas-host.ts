/**
 * Host seam for painting a `canvas` blueprint (spec 0.8.0, ADR-012).
 *
 * The player (L7) could import `@texuli/canvas` (L4), but the canvas
 * validator does not belong in the player's first-load chunk, so, as for
 * documents, a host supplies a {@link CanvasPlayerHost}: its `checkCanvas`
 * runs inside the player's validation (`validateDraft`'s injected canvas
 * check, at the player's tier), and once the draft is valid the player hands
 * the `canvas` root to `present` instead of painting it.
 *
 * Without a host a `canvas` node is refused (`canvas-unchecked`), the
 * player shows its invalid notice, and nothing of the canvas paints.
 * `@texuli/canvas` ships the real adapter (`createCanvasPlayerHost` from
 * `@texuli/canvas/host`), which paints the viewer lazily. Tests use a mock.
 */

import type { RenderNode, RenderTier } from '@texuli/catalog/render/renderer';
import type { DraftCanvasCheck } from '@texuli/catalog/validate';

export type { DraftCanvasCheck };

/**
 * Read-only request the player hands a canvas host. `canvas`, `tier` and
 * `key` are fixed for one presentation; `label`, `active` and `target` are
 * live getters (read them when needed).
 */
export interface CanvasPlayerHostRequest {
  /** The validated `canvas` node's `canvas` (validated again by the host before it paints). */
  canvas: unknown;
  /** The node's `label` prop, when it set one. */
  canvasLabel?: string;
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

/** A host that validates and paints a canvas blueprint. */
export interface CanvasPlayerHost {
  /** The canvas validator the player injects into `validateDraft`. */
  checkCanvas: DraftCanvasCheck;
  /**
   * Paint the canvas into `request.target`. May return a cleanup; the player
   * calls it when the blueprint, tier or host identity changes, and on
   * destroy, and only then presents again.
   */
  present(request: CanvasPlayerHostRequest): undefined | (() => void);
}

/** True when a catalog tree (or render root) is a `canvas` node. */
export function isCanvasTree(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (value as Record<string, unknown>).id === 'canvas';
}

/** The `canvas` render root of a validated draft, or `null`. */
export function canvasRoot(
  roots: readonly RenderNode[]
): Extract<RenderNode, { kind: 'component' }> | null {
  const root = roots[0];
  return roots.length === 1 && root?.kind === 'component' && root.id === 'canvas' ? root : null;
}

/**
 * The package that owns the canvas viewer: a host that imports both passes
 * `createCanvasPlayerHost()` as `canvasHost` on `Player`. A stable pointer
 * for tests and docs; not a runtime import.
 */
export const CANVAS_HOST_PACKAGE = '@texuli/canvas' as const;
