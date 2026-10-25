import type {
  CompositionIssue,
  CompositionLayer,
  ValidateCompositionOptions,
} from '../composition-model/types.ts';

/**
 * When a layer is on screen, in milliseconds from the composition start:
 * visible from `startMs` up to (not including) `endMs`, which defaults to the
 * composition's `durationMs`.
 */
export interface LayerTiming {
  startMs: number;
  endMs?: number;
}

/** A v1 leaf layer (shape, text or image) with an optional time window. */
export type CompositionLeafV2 = CompositionLayer & { timing?: LayerTiming };

/**
 * A group of layers. It moves its children by `offset`, multiplies their
 * opacity, and gates them by its own `timing`. Groups take no rotation,
 * scale, blend mode or mask, so every resolved frame stays a flat v1 scene.
 */
export interface GroupLayer {
  id: string;
  type: 'group';
  children: readonly CompositionLayerV2[];
  offset?: { x: number; y: number };
  opacity?: number;
  timing?: LayerTiming;
}

export type CompositionLayerV2 = CompositionLeafV2 | GroupLayer;

/** Composition v2: layers may nest in groups and carry time windows. */
export interface CompositionV2 {
  version: 2;
  width: number;
  height: number;
  /** Required when any layer has `timing`. */
  durationMs?: number;
  layers: readonly CompositionLayerV2[];
}

export type CompositionV2Validation =
  | { ok: true; composition: CompositionV2 }
  | { ok: false; errors: readonly CompositionIssue[] };

export type ValidateCompositionV2Options = ValidateCompositionOptions;
