/**
 * A light `Sparkline` for first screens: the same props as the
 * `@texuli/charts/compact` Sparkline (catalog id `charts-sparkline`) and the
 * same drawing, accessible name and description, without the data table, its
 * scroll window or the formatter cache. Swap the import path to switch.
 */
export type { ChartFormatSpec, CompactChartLabels } from '../compact/shared.ts';
export { barsPaths } from './paths.ts';
export { default as Sparkline } from './SparklineLite.svelte';
