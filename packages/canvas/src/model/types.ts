/**
 * The canvas format (spec 0.8.0, `schemas/canvas.schema.json`): plain JSON
 * data with persisted ids. Coordinates are world units, absolute for every
 * shape (children of frames and groups included). Array order is z-order:
 * the first shape paints at the bottom.
 */

/** A token palette name (closed): painted with `--tx-*` colors, never a raw CSS color. */
export type CanvasColor =
  | 'default'
  | 'gray'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'pink';

export type CanvasDash = 'solid' | 'dashed' | 'dotted';

export interface CanvasPaint {
  /** Fill color (`none` paints no fill). */
  fill?: CanvasColor | 'none';
  /** Stroke color (`none` paints no outline). */
  stroke?: CanvasColor | 'none';
  /** Stroke width in world units, 0.5 to 16. */
  strokeWidth?: number;
  dash?: CanvasDash;
  /** 0.1 to 1. */
  opacity?: number;
}

/** Text sizes (closed). */
export type CanvasFontSize = 's' | 'm' | 'l' | 'xl';
/** Text alignment in reading direction. */
export type CanvasTextAlign = 'start' | 'center' | 'end';

/** A point `[x, y]`. In lines and paths, relative to the shape's `x` and `y`. */
export type CanvasPoint = [number, number];

interface ShapeBase {
  /** Persisted id, unique among shapes and connectors (`CANVAS_ID_PATTERN`). */
  id: string;
  /** Locked shapes do not move, resize, rotate or get deleted from the editor. */
  locked?: boolean;
}

interface Boxed extends ShapeBase {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees, clockwise, around the box center (-360 to 360). */
  rotation?: number;
  paint?: CanvasPaint;
}

export interface RectShape extends Boxed {
  type: 'rect';
  /** Corner radius in world units. */
  radius?: number;
  text?: string;
}

export interface EllipseShape extends Boxed {
  type: 'ellipse';
  text?: string;
}

export interface DiamondShape extends Boxed {
  type: 'diamond';
  text?: string;
}

/** A polyline (`line`) or a polyline with an arrowhead at its end (`arrow`). */
export interface LineShape extends Boxed {
  type: 'line' | 'arrow';
  /** At least two points, relative to `x` and `y`. */
  points: CanvasPoint[];
}

/** A freehand stroke (simplified on input; see `simplifyPath`). */
export interface PathShape extends Boxed {
  type: 'path';
  points: CanvasPoint[];
  /** Close the stroke into a filled outline. */
  closed?: boolean;
}

export interface TextShape extends Boxed {
  type: 'text';
  text: string;
  fontSize?: CanvasFontSize;
  align?: CanvasTextAlign;
}

export interface StickyShape extends Boxed {
  type: 'sticky';
  text: string;
  color?: CanvasColor;
}

/** An image the host resolves from `ref`; the resolved URL passes the URL policy. */
export interface ImageShape extends Boxed {
  type: 'image';
  /** A host reference (never painted as a URL by itself). */
  ref: string;
  /** Required text alternative. */
  alt: string;
}

/** A titled region that holds and clips shapes. */
export interface FrameShape extends Boxed {
  type: 'frame';
  title?: string;
  children: CanvasShape[];
}

/** Shapes that move, copy and delete together. Its box is its children's bounds. */
export interface GroupShape extends ShapeBase {
  type: 'group';
  children: CanvasShape[];
}

export type CanvasShape =
  | RectShape
  | EllipseShape
  | DiamondShape
  | LineShape
  | PathShape
  | TextShape
  | StickyShape
  | ImageShape
  | FrameShape
  | GroupShape;

export type CanvasShapeType = CanvasShape['type'];
/** Shapes with a box of their own (every type but `group`). */
export type BoxedShape = Exclude<CanvasShape, GroupShape>;
/** Shapes that hold children. */
export type ContainerShape = FrameShape | GroupShape;

/** Where a connector attaches on a shape. `auto` picks the side facing the other end. */
export type CanvasAnchor = 'auto' | 'center' | 'top' | 'right' | 'bottom' | 'left';

/** A connector end: on a shape, or at a free world point. */
export type CanvasEndpoint = { shape: string; anchor?: CanvasAnchor } | { x: number; y: number };

export type CanvasRouting = 'straight' | 'elbow' | 'curved';
export type CanvasCap = 'none' | 'arrow' | 'dot';

export interface CanvasConnector {
  id: string;
  from: CanvasEndpoint;
  to: CanvasEndpoint;
  /** Default `straight`. */
  routing?: CanvasRouting;
  /** Default `none`. */
  startCap?: CanvasCap;
  /** Default `arrow`. */
  endCap?: CanvasCap;
  text?: string;
  paint?: CanvasPaint;
}

export interface CanvasMeta {
  title?: string;
  /** BCP 47 language tag of the text. */
  locale?: string;
  description?: string;
}

export interface CanvasDocument {
  format: 'texuli-canvas';
  formatVersion: 1;
  meta?: CanvasMeta;
  /** Snap grid in world units (editor default 8). */
  grid?: number;
  shapes: CanvasShape[];
  connectors: CanvasConnector[];
}

/** A world rectangle. */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasXY {
  x: number;
  y: number;
}
