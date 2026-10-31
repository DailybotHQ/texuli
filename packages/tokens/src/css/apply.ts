/** Theme variables and scoped CSS for the public @texuli/tokens CSS entry. */

import {
  type ColorModeName,
  defineTheme,
  flattenSemanticPalette,
  INTERACTION_STATES,
  SEMANTIC_ROLES,
  semanticTokenToCssVar,
  type Theme,
} from '../contract/index.ts';
import { slowerDuration } from '../motion/durations.ts';

export interface ThemeAppearanceInput {
  theme: Theme;
  mode: ColorModeName;
  density?: number;
  reducedMotion?: boolean;
}

export interface AppliedTheme {
  themeId: string;
  mode: ColorModeName;
  density: number;
  reducedMotion: boolean;
  vars: Record<string, string>;
}

const FONT_SIZES = [
  ['xs', -2, '0.75rem'],
  ['sm', -1, '0.875rem'],
  ['base', 0, '1rem'],
  ['lg', 1, '1.125rem'],
  ['xl', 2, '1.25rem'],
  ['2xl', 3, '1.5rem'],
  ['3xl', 4, '1.875rem'],
  ['4xl', 5, '2.25rem'],
  ['5xl', 6, '3rem'],
  ['6xl', 7, '3.75rem'],
  ['7xl', 8, '4.5rem'],
  ['8xl', 9, '6rem'],
  ['9xl', 10, '8rem'],
] as const;

