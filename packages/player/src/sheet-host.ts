/**
 * Host seam for painting `spreadsheet` nodes (spec 0.8.0, ADR-015).
 *
 * The player (L7) could import `@texuli/sheets` (L5), but the formula
 * engine and the sheet view do not belong in the player's first-load chunk,
 * so, as for canvases and forms, a host supplies a {@link SheetPlayerHost}:
 * its `checkSheet` runs inside the player's validation (`validateDraft`'s
 * injected sheet check, at the player's tier, which parses every formula),
 * and each valid `spreadsheet` node hands its `sheet` to `present`, which
 * paints it into the node's place.
 *
 * Without a host a `spreadsheet` node is refused (`sheet-unchecked`), the
 * player shows its invalid notice, and nothing of the sheet paints (a
 * preview with placeholders shows the sheet title and `sheetNeedsHost`).
 * `@texuli/sheets` ships the real adapter (`createSheetPlayerHost` from
 * `@texuli/sheets/host`), which mounts a read-only `SheetView` lazily.
 */

import type { RenderTier } from '@texuli/catalog/render/renderer';
import type { DraftSheetCheck } from '@texuli/catalog/validate';

export type { DraftSheetCheck };

/**
 * Read-only request the player hands a sheet host for one `spreadsheet`
 * node. `sheet` and `tier` are fixed for one presentation; `label`,
 * `active` and `target` are live getters (read them when needed).
 */
export interface SheetPlayerHostRequest {
  /** The validated node's `sheet` (validated again by the host before it paints). */
  sheet: unknown;
  /** The node's `label` prop, when it set one. */
  sheetLabel?: string;
  /** Host-chosen tier (never from the draft). */
  tier: RenderTier;
  /** Accessible name of the player region. */
  label: string;
  /** False while the enclosing surface is inactive (`inert`). */
  active: boolean;
  /** The element the host paints into (empty, owned by the host until cleanup). */
  target: HTMLElement | null;
}

/** A host that validates and paints `spreadsheet` nodes. */
export interface SheetPlayerHost {
  /** The sheet validator the player injects into `validateDraft`. */
  checkSheet: DraftSheetCheck;
  /**
   * Paint the sheet into `request.target`. May return a cleanup; the player
   * calls it when the node, its sheet, the tier or the host changes, and on
   * destroy, and only then presents again.
   */
  present(request: SheetPlayerHostRequest): undefined | (() => void);
}

/**
 * The package that owns the sheet view: a host passes
 * `createSheetPlayerHost()` from `@texuli/sheets/host` as `sheetHost` on
 * `Player`. A stable pointer for tests and docs; not a runtime import.
 */
export const SHEET_HOST_PACKAGE = '@texuli/sheets' as const;
