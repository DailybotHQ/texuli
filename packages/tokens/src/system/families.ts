/**
 * Token contract v2 system families (ADR-020). Every `base` family default is
 * written to `@texuli/tokens/base.css` and reproduces today's rendered values
 * (measured from the component stylesheets); nothing reads these tokens until
 * the adoption tasks move component CSS onto them. The `theme` family (data-viz)
 * is emitted per theme by `themeVariables`.
 */

import { STATUS_NAMES, TYPE_ROLES, type TypeRole } from './names.ts';

/** One system token: its custom property, default CSS value and meaning. */
export interface SystemToken {
  readonly name: string;
  /**
   * The default. `base.css` declares it when it is a plain literal; when it
   * reads other variables it is the read fallback instead (`systemVar`). For
   * the `theme` family it names the theme source.
   */
  readonly value: string;
  readonly description: string;
}

export type SystemTokenFamilyId =
  | 'space'
  | 'size'
  | 'type'
  | 'elevation'
  | 'shape'
  | 'layer'
  | 'opacity'
  | 'layout'
  | 'icon'
  | 'status'
  | 'data-viz';

export interface SystemTokenFamily {
  readonly id: SystemTokenFamilyId;
  readonly title: string;
  readonly description: string;
  /** `base`: declared by `base.css`. `theme`: emitted by `themeVariables` per theme. */
  readonly emit: 'base' | 'theme';
  readonly tokens: readonly SystemToken[];
}

const token = (name: string, value: string, description: string): SystemToken => ({
  name,
  value,
  description,
});

const SPACE: SystemToken[] = [
  token(
    '--tx-space-unit',
    'calc(0.25rem * var(--tx-density, 1))',
    'The 0.25rem step, scaled by the theme density.'
  ),
  token('--tx-space-0', '0px', 'No space.'),
  ...Array.from({ length: 12 }, (_, i) =>
    token(
      `--tx-space-${i + 1}`,
      `calc(var(--tx-space-unit) * ${i + 1})`,
      `${(i + 1) * 0.25}rem at density 1.`
    )
  ),
];

const SIZE: SystemToken[] = [
  token('--tx-size-control-xs', '1.75rem', 'Compact control height (toolbar small buttons).'),
  token('--tx-size-control-sm', '2rem', 'Small control height (button, select, toggle sm).'),
  token('--tx-size-control-md', '2.25rem', 'Default control height (button, input, select md).'),
  token('--tx-size-control-lg', '2.75rem', 'Large control height (button, select, toggle lg).'),
  token('--tx-size-icon-xs', '0.75rem', 'Extra small icon (12 px, Icon size xs).'),
  token('--tx-size-icon-sm', '1rem', 'Small icon (16 px, Icon size sm, icons inside buttons).'),
  token(
    '--tx-size-icon-md',
    '1.25rem',
    'Default icon (20 px, Icon size md, alert and toast icons).'
  ),
  token('--tx-size-icon-lg', '1.5rem', 'Large icon (24 px, Icon size lg).'),
  token('--tx-size-target-min', '24px', 'The smallest interactive target anywhere (WCAG 2.2).'),
  token(
    '--tx-size-target-touch',
    'max(2.75rem, 44px)',
    'The interactive target below 640 px (button sm, md and icon on small screens).'
  ),
];

const ROLE_DEFAULTS: Record<
  TypeRole,
  [family: string, size: string, line: string, weight: string, tracking: string, use: string]
