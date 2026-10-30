/**
 * `@texuli/tokens/data-viz`: complete chart tokens for any theme (ADR-020).
 * A theme's own `charts` win; a theme without them gets tokens derived from
 * its palette with the chart engine (five series hues around the primary
 * hue, the same rule the seed generator uses), so a consumer never needs a
 * hex fallback.
 *
 * `themeVariables` keeps emitting chart tokens only for themes that carry
 * them: emitting derived colors by default changes how today's chart-less
 * themes render (components fall back to different colors today), so that
 * switch belongs to the chart adoption task with its own visual review.
 */

import type { ColorModeName, Theme, ThemeChartTokens } from '../contract/types.ts';
import { type ChartPaletteInput, deriveChartTokens } from '../palette/charts.ts';
import { parseHex } from '../palette/contrast.ts';
import { oklchToHex, rgbToOklch } from '../palette/oklch.ts';

const FALLBACK = {
  light: { surface: '#ffffff', ink: '#52525b', border: '#e4e4e7', destructive: '#dc2626' },
  dark: { surface: '#09090b', ink: '#a1a1aa', border: '#27272a', destructive: '#f87171' },
} as const;

/** A hex color from the palette, or the mode's neutral stand-in. */
function hexOr(value: string | undefined, fallback: string): string {
  return value && parseHex(value) ? value : fallback;
}

function primaryHue(value: string): number {
  const rgb = parseHex(value);
  if (!rgb) return 250;
  const { h, c } = rgbToOklch(rgb);
  return c < 0.02 || !Number.isFinite(h) ? 250 : h;
}

/** The chart engine input for a theme palette (exported for tests and tooling). */
export function chartPaletteInputFor(theme: Theme, mode: ColorModeName): ChartPaletteInput {
  const p = mode === 'dark' ? theme.dark : theme.light;
  const fb = FALLBACK[mode];
  const hue = primaryHue(p.primary.default);
  const l = mode === 'light' ? 0.58 : 0.72;
  const [chart1, chart2, chart3, chart4, chart5] = [0, 45, 90, 180, 270].map((offset) =>
    oklchToHex({ l, c: 0.16, h: (hue + offset) % 360 })
  ) as [string, string, string, string, string];
  return {
    surface: hexOr(p.surface.default, fb.surface),
    background: hexOr(p.background.default, fb.surface),
    destructive: hexOr(p.destructive.default, fb.destructive),
    border: p.border.default || fb.border,
    mutedForeground: p.mutedForeground.default || fb.ink,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
  };
}

/** The theme's chart tokens for one mode: its own, or derived from its palette. */
export function themeChartTokens(theme: Theme, mode: ColorModeName): ThemeChartTokens {
  const own = theme.charts?.[mode];
  if (own) return own;
  const derived = deriveChartTokens(chartPaletteInputFor(theme, mode), mode);
  return {
    categorical: derived.categorical as unknown as ThemeChartTokens['categorical'],
    sequential: derived.sequential as unknown as ThemeChartTokens['sequential'],
    diverging: derived.diverging as unknown as ThemeChartTokens['diverging'],
    grid: derived.grid,
    axis: derived.axis,
  };
}

/** Every `--tx-chart-*` variable for one theme and mode, always complete (28 entries). */
export function dataVizVariables(theme: Theme, mode: ColorModeName): Record<string, string> {
  const charts = themeChartTokens(theme, mode);
  const vars: Record<string, string> = {};
  charts.categorical.forEach((color, i) => {
    vars[`--tx-chart-${i + 1}`] = color;
  });
  charts.sequential.forEach((color, i) => {
    vars[`--tx-chart-sequential-${i + 1}`] = color;
  });
  charts.diverging.forEach((color, i) => {
    vars[`--tx-chart-diverging-${i + 1}`] = color;
  });
  vars['--tx-chart-grid'] = charts.grid;
  vars['--tx-chart-axis'] = charts.axis;
  return vars;
}
