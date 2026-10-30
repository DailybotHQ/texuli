/**
 * `fromTheme`: any Texuli `Theme` as a design-system document (ADR-021).
 * Brand inputs go to `color.brand`; every role whose value the seed
 * generator would not reproduce from that brand becomes an explicit role pin
 * (`color.roles.<mode>`), so compiling the document reproduces the theme's
 * variables. Style knobs map to their sections; anything the closed
 * vocabulary cannot hold is listed in `losses`.
 */

import type { DesignSystem } from '@texuli/spec/design-system';
import { SEMANTIC_ROLES, type SemanticRoleValue } from '../contract/semantic.ts';
import {
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_THEME_STYLE,
  type Theme,
} from '../contract/types.ts';
import { checkThemeContrast } from '../generator/contrast.ts';
import { generateThemeFromSeed, type NeutralFamily } from '../generator/seed.ts';
import { MOTION_EASINGS } from '../motion/index.ts';
import { parseHex } from '../palette/contrast.ts';
import { MOTION_PRESETS } from '../style-presets/presets.ts';
import { toDocColor } from './color.ts';

/** The seed generator inputs a theme was built from, when known (library themes). */
export interface DesignSystemBrand {
  seed: string;
  secondary?: string;
  neutral?: NeutralFamily;
  contrast?: 'AA' | 'AAA';
}

export interface FromThemeOptions {
  /** Defaults to the theme id (or `theme` when it is not a design-system id). */
  id?: string;
  /** Defaults to `1.0.0`. */
  version?: string;
  /** The generator inputs; without them the seed is the light primary and roles are pinned. */
  brand?: DesignSystemBrand;
}

/** A field `fromTheme` could not carry exactly. */
export interface FromThemeLoss {
  path: string;
  reason: string;
}