> = {
  display: [
    'heading',
    'var(--tx-font-size-4xl, 2.25rem)',
    '1.1',
    'var(--tx-font-weight-bold, 700)',
    'heading',
    'Hero and display text.',
  ],
  title: [
    'heading',
    'var(--tx-font-size-2xl, 1.5rem)',
    '1.2',
    'var(--tx-font-weight-heading, 600)',
    'heading',
    'Page titles and KPI values.',
  ],
  heading: [
    'heading',
    'var(--tx-font-size-lg, 1.125rem)',
    '1.3',
    'var(--tx-font-weight-heading, 600)',
    'heading',
    'Dialog, sheet and section headings.',
  ],
  body: [
    'sans',
    'var(--tx-font-size-base, 1rem)',
    '1.5',
    'var(--tx-font-weight-body, 400)',
    'body',
    'Running text.',
  ],
  label: [
    'sans',
    'var(--tx-font-size-sm, 0.875rem)',
    '1.25',
    'var(--tx-font-weight-medium, 500)',
    'body',
    'Control labels and button text.',
  ],
  caption: [
    'sans',
    'var(--tx-font-size-xs, 0.75rem)',
    '1.35',
    'var(--tx-font-weight-body, 400)',
    'body',
    'Descriptions, hints and captions.',
  ],
  code: [
    'mono',
    '0.875em',
    '1.5',
    'var(--tx-font-weight-body, 400)',
    'none',
    'Inline and block code.',
  ],
};

const FAMILY_STACK: Record<string, string> = {
  heading: 'var(--tx-font-heading, var(--tx-font-sans, system-ui, sans-serif))',
  sans: 'var(--tx-font-sans, system-ui, sans-serif)',
  mono: 'var(--tx-font-mono, ui-monospace, monospace)',
};

const TRACKING: Record<string, string> = {
  heading: 'var(--tx-letter-spacing-heading, 0)',
  body: 'var(--tx-letter-spacing-body, 0)',
  none: '0',
};

const TYPE: SystemToken[] = TYPE_ROLES.flatMap((role) => {
  const [family, size, line, weight, tracking, use] = ROLE_DEFAULTS[role];
  return [
    token(`--tx-type-${role}-family`, FAMILY_STACK[family] as string, `${use} Font family.`),
    token(`--tx-type-${role}-size`, size, `${use} Font size.`),
    token(`--tx-type-${role}-line`, line, `${use} Line height.`),
    token(`--tx-type-${role}-weight`, weight, `${use} Font weight.`),
    token(`--tx-type-${role}-tracking`, TRACKING[tracking] as string, `${use} Letter spacing.`),
  ];
});

const ELEVATION: SystemToken[] = [
  token('--tx-elevation-0', 'none', 'Flush with the surface.'),
  token(
    '--tx-elevation-1',
    'var(--tx-shadow-soft, none)',
    'Resting surfaces: cards, inputs, stats.'
  ),
  token(
    '--tx-elevation-2',
    'var(--tx-shadow-soft, none)',
    'Raised controls: slider thumbs, active tabs.'
  ),
  token(
    '--tx-elevation-3',
    'var(--tx-shadow-float, none)',
    'Floating layers: menus, popovers, tooltips.'
  ),
  token('--tx-elevation-4', 'var(--tx-shadow-float, none)', 'Modal layers: dialogs and sheets.'),
  token('--tx-elevation-5', 'var(--tx-shadow-float, none)', 'Notifications: toasts.'),
  token('--tx-surface-glass-alpha', 'var(--tx-glass-opacity, 82%)', 'Glass surface fill opacity.'),
  token('--tx-surface-glass-blur', 'var(--tx-glass-blur, 16px)', 'Glass surface backdrop blur.'),
];

const SHAPE: SystemToken[] = [
  token('--tx-shape-radius-none', '0px', 'Square corners.'),
  token(
    '--tx-shape-radius-xs',
    'max(0px, var(--tx-radius, 0.625rem) - var(--tx-radius-step-6, 6px))',
    'The theme radius minus 6 px times the radius scale.'
  ),
  token(
    '--tx-shape-radius-sm',
    'max(0px, var(--tx-radius, 0.625rem) - var(--tx-radius-step-4, 4px))',
    'The theme radius minus 4 px times the radius scale.'
  ),
  token(
    '--tx-shape-radius-md',
    'max(0px, var(--tx-radius, 0.625rem) - var(--tx-radius-step-2, 2px))',
    'The theme radius minus 2 px times the radius scale.'
  ),
  token('--tx-shape-radius-lg', 'var(--tx-radius, 0.625rem)', 'The theme radius.'),
  token(
    '--tx-shape-radius-xl',
    'calc(var(--tx-radius, 0.625rem) + var(--tx-radius-step-4, 4px))',
    'The theme radius plus 4 px times the radius scale.'
  ),
  token('--tx-shape-radius-full', '9999px', 'Pill and circle corners.'),
  token('--tx-border-width-thin', 'var(--tx-border-width, 1px)', 'Hairline borders.'),
  token(
    '--tx-border-width-thick',
    'calc(var(--tx-border-width, 1px) * 2)',
    'Emphasis borders (drop zones, slider thumbs).'
  ),
];