const STYLE_VARIABLES = [
  '--tx-radius',
  '--tx-font-sans',
  '--tx-font-heading',
  '--tx-font-mono',
  '--tx-density',
  '--tx-motion',
  '--tx-font-weight-body',
  '--tx-font-weight-medium',
  '--tx-font-weight-heading',
  '--tx-font-weight-bold',
  '--tx-letter-spacing-body',
  '--tx-letter-spacing-heading',
  '--tx-radius-scale',
  '--tx-radius-step-6',
  '--tx-radius-step-4',
  '--tx-radius-step-2',
  '--tx-border-width',
  '--tx-elevation-style',
  '--tx-shadow-soft',
  '--tx-shadow-float',
  '--tx-surface-style',
  '--tx-glass-opacity',
  '--tx-glass-blur',
  '--tx-motion-fast',
  '--tx-motion-base',
  '--tx-motion-slow',
  '--tx-motion-slower',
  '--tx-motion-easing',
  '--tx-focus-ring-style',
  '--tx-focus-ring-width',
  '--tx-focus-ring-offset',
  '--tx-chart-grid',
  '--tx-chart-axis',
  ...FONT_SIZES.map(([step]) => `--tx-font-size-${step}`),
  ...Array.from({ length: 8 }, (_, i) => `--tx-chart-${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `--tx-chart-sequential-${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `--tx-chart-diverging-${i + 1}`),
] as const;

const THEME_VARIABLE_NAMES = [
  ...new Set([
    ...STYLE_VARIABLES,
    ...SEMANTIC_ROLES.flatMap((role) =>
      INTERACTION_STATES.map((state) => semanticTokenToCssVar(role, state))
    ),
  ]),
];

function densityFor(input: ThemeAppearanceInput, theme: Theme): number {
  const density = input.density ?? theme.density;
  if (!Number.isFinite(density) || density < 0.75 || density > 1.25) {
    throw new RangeError('Theme density must be between 0.75 and 1.25');
  }
  return density;
}

function assertMode(mode: unknown): asserts mode is ColorModeName {
  if (mode !== 'light' && mode !== 'dark') throw new TypeError('Theme mode must be light or dark');
}

/** @internal The 13 font size steps for a type scale ratio; shared with the design-system compiler. */
export function fontSizes(scaleRatio: number | null): Record<string, string> {
  return Object.fromEntries(
    FONT_SIZES.map(([step, exponent, fallback]) => [
      `--tx-font-size-${step}`,
      scaleRatio === null
        ? fallback
        : `${Number(scaleRatio ** exponent)
            .toFixed(4)
            .replace(/0+$/, '')
            .replace(/\.$/, '')}rem`,
    ])
  );
}

/** @internal The soft and float shadows of an elevation style; shared with the design-system compiler. */
export function shadows(elevation: Theme['style']['elevation']): [string, string] {
  switch (elevation) {
    case 'flat':
      return ['none', 'none'];
    case 'crisp':
      return ['0 1px 2px 0 var(--tx-shadow)', '0 4px 8px -2px var(--tx-shadow)'];
    case 'glow':
      return [
        '0 0 12px color-mix(in oklab, var(--tx-primary) 24%, transparent)',
        '0 0 28px color-mix(in oklab, var(--tx-primary) 32%, transparent)',
      ];
    case 'layered':
      return [
        '0 1px 1px 0 var(--tx-shadow), 0 2px 4px -1px var(--tx-shadow), 0 4px 8px -2px var(--tx-shadow)',
        '0 1px 2px 0 var(--tx-shadow), 0 4px 8px -2px var(--tx-shadow), 0 12px 24px -6px var(--tx-shadow), 0 24px 48px -12px var(--tx-shadow)',
      ];
    default:
      return [
        '0 1px 2px 0 var(--tx-shadow), 0 1px 3px 0 var(--tx-shadow)',
        '0 10px 30px -8px var(--tx-shadow), 0 4px 10px -4px var(--tx-shadow)',
      ];
  }
}

/** Every validated CSS custom property for one theme and mode. */
export function themeVariables(input: ThemeAppearanceInput): Record<string, string> {
  assertMode(input.mode);
  const theme = defineTheme(input.theme);
  const palette = input.mode === 'dark' ? theme.dark : theme.light;
  const density = densityFor(input, theme);
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(flattenSemanticPalette(palette))) {
    const [role, state] = token.split('.');
    vars[semanticTokenToCssVar(role as string, state)] = value;
  }

  const style = theme.style;
  const [softShadow, floatShadow] = shadows(style.elevation);
  Object.assign(vars, fontSizes(style.typography.scaleRatio));
  Object.assign(vars, {
    '--tx-radius': theme.radius,
    '--tx-font-sans': theme.fontFamily,
    '--tx-font-heading': theme.fontFamilyHeading ?? theme.fontFamily,
    '--tx-font-mono': theme.fontFamilyMono,
    '--tx-density': String(density),
    '--tx-motion': input.reducedMotion ? '0' : '1',
    '--tx-font-weight-body': String(style.typography.weights.body),
    '--tx-font-weight-medium': String(style.typography.weights.medium),
    '--tx-font-weight-heading': String(style.typography.weights.heading),
    '--tx-font-weight-bold': String(style.typography.weights.bold),
    '--tx-letter-spacing-body': style.typography.tracking.body,
    '--tx-letter-spacing-heading': style.typography.tracking.heading,
    '--tx-radius-scale': String(style.shape.radiusScale),
    '--tx-radius-step-6': `${Number((6 * style.shape.radiusScale).toFixed(4))}px`,
    '--tx-radius-step-4': `${Number((4 * style.shape.radiusScale).toFixed(4))}px`,
    '--tx-radius-step-2': `${Number((2 * style.shape.radiusScale).toFixed(4))}px`,
    '--tx-border-width': style.shape.borderWidth,
    '--tx-elevation-style': style.elevation,
    '--tx-shadow-soft': softShadow,
    '--tx-shadow-float': floatShadow,
    '--tx-surface-style': style.surface,
    '--tx-glass-opacity': '82%',
    '--tx-glass-blur': '16px',
    '--tx-motion-fast': input.reducedMotion ? '0ms' : `${style.motion.durations.fast}ms`,
    '--tx-motion-base': input.reducedMotion ? '0ms' : `${style.motion.durations.base}ms`,
    '--tx-motion-slow': input.reducedMotion ? '0ms' : `${style.motion.durations.slow}ms`,
    '--tx-motion-slower': input.reducedMotion
      ? '0ms'
      : `${slowerDuration(style.motion.durations.slow)}ms`,
    '--tx-motion-easing': input.reducedMotion ? 'linear' : style.motion.easing,
    '--tx-focus-ring-style': style.focusRing.style,
    '--tx-focus-ring-width': style.focusRing.width,
    '--tx-focus-ring-offset': style.focusRing.offset,
  });

  const charts = theme.charts?.[input.mode];
  vars['--tx-chart-grid'] = charts?.grid ?? palette.border.default;
  vars['--tx-chart-axis'] = charts?.axis ?? palette.mutedForeground.default;
  charts?.categorical.forEach((color, index) => {
    vars[`--tx-chart-${index + 1}`] = color;
  });
  charts?.sequential.forEach((color, index) => {
    vars[`--tx-chart-sequential-${index + 1}`] = color;
  });
  charts?.diverging.forEach((color, index) => {
    vars[`--tx-chart-diverging-${index + 1}`] = color;
  });
  return vars;
}

