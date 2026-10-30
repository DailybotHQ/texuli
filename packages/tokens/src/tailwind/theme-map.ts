/**
 * Tailwind 4 `@theme inline` mapping: utility theme keys → `--tx-*` custom properties.
 * The CSS preset (`preset.css`) stays in sync with this table; tests enforce it.
 */

import { SEMANTIC_ROLES, semanticTokenToCssVar, tokenToCssVar } from '../contract/index.ts';

/** One Tailwind theme custom property and the token CSS variable it references. */
export type TailwindThemeEntry = {
  /** Full CSS custom property name inside `@theme inline` (e.g. `--color-primary`). */
  readonly themeVar: string;
  /** Token custom property, always `--tx-*`. */
  readonly tokenVar: string;
  /** Optional fallback chain after the primary token (comma-separated CSS). */
  readonly fallback?: string;
};

function color(name: string, token: string, fallback?: string): TailwindThemeEntry {
  const entry: TailwindThemeEntry = {
    themeVar: `--color-${name}`,
    tokenVar: token.startsWith('--') ? token : tokenToCssVar(token),
  };
  if (fallback !== undefined) return { ...entry, fallback };
  return entry;
}

/** Semantic roles exposed as Tailwind color utilities (`bg-primary`, `text-muted-foreground`, …). */
export const TAILWIND_SEMANTIC_COLORS: readonly TailwindThemeEntry[] = SEMANTIC_ROLES.map(
  (role) => {
    const kebab = semanticTokenToCssVar(role).slice('--tx-'.length);
    return color(kebab, semanticTokenToCssVar(role));
  }
);

/** Interaction-state fills for interactive roles (hover/active/disabled/focus). */
export const TAILWIND_INTERACTION_COLORS: readonly TailwindThemeEntry[] = [
  color('primary-hover', '--tx-primary-hover'),
  color('primary-active', '--tx-primary-active'),
  color('primary-disabled', '--tx-primary-disabled'),
  color('primary-focus', '--tx-primary-focus'),
  color('secondary-hover', '--tx-secondary-hover'),
  color('destructive-hover', '--tx-destructive-hover'),
  color('destructive-active', '--tx-destructive-active'),
  color('accent-hover', '--tx-accent-hover'),
  color('success-hover', '--tx-success-hover'),
  color('warning-hover', '--tx-warning-hover'),
  color('info-hover', '--tx-info-hover'),
  color('muted-hover', '--tx-muted-hover'),
  color('link-hover', '--tx-link-hover'),
];

/** Surface fill aliases (glass progressive enhancement writes `--tx-*-fill`). */
export const TAILWIND_SURFACE_ALIASES: readonly TailwindThemeEntry[] = [
  color('surface', '--tx-surface-fill', 'var(--tx-surface)'),
  color('elevated', '--tx-elevated-fill', 'var(--tx-elevated)'),
];

/** Chart series and chrome colors. */
export const TAILWIND_CHART_COLORS: readonly TailwindThemeEntry[] = [
  color('chart-1', '--tx-chart-1'),
  color('chart-2', '--tx-chart-2'),
  color('chart-3', '--tx-chart-3'),
  color('chart-4', '--tx-chart-4'),
  color('chart-5', '--tx-chart-5'),
  color('chart-6', '--tx-chart-6', 'var(--tx-chart-1)'),
  color('chart-7', '--tx-chart-7', 'var(--tx-chart-2)'),
  color('chart-8', '--tx-chart-8', 'var(--tx-chart-3)'),
  color('chart-grid', '--tx-chart-grid'),
  color('chart-axis', '--tx-chart-axis'),
];

/** Radius scale derived from `--tx-radius` and step tokens. */
export const TAILWIND_RADIUS: readonly TailwindThemeEntry[] = [
  {
    themeVar: '--radius-xs',
    tokenVar: '--tx-radius',
    fallback: 'calc(var(--tx-radius) - var(--tx-radius-step-6, 6px))',
  },
  {
    themeVar: '--radius-sm',
    tokenVar: '--tx-radius',
    fallback: 'calc(var(--tx-radius) - var(--tx-radius-step-4, 4px))',
  },
  {
    themeVar: '--radius-md',
    tokenVar: '--tx-radius',
    fallback: 'calc(var(--tx-radius) - var(--tx-radius-step-2, 2px))',
  },
  { themeVar: '--radius-lg', tokenVar: '--tx-radius' },
  {
    themeVar: '--radius-xl',
    tokenVar: '--tx-radius',
    fallback: 'calc(var(--tx-radius) + var(--tx-radius-step-4, 4px))',
  },
  {
    themeVar: '--radius-2xl',
    tokenVar: '--tx-radius',
    fallback:
      'calc(var(--tx-radius) + var(--tx-radius-step-6, 6px) + var(--tx-radius-step-2, 2px))',
  },
];