const LAYER: SystemToken[] = [
  token('--tx-z-base', '0', 'In-flow content.'),
  token('--tx-z-sticky', '40', 'Sticky chrome and navigation menus.'),
  token('--tx-z-popover', '50', 'Popovers, menus, selects, comboboxes, date panels.'),
  token('--tx-z-tooltip', '50', 'Tooltips.'),
  token('--tx-z-overlay', '60', 'Sheets, drawers and their scrims.'),
  token('--tx-z-modal', '60', 'Dialogs and alert dialogs.'),
  token('--tx-z-toast', '60', 'The toast viewport.'),
  token('--tx-z-top', '70', 'Skip links and shell chrome above every layer.'),
];

const OPACITY: SystemToken[] = [
  token('--tx-opacity-disabled', '0.5', 'Disabled controls.'),
  token('--tx-opacity-muted', '0.7', 'Decorative icons such as select and menu chevrons.'),
  token('--tx-opacity-scrim', '45%', 'Foreground mix of the dialog and sheet scrim.'),
];

const BREAKPOINTS = ['base', 'sm', 'md', 'lg'] as const;
const LAYOUT: SystemToken[] = [
  token('--tx-layout-content-max', '72ch', 'Readable prose width (content layouts).'),
  token('--tx-layout-wide-max', '80rem', 'Wide page sections (marketing layouts).'),
  token('--tx-layout-full-max', '100%', 'Full-bleed sections.'),
  token('--tx-layout-breakpoint-sm', '36rem', 'Small container breakpoint (2 grid columns).'),
  token('--tx-layout-breakpoint-md', '56rem', 'Medium container breakpoint (3 grid columns).'),
  token('--tx-layout-breakpoint-lg', '72rem', 'Large container breakpoint (4 grid columns).'),
  ...BREAKPOINTS.map((bp, i) =>
    token(`--tx-layout-grid-columns-${bp}`, String(i + 1), `Grid columns at the ${bp} breakpoint.`)
  ),
  ...BREAKPOINTS.map((bp) =>
    token(
      `--tx-layout-grid-gutter-${bp}`,
      'var(--tx-space-4)',
      `Grid gutter at the ${bp} breakpoint.`
    )
  ),
];

const ICON: SystemToken[] = [
  token('--tx-icon-stroke', '2', 'Icon stroke width (the Icon component default).'),
  token('--tx-icon-style', 'outline', 'Icon style: outline or filled.'),
];

const STATUS_ROLE: Record<(typeof STATUS_NAMES)[number], [string, string, string, string]> = {
  success: ['success', 'success-foreground', 'success-soft', 'success-soft-foreground'],
  warning: ['warning', 'warning-foreground', 'warning-soft', 'warning-soft-foreground'],
  danger: [
    'destructive',
    'destructive-foreground',
    'destructive-soft',
    'destructive-soft-foreground',
  ],
  info: ['info', 'info-foreground', 'info-soft', 'info-soft-foreground'],
  neutral: ['secondary', 'secondary-foreground', 'muted', 'muted-foreground'],
};

