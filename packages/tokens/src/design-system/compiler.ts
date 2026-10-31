/**
 * `compileDesignSystem` (ADR-021, ADR-022, ADR-023): a resolved design-system
 * document becomes concrete `--tx-*` variables per mode, the allowlisted
 * attributes, font faces, assets, component defaults, a report and a hash.
 * Pure, synchronous and deterministic: the same input (in any key order)
 * gives byte-equal output, so the hash is a cache key.
 *
 * Color: the brand seeds go through `generateThemeFromSeed` at the declared
 * contrast target. Brand pins (`color.pin`) are kept as fills and the solver
 * derives their on-colors and tints; explicit role pins (`color.roles`) are
 * never moved; every other color the solver may move until each pair holds.
 * A pair it cannot hold is a refusal naming the pins involved.
 */

import type { DesignSystem } from '@texuli/spec/design-system';
import { semanticTokenToCssVar, toKebabCase } from '../contract/prefix.ts';
import {
  INTERACTIVE_SEMANTIC_ROLES,
  SEMANTIC_ROLES,
  type SemanticPalette,
  type SemanticRole,
} from '../contract/semantic.ts';
import {
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_RADIUS,
  type ElevationStyle,
  type Theme,
} from '../contract/types.ts';
import { fontSizes, shadows } from '../css/apply.ts';
import { chartPaletteInputFor } from '../data-viz/index.ts';
import { THEME_CONTRAST_PAIRS } from '../generator/contrast.ts';
import {
  generateThemeFromSeed,
  hex,
  interactive,
  type NeutralFamily,
  search,
  seedOklch,
} from '../generator/seed.ts';
import { MOTION_EASINGS, type MotionEasingName, motionVariables } from '../motion/index.ts';
import { deriveChartTokens, validateChartTokens } from '../palette/charts.ts';
import { contrastRatio, relativeLuminance } from '../palette/contrast.ts';
import { MOTION_PRESETS } from '../style-presets/presets.ts';
import { BASE_SYSTEM_TOKENS, closingParen } from '../system/base.ts';
import { composite, onColor, parseDsColor } from './color.ts';
import { DEFAULT_DESIGN_SYSTEM_SEED, formatFontStack } from './from-theme.ts';
import {
  DESIGN_SYSTEM_TARGETS,
  type DesignSystemAttribute,
  type DesignSystemContrast,
  type DesignSystemMode,
  type DesignSystemPairResult,
  evaluateDesignSystemContrast,
  lengthPx,
  MIN_FOCUS_WIDTH,
  textMinimum,
} from './guarantees.ts';
import { canonicalJson, sha256Hex } from './hash.ts';
import {
  type DesignSystemCompileIssue,
  type DesignSystemFailure,
  type ResolveDesignSystemOptions,
  resolveDesignSystemSync,
} from './resolve.ts';

/** Bumped when the same document would compile to different output. */
export const DESIGN_SYSTEM_COMPILER_VERSION = 1;

export interface CompileDesignSystemOptions extends ResolveDesignSystemOptions {
  /** The modes to compile; defaults to `color.modes`, then light and dark. */
  modes?: readonly DesignSystemMode[];
}

/** A color the solver chose instead of the generated one. */
export interface DesignSystemAdjustment {
  mode: DesignSystemMode;
  variable: string;
  from: string;
  to: string;
  /** The document field that caused it. */
  path: string;
  reason: string;
}

export interface DesignSystemWarning {
  path: string;
  message: string;
}

/** One `@font-face` to register, with a preload hint for same-origin files. */
export interface DesignSystemFontFace {
  family: string;
  src: string;
  format: 'woff2' | 'woff' | 'truetype' | 'opentype';
  weight: string;
  style: 'normal' | 'italic';
  display: 'swap' | 'fallback' | 'optional' | 'block' | 'auto';
  /** A `data:` URL (counted in `report.inlineBytes`). */
  inline: boolean;
  preload?: { href: string; as: 'font'; type: string; crossorigin: 'anonymous' };
}

export interface DesignSystemTargetResult {
  variable: string;
  px: number;
  required: number;
  pass: boolean;
}

export interface DesignSystemReport {
  /** Every checked contrast pair, per compiled mode. */
  contrast: Partial<Record<DesignSystemMode, DesignSystemPairResult[]>>;
  /** Every color or size the solver changed, in order. */
  adjustments: DesignSystemAdjustment[];
  warnings: DesignSystemWarning[];
  /** Decoded bytes of every `data:` font and asset. */
  inlineBytes: number;
  targets: DesignSystemTargetResult[];
}

