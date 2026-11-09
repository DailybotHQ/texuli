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

const DATA_COLOR_FALLBACKS: Record<(typeof DATA_COLORS)[number], string> = {
  'chart-1': '--tx-primary',
  'chart-2': '--tx-secondary',
  'chart-3': '--tx-success',
  'chart-4': '--tx-warning',
  'chart-5': '--tx-info',
  'chart-6': '--tx-chart-1',
  'chart-7': '--tx-chart-2',
  'chart-8': '--tx-chart-3',
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

/** Resolve a color reference to a themed token, with the catalog fallback chain. */
export function colorRefVar(ref: ColorRef): string {
  if ((DATA_COLORS as readonly string[]).includes(ref)) {
    const token = `--tx-${ref}`;
    return `var(${token}, var(${DATA_COLOR_FALLBACKS[ref as (typeof DATA_COLORS)[number]]}))`;
  }

  const [token] = ROLE_TOKENS[ref as (typeof ROLE_COLORS)[number]];
  return `var(${token})`;
}

/** Resolve the token used for text with an AA-safe foreground on the color. */
export function colorRefInk(ref: ColorRef): string {
  if ((DATA_COLORS as readonly string[]).includes(ref)) return 'var(--tx-background)';

  const [, token] = ROLE_TOKENS[ref as (typeof ROLE_COLORS)[number]];
  return `var(${token})`;
}
