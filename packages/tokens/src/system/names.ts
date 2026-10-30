/**
 * The closed list of system token names (token contract v2, ADR-020), built
 * compactly so the theme JSON schema can list them without the descriptions.
 * `families.ts` holds the defaults and descriptions; a test keeps both equal.
 */

const steps = (prefix: string, keys: readonly (string | number)[]): string[] =>
  keys.map((key) => `--tx-${prefix}-${key}`);

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

const SIZES = ['xs', 'sm', 'md', 'lg'] as const;
const BREAKPOINTS = ['base', 'sm', 'md', 'lg'] as const;
const STATUSES = ['success', 'warning', 'danger', 'info', 'neutral'] as const;

/** The type roles, each with family, size, line, weight and tracking tokens. */
export const TYPE_ROLES = [
  'display',
  'title',
  'heading',
  'body',
  'label',
  'caption',
  'code',
] as const;
export type TypeRole = (typeof TYPE_ROLES)[number];

/** The type role properties, in table order. */
export const TYPE_ROLE_PROPERTIES = ['family', 'size', 'line', 'weight', 'tracking'] as const;

/** Status names shared by badges, alerts, toasts and charts. */
export const STATUS_NAMES = STATUSES;

/** System tokens `base.css` declares (theme-independent or derived from theme tokens). */
export const BASE_SYSTEM_TOKEN_NAMES: readonly string[] = [
  '--tx-space-unit',
  ...steps('space', range(0, 12)),
  ...steps('size-control', SIZES),
  ...steps('size-icon', SIZES),
  '--tx-size-target-min',
  '--tx-size-target-touch',
  ...TYPE_ROLES.flatMap((role) => steps(`type-${role}`, TYPE_ROLE_PROPERTIES)),
  ...steps('elevation', range(0, 5)),
  '--tx-surface-glass-alpha',
  '--tx-surface-glass-blur',
  ...steps('shape-radius', ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full']),
  '--tx-border-width-thin',
  '--tx-border-width-thick',
  ...steps('z', ['base', 'sticky', 'popover', 'tooltip', 'overlay', 'modal', 'toast', 'top']),
  ...steps('opacity', ['disabled', 'muted', 'scrim']),
  ...steps('layout', ['content-max', 'wide-max', 'full-max']),
  ...steps('layout-breakpoint', ['sm', 'md', 'lg']),
  ...steps('layout-grid-columns', BREAKPOINTS),
  ...steps('layout-grid-gutter', BREAKPOINTS),
  '--tx-icon-stroke',
  '--tx-icon-style',
  ...STATUSES.flatMap((status) =>
    steps(`status-${status}`, ['', 'foreground', 'soft', 'soft-foreground']).map((name) =>
      name.endsWith('-') ? name.slice(0, -1) : name
    )
  ),
];

/** Data-viz tokens every theme emits through `themeVariables` (not `base.css`). */
export const DATA_VIZ_TOKEN_NAMES: readonly string[] = [
  ...steps('chart', range(1, 8)),
  ...steps('chart-sequential', range(1, 9)),
  ...steps('chart-diverging', range(1, 9)),
  '--tx-chart-grid',
  '--tx-chart-axis',
];

/** Every system token name, the vocabulary design systems and agents may read or set. */
export const SYSTEM_TOKEN_NAMES: readonly string[] = [
  ...BASE_SYSTEM_TOKEN_NAMES,
  ...DATA_VIZ_TOKEN_NAMES,
];

/** True when `name` is a system token of contract v2. */
export function isSystemTokenName(name: string): boolean {
  return SYSTEM_TOKEN_NAMES.includes(name);
}
