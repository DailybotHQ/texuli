import type { Composition, CompositionIssue } from '../composition-model/types.ts';

/** Named easing curves for segments between keyframes. */
export const EASING_NAMES = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;
export type EasingName = (typeof EASING_NAMES)[number];

/**
 * A keyframe on a layer track. Times are milliseconds from the animation start.
 * Omitted properties keep the previous keyframe’s value (or the layer base).
 */
export interface LayerKeyframe {
  timeMs: number;
  opacity?: number;
  translateX?: number;
  translateY?: number;
  scaleX?: number;
  scaleY?: number;
  rotateDeg?: number;
  /**
   * Solid fill color (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`): a shape's
   * fill or a text layer's paint. Colors between keyframes mix in OKLCH.
   */
  fill?: string;
  /** Solid stroke color of a shape layer, mixed in OKLCH. */
  stroke?: string;
  /** Easing into this keyframe from the previous one. Default `linear`. */
  easing?: EasingName;
}

/** Keyframes for one composition layer id. */
export interface LayerTrack {
  layerId: string;
  keyframes: readonly LayerKeyframe[];
}

/**
 * Finite, serializable animation over a composition. Untrusted input is
 * validated before sampling; no CSS strings or script.
 */
export interface CompositionAnimation {
  version: 1;
  durationMs: number;
  loop?: boolean;
  tracks: readonly LayerTrack[];
}

export type AnimationValidation =
  | { ok: true; animation: CompositionAnimation }
  | { ok: false; errors: readonly CompositionIssue[] };

export type ValidateAnimationOptions = {
  /** Composition layer ids must exist when provided. */
  composition?: Composition;
};

export const ANIMATION_LIMITS = Object.freeze({
  maxDurationMs: 120_000,
  maxTracks: 256,
  maxKeyframesPerTrack: 64,
  maxIssues: 64,
});

export type SampleAnimationOptions = {
  /**
   * When true, ignore the requested time and return the still frame
   * (`stillTimeMs`, default 0). Used for prefers-reduced-motion.
   */
  reducedMotion?: boolean;
  /** Still frame time under reduced motion. Default 0. */
  stillTimeMs?: number;
};

export type TimelineState = {
  timeMs: number;
  playing: boolean;
  durationMs: number;
  loop: boolean;
  reducedMotion: boolean;
};

export type TimelineListener = (state: TimelineState) => void;
