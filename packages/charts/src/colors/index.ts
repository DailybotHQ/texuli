import { sequentialFallback } from '../math/color.ts';

const SEMANTIC_FALLBACKS = [
  '--tx-primary',
  '--tx-success',
  '--tx-info',
  '--tx-warning',
  '--tx-destructive',
  '--tx-secondary',
  '--tx-accent',
  '--tx-link',
] as const;

const clamp = (value: number, min: number, max: number): number =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : 0;

/** Resolve a repeatable categorical color from the active theme's chart tokens. */
export function categoricalColor(index: number): string {
  const normalized = Number.isFinite(index) ? Math.trunc(index) : 0;
  const slot = ((normalized % 8) + 8) % 8;
  return `var(--tx-chart-${slot + 1}, var(${SEMANTIC_FALLBACKS[slot]}, CanvasText))`;
}

/** Resolve the nearest token in the nine-step sequential ramp for a 0–1 value. */
export function sequentialColor(value: number): string {
  const slot = Math.round(clamp(value, 0, 1) * 8);
  return `var(--tx-chart-sequential-${slot + 1}, ${sequentialFallback(slot)})`;
}

/** Resolve the nearest token in the nine-step diverging ramp for a -1–1 value. */
export function divergingColor(value: number): string {
  const slot = Math.round(((clamp(value, -1, 1) + 1) / 2) * 8);
  const side = slot < 4 ? 'destructive' : 'success';
  const strength = Math.abs(slot - 4) * 16;
  const fallback =
    slot === 4
      ? 'var(--tx-background, Canvas)'
      : `color-mix(in oklab, var(--tx-${side}, CanvasText) ${strength}%, var(--tx-background, Canvas))`;
  return `var(--tx-chart-diverging-${slot + 1}, ${fallback})`;
}
