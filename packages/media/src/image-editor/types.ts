/**
 * A non-destructive image edit: a serializable recipe applied to an untouched
 * source. Rendering applies, in order: orientation (quarter turns, then
 * flips), crop, resize, filters, then annotations.
 *
 * Coordinates are normalized (0 to 1), so an edit survives a different source
 * resolution:
 * - `crop` is a rectangle in the oriented image (after rotation and flips);
 * - annotations live on the final image (after the crop).
 */
export interface ImageEdit {
  version: 1;
  /** Clockwise quarter turns. */
  rotate: QuarterTurn;
  flipX: boolean;
  flipY: boolean;
  /** The kept part of the oriented image; omitted means the whole image. */
  crop?: NormalizedRect;
  /** Output size in pixels; omitted means the cropped size at full resolution. */
  resize?: { width: number; height: number };
  filters: ImageFilters;
  annotations: readonly Annotation[];
}

export type QuarterTurn = 0 | 90 | 180 | 270;

/** A rectangle in normalized coordinates (`x + width ≤ 1`, `y + height ≤ 1`). */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Filter amounts; each has a neutral value (see `NEUTRAL_FILTERS`). */
export interface ImageFilters {
  /** Percent, 0–200 (100 is neutral). */
  brightness: number;
  /** Percent, 0–200 (100 is neutral). */
  contrast: number;
  /** Percent, 0–200 (100 is neutral). */
  saturation: number;
  /** Percent, 0–100 (0 is neutral). */
  grayscale: number;
  /** Percent, 0–100 (0 is neutral). */
  sepia: number;
  /** Degrees, -180–180 (0 is neutral). */
  hueRotate: number;
  /** Radius as a fraction of the output's shorter side, 0–0.05 (0 is neutral). */
  blur: number;
}

export type FilterName = keyof ImageFilters;

interface AnnotationBase {
  id: string;
  /** Six-digit hex color, for example `#e11d48`. */
  color: string;
  /** Stroke width as a fraction of the output's shorter side. */
  strokeWidth: number;
}

export interface RectAnnotation extends AnnotationBase {
  type: 'rect' | 'ellipse';
  frame: NormalizedRect;
}

export interface ArrowAnnotation extends AnnotationBase {
  type: 'arrow';
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  /** The text's top-start corner. */
  at: { x: number; y: number };
  text: string;
  /** Font size as a fraction of the output height. */
  fontSize: number;
}

export type Annotation = RectAnnotation | ArrowAnnotation | TextAnnotation;
export type AnnotationType = Annotation['type'];

export interface ImageEditIssue {
  path: string;
  code: 'invalid-input' | 'unknown-field' | 'invalid-value' | 'limit-exceeded' | 'duplicate-id';
  message: string;
}

export type ImageEditValidation =
  | { ok: true; edit: ImageEdit }
  | { ok: false; errors: readonly ImageEditIssue[] };

/** One undoable change. `annotation` actions address annotations by id. */
export type EditAction =
  | { type: 'rotate'; turns: -1 | 1 }
  | { type: 'flip'; axis: 'x' | 'y' }
  | { type: 'crop'; rect: NormalizedRect | null }
  | { type: 'resize'; size: { width: number; height: number } | null }
  | { type: 'filter'; name: FilterName; value: number }
  | { type: 'reset-filters' }
  | { type: 'add-annotation'; annotation: Annotation }
  | { type: 'update-annotation'; id: string; patch: AnnotationPatch }
  | { type: 'move-annotation'; id: string; dx: number; dy: number }
  | { type: 'remove-annotation'; id: string }
  | { type: 'reset' };

/** The fields an update may change; type and id are fixed. */
export type AnnotationPatch = Partial<{
  color: string;
  strokeWidth: number;
  frame: NormalizedRect;
  from: { x: number; y: number };
  to: { x: number; y: number };
  at: { x: number; y: number };
  text: string;
  fontSize: number;
}>;

/** Pixel size of the source image (natural size). */
export interface SourceSize {
  width: number;
  height: number;
}
