<script lang="ts">
/**
 * Sets the motion level (and an optional reduced-motion override) for every
 * component below it. Renders no element. A nested provider can only lower
 * the level its parent set (the host's choice wins, ADR-013).
 */
import type { Snippet } from 'svelte';
import { getMotionSettings, type MotionSettings, setMotionSettings } from './context.ts';
import { isMotionLevelName, lowerLevel, type MotionLevel } from './contract.ts';

let {
  level = 'full',
  reducedMotion,
  children,
}: {
  /** `full` (default), `subtle` (shorter, no travel or scale) or `none` (instant). */
  level?: MotionLevel;
  /** `true` forces reduced motion, `false` ignores the reader's preference; omit to follow it. */
  reducedMotion?: boolean;
  children?: Snippet;
} = $props();

const parent = getMotionSettings();

const settings: MotionSettings = {
  get level() {
    return lowerLevel(parent.level, isMotionLevelName(level) ? level : 'full');
  },
  get reducedMotion() {
    // A parent that forces reduced motion wins over a child that ignores it.
    if (parent.reducedMotion === true) return true;
    return typeof reducedMotion === 'boolean' ? reducedMotion : parent.reducedMotion;
  },
};
setMotionSettings(settings);
</script>

{@render children?.()}