const STACK_NAME = /^-?[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/;
const DS_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** The seed of the default library theme (`violet`), used when nothing names a brand. */
export const DEFAULT_DESIGN_SYSTEM_SEED = '#7c3aed';

/** The names of a CSS font-family list, unquoted. */
export function splitFontStack(stack: string): string[] {
  return stack
    .split(',')
    .map((part) =>
      part
        .trim()
        .replace(/^(["'])(.*)\1$/, '$2')
        .trim()
    )
    .filter(Boolean);
}

/** A font-family list from names: a name that is not a CSS identifier is double-quoted. */
export function formatFontStack(names: readonly string[]): string {
  return names
    .map((name) => (/^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(name) ? name : `"${name}"`))
    .join(', ');
}

/** CSS px of a theme length (`px`, `rem`, `em`, or `0`). */
function px(value: string): number | undefined {
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(value.trim());
  if (!m || (m[2] === undefined && Number(m[1]) !== 0)) return;
  return Number(m[1]) * (m[2] === 'rem' || m[2] === 'em' ? 16 : 1);
}

/** Letter spacing in em (`0` or `<n>em`). */
function em(value: string): number | undefined {
  const m = /^(-?\d*\.?\d+)(em)?$/.exec(value.trim());
  if (!m || (m[2] === undefined && Number(m[1]) !== 0)) return;
  return Number(m[1]);
}

const sameRole = (a: SemanticRoleValue, b: SemanticRoleValue | undefined) =>
  !!b &&
  a.default === b.default &&
  a.hover === b.hover &&
  a.active === b.active &&
  a.disabled === b.disabled &&
  a.focus === b.focus;

/** {@link fromTheme} with the fields it could not carry exactly. */
export function fromThemeWithReport(
  theme: Theme,
  options: FromThemeOptions = {}
): { document: DesignSystem; losses: FromThemeLoss[] } {
  const losses: FromThemeLoss[] = [];
  const lose = (path: string, reason: string) => losses.push({ path, reason });
  const contrast =
    options.brand?.contrast ??
    (checkThemeContrast(theme, { textMinimum: 7 }).some((issue) => issue.required === 7)
      ? 'AA'
      : 'AAA');
  const lightPrimary = theme.light.primary.default;
  const brand: DesignSystemBrand = options.brand ?? {
    seed: parseHex(lightPrimary) ? lightPrimary : DEFAULT_DESIGN_SYSTEM_SEED,
  };
  let reference: Theme | undefined;
  try {
    reference = generateThemeFromSeed({
      seed: brand.seed,
      ...(brand.secondary ? { secondary: brand.secondary } : {}),
      ...(brand.neutral ? { neutral: brand.neutral } : {}),
      contrast,
    });
  } catch {
    reference = undefined;
  }

  const color: Record<string, unknown> = {
    brand: {
      seed: brand.seed,
      ...(brand.secondary ? { secondary: brand.secondary } : {}),
      ...(brand.neutral ? { neutral: brand.neutral } : {}),
    },
  };
  const roles: Record<string, Record<string, string>> = {};
  for (const mode of ['light', 'dark'] as const) {
    const pins: Record<string, string> = {};
    for (const role of SEMANTIC_ROLES) {
      const value = theme[mode][role];
      if (sameRole(value, reference?.[mode][role])) continue;
      const pinned = toDocColor(value.default);
      if (pinned === undefined) lose(`$.color.roles.${mode}.${role}`, 'Not a document color.');
      else pins[role] = pinned;
    }
    if (Object.keys(pins).length > 0) roles[mode] = pins;
  }
  if (Object.keys(roles).length > 0) color.roles = roles;
  if (theme.charts) color.dataViz = { light: theme.charts.light, dark: theme.charts.dark };

  const families: Record<string, unknown> = {};
  const family = (key: string, stack: string | undefined, fallback: string) => {
    if (stack === undefined || stack === fallback) return;
    const names = splitFontStack(stack);
    const kept = names.filter((name) => STACK_NAME.test(name)).slice(0, 8);
    if (kept.length !== names.length)
      lose(`$.typography.families.${key}`, 'Some names do not fit.');
    if (kept.length > 0) families[key] = { stack: kept };
  };
  family('sans', theme.fontFamily, DEFAULT_FONT_SANS);
  family('heading', theme.fontFamilyHeading, theme.fontFamily);
  family('mono', theme.fontFamilyMono, DEFAULT_FONT_MONO);

  const style = theme.style;
  const defaults = DEFAULT_THEME_STYLE;
  const typography: Record<string, unknown> = {};
  if (Object.keys(families).length > 0) typography.families = families;
  const ratio = style.typography.scaleRatio;
  if (ratio !== null) {
    if (ratio >= 1.05 && ratio <= 1.618) typography.scale = { ratio };
    else lose('$.typography.scale.ratio', 'Outside 1.05–1.618.');
  }
  const typeRoles: Record<string, Record<string, number>> = {};
  const role = (name: string, key: string, value: number, fallback: number) => {
    if (value === fallback) return;
    typeRoles[name] ??= {};
    (typeRoles[name] as Record<string, number>)[key] = value;
  };
  const w = style.typography.weights;
  role('body', 'weight', w.body, defaults.typography.weights.body);
  role('label', 'weight', w.medium, defaults.typography.weights.medium);
  role('heading', 'weight', w.heading, defaults.typography.weights.heading);
  role('display', 'weight', w.bold, defaults.typography.weights.bold);
  for (const [name, value] of [
    ['body', style.typography.tracking.body],
    ['heading', style.typography.tracking.heading],
  ] as const) {
    const n = em(value);
    if (n === undefined || n < -0.1 || n > 0.2) lose(`$.typography.roles.${name}.tracking`, value);
    else role(name, 'tracking', n, 0);
  }
  if (Object.keys(typeRoles).length > 0) typography.roles = typeRoles;

  const shape: Record<string, number> = {};
  const radius = px(theme.radius);
  if (radius === undefined || radius < 0 || radius > 48) lose('$.shape.radius', theme.radius);
  else if (radius !== 10) shape.radius = radius;
  if (style.shape.radiusScale !== 1) {
    if (style.shape.radiusScale <= 4) shape.radiusScale = style.shape.radiusScale;
    else lose('$.shape.radiusScale', 'Above 4.');
  }
  const border = px(style.shape.borderWidth);
  if (border === undefined || border > 4) lose('$.shape.borderWidth', style.shape.borderWidth);
  else if (border !== 1) shape.borderWidth = border;

  const motion: Record<string, unknown> = {};
  const { durations, easing } = style.motion;
  const preset = MOTION_PRESETS.find(
    (p) =>
      p.easing === easing &&
      p.durations.fast === durations.fast &&
      p.durations.base === durations.base &&
      p.durations.slow === durations.slow
  );
  if (preset) {
    if (preset.id !== 'standard') motion.personality = preset.id;
  } else {
    motion.durations = { ...durations };
    const named = Object.entries(MOTION_EASINGS).find(([, curve]) => curve === easing)?.[0];
    if (named && named !== 'standard') motion.easing = named;
    else if (!named) lose('$.motion.easing', easing);
  }

  const accessibility: Record<string, unknown> = {};
  if (contrast === 'AAA') accessibility.contrast = 'AAA';
  const ring = style.focusRing;
  if (ring.style !== 'ring') accessibility.focus = ring.style;
  const width = px(ring.width);
  const offset = px(ring.offset);
  if (width === undefined || width < 1 || width > 6) lose('$.accessibility.focusWidth', ring.width);
  else if (width !== 2) accessibility.focusWidth = width;
  if (offset === undefined || offset < 0 || offset > 8)
    lose('$.accessibility.focusOffset', ring.offset);
  else if (offset !== 2) accessibility.focusOffset = offset;
  if (theme.components) lose('$.components', 'Theme component hooks have no document field.');

  const id = options.id ?? (DS_ID.test(theme.id) && theme.id.length <= 64 ? theme.id : 'theme');
  const document: Record<string, unknown> = {
    format: 'texuli/design-system',
    formatVersion: 1,
    id,
    version: options.version ?? '1.0.0',
    name: theme.name.slice(0, 80),
    ...(theme.description ? { description: theme.description.slice(0, 500) } : {}),
    color,
  };
  if (Object.keys(typography).length > 0) document.typography = typography;
  if (Object.keys(shape).length > 0) document.shape = shape;
  if (theme.density !== 1) document.space = { density: theme.density };
  if (style.elevation !== 'soft') document.elevation = { style: style.elevation };
  if (style.surface !== 'solid') document.surface = { style: style.surface };
  if (Object.keys(motion).length > 0) document.motion = motion;
  if (Object.keys(accessibility).length > 0) document.accessibility = accessibility;
  return { document: document as unknown as DesignSystem, losses };
}

/**
 * Any `Theme` as a valid design-system document. Compiling it reproduces
 * `themeVariables(theme)` for every variable both emit (interaction states
 * are re-derived from each role's default; see `fromThemeWithReport` for
 * the fields a hand-made theme may lose).
 */
export function fromTheme(theme: Theme, options: FromThemeOptions = {}): DesignSystem {
  return fromThemeWithReport(theme, options).document;
}
