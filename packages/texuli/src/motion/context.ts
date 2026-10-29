/**
 * The motion level and reduced-motion override a `MotionProvider` gives the
 * components below it (ADR-013). Read once, at component init; the getters
 * stay live, so a provider prop change applies to the next animation.
 */

import { getContext, setContext } from 'svelte';
import type { MotionLevel } from './contract.ts';

/** What every animation below a provider plays at. */
export interface MotionSettings {
  /** The host's level: `full` (default), `subtle` (shorter, no travel or scale) or `none` (instant). */
  readonly level: MotionLevel;
  /**
   * `true` forces reduced motion (instant), `false` ignores the reader's
   * preference; `undefined` (default) reads `prefers-reduced-motion`.
   */
  readonly reducedMotion: boolean | undefined;
}

const MOTION_CONTEXT = Symbol.for('texuli.motion');

/** No provider: full motion, the reader's preference decides reduced motion. */
export const DEFAULT_MOTION_SETTINGS: MotionSettings = Object.freeze({
  level: 'full',
  reducedMotion: undefined,
});

export function setMotionSettings(settings: MotionSettings): void {
  setContext(MOTION_CONTEXT, settings);
}

/** The enclosing provider's settings (call during component init). */
export function getMotionSettings(): MotionSettings {
  return getContext<MotionSettings | undefined>(MOTION_CONTEXT) ?? DEFAULT_MOTION_SETTINGS;
}
