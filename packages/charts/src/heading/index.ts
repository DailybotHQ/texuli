/**
 * `@texuli/charts/heading` (D-G-020): the heading rank of a chart's title,
 * from Svelte context. Flow, geo and part-whole charts render their title at
 * the rank a host sets for them (the player sets one rank below the nearest
 * titled section: `h2` directly under a page's `h1`, `h3` in a card titled
 * `h2`), and at {@link CHART_TITLE_LEVEL_DEFAULT} (`h3`) when nothing sets
 * one, as before: inside a slide, a block or your own markup.
 *
 * The rank never comes from a prop, so the blueprint vocabulary is
 * unchanged. Values are clamped to 2–6: a chart title is never an `h1`.
 */
import { getContext, setContext } from 'svelte';

/** A chart title's heading rank. */
export type ChartTitleLevel = 2 | 3 | 4 | 5 | 6;

/** The rank a chart title renders at when no host sets one. */
export const CHART_TITLE_LEVEL_DEFAULT: ChartTitleLevel = 3;

// Symbol.for: one key even if two copies of this module load.
const KEY = Symbol.for('texuli.charts.title-level');

/** Clamp any value to a chart title rank (2–6); anything else is the default. */
export function chartTitleLevelOf(value: unknown): ChartTitleLevel {
  if (typeof value !== 'number' || !Number.isFinite(value)) return CHART_TITLE_LEVEL_DEFAULT;
  return Math.min(6, Math.max(2, Math.trunc(value))) as ChartTitleLevel;
}

/**
 * Set the title rank for the charts rendered inside the calling component
 * (call during component initialization). `level` is read on every render,
 * so a reactive rank follows; `undefined` means the default.
 */
export function setChartTitleLevel(level: () => number | undefined): void {
  setContext(KEY, level);
}

/**
 * The title rank getter for a chart component (call during component
 * initialization): the rank its host set, or the default.
 */
export function chartTitleLevel(): () => ChartTitleLevel {
  const read = getContext<(() => number | undefined) | undefined>(KEY);
  return () => {
    const level = read?.();
    return level === undefined ? CHART_TITLE_LEVEL_DEFAULT : chartTitleLevelOf(level);
  };
}
