/**
 * The canvas caps and closed vocabularies. Every limit holds for every
 * input (agent output, a pasted clipboard, a remote replica): the validator
 * refuses past them and the editor never builds past them.
 */
import type {
  CanvasAnchor,
  CanvasCap,
  CanvasColor,
  CanvasDash,
  CanvasFontSize,
  CanvasRouting,
  CanvasShapeType,
  CanvasTextAlign,
} from './types.ts';

export const CANVAS_FORMAT = 'texuli-canvas' as const;
export const CANVAS_FORMAT_VERSION = 1 as const;

export const CANVAS_LIMITS = Object.freeze({
  /** Shapes in a canvas, nested ones included. */
  shapes: 5_000,
  connectors: 5_000,
  /** Frames and groups nested inside each other. */
  depth: 8,
  /** Points stored in one line or path (freehand input is simplified to fit). */
  pathPoints: 1_000,
  /** Points across every line and path. */
  totalPoints: 200_000,
  /** Raw points `simplifyPath` reads (the rest is dropped). */
  rawPoints: 100_000,
  /** Code points of one shape or connector text. */
  text: 5_000,
  /** Code points of all text in a canvas. */
  totalText: 1_000_000,
  title: 200,
  alt: 500,
  description: 1_000,
  id: 64,
  ref: 256,
  /** Coordinates stay within ±this. */
  coordinate: 1_000_000,
  /** Widths and heights stay within this. */
  size: 100_000,
  /** JSON text read before parsing (`loadUntrustedCanvas`, the clipboard). */
  bytes: 8_000_000,
  /** Operations in one `applyCanvasOps` call. */
  ops: 10_000,
  /** Undo steps kept by `createCanvasHistory` (default). */
  history: 200,
});

/** Persisted ids (also valid `@texuli/document/sync` node ids). */
export const CANVAS_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
/** Host references for images. */
export const CANVAS_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,255}$/;
export const CANVAS_LANG_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,4}$/;

export const SHAPE_TYPES: readonly CanvasShapeType[] = Object.freeze([
  'rect',
  'ellipse',
  'diamond',
  'line',
  'arrow',
  'path',
  'text',
  'sticky',
  'image',
  'frame',
  'group',
]);

export const CANVAS_COLORS: readonly CanvasColor[] = Object.freeze([
  'default',
  'gray',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
]);
export const CANVAS_DASHES: readonly CanvasDash[] = Object.freeze(['solid', 'dashed', 'dotted']);
export const CANVAS_FONT_SIZES: readonly CanvasFontSize[] = Object.freeze(['s', 'm', 'l', 'xl']);
export const CANVAS_ALIGNS: readonly CanvasTextAlign[] = Object.freeze(['start', 'center', 'end']);
export const CANVAS_ANCHORS: readonly CanvasAnchor[] = Object.freeze([
  'auto',
  'center',
  'top',
  'right',
  'bottom',
  'left',
]);
export const CANVAS_ROUTINGS: readonly CanvasRouting[] = Object.freeze([
  'straight',
  'elbow',
  'curved',
]);
export const CANVAS_CAPS: readonly CanvasCap[] = Object.freeze(['none', 'arrow', 'dot']);

/** Font sizes in world units. */
export const FONT_SIZE_UNITS: Readonly<Record<CanvasFontSize, number>> = Object.freeze({
  s: 14,
  m: 18,
  l: 24,
  xl: 36,
});
