/**
 * The `canvasHost` seam of `@texuli/player` (spec 0.8.0): agents emit a
 * `canvas` catalog node whose `canvas` prop holds a canvas; the player runs
 * `checkCanvas` inside its validation (at the player's tier, never the
 * draft's) and hands a valid canvas to `present`, which mounts the viewer
 * (loaded on first use) into the player's surface. The types are declared
 * here structurally, because this package (L4) cannot import the player
 * (L7); the player keeps the canvas engine out of its eager chunk this way.
 */
import { mount, unmount } from 'svelte';
import type { CanvasLabelOverrides } from '../editor/labels.ts';
import { validateCanvas } from '../model/schema.ts';

/** The tiers the player validates at. */
export type CanvasHostTier = 'developer' | 'untrusted';

/** One issue the canvas check reports to `validateDraft`. */
export interface CanvasDraftIssue {
  code: string;
  /** A JSON path into the canvas. */
  path: string;
  message: string;
  severity?: 'error' | 'warning';
}

/** The canvas validator a draft check runs (`validateCanvas` at the tier). */
export type CanvasDraftCheck = (
  canvas: unknown,
  tier: CanvasHostTier
) => { ok: boolean; canvas?: unknown; issues: readonly CanvasDraftIssue[] };

/** What the player hands `present` (`label`, `active` and `target` are live getters). */
export interface CanvasHostRequest {
  canvas: unknown;
  /** The node's `label` prop, when it set one. */
  canvasLabel?: string;
  /** The node's key (spec 0.7.0), when it declares one. */
  key?: string;
  tier: CanvasHostTier;
  /** Accessible name of the player region. */
  label: string;
  active: boolean;
  target: HTMLElement | null;
}

export interface CanvasHost {
  checkCanvas: CanvasDraftCheck;
  present(request: CanvasHostRequest): undefined | (() => void);
}

/** `validateCanvas` as a draft check: every error refuses the node. */
export const checkCanvasDraft: CanvasDraftCheck = (canvas, tier) => {
  const result = validateCanvas(canvas, { trust: tier });
  const issues = result.issues.map((issue) => ({
    code: issue.code,
    path: issue.jsonPath,
    message: issue.message,
    severity: issue.severity === 'warning' ? ('warning' as const) : ('error' as const),
  }));
  return result.ok ? { ok: true, canvas: result.canvas, issues } : { ok: false, issues };
};

export interface CanvasHostOptions {
  /** Turn an image `ref` into a URL (checked by `safeImageSrc` at the player's tier). */
  resolveImage?: (ref: string) => string | null | undefined;
  labels?: CanvasLabelOverrides;
  dir?: 'ltr' | 'rtl';
}

/**
 * A `canvasHost` for `Player`: `checkCanvas` joins validation, and
 * `present` validates again at the tier and mounts `CanvasViewer`. A canvas
 * that does not validate paints nothing. The cleanup unmounts the viewer,
 * or cancels a mount still loading.
 */
export function createCanvasPlayerHost(options: CanvasHostOptions = {}): CanvasHost {
  return {
    checkCanvas: checkCanvasDraft,
    present(request) {
      const target = request.target;
      if (!target) return undefined;
      const checked = validateCanvas(request.canvas, { trust: request.tier });
      if (!checked.ok) return undefined;
      let cancelled = false;
      let instance: Record<string, unknown> | null = null;
      void import('../viewer/CanvasViewer.svelte').then(({ default: CanvasViewer }) => {
        if (cancelled) return;
        instance = mount(CanvasViewer, {
          target,
          props: {
            canvas: checked.canvas,
            trust: request.tier,
            ...(request.canvasLabel ? { label: request.canvasLabel } : {}),
            ...(options.resolveImage ? { resolveImage: options.resolveImage } : {}),
            ...(options.labels ? { labels: options.labels } : {}),
            ...(options.dir ? { dir: options.dir } : {}),
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
