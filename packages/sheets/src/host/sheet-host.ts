/**
 * The sheet half of the `sheetHost` seam of `@texuli/player` (spec 0.8.0,
 * `packages/player/src/sheet-host.ts`), shaped like `canvasHost`: agents
 * emit a `spreadsheet` catalog node whose `sheet` prop holds a sheet; the
 * player runs `checkSheet` inside its validation and hands a valid sheet to
 * `present`, which mounts a read-only `SheetView` (loaded on first use) in
 * the node's place. The types are declared here structurally, because this
 * package (L5) cannot import the player (L7); pass the result as
 * `sheetHost` on `Player`.
 */
import { mount, unmount } from 'svelte';
import { validateSheet } from '../model/schema.ts';
import type { SheetViewLabels } from '../view/labels.ts';

/** The tiers the player validates at. */
export type SheetHostTier = 'developer' | 'untrusted';

/** What the player hands `present` (`label`, `active` and `target` are live getters). */
export interface SheetHostRequest {
  sheet: unknown;
  /** The node's `label` prop, when it set one. */
  sheetLabel?: string;
  /** The node's key (spec 0.7.0), when it declares one. */
  key?: string;
  tier: SheetHostTier;
  /** Accessible name of the player region. */
  label: string;
  active: boolean;
  target: HTMLElement | null;
}

/** One issue the sheet check reports to `validateDraft`. */
export interface SheetDraftIssue {
  code: string;
  path: string;
  message: string;
  severity?: 'error' | 'warning';
}

/** The sheet validator a draft check runs (`validateSheet`; sheets are data at every tier). */
export type SheetDraftCheck = (
  sheet: unknown,
  tier: SheetHostTier
) => { ok: boolean; sheet?: unknown; issues: readonly SheetDraftIssue[] };

export interface SheetHost {
  checkSheet: SheetDraftCheck;
  present(request: SheetHostRequest): undefined | (() => void);
}

export interface SheetHostOptions {
  /** The host clock for TODAY and NOW. */
  now?: () => number | Date;
  labels?: Partial<SheetViewLabels>;
  /** Let people edit the painted sheet (default `false`: agent sheets paint read-only). */
  editable?: boolean;
}

/**
 * A sheet host for the player: `checkSheet` joins validation, and `present`
 * validates again and mounts `SheetView`. A sheet that does not validate
 * paints nothing. The cleanup unmounts the view, or cancels a mount still
 * loading.
 */
export function createSheetPlayerHost(options: SheetHostOptions = {}): SheetHost {
  return {
    checkSheet: (sheet) => {
      const result = validateSheet(sheet);
      return result.ok
        ? { ok: true, sheet: result.sheet, issues: result.issues }
        : { ok: false, issues: result.issues };
    },
    present(request) {
      const target = request.target;
      if (!target) return undefined;
      const checked = validateSheet(request.sheet);
      if (!checked.ok) return undefined;
      let cancelled = false;
      let instance: Record<string, unknown> | null = null;
      void import('../view/SheetView.svelte').then(({ default: SheetView }) => {
        if (cancelled) return;
        instance = mount(SheetView, {
          target,
          props: {
            sheet: checked.sheet,
            readonly: options.editable !== true,
            ...(request.sheetLabel ? { label: request.sheetLabel } : {}),
            ...(options.now ? { now: options.now } : {}),
            ...(options.labels ? { labels: options.labels } : {}),
          },
        });
      });
      return () => {
        cancelled = true;
        if (instance) void unmount(instance);
        instance = null;
      };
    },
  };
}
