/**
 * Looping motion (`texuli/motion/loop`, D-G-046): the closed preset,
 * duration and stagger names a `MotionLoop` takes, and the one rule that
 * decides whether it moves. Static and tiny: the keyframes live in
 * `loop.css`, Texuli's own stylesheet, and every period, delay and curve is
 * a theme token (`--tx-motion-<step>`, `--tx-motion-ease-standard`).
 */

import type { MotionDurationName, MotionLevel } from '../contract.ts';

/**
 * `pulse` dims and shrinks a little (a live dot, a speaking avatar ring);
 * `wave` scales along the block axis (the bars of a voice waveform).
 */
export const MOTION_LOOP_PRESETS = Object.freeze(['pulse', 'wave'] as const);
export type MotionLoopPreset = (typeof MOTION_LOOP_PRESETS)[number];

/** The delay between neighboring children: none, or `--tx-motion-fast` / `-base`. */
export const MOTION_LOOP_STAGGERS = Object.freeze(['none', 'fast', 'base'] as const);
export type MotionLoopStagger = (typeof MOTION_LOOP_STAGGERS)[number];

/** Where a loop is painted: the preset, and `subtle` (opacity only) or `full`. */
export interface MotionLoopState {
  readonly preset: MotionLoopPreset;
  readonly level: 'full' | 'subtle';
}

export interface MotionLoopInput {
  readonly preset: unknown;
  /** `false` keeps the children at rest. */
  readonly playing: boolean;
  /** The enclosing `MotionProvider` level. */
  readonly level: MotionLevel;
  /** The provider's override: `true` keeps the loop at rest. */
  readonly reducedMotion: boolean | undefined;
}

/**
 * The loop to paint, or `null` for the rest state: not playing, level
 * `none` or a provider that forces reduced motion. The reader's
 * `prefers-reduced-motion: reduce` and a `data-tx-motion="reduce"` scope are
 * enforced by the stylesheet, so they hold on the server too. An unknown
 * preset falls back to `pulse`.
 */
export function resolveMotionLoop(input: MotionLoopInput): MotionLoopState | null {
  if (!input.playing || input.level === 'none' || input.reducedMotion === true) return null;
  const preset = input.preset === 'wave' ? 'wave' : 'pulse';
  return { preset, level: input.level === 'subtle' ? 'subtle' : 'full' };
}

/** A duration step name, or `slow` (the default period: 4 × `--tx-motion-slow`). */
export function loopDuration(value: unknown): MotionDurationName {
  return value === 'fast' || value === 'base' ? value : 'slow';
}

/** A stagger name, or `fast` (the default). */
export function loopStagger(value: unknown): MotionLoopStagger {
  return value === 'none' || value === 'base' ? value : 'fast';
}
