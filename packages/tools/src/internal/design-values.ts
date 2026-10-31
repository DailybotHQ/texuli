/**
 * Design values for the static writers (ADR-024, option B): a compiled
 * design system's `--tx-*` variables for one mode, resolved to the plain
 * data every writer takes. Colors become sRGB `#rrggbb` (mail clients,
 * PDF, DOCX, PPTX and standalone SVG have no OKLCH and no custom
 * properties), font stacks stay CSS stacks, and the radius and the spacing
 * step become pixels. The writers in `@texuli/document`, `@texuli/canvas`
 * and `@texuli/slides` declare the same shape structurally, so none of them
 * imports the compiler or `@texuli/tokens`.
 */
import { toSrgbHex } from '../email/styles.ts';

/** The color roles the static writers read (camelCase of `--tx-<role>`; `chartN` is `--tx-chart-N`). */
export const DESIGN_COLOR_ROLES = Object.freeze([
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'muted',
  'mutedForeground',
  'border',
  'borderStrong',
  'ring',
  'primary',
  'primaryForeground',
  'primarySoft',
  'primarySoftForeground',
  'secondary',
  'secondaryForeground',
  'accent',
  'accentForeground',
  'link',
  'info',
  'infoForeground',
  'infoSoft',
  'infoSoftForeground',
  'success',
  'successForeground',
  'successSoft',
  'successSoftForeground',
  'warning',
  'warningForeground',
  'warningSoft',
  'warningSoftForeground',
  'destructive',
  'destructiveForeground',
  'destructiveSoft',
  'destructiveSoftForeground',
  'chart1',
  'chart2',
  'chart3',
  'chart4',
  'chart5',
  'chart6',
  'chart7',
  'chart8',
] as const);
export type DesignColorRole = (typeof DESIGN_COLOR_ROLES)[number];

/** One mode of a design system as plain, resolved values. */
export interface DesignValues {
  mode: 'light' | 'dark';
  /** sRGB `#rrggbb` per role; a role whose value does not resolve to sRGB is left out. */
  colors: Partial<Record<DesignColorRole, string>>;
  /** CSS font stacks (`--tx-font-sans`, `--tx-font-heading`, `--tx-font-mono`). */
  fonts: { sans?: string; heading?: string; mono?: string };
  /** `--tx-radius` in pixels. */
  radius?: number;
  /** One spacing step (`--tx-space-1`) in pixels. */
  space?: number;
}

/** What `designValues` reads from a `CompiledDesignSystem`: its variables per mode. */
export interface DesignVarsSource {
  vars: Readonly<Partial<Record<'light' | 'dark', Readonly<Record<string, string>>>>>;
}

const varName = (role: DesignColorRole): string =>
  role.startsWith('chart')
    ? `--tx-chart-${role.slice(5)}`
    : `--tx-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

/** A CSS length in `px` or `rem` (16 px) as pixels, else `undefined` (no `calc()`, no `var()`). */
export function cssPixels(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{1,4}(?:\.\d{1,4})?)(px|rem)$/.exec(value.trim());
  if (!match) return value.trim() === '0' ? 0 : undefined;
  const amount = Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
  return Math.round(amount * 100) / 100;
}

const fontStack = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' && value.length <= 400
    ? value.trim()
    : undefined;

/**
 * Resolve one mode of a compiled design system (`compileDesignSystem(…)`
 * with `ok: true`, or anything with the same `vars`) to `DesignValues`.
 * Returns `null` when the mode was not compiled. Never throws.
 */
export function designValues(
  source: DesignVarsSource | null | undefined,
  mode: 'light' | 'dark' = 'light'
): DesignValues | null {
  const vars = source?.vars?.[mode];
  if (!vars || typeof vars !== 'object') return null;
  const colors: Partial<Record<DesignColorRole, string>> = {};
  for (const role of DESIGN_COLOR_ROLES) {
    const hex = toSrgbHex(vars[varName(role)]);
    if (hex) colors[role] = hex;
  }
  const fonts: DesignValues['fonts'] = {};
  const sans = fontStack(vars['--tx-font-sans']);
  const heading = fontStack(vars['--tx-font-heading']);
  const mono = fontStack(vars['--tx-font-mono']);
  if (sans) fonts.sans = sans;
  if (heading) fonts.heading = heading;
  if (mono) fonts.mono = mono;
  const values: DesignValues = { mode, colors, fonts };
  const radius = cssPixels(vars['--tx-radius']);
  const space = cssPixels(vars['--tx-space-1']);
  if (radius !== undefined) values.radius = radius;
  if (space !== undefined) values.space = space;
  return values;
}
