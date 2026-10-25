import type { Theme, ThemeCharts, ThemeChartTokens } from '../contract/types.ts';
import { deriveChartTokens } from '../palette/charts.ts';
import { oklchToHex } from '../palette/oklch.ts';
import { generatePaletteScale } from '../palette/scale.ts';
import type { LibraryThemeDefinition } from './types.ts';

function hueColor(hue: number, lightness: number): string {
  return oklchToHex({ l: lightness, c: 0.16, h: hue });
}

function defaults(theme: Theme, mode: 'light' | 'dark'): Record<string, string> {
  return Object.fromEntries(
    Object.entries(theme[mode]).map(([key, value]) => [key, value.default])
  );
}

function oneMode(
  definition: LibraryThemeDefinition,
  theme: Theme,
  mode: 'light' | 'dark'
): ThemeChartTokens {
  const seedScale = generatePaletteScale(definition.seed);
  const secondaryScale = generatePaletteScale(definition.secondary ?? definition.seed);
  const palette = defaults(theme, mode);
  const derived = deriveChartTokens(
    {
      surface: palette.surface as string,
      background: palette.background as string,
      destructive: palette.destructive as string,
      border: palette.border as string,
      mutedForeground: palette.mutedForeground as string,
      chart1: definition.chartSeeds?.[0] ?? seedScale[mode === 'light' ? 600 : 400],
      chart2: definition.chartSeeds?.[1] ?? secondaryScale[mode === 'light' ? 600 : 400],
      chart3: definition.chartSeeds?.[2] ?? hueColor(165, mode === 'light' ? 0.58 : 0.72),
      chart4: definition.chartSeeds?.[3] ?? hueColor(70, mode === 'light' ? 0.58 : 0.72),
      chart5: definition.chartSeeds?.[4] ?? hueColor(325, mode === 'light' ? 0.58 : 0.72),
    },
    mode
  );
  return {
    categorical: derived.categorical as unknown as ThemeChartTokens['categorical'],
    sequential: derived.sequential as unknown as ThemeChartTokens['sequential'],
    diverging: derived.diverging as unknown as ThemeChartTokens['diverging'],
    grid: derived.grid,
    axis: derived.axis,
  };
}

/** Build optional chart tokens separately so non-chart consumers do not pay their payload. */
export function buildLibraryThemeCharts(
  definition: LibraryThemeDefinition,
  theme: Theme
): ThemeCharts {
  return {
    light: oneMode(definition, theme, 'light'),
    dark: oneMode(definition, theme, 'dark'),
  };
}