function declarations(vars: Record<string, string>): string {
  return Object.entries(vars)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `    ${name}: ${value};`)
    .join('\n');
}

/**
 * Compile both mode palettes as scoped CSS rules. Theme ids and all values are
 * revalidated before serialization, so arbitrary input cannot inject CSS.
 */
export function compileThemeCss(input: Theme): string {
  const theme = defineTheme(input);
  const selectors = (mode: ColorModeName) =>
    `[data-tx-theme='${theme.id}'][data-tx-mode='${mode}']`;
  const rules = (['light', 'dark'] as const).map((mode) => {
    const vars = themeVariables({ theme, mode });
    return `  ${selectors(mode)} {\n${declarations(vars)}\n  }`;
  });
  return `@layer tx.base, tx.components;\n\n@layer tx.base {\n${rules.join('\n\n')}\n}\n`;
}

/**
 * Write a theme to any element and scope it to that element's descendants.
 * The element is marked `[data-tx-scope]` (ADR-023): `base.css` declares the
 * system token defaults on every scope, and overlay portals opened inside it
 * mount in a portal root that mirrors its attributes and inline variables.
 * An existing `data-tx-scope` value (a host-named scope) is kept.
 */
export function applyTheme(target: HTMLElement, input: ThemeAppearanceInput): AppliedTheme {
  const theme = defineTheme(input.theme);
  const vars = themeVariables({ ...input, theme });
  for (const name of THEME_VARIABLE_NAMES) target.style.removeProperty(name);
  for (const [name, value] of Object.entries(vars)) target.style.setProperty(name, value);
  const reducedMotion = input.reducedMotion ?? false;
  if (!target.hasAttribute('data-tx-scope')) target.setAttribute('data-tx-scope', '');
  target.dataset.txTheme = theme.id;
  target.dataset.txMode = input.mode;
  target.dataset.txMotion = reducedMotion ? 'reduce' : 'full';
  target.dataset.txSurface = theme.style.surface;
  return {
    themeId: theme.id,
    mode: input.mode,
    density: Number(vars['--tx-density']),
    reducedMotion,
    vars,
  };
}

/**
 * Remove theme properties and attributes written by {@link applyTheme}. The
 * scope marker goes too, unless the host named it (a non-empty value).
 */
export function clearTheme(target: HTMLElement): void {
  if (target.getAttribute('data-tx-scope') === '') target.removeAttribute('data-tx-scope');
  for (const name of THEME_VARIABLE_NAMES) target.style.removeProperty(name);
  delete target.dataset.txTheme;
  delete target.dataset.txMode;
  delete target.dataset.txMotion;
  delete target.dataset.txSurface;
}