const STATUS: SystemToken[] = STATUS_NAMES.flatMap((status) => {
  const [fill, fg, soft, softFg] = STATUS_ROLE[status];
  return [
    token(
      `--tx-status-${status}`,
      `var(--tx-${fill})`,
      `The ${status} fill (badges, alerts, charts).`
    ),
    token(`--tx-status-${status}-foreground`, `var(--tx-${fg})`, `Text on the ${status} fill.`),
    token(`--tx-status-${status}-soft`, `var(--tx-${soft})`, `The soft ${status} fill.`),
    token(
      `--tx-status-${status}-soft-foreground`,
      `var(--tx-${softFg})`,
      `Text on the soft ${status} fill.`
    ),
  ];
});

const DATA_VIZ: SystemToken[] = [
  ...Array.from({ length: 8 }, (_, i) =>
    token(`--tx-chart-${i + 1}`, 'theme.charts.categorical', `Categorical series color ${i + 1}.`)
  ),
  ...Array.from({ length: 9 }, (_, i) =>
    token(
      `--tx-chart-sequential-${i + 1}`,
      'theme.charts.sequential',
      `Sequential ramp step ${i + 1}.`
    )
  ),
  ...Array.from({ length: 9 }, (_, i) =>
    token(
      `--tx-chart-diverging-${i + 1}`,
      'theme.charts.diverging',
      `Diverging ramp step ${i + 1}.`
    )
  ),
  token('--tx-chart-grid', 'theme.charts.grid or the border role', 'Chart grid lines.'),
  token(
    '--tx-chart-axis',
    'theme.charts.axis or the muted foreground role',
    'Chart axes and ticks.'
  ),
];

/** Every system family of token contract v2, in documentation order. */
export const SYSTEM_TOKEN_FAMILIES: readonly SystemTokenFamily[] = [
  {
    id: 'space',
    title: 'Space',
    description: 'The 0.25rem spacing scale, scaled by `--tx-density`.',
    emit: 'base',
    tokens: SPACE,
  },
  {
    id: 'size',
    title: 'Size',
    description: 'Control heights, icon sizes and interactive targets.',
    emit: 'base',
    tokens: SIZE,
  },
  {
    id: 'type',
    title: 'Type roles',
    description:
      'Family, size, line height, weight and tracking per role, mapped from the theme type scale.',
    emit: 'base',
    tokens: TYPE,
  },
  {
    id: 'elevation',
    title: 'Elevation',
    description: 'A six-step shadow ladder over the theme soft and float shadows, plus glass.',
    emit: 'base',
    tokens: ELEVATION,
  },
  {
    id: 'shape',
    title: 'Shape',
    description:
      'The radius scale derived from `--tx-radius` and the radius scale, and border widths.',
    emit: 'base',
    tokens: SHAPE,
  },
  {
    id: 'layer',
    title: 'Layers',
    description: 'Stacking order for sticky chrome, popovers, overlays, dialogs and toasts.',
    emit: 'base',
    tokens: LAYER,
  },
  {
    id: 'opacity',
    title: 'Opacity',
    description: 'Disabled, muted and scrim opacities.',
    emit: 'base',
    tokens: OPACITY,
  },
  {
    id: 'layout',
    title: 'Layout',
    description:
      'Content widths, container breakpoints, grid columns and gutters. CSS cannot read custom properties inside `@media` or `@container` conditions, so the breakpoints are values for tooling and design-system exports.',
    emit: 'base',
    tokens: LAYOUT,
  },
  { id: 'icon', title: 'Icons', description: 'Icon stroke and style.', emit: 'base', tokens: ICON },
  {
    id: 'status',
    title: 'Status',
    description:
      'One status set over the semantic roles, shared by badges, alerts, toasts and charts.',
    emit: 'base',
    tokens: STATUS,
  },
  {
    id: 'data-viz',
    title: 'Data-viz',
    description:
      'Chart categorical, sequential and diverging colors with grid and axis, emitted per theme.',
    emit: 'theme',
    tokens: DATA_VIZ,
  },
];

/** Every system token, flattened in family order. */
export const SYSTEM_TOKENS: readonly SystemToken[] = SYSTEM_TOKEN_FAMILIES.flatMap(
  (family) => family.tokens
);
