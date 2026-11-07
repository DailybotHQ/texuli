/**
 * Virtual canvas fit and letterboxing. Independent of browser globals.
 *
 * Aspects: 16:9 → 1280×720, 4:3 → 1024×768, 9:16 → 720×1280, 1:1 → 1080×1080.
 * `fit: 'contain' | 'container'` letterboxes; `cover` fills and may crop;
 * `reflow` gives a landscape or square deck a narrower, portrait canvas on a
 * portrait container, so layouts reflow into one column instead of
 * letterboxing.
 */

export const DECK_ASPECTS = ['16:9', '4:3', '9:16', '1:1'] as const;
export type DeckAspect = (typeof DECK_ASPECTS)[number];

export const DEFAULT_DECK_ASPECT: DeckAspect = '16:9';

export const DECK_CANVAS = Object.freeze({
  '16:9': Object.freeze({ width: 1280, height: 720 }),
  '4:3': Object.freeze({ width: 1024, height: 768 }),
  '9:16': Object.freeze({ width: 720, height: 1280 }),
  '1:1': Object.freeze({ width: 1080, height: 1080 }),
} as const);

export type DeckCanvasSize = Readonly<{ width: number; height: number }>;

export type DeckFitMode = 'contain' | 'cover' | 'container' | 'reflow';

/**
 * The canvas inline size of a reflowed slide (`fit: 'reflow'`): the 9:16
 * canvas width, under the 48rem container query where the catalog layouts
 * switch to one column.
 */
export const DECK_REFLOW_WIDTH = 720;

export interface CanvasFit {
  /** Uniform scale applied to the virtual canvas. */
  scale: number;
  /** Rendered width after scale (CSS px). */
  width: number;
  /** Rendered height after scale (CSS px). */
  height: number;
  /** Letterbox offset on the inline axis. */
  offsetX: number;
  /** Letterbox offset on the block axis. */
  offsetY: number;
  canvasWidth: number;
  canvasHeight: number;
  aspect: DeckAspect;
  fit: DeckFitMode;
}

export function isDeckAspect(value: unknown): value is DeckAspect {
  return typeof value === 'string' && (DECK_ASPECTS as readonly string[]).includes(value);
}

/** The virtual canvas size for an aspect; unknown values fall back to 16:9. */
export function deckCanvasSize(aspect: unknown = DEFAULT_DECK_ASPECT): DeckCanvasSize {
  return DECK_CANVAS[isDeckAspect(aspect) ? aspect : DEFAULT_DECK_ASPECT];
}

/**
 * Scale and letterbox a virtual canvas inside a container.
 * `container` is an alias of `contain` for embedded decks. `reflow` acts as
 * `contain` unless the container is portrait (taller than wide) and the deck
 * canvas is not: then the canvas becomes `DECK_REFLOW_WIDTH` wide and as tall
 * as the container's ratio asks, filling it with no letterbox, and the
 * result's `fit` is `reflow` (otherwise `contain`).
 */
export function fitDeckCanvas(
  containerWidth: number,
  containerHeight: number,
  aspect: unknown = DEFAULT_DECK_ASPECT,
  fit: DeckFitMode = 'contain'
): CanvasFit {
  const resolvedAspect = isDeckAspect(aspect) ? aspect : DEFAULT_DECK_ASPECT;
  const canvas = DECK_CANVAS[resolvedAspect];
  const width = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  const height = Number.isFinite(containerHeight) ? Math.max(0, containerHeight) : 0;
  if (fit === 'reflow' && width > 0 && height > width && canvas.width >= canvas.height) {
    const scale = width / DECK_REFLOW_WIDTH;
    return {
      scale,
      width,
      height,
      offsetX: 0,
      offsetY: 0,
      canvasWidth: DECK_REFLOW_WIDTH,
      canvasHeight: height / scale,
      aspect: resolvedAspect,
      fit: 'reflow',
    };
  }
  const mode: DeckFitMode =
    fit === 'cover' ? 'cover' : fit === 'container' ? 'container' : 'contain';
  const sx = canvas.width > 0 ? width / canvas.width : 0;
  const sy = canvas.height > 0 ? height / canvas.height : 0;
  const scale = mode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const renderedWidth = canvas.width * scale;
  const renderedHeight = canvas.height * scale;
  return {
    scale,
    width: renderedWidth,
    height: renderedHeight,
    offsetX: (width - renderedWidth) / 2,
    offsetY: (height - renderedHeight) / 2,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    aspect: resolvedAspect,
    fit: mode,
  };
}
