import type { Composition } from '../composition-model/index.ts';
import type { CompositionViewport } from './draw.ts';

export const VIEWPORT_LIMITS = Object.freeze({ minZoom: 1, maxZoom: 8, zoomStep: 1.25 });

/** The whole composition, unzoomed. */
export function initialViewport(): CompositionViewport {
  return { x: 0, y: 0, zoom: 1 };
}

/** Keeps the zoom in range and the view inside the composition. */
export function clampViewport(
  composition: Pick<Composition, 'width' | 'height'>,
  viewport: CompositionViewport
): CompositionViewport {
  const raw = Number.isFinite(viewport.zoom) ? viewport.zoom : 1;
  const zoom = Math.min(VIEWPORT_LIMITS.maxZoom, Math.max(VIEWPORT_LIMITS.minZoom, raw));
  const maxX = composition.width - composition.width / zoom;
  const maxY = composition.height - composition.height / zoom;
  const x = Number.isFinite(viewport.x) ? viewport.x : 0;
  const y = Number.isFinite(viewport.y) ? viewport.y : 0;
  return { x: Math.min(maxX, Math.max(0, x)), y: Math.min(maxY, Math.max(0, y)), zoom };
}

/**
 * Zooms by `factor` around a focus point given as a fraction of the view
 * (default: its center), so the point under the focus stays in place.
 */
export function zoomViewport(
  composition: Pick<Composition, 'width' | 'height'>,
  viewport: CompositionViewport,
  factor: number,
  focus: { x: number; y: number } = { x: 0.5, y: 0.5 }
): CompositionViewport {
  const current = clampViewport(composition, viewport);
  const zoom = Math.min(
    VIEWPORT_LIMITS.maxZoom,
    Math.max(VIEWPORT_LIMITS.minZoom, current.zoom * factor)
  );
  const pointX = current.x + (composition.width / current.zoom) * focus.x;
  const pointY = current.y + (composition.height / current.zoom) * focus.y;
  return clampViewport(composition, {
    zoom,
    x: pointX - (composition.width / zoom) * focus.x,
    y: pointY - (composition.height / zoom) * focus.y,
  });
}

/** Pans by a fraction of the current view size in each axis. */
export function panViewport(
  composition: Pick<Composition, 'width' | 'height'>,
  viewport: CompositionViewport,
  fractionX: number,
  fractionY: number
): CompositionViewport {
  const current = clampViewport(composition, viewport);
  return clampViewport(composition, {
    zoom: current.zoom,
    x: current.x + (composition.width / current.zoom) * fractionX,
    y: current.y + (composition.height / current.zoom) * fractionY,
  });
}

export type ViewportAction =
  | 'zoom-in'
  | 'zoom-out'
  | 'reset'
  | 'pan-left'
  | 'pan-right'
  | 'pan-up'
  | 'pan-down';

/**
 * The view action for a key on the focused canvas, or `null`. Arrow keys pan
 * the picture in screen space (not reading order), so they mean the same in
 * RTL. Modified keys are left to the browser and assistive tech.
 */
export function viewportKeyAction(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): ViewportAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  switch (event.key) {
    case '+':
    case '=':
      return 'zoom-in';
    case '-':
    case '_':
      return 'zoom-out';
    case '0':
    case 'Home':
      return 'reset';
    case 'ArrowLeft':
      return 'pan-left';
    case 'ArrowRight':
      return 'pan-right';
    case 'ArrowUp':
      return 'pan-up';
    case 'ArrowDown':
      return 'pan-down';
    default:
      return null;
  }
}

/** Applies a {@link ViewportAction}. Panning moves a quarter of the view. */
export function applyViewportAction(
  composition: Pick<Composition, 'width' | 'height'>,
  viewport: CompositionViewport,
  action: ViewportAction
): CompositionViewport {
  switch (action) {
    case 'zoom-in':
      return zoomViewport(composition, viewport, VIEWPORT_LIMITS.zoomStep);
    case 'zoom-out':
      return zoomViewport(composition, viewport, 1 / VIEWPORT_LIMITS.zoomStep);
    case 'reset':
      return initialViewport();
    case 'pan-left':
      return panViewport(composition, viewport, -0.25, 0);
    case 'pan-right':
      return panViewport(composition, viewport, 0.25, 0);
    case 'pan-up':
      return panViewport(composition, viewport, 0, -0.25);
    case 'pan-down':
      return panViewport(composition, viewport, 0, 0.25);
  }
}
