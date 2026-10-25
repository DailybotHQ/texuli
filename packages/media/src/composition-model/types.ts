import type { MediaProvenance } from '../provenance.ts';

/** A finite, serializable description of a composition canvas. */
export interface Composition {
  version: 1;
  width: number;
  height: number;
  durationMs?: number;
  layers: readonly CompositionLayer[];
}

export interface CompositionFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Numeric transforms only; arbitrary CSS transform strings are never accepted. */
export interface CompositionTransform {
  translateX?: number;
  translateY?: number;
  scaleX?: number;
  scaleY?: number;
  rotateDeg?: number;
}

export type CompositionBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface CompositionMask {
  layerId: string;
  mode: 'alpha' | 'luminance';
  invert?: boolean;
}

export interface CompositionLayerBase {
  id: string;
  frame: CompositionFrame;
  transform?: CompositionTransform;
  opacity?: number;
  blendMode?: CompositionBlendMode;
  mask?: CompositionMask;
}

export type CompositionLayer = ShapeLayer | TextLayer | ImageLayer;

export interface ShapeLayer extends CompositionLayerBase {
  type: 'shape';
  shape: 'rectangle' | 'ellipse' | 'line';
  fill?: CompositionPaint;
  stroke?: CompositionPaint;
  strokeWidth?: number;
}

export interface TextLayer extends CompositionLayerBase {
  type: 'text';
  text: string;
  paint: CompositionPaint;
  fontSize: number;
  fontWeight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  align?: 'start' | 'center' | 'end';
}

export interface ImageLayer extends CompositionLayerBase {
  type: 'image';
  src: string;
  /** Empty alt text is allowed for a deliberately decorative image. */
  alt: string;
  fit?: 'contain' | 'cover' | 'fill';
  /** Plain-data origin metadata; renderers ignore it and exporters preserve it as a sidecar. */
  provenance?: MediaProvenance;
}

export interface SolidPaint {
  kind: 'solid';
  color: string;
}

export interface LinearGradientPaint {
  kind: 'linear-gradient';
  angle: number;
  stops: readonly GradientStop[];
}

export interface RadialGradientPaint {
  kind: 'radial-gradient';
  center: { x: number; y: number };
  radius: number;
  stops: readonly GradientStop[];
}

export interface GradientStop {
  offset: number;
  color: string;
}

export type CompositionPaint = SolidPaint | LinearGradientPaint | RadialGradientPaint;

export interface CompositionIssue {
  path: string;
  code:
    | 'invalid-input'
    | 'unknown-field'
    | 'missing-field'
    | 'invalid-value'
    | 'limit-exceeded'
    | 'duplicate-id'
    | 'unsafe-source'
    | 'missing-mask'
    | 'mask-cycle';
  message: string;
}

export type CompositionValidation =
  | { ok: true; composition: Composition }
  | { ok: false; errors: readonly CompositionIssue[] };

export interface ValidateCompositionOptions {
  /** Defaults to `untrusted`; use `developer` only for app-authored data. */
  trust?: 'developer' | 'untrusted';
}