export interface CompiledDesignSystem {
  ok: true;
  id: string;
  version: string;
  name: string;
  variant?: string;
  modes: DesignSystemMode[];
  /** Concrete values only: no `var()` and no `url()`. Keys sorted. */
  vars: Partial<Record<DesignSystemMode, Record<`--tx-${string}`, string>>>;
  attrs: Partial<Record<DesignSystemAttribute, string>>;
  fontFaces: DesignSystemFontFace[];
  assets: {
    logo?: { light?: string; dark?: string; mark?: string; wordmark?: string };
    favicon?: string;
  };
  /** Component defaults for `setDesignDefaults`. */
  defaults: Record<string, { variant?: string; size?: string }>;
  /** The targets the guarantees were held to (re-checkable with `checkDesignSystemGuarantees`). */
  accessibility: { contrast: DesignSystemContrast; targetMin: number };
  report: DesignSystemReport;
  /** SHA-256 over the canonical resolved document, variant, modes, trust and compiler version. */
  hash: string;
}

type Doc = Record<string, unknown>;
type Values = Partial<Record<'default' | 'hover' | 'active' | 'disabled' | 'focus', string>>;

const rec = (value: unknown): Doc =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Doc) : {};
const num = (n: number) => String(Number(n.toFixed(4)));
const rem = (px: number) => (px === 0 ? '0' : `${num(px / 16)}rem`);
const at = (path: string, key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
const sortKeys = (doc: Doc) => Object.keys(doc).sort();

/** Fill roles a brand pin may set, with their on-color and soft tint roles. */
const PIN_ROLES: readonly [SemanticRole, SemanticRole, SemanticRole?, SemanticRole?][] = [
  ['primary', 'primaryForeground', 'primarySoft', 'primarySoftForeground'],
  ['secondary', 'secondaryForeground'],
  ['accent', 'accentForeground'],
  ['destructive', 'destructiveForeground', 'destructiveSoft', 'destructiveSoftForeground'],
  ['success', 'successForeground', 'successSoft', 'successSoftForeground'],
  ['warning', 'warningForeground', 'warningSoft', 'warningSoftForeground'],
  ['info', 'infoForeground', 'infoSoft', 'infoSoftForeground'],
];

/** The color each interactive role's states move away from (the generator's rule). */
const AGAINST: Record<(typeof INTERACTIVE_SEMANTIC_ROLES)[number], SemanticRole> = {
  primary: 'primaryForeground',
  secondary: 'secondaryForeground',
  accent: 'accentForeground',
  destructive: 'destructiveForeground',
  success: 'successForeground',
  warning: 'warningForeground',
  info: 'infoForeground',
  muted: 'mutedForeground',
  input: 'background',
  link: 'background',
  sidebarPrimary: 'primaryForeground',
};

/** A soft tone fill and its ink around a pinned hue (the generator's soft-tone rule). */
function tint(h: number, c: number, light: boolean, foreground: string, minimum: number) {
  const softC = Math.min(c, 0.08);
  const fill = (inks: readonly string[]) => {
    const start = light ? 0.97 : 0.22;
    for (let step = 0; step <= 100; step++) {
      const color = hex(start + (light ? -1 : 1) * step * 0.005, softC, h);
      if (inks.every((ink) => contrastRatio(ink, color) >= minimum)) return color;
    }
    return light ? '#f4f4f5' : '#27272a';
  };
  const ink = (color: string) =>
    search(h, Math.min(c, 0.14), light ? 0.28 : 0.88, light ? -1 : 1, [color], minimum);
  let color = fill([foreground]);
  let text = ink(color);
  color = fill([foreground, text]);
  text = ink(color);
  color = fill([foreground, text]);
  return { color, foreground: text };
}

interface ColorResult {
  vars: Record<string, string>;
  sources: Record<string, string>;
  hexOf: (role: SemanticRole) => string;
}

/** Solve one mode's semantic colors around the pins; adjustments are appended. */
function solveColors(
  mode: DesignSystemMode,
  base: SemanticPalette,
  color: Doc,
  minimum: number,
  adjustments: DesignSystemAdjustment[]
): ColorResult {
  const light = mode === 'light';
  const value = {} as Record<SemanticRole, string>;
  const states = {} as Record<SemanticRole, Values>;
  for (const role of SEMANTIC_ROLES) {
    const { default: d, ...rest } = base[role];
    value[role] = d;
    states[role] = rest;
  }
  const pinned = new Map<SemanticRole, string>();
  const rolePins = rec(rec(color.roles)[mode]);
  const hexOf = (role: SemanticRole): string => {
    const page = parseDsColor(value.background);
    const pageHex = page ? composite(page, '#ffffff') : '#ffffff';
    const parsed = parseDsColor(value[role]);
    return parsed ? composite(parsed, pageHex) : '#808080';
  };
  const set = (role: SemanticRole, next: string, path: string, reason: string) => {
    if (next === value[role]) return;
    adjustments.push({
      mode,
      variable: semanticTokenToCssVar(role),
      from: value[role],
      to: next,
      path,
      reason,
    });
    value[role] = next;
  };

  const pins = rec(color.pin);
  for (const [role, fg, soft, softFg] of PIN_ROLES) {
    const pin = pins[role];
    if (typeof pin !== 'string' || Object.hasOwn(rolePins, role)) continue;
    const path = `$.color.pin.${role}`;
    const before = base[role].default;
    value[role] = pin;
    pinned.set(role, path);
    if (role === 'primary' && !Object.hasOwn(rolePins, 'sidebarPrimary')) {
      value.sidebarPrimary = pin;
      pinned.set('sidebarPrimary', path);
    }
    const fill = hexOf(role);
    if (fill === before) continue;
    if (!Object.hasOwn(rolePins, fg))
      set(fg, onColor(fill, minimum), path, `on-color for the pinned ${role}`);
    if (soft && softFg && !Object.hasOwn(rolePins, soft) && !Object.hasOwn(rolePins, softFg)) {
      const { c, h } = seedOklch(fill, 'Pin');
      const tone = tint(h, c, light, hexOf('foreground'), minimum);
      set(soft, tone.color, path, `soft tint of the pinned ${role}`);
      set(softFg, tone.foreground, path, `ink on the soft ${role} tint`);
    }
  }
  for (const role of SEMANTIC_ROLES) {
    const pin = rolePins[role];
    if (typeof pin !== 'string') continue;
    value[role] = pin;
    pinned.set(role, `$.color.roles.${mode}.${role}`);
  }

  // Move derived colors until every pair holds; pinned colors never move.
  const required = (kind: string) => (kind === 'text' ? minimum : 3);
  const partners = (role: SemanticRole, side: 'foreground' | 'background') =>
    THEME_CONTRAST_PAIRS.filter((pair) => pair[side] === role);
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const pair of THEME_CONTRAST_PAIRS) {
      const need = required(pair.kind);
      if (contrastRatio(hexOf(pair.foreground), hexOf(pair.background)) >= need) continue;
      const cause = pinned.get(pair.background) ?? pinned.get(pair.foreground) ?? '$.color.brand';
      const reason = `${pair.foreground} on ${pair.background} below ${need}:1`;
      const solve = (role: SemanticRole, against: string[]) => {
        const own = seedOklch(hexOf(role), 'Color');
        const mean = against.reduce((sum, c) => sum + relativeLuminance(c), 0) / against.length;
        return search(own.h, own.c, own.l, mean > 0.18 ? -1 : 1, against, need);
      };
      if (!pinned.has(pair.foreground)) {
        const against = partners(pair.foreground, 'foreground').map((p) => hexOf(p.background));
        set(pair.foreground, solve(pair.foreground, against), cause, reason);
        moved = true;
      } else if (!pinned.has(pair.background)) {
        const against = partners(pair.background, 'background').map((p) => hexOf(p.foreground));
        set(pair.background, solve(pair.background, against), cause, reason);
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Interaction states follow each fill whenever it or its context changed.
  const ring = value.ring;
  for (const role of INTERACTIVE_SEMANTIC_ROLES) {
    const against = AGAINST[role];
    const same =
      value[role] === base[role].default &&
      value[against] === base[against].default &&
      value.background === base.background.default &&
      ring === base.ring.default;
    if (same) continue;
    const { default: _, ...rest } = interactive(
      hexOf(role),
      hexOf(against),
      hexOf('background'),
      ring
    );
    states[role] = rest;
  }

  const vars: Record<string, string> = {};
  const sources: Record<string, string> = {};
  const interactiveRoles: readonly string[] = INTERACTIVE_SEMANTIC_ROLES;
  for (const role of SEMANTIC_ROLES) {
    const name = semanticTokenToCssVar(role);
    vars[name] = value[role];
    const path = pinned.get(role);
    if (path) sources[name] = path;
    if (!interactiveRoles.includes(role)) continue;
    for (const state of ['hover', 'active', 'disabled', 'focus'] as const) {
      const v = states[role][state];
      if (v === undefined) continue;
      vars[semanticTokenToCssVar(role, state)] = v;
      if (path) sources[semanticTokenToCssVar(role, state)] = path;
    }
  }
  return { vars, sources, hexOf };
}

/** Replace every `var()` with its value from `vars` (or its fallback), innermost first. */
function concrete(vars: Record<string, string>): Record<string, string> {
  const done = new Map<string, string>();
  const visiting = new Set<string>();
  const value = (name: string): string | undefined => {
    const known = done.get(name);
    if (known !== undefined) return known;
    const raw = vars[name];
    if (raw === undefined || visiting.has(name)) return;
    visiting.add(name);
    const out = substitute(raw);
    visiting.delete(name);
    done.set(name, out);
    return out;
  };
  const substitute = (raw: string): string => {
    let out = raw;
    for (let guard = 0; guard < 256; guard++) {
      const start = out.lastIndexOf('var(');
      if (start < 0) break;
      const end = closingParen(out, start + 3);
      if (end < 0) break;
      const inner = out.slice(start + 4, end - 1);
      const comma = inner.indexOf(',');
      const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
      const fallback = comma < 0 ? '' : inner.slice(comma + 1).trim();
      out = out.slice(0, start) + (value(name) ?? fallback) + out.slice(end);
    }
    return out;
  };
  const result: Record<string, string> = {};
  for (const name of Object.keys(vars).sort()) result[name] = value(name) ?? '';
  return result;
}

const RADIUS_STEPS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full']);
const TYPE_ROLE_NAMES = new Set([
  'display',
  'title',
  'heading',
  'body',
  'label',
  'caption',
  'code',
]);

const PERSONALITY = Object.fromEntries(MOTION_PRESETS.map((preset) => [preset.id, preset]));

/** Mode-independent variables, component pins and target refusals. */
function styleVariables(doc: Doc, targetMin: number, adjustments: DesignSystemAdjustment[]) {
  const vars: Record<string, string> = {};
  const sources: Record<string, string> = {};
  const errors: DesignSystemCompileIssue[] = [];
  for (const token of BASE_SYSTEM_TOKENS) vars[token.name] = token.value;

  const typography = rec(doc.typography);
  const families = rec(typography.families);
  const stack = (key: string, fallback: string) => {
    const names = rec(families[key]).stack;
    return Array.isArray(names) ? formatFontStack(names as string[]) : fallback;
  };
  const sans = stack('sans', DEFAULT_FONT_SANS);
  vars['--tx-font-sans'] = sans;
  vars['--tx-font-heading'] = stack('heading', sans);
  vars['--tx-font-mono'] = stack('mono', DEFAULT_FONT_MONO);
  const serif = stack('serif', 'ui-serif, Georgia, serif');

  const scale = rec(typography.scale);
  const ratio = typeof scale.ratio === 'number' ? scale.ratio : null;
  const baseSize = typeof scale.base === 'number' ? scale.base : 16;
  for (const [name, size] of Object.entries(fontSizes(ratio)))
    vars[name] = baseSize === 16 ? size : rem((lengthPx(size) as number) * (baseSize / 16));

  const roles = rec(typography.roles);
  const anchor: Record<string, string> = {
    'body.weight': '--tx-font-weight-body',
    'label.weight': '--tx-font-weight-medium',
    'heading.weight': '--tx-font-weight-heading',
    'display.weight': '--tx-font-weight-bold',
    'body.tracking': '--tx-letter-spacing-body',
    'heading.tracking': '--tx-letter-spacing-heading',
  };
  const tracking = (n: number) => (n === 0 ? '0' : `${num(n)}em`);
  Object.assign(vars, {
    '--tx-font-weight-body': '400',
    '--tx-font-weight-medium': '500',
    '--tx-font-weight-heading': '600',
    '--tx-font-weight-bold': '700',
    '--tx-letter-spacing-body': '0',
    '--tx-letter-spacing-heading': '0',
  });
  for (const role of sortKeys(roles)) {
    const fields = rec(roles[role]);
    for (const key of sortKeys(fields)) {
      const v = fields[key];
      const path = `$.typography.roles.${role}.${key}`;
      const target = anchor[`${role}.${key}`] ?? `--tx-type-${role}-${key}`;
      let out: string;
      if (key === 'family')
        out = v === 'serif' ? serif : `var(--tx-font-${v === 'heading' ? 'heading' : v})`;
      else if (key === 'size') out = rem(v as number);
      else if (key === 'tracking') out = tracking(v as number);
      else out = num(v as number);
      vars[target] = out;
      sources[target] = path;
    }
  }

  const shape = rec(doc.shape);
  const radiusScale = typeof shape.radiusScale === 'number' ? shape.radiusScale : 1;
  vars['--tx-radius'] = typeof shape.radius === 'number' ? rem(shape.radius) : DEFAULT_RADIUS;
  vars['--tx-radius-scale'] = String(radiusScale);
  for (const step of [6, 4, 2])
    vars[`--tx-radius-step-${step}`] = `${Number((step * radiusScale).toFixed(4))}px`;
  vars['--tx-border-width'] =
    `${typeof shape.borderWidth === 'number' ? num(shape.borderWidth) : 1}px`;

  const space = rec(doc.space);
  const density = typeof space.density === 'number' ? space.density : 1;
  const unitPx = (typeof space.base === 'number' ? space.base : 4) * density;
  vars['--tx-density'] = String(density);
  vars['--tx-space-unit'] = rem(unitPx);
  for (let n = 1; n <= 12; n++) vars[`--tx-space-${n}`] = rem(unitPx * n);

  const elevation = (rec(doc.elevation).style as ElevationStyle | undefined) ?? 'soft';
  const [soft, float] = shadows(elevation);
  vars['--tx-elevation-style'] = elevation;
  vars['--tx-shadow-soft'] = soft;
  vars['--tx-shadow-float'] = float;
  const surface = rec(doc.surface);
  const glass = rec(surface.glass);
  vars['--tx-surface-style'] = (surface.style as string | undefined) ?? 'solid';
  vars['--tx-glass-opacity'] =
    typeof glass.alpha === 'number' ? `${num(glass.alpha * 100)}%` : '82%';
  vars['--tx-glass-blur'] = typeof glass.blur === 'number' ? `${num(glass.blur)}px` : '16px';

  const motion = rec(doc.motion);
  const personality = (motion.personality as string | undefined) ?? 'standard';
  const preset =
    PERSONALITY[personality] ?? (PERSONALITY.standard as (typeof MOTION_PRESETS)[number]);
  const durations = { ...preset.durations, ...rec(motion.durations) } as Record<
    'fast' | 'base' | 'slow',
    number
  >;
  Object.assign(vars, motionVariables({ durations, reducedMotion: personality === 'none' }), {
    '--tx-motion': '1',
    '--tx-motion-easing':
      typeof motion.easing === 'string'
        ? MOTION_EASINGS[motion.easing as MotionEasingName]
        : preset.easing,
  });

  const a11y = rec(doc.accessibility);
  vars['--tx-focus-ring-style'] = (a11y.focus as string | undefined) ?? 'ring';
  const focusWidth = typeof a11y.focusWidth === 'number' ? a11y.focusWidth : 2;
  vars['--tx-focus-ring-width'] = `${num(focusWidth)}px`;
  vars['--tx-focus-ring-offset'] =
    `${num(typeof a11y.focusOffset === 'number' ? a11y.focusOffset : 2)}px`;
  if (focusWidth < MIN_FOCUS_WIDTH)
    errors.push({
      code: 'aa-focus',
      path: '$.accessibility.focusWidth',
      message: `A ${focusWidth}px focus ring is too thin; at least ${MIN_FOCUS_WIDTH}px is required.`,
    });

  // Sizes: the solver lifts system controls to the target; pinned component sizes are checked.
  vars['--tx-size-target-min'] = `${targetMin}px`;
  for (const size of ['xs', 'sm', 'md', 'lg']) {
    const name = `--tx-size-control-${size}`;
    const px = lengthPx(vars[name]) as number;
    if (px >= targetMin) continue;
    for (const mode of ['light', 'dark'] as const)
      adjustments.push({
        mode,
        variable: name,
        from: vars[name] as string,
        to: `${targetMin}px`,
        path: '$.accessibility.targetMin',
        reason: `control height below the ${targetMin}px target`,
      });
    vars[name] = `${targetMin}px`;
  }
  const icons = rec(doc.icons);
  const iconSize = rec(icons.size);
  for (const size of ['sm', 'md', 'lg'])
    if (typeof iconSize[size] === 'number') vars[`--tx-size-icon-${size}`] = rem(iconSize[size]);
  if (typeof icons.stroke === 'number') vars['--tx-icon-stroke'] = num(icons.stroke);
  if (typeof icons.style === 'string') vars['--tx-icon-style'] = icons.style;

  const layout = rec(doc.layout);
  if (typeof layout.contentMax === 'number')
    vars['--tx-layout-content-max'] = `${layout.contentMax}px`;
  if (typeof layout.wideMax === 'number') vars['--tx-layout-wide-max'] = `${layout.wideMax}px`;
  const breakpoints = rec(layout.breakpoints);
  for (const bp of sortKeys(breakpoints))
    vars[`--tx-layout-breakpoint-${bp}`] = `${breakpoints[bp]}px`;
  const grid = rec(layout.grid);
  const columns = rec(grid.columns);
  for (const bp of sortKeys(columns)) vars[`--tx-layout-grid-columns-${bp}`] = String(columns[bp]);
  const gutter = rec(grid.gutter);
  for (const bp of sortKeys(gutter))
    vars[`--tx-layout-grid-gutter-${bp}`] = `var(--tx-${gutter[bp]})`;

  const dimensionPx = (step: string): number | undefined =>
    step.startsWith('space-')
      ? unitPx * Number(step.slice(6))
      : step === 'target-min'
        ? targetMin
        : lengthPx(vars[`--tx-size-${step}`]);
  const components = rec(doc.components);
  const defaults: Record<string, { variant?: string; size?: string }> = {};
  const targets: readonly string[] = DESIGN_SYSTEM_TARGETS;
  for (const component of sortKeys(components)) {
    const fields = rec(components[component]);
    for (const key of sortKeys(fields)) {
      const v = fields[key];
      const path = at(at('$.components', component), key);
      if (key === 'defaults') {
        const chosen = rec(v);
        defaults[component] = {
          ...(typeof chosen.variant === 'string' ? { variant: chosen.variant } : {}),
          ...(typeof chosen.size === 'string' ? { size: chosen.size } : {}),
        };
        continue;
      }
      const name = `--tx-${component}-${key}`;
      // The spec already checked each value against its kind; the kind follows from it.
      let out: string;
      if (typeof v === 'number') out = key.includes('stroke') ? num(v) : `var(--tx-elevation-${v})`;
      else if (typeof v !== 'string') continue;
      else if (key.includes('opacity')) out = `var(--tx-opacity-${v})`;
      else if (RADIUS_STEPS.has(v) && key.includes('radius')) out = `var(--tx-shape-radius-${v})`;
      else if (v === 'none' || v === 'thin' || v === 'thick')
        out = v === 'none' ? '0px' : `var(--tx-border-width-${v})`;
      else if (TYPE_ROLE_NAMES.has(v)) {
        const prop = key.includes('weight')
          ? 'weight'
          : key.includes('line-height')
            ? 'line'
            : 'size';
        out = `var(--tx-type-${v}-${prop})`;
      } else if (/^(?:space|control|icon|target)-/.test(v)) {
        out = v.startsWith('space-') ? `var(--tx-${v})` : `var(--tx-size-${v})`;
        const px = dimensionPx(v);
        if (targets.includes(name) && px !== undefined && px < targetMin)
          errors.push({
            code: 'target-size',
            path,
            message: `${component} ${key} is ${num(px)}px; targets need at least ${targetMin}px.`,
            hint: `Choose a step of at least ${targetMin}px or lower accessibility.targetMin.`,
          });
      } else out = `var(--tx-${toKebabCase(v)})`;
      vars[name] = out;
      sources[name] = path;
    }
  }
  return { vars, sources, errors, defaults };
}

function seedHex(
  value: unknown,
  path: string,
  warnings: DesignSystemWarning[]
): string | undefined {
  if (typeof value !== 'string') return;
  const parsed = parseDsColor(value);
  if (!parsed) return;
  if (parsed.alpha < 1) warnings.push({ path, message: 'Seed alpha is ignored.' });
  return parsed.hex;
}

/** Decoded bytes of a base64 `data:` URL, or 0. */
function inlineBytes(src: unknown): number {
  if (typeof src !== 'string' || !src.startsWith('data:')) return 0;
  const payload = src.slice(src.indexOf(',') + 1);
  return (payload.length / 4) * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
}

const FONT_FORMAT: Record<string, DesignSystemFontFace['format']> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

/**
 * Compile a design-system document. Never throws on a JSON value: a document
 * that fails validation, resolution or a guarantee returns
 * `{ ok: false, errors }` with stable codes and JSON paths.
 */
export function compileDesignSystem(
  input: unknown,
  options: CompileDesignSystemOptions = {}
): CompiledDesignSystem | DesignSystemFailure {
  const resolved = resolveDesignSystemSync(input, options);
  if (!resolved.ok) return resolved;
  const doc = resolved.document as unknown as Doc;
  const color = rec(doc.color);
  const a11y = rec(doc.accessibility);
  const contrast = (a11y.contrast as DesignSystemContrast | undefined) ?? 'AA';
  const minimum = textMinimum(contrast);
  const targetMin = typeof a11y.targetMin === 'number' ? a11y.targetMin : 24;
  const requested = options.modes ??
    (color.modes as DesignSystemMode[] | undefined) ?? ['light', 'dark'];
  if (!Array.isArray(requested) || requested.some((m) => m !== 'light' && m !== 'dark'))
    return {
      ok: false,
      errors: [
        { code: 'invalid-value', path: '$.color.modes', message: 'Modes are light and dark.' },
      ],
    };
  const modes = (['light', 'dark'] as const).filter((mode) => requested.includes(mode));

  const warnings: DesignSystemWarning[] = [];
  const adjustments: DesignSystemAdjustment[] = [];
  const errors: DesignSystemCompileIssue[] = [];
  const brand = rec(color.brand);
  const seed = seedHex(brand.seed, '$.color.brand.seed', warnings) ?? DEFAULT_DESIGN_SYSTEM_SEED;
  const secondary = seedHex(brand.secondary, '$.color.brand.secondary', warnings);
  let theme: Theme;
  try {
    theme = generateThemeFromSeed({
      seed,
      ...(secondary ? { secondary } : {}),
      ...(typeof brand.neutral === 'string' ? { neutral: brand.neutral as NeutralFamily } : {}),
      contrast,
    });
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: 'aa-text',
          path: '$.color.brand.seed',
          message: error instanceof Error ? error.message : 'The seed cannot meet the target.',
        },
      ],
    };
  }

  const style = styleVariables(doc, targetMin, adjustments);
  errors.push(...style.errors);
  const accent = seedHex(brand.accent, '$.color.brand.accent', warnings);
  const dataViz = rec(color.dataViz);
  const status = rec(color.status);
  const vars: CompiledDesignSystem['vars'] = {};
  const contrastReport: DesignSystemReport['contrast'] = {};
  const targets: DesignSystemTargetResult[] = [];

  for (const mode of modes) {
    const solved = solveColors(mode, theme[mode], color, minimum, adjustments);
    const draft: Record<string, string> = { ...style.vars, ...solved.vars };
    const sources: Record<string, string> = { ...style.sources, ...solved.sources };
    for (const name of sortKeys(status)) {
      const fill = status[name] as string;
      const variable = `--tx-status-${name}`;
      draft[variable] = fill;
      sources[variable] = `$.color.status.${name}`;
      const fillHex = composite(
        parseDsColor(fill) as NonNullable<ReturnType<typeof parseDsColor>>,
        solved.hexOf('background')
      );
      const fgName = `${variable}-foreground`;
      const current = concrete(draft)[fgName] as string;
      const fg = parseDsColor(current);
      if (!fg || contrastRatio(composite(fg, fillHex), fillHex) < minimum) {
        const next = onColor(fillHex, minimum);
        adjustments.push({
          mode,
          variable: fgName,
          from: current,
          to: next,
          path: `$.color.status.${name}`,
          reason: 'on-color for the status fill',
        });
        draft[fgName] = next;
      }
    }
    const own = rec(dataViz[mode]);
    let charts: Doc;
    // A partial palette (every list is optional) fills the rest from the derived one.
    if (['categorical', 'sequential', 'diverging', 'grid', 'axis'].every((key) => key in own))
      charts = own;
    else {
      const p = Object.fromEntries(
        SEMANTIC_ROLES.map((role) => [role, { default: solved.hexOf(role) }])
      ) as unknown as SemanticPalette;
      const input = chartPaletteInputFor({ light: p, dark: p } as Theme, mode);
      if (accent) {
        const { h } = seedOklch(accent, 'Accent');
        input.chart3 = hex(mode === 'light' ? 0.58 : 0.72, 0.16, h);
      }
      charts = { ...(deriveChartTokens(input, mode) as unknown as Doc), ...own };
      if (dataViz.cvdSafe === true)
        for (const issue of validateChartTokens(charts as never, input, mode))
          if (issue.kind === 'cvd-distance')
            warnings.push({
              path: `$.color.dataViz.${mode}`,
              message: `Categorical ${issue.indices.join(' and ')} are close for color-vision deficiencies.`,
            });
    }
    (charts.categorical as string[]).forEach((c, i) => {
      draft[`--tx-chart-${i + 1}`] = c;
    });
    (charts.sequential as string[]).forEach((c, i) => {
      draft[`--tx-chart-sequential-${i + 1}`] = c;
    });
    (charts.diverging as string[]).forEach((c, i) => {
      draft[`--tx-chart-diverging-${i + 1}`] = c;
    });
    draft['--tx-chart-grid'] = charts.grid as string;
    draft['--tx-chart-axis'] = charts.axis as string;

    // A token that only reads another (status → role) answers for the same pin.
    for (const [name, raw] of Object.entries(draft)) {
      const ref = /^var\((--tx-[a-z0-9-]+)\)$/.exec(raw)?.[1];
      if (ref && sources[name] === undefined && sources[ref] !== undefined)
        sources[name] = sources[ref] as string;
    }
    const out = concrete(draft) as Record<`--tx-${string}`, string>;
    vars[mode] = out;
    const pairs = evaluateDesignSystemContrast(out, contrast);
    contrastReport[mode] = pairs;
    for (const pair of pairs) {
      if (pair.pass) continue;
      const involved = [sources[pair.foreground], sources[pair.background]].filter(
        (path): path is string => path !== undefined
      );
      errors.push({
        code: pair.kind === 'focus' ? 'aa-focus' : 'aa-text',
        path: involved[0] ?? '$.color.brand.seed',
        message: `${pair.foreground} on ${pair.background} is ${pair.ratio}:1 in ${mode}; ${pair.required}:1 is required.`,
        hint: involved.length
          ? `Pinned: ${[...new Set(involved)].join(', ')}. Pins never move; change one.`
          : 'No pin is involved; report this document.',
        pairs: [pair],
        mode,
      });
    }
    if (mode === modes[0])
      for (const name of DESIGN_SYSTEM_TARGETS) {
        const px = lengthPx(out[name as `--tx-${string}`]);
        if (px !== undefined)
          targets.push({ variable: name, px, required: targetMin, pass: px >= targetMin });
      }
  }
  if (errors.length > 0) return { ok: false, errors };

  const typography = rec(doc.typography);
  const families = rec(typography.families);
  const fontFaces: DesignSystemFontFace[] = [];
  let bytes = 0;
  for (const key of ['sans', 'heading', 'mono', 'serif']) {
    const family = rec(families[key]);
    const name = (family.stack as string[] | undefined)?.[0];
    for (const file of (family.files as Doc[] | undefined) ?? []) {
      const src = file.src as string;
      const inline = src.startsWith('data:');
      bytes += inlineBytes(src);
      const ext =
        (inline ? /^data:font\/(\w+)/.exec(src)?.[1] : /\.(\w+)$/.exec(src)?.[1]) ?? 'woff2';
      const format = FONT_FORMAT[ext] ?? 'woff2';
      fontFaces.push({
        family: name as string,
        src,
        format,
        weight: (file.weight as string | undefined) ?? '400',
        style: (file.style as DesignSystemFontFace['style'] | undefined) ?? 'normal',
        display: (file.display as DesignSystemFontFace['display'] | undefined) ?? 'swap',
        inline,
        ...(file.preload === true && !inline
          ? {
              preload: {
                href: src,
                as: 'font' as const,
                type: `font/${ext}`,
                crossorigin: 'anonymous' as const,
              },
            }
          : {}),
      });
    }
  }
  const assetsDoc = rec(doc.assets);
  const assets: CompiledDesignSystem['assets'] = {};
  const logo = rec(assetsDoc.logo);
  if (Object.keys(logo).length > 0) {
    assets.logo = {};
    for (const key of ['light', 'dark', 'mark', 'wordmark'] as const)
      if (typeof logo[key] === 'string') {
        assets.logo[key] = logo[key];
        bytes += inlineBytes(logo[key]);
      }
  }
  if (typeof assetsDoc.favicon === 'string') {
    assets.favicon = assetsDoc.favicon;
    bytes += inlineBytes(assetsDoc.favicon);
  }

  const attrs: CompiledDesignSystem['attrs'] = {
    'data-tx-ds': doc.id as string,
    'data-tx-ds-version': doc.version as string,
    ...(resolved.variant !== undefined ? { 'data-tx-ds-variant': resolved.variant } : {}),
    'data-tx-surface': (rec(doc.surface).style as string | undefined) ?? 'solid',
    'data-tx-elevation': (rec(doc.elevation).style as string | undefined) ?? 'soft',
    'data-tx-focus-ring-style': (a11y.focus as string | undefined) ?? 'ring',
    'data-tx-icon-style': (rec(doc.icons).style as string | undefined) ?? 'outline',
  };
  return {
    ok: true,
    id: doc.id as string,
    version: doc.version as string,
    name: doc.name as string,
    ...(resolved.variant !== undefined ? { variant: resolved.variant } : {}),
    modes: [...modes],
    vars,
    attrs,
    fontFaces,
    assets,
    defaults: style.defaults,
    accessibility: { contrast, targetMin },
    report: {
      contrast: contrastReport,
      adjustments,
      warnings,
      inlineBytes: bytes,
      targets,
    },
    hash: sha256Hex(
      canonicalJson({
        compiler: DESIGN_SYSTEM_COMPILER_VERSION,
        document: resolved.document,
        variant: resolved.variant ?? null,
        modes,
        trust: options.trust ?? 'untrusted',
      })
    ),
  };
}

export type { DesignSystem };