/** Typography: families, weights, tracking, text sizes. */
export const TAILWIND_TYPOGRAPHY: readonly TailwindThemeEntry[] = [
  { themeVar: '--font-sans', tokenVar: '--tx-font-sans' },
  { themeVar: '--font-heading', tokenVar: '--tx-font-heading' },
  { themeVar: '--font-mono', tokenVar: '--tx-font-mono' },
  { themeVar: '--font-weight-normal', tokenVar: '--tx-font-weight-body', fallback: '400' },
  { themeVar: '--font-weight-medium', tokenVar: '--tx-font-weight-medium', fallback: '500' },
  { themeVar: '--font-weight-semibold', tokenVar: '--tx-font-weight-heading', fallback: '600' },
  { themeVar: '--font-weight-bold', tokenVar: '--tx-font-weight-bold', fallback: '700' },
  { themeVar: '--tracking-body', tokenVar: '--tx-letter-spacing-body', fallback: '0' },
  { themeVar: '--tracking-heading', tokenVar: '--tx-letter-spacing-heading', fallback: '0' },
  { themeVar: '--text-xs', tokenVar: '--tx-font-size-xs', fallback: '0.75rem' },
  { themeVar: '--text-sm', tokenVar: '--tx-font-size-sm', fallback: '0.875rem' },
  { themeVar: '--text-base', tokenVar: '--tx-font-size-base', fallback: '1rem' },
  { themeVar: '--text-lg', tokenVar: '--tx-font-size-lg', fallback: '1.125rem' },
  { themeVar: '--text-xl', tokenVar: '--tx-font-size-xl', fallback: '1.25rem' },
  { themeVar: '--text-2xl', tokenVar: '--tx-font-size-2xl', fallback: '1.5rem' },
  { themeVar: '--text-3xl', tokenVar: '--tx-font-size-3xl', fallback: '1.875rem' },
  { themeVar: '--text-4xl', tokenVar: '--tx-font-size-4xl', fallback: '2.25rem' },
  { themeVar: '--text-5xl', tokenVar: '--tx-font-size-5xl', fallback: '3rem' },
  { themeVar: '--text-6xl', tokenVar: '--tx-font-size-6xl', fallback: '3.75rem' },
  { themeVar: '--text-7xl', tokenVar: '--tx-font-size-7xl', fallback: '4.5rem' },
  { themeVar: '--text-8xl', tokenVar: '--tx-font-size-8xl', fallback: '6rem' },
  { themeVar: '--text-9xl', tokenVar: '--tx-font-size-9xl', fallback: '8rem' },
];

/** Spacing unit, motion, shadows, borders. */
export const TAILWIND_SPACING_MOTION_SHADOW: readonly TailwindThemeEntry[] = [
  {
    themeVar: '--spacing',
    tokenVar: '--tx-space-unit',
    fallback: 'calc(0.25rem * var(--tx-density, 1))',
  },
  { themeVar: '--default-border-width', tokenVar: '--tx-border-width', fallback: '1px' },
  { themeVar: '--duration-fast', tokenVar: '--tx-motion-fast', fallback: '150ms' },
  { themeVar: '--duration-base', tokenVar: '--tx-motion-base', fallback: '200ms' },
  { themeVar: '--duration-slow', tokenVar: '--tx-motion-slow', fallback: '300ms' },
  {
    themeVar: '--default-transition-duration',
    tokenVar: '--tx-motion-base',
    fallback: '200ms',
  },
  {
    themeVar: '--default-transition-timing-function',
    tokenVar: '--tx-motion-easing',
    fallback: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  {
    themeVar: '--shadow-soft',
    tokenVar: '--tx-shadow-soft',
    fallback: '0 1px 2px 0 var(--tx-shadow), 0 1px 3px 0 var(--tx-shadow)',
  },
  {
    themeVar: '--shadow-float',
    tokenVar: '--tx-shadow-float',
    fallback: '0 10px 30px -8px var(--tx-shadow), 0 4px 10px -4px var(--tx-shadow)',
  },
  { themeVar: '--color-shadow', tokenVar: '--tx-shadow' },
];

/**
 * Every theme entry the preset CSS must declare. Surface aliases override the
 * plain semantic `surface` / `elevated` color keys so glass fills win when set.
 */
export const TAILWIND_THEME_ENTRIES: readonly TailwindThemeEntry[] = (() => {
  const byTheme = new Map<string, TailwindThemeEntry>();
  for (const entry of [
    ...TAILWIND_SEMANTIC_COLORS,
    ...TAILWIND_INTERACTION_COLORS,
    ...TAILWIND_CHART_COLORS,
    ...TAILWIND_RADIUS,
    ...TAILWIND_TYPOGRAPHY,
    ...TAILWIND_SPACING_MOTION_SHADOW,
    ...TAILWIND_SURFACE_ALIASES,
  ]) {
    byTheme.set(entry.themeVar, entry);
  }
  return Object.freeze([...byTheme.values()]);
})();

/** Serialize one entry as `var(--tx-…)` or `var(--tx-…, fallback)`. */
export function themeEntryValue(entry: TailwindThemeEntry): string {
  if (entry.themeVar === '--spacing') {
    // The unit of the --tx-space-* scale; the fallback keeps the preset working without base.css.
    return `var(${entry.tokenVar}, ${entry.fallback})`;
  }
  if (
    entry.themeVar.startsWith('--radius-') &&
    entry.themeVar !== '--radius-lg' &&
    entry.fallback
  ) {
    return entry.fallback;
  }
  if (entry.fallback) {
    if (entry.fallback.startsWith('calc(') || entry.fallback.startsWith('0 ')) {
      // Full expression (radius calc, shadow stack) or density spacing already handled.
      if (entry.fallback.includes('var(--tx-')) return entry.fallback;
    }
    return `var(${entry.tokenVar}, ${entry.fallback})`;
  }
  return `var(${entry.tokenVar})`;
}

/** Build the body of an `@theme inline { … }` block from the map (tests / codegen). */
export function renderThemeInlineBlock(
  entries: readonly TailwindThemeEntry[] = TAILWIND_THEME_ENTRIES
): string {
  const lines = entries.map((entry) => `  ${entry.themeVar}: ${themeEntryValue(entry)};`);
  return `{\n${lines.join('\n')}\n}`;
}
