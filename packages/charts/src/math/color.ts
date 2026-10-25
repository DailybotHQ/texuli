/**
 * Step `slot` (0–8) of a light-to-strong ramp mixed from the theme's first
 * chart color (or primary) into its background. Charts use it when a theme
 * ships no sequential palette (`--tx-chart-sequential-*`), so maps, heatmaps
 * and ranges still show a readable scale in light and dark alike.
 */
export function sequentialFallback(slot: number): string {
  const step = Number.isFinite(slot) ? Math.min(8, Math.max(0, Math.trunc(slot))) : 0;
  const strength = 18 + step * 10;
  return `color-mix(in oklab, var(--tx-chart-1, var(--tx-primary, CanvasText)) ${strength}%, var(--tx-background, Canvas))`;
}
