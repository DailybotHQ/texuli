/** Closed color references accepted by label components and primitive fills. */
export const DATA_COLORS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
] as const;

/** Semantic color roles available to components that need a named color. */
export const ROLE_COLORS = [
  'primary',
  'secondary',
  'success',
  'warning',
  'destructive',
  'info',
  'neutral',
] as const;

export type ColorRef = (typeof DATA_COLORS)[number] | (typeof ROLE_COLORS)[number];
export type DataColorRef = (typeof DATA_COLORS)[number];
export type CategoryColor = 'none' | DataColorRef;

export const CATEGORY_COLORS = ['none', ...DATA_COLORS] as const;

const DATA_COLOR_FALLBACKS: Record<(typeof DATA_COLORS)[number], string> = {
  'chart-1': '#4f46e5',
  'chart-2': '#0ea5e9',
  'chart-3': '#f59e0b',
  'chart-4': '#10b981',
  'chart-5': '#ec4899',
  'chart-6': '#7c3aed',
  'chart-7': '#64748b',
  'chart-8': '#0f766e',
};

const DATA_COLOR_INK_FALLBACKS: Record<(typeof DATA_COLORS)[number], string> = {
  'chart-1': '#ffffff',
  'chart-2': '#0a0a0a',
  'chart-3': '#0a0a0a',
  'chart-4': '#0a0a0a',
  'chart-5': '#0a0a0a',
  'chart-6': '#ffffff',
  'chart-7': '#ffffff',
  'chart-8': '#ffffff',
};

const ROLE_TOKENS: Record<(typeof ROLE_COLORS)[number], readonly [string, string]> = {
  primary: ['--tx-primary', '--tx-primary-foreground'],
  secondary: ['--tx-secondary', '--tx-secondary-foreground'],
  success: ['--tx-success', '--tx-success-foreground'],
  warning: ['--tx-warning', '--tx-warning-foreground'],
  destructive: ['--tx-destructive', '--tx-destructive-foreground'],
  info: ['--tx-info', '--tx-info-foreground'],
  neutral: ['--tx-muted', '--tx-muted-foreground'],
};

/** True only for a color name in the closed component palette. */
export function isColorRef(value: unknown): value is ColorRef {
  return (
    typeof value === 'string' &&
    ((DATA_COLORS as readonly string[]).includes(value) ||
      (ROLE_COLORS as readonly string[]).includes(value))
  );
}

/** True only for the data-viz references used by the category color axis. */
export function isDataColorRef(value: unknown): value is DataColorRef {
  return typeof value === 'string' && (DATA_COLORS as readonly string[]).includes(value);
}

/** True only for the explicit category axis, including its appearance-preserving default. */
export function isCategoryColor(value: unknown): value is CategoryColor {
  return typeof value === 'string' && (CATEGORY_COLORS as readonly string[]).includes(value);
}

/** Resolve a color reference to a themed token, with the catalog fallback chain. */
export function colorRefVar(ref: ColorRef): string {
  if ((DATA_COLORS as readonly string[]).includes(ref)) {
    const token = `--tx-${ref}`;
    return `var(${token}, ${DATA_COLOR_FALLBACKS[ref as (typeof DATA_COLORS)[number]]})`;
  }

  const [token] = ROLE_TOKENS[ref as (typeof ROLE_COLORS)[number]];
  return `var(${token})`;
}

/** Resolve the token used for text with an AA-safe foreground on the color. */
export function colorRefInk(ref: ColorRef): string {
  if ((DATA_COLORS as readonly string[]).includes(ref)) {
    const dataColor = ref as (typeof DATA_COLORS)[number];
    return `var(--tx-${dataColor}-foreground, ${DATA_COLOR_INK_FALLBACKS[dataColor]})`;
  }

  const [, token] = ROLE_TOKENS[ref as (typeof ROLE_COLORS)[number]];
  return `var(${token})`;
}
