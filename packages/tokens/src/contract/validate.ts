/**
 * Owned theme validator (no zod). Fails closed with path-addressed issues.
 */

import { isSafeCssColor, isSafeCssEasing, isSafeCssLength, isSafeFontFamily } from './css-safe.ts';
import { COMPONENT_HOOK_KEYS, type ComponentHookKey, isAllowedHookValue } from './hooks.ts';
import {
  INTERACTION_STATES,
  type InteractionState,
  isInteractiveSemanticRole,
  normalizeRoleValue,
  SEMANTIC_ROLES,
  type SemanticPalette,
  type SemanticRole,
  type SemanticRoleInput,
} from './semantic.ts';
import {
  DEFAULT_DENSITY,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_RADIUS,
  DEFAULT_THEME_STYLE,
  type ElevationStyle,
  type FocusRingStyle,
  type SurfaceStyle,
  type Theme,
  type ThemeChartTokens,
  type ThemeInput,
  type ThemeStyle,
} from './types.ts';

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationSuccess = { ok: true; value: Theme };
export type ValidationFailure = { ok: false; issues: ValidationIssue[] };
export type ValidationResult = ValidationSuccess | ValidationFailure;

const THEME_ID = /^[a-z][a-z0-9-]*$/;
const HEX6 = /^#[0-9a-f]{6}$/i;
const TRACKING = /^(?:0|normal|-?(?:\d(?:\.\d{1,4})?|\.\d{1,4})em)$/;

const ELEVATIONS: readonly ElevationStyle[] = ['flat', 'soft', 'crisp', 'glow', 'layered'];
const SURFACES: readonly SurfaceStyle[] = ['solid', 'glass'];
const FOCUS_STYLES: readonly FocusRingStyle[] = ['ring', 'outline', 'glow', 'inset'];

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  max = 80
): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    issues.push(issue(path, 'Expected a non-empty string'));
    return null;
  }
  if (value.length > max) {
    issues.push(issue(path, `String longer than ${max} characters`));
    return null;
  }
  return value;
}

function requireColor(value: unknown, path: string, issues: ValidationIssue[]): string | null {
  const s = requireString(value, path, issues, 96);
  if (s === null) return null;
  if (!isSafeCssColor(s)) {
    issues.push(issue(path, 'Unsafe or invalid CSS color'));
    return null;
  }
  return s.trim();
}

function requireHex6(value: unknown, path: string, issues: ValidationIssue[]): string | null {
  const s = requireString(value, path, issues, 16);
  if (s === null) return null;
  if (!HEX6.test(s)) {
    issues.push(issue(path, 'Expected a #rrggbb hex color'));
    return null;
  }
  return s.toLowerCase();
}

function parseRoleValue(
  input: unknown,
  path: string,
  role: SemanticRole,
  issues: ValidationIssue[]
): SemanticPalette[SemanticRole] | null {
  if (typeof input === 'string') {
    const color = requireColor(input, path, issues);
    return color === null ? null : { default: color };
  }
  if (!isObject(input)) {
    issues.push(issue(path, 'Expected a color string or { default, hover?, … }'));
    return null;
  }
  const def = requireColor(input.default, `${path}.default`, issues);
  if (def === null) return null;

  const value: SemanticPalette[SemanticRole] = { default: def };
  if (!isInteractiveSemanticRole(role)) {
    for (const state of INTERACTION_STATES) {
      if (state === 'default') continue;
      if (input[state] !== undefined) {
        issues.push(issue(`${path}.${state}`, `Role "${role}" does not accept interaction states`));
      }
    }
    return value;
  }

  for (const state of INTERACTION_STATES) {
    if (state === 'default') continue;
    if (input[state] === undefined) continue;
    const color = requireColor(input[state], `${path}.${state}`, issues);
    if (color !== null) value[state as InteractionState] = color;
  }
  return value;
}

function parsePalette(
  input: unknown,
  path: string,
  issues: ValidationIssue[]
): SemanticPalette | null {
  if (!isObject(input)) {
    issues.push(issue(path, 'Expected an object of semantic roles'));
    return null;
  }
  const palette = {} as SemanticPalette;
  let ok = true;
  for (const role of SEMANTIC_ROLES) {
    if (input[role] === undefined) {
      issues.push(issue(`${path}.${role}`, 'Missing required semantic role'));
      ok = false;
      continue;
    }
    const value = parseRoleValue(input[role], `${path}.${role}`, role, issues);
    if (value === null) ok = false;
    else palette[role] = value;
  }
  return ok ? palette : null;
}

function parseChartTokens(
  input: unknown,
  path: string,
  issues: ValidationIssue[]
): ThemeChartTokens | null {
  if (!isObject(input)) {
    issues.push(issue(path, 'Expected a chart tokens object'));
    return null;
  }
  const categorical = parseHexArray(input.categorical, `${path}.categorical`, 8, issues);
  const sequential = parseHexArray(input.sequential, `${path}.sequential`, 9, issues);
  const diverging = parseHexArray(input.diverging, `${path}.diverging`, 9, issues);
  const grid = requireColor(input.grid, `${path}.grid`, issues);
  const axis = requireColor(input.axis, `${path}.axis`, issues);
  if (!categorical || !sequential || !diverging || !grid || !axis) return null;
  return {
    categorical: categorical as unknown as ThemeChartTokens['categorical'],
    sequential: sequential as unknown as ThemeChartTokens['sequential'],
    diverging: diverging as unknown as ThemeChartTokens['diverging'],
    grid,
    axis,
  };
}

function parseHexArray(
  input: unknown,
  path: string,
  length: number,
  issues: ValidationIssue[]
): string[] | null {
  if (!Array.isArray(input) || input.length !== length) {
    issues.push(issue(path, `Expected an array of ${length} #rrggbb colors`));
    return null;
  }
  const out: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const c = requireHex6(input[i], `${path}[${i}]`, issues);
    if (c === null) return null;
    out.push(c);
  }
  return out;
}

function parseStyle(input: unknown, path: string, issues: ValidationIssue[]): ThemeStyle {
  const base = structuredClone(DEFAULT_THEME_STYLE);
  if (input === undefined) return base;
  if (!isObject(input)) {
    issues.push(issue(path, 'Expected a style object'));
    return base;
  }

  if (input.elevation !== undefined) {
    if (
      typeof input.elevation === 'string' &&
      (ELEVATIONS as readonly string[]).includes(input.elevation)
    ) {
      base.elevation = input.elevation as ElevationStyle;
    } else issues.push(issue(`${path}.elevation`, 'Invalid elevation style'));
  }
  if (input.surface !== undefined) {
    if (
      typeof input.surface === 'string' &&
      (SURFACES as readonly string[]).includes(input.surface)
    ) {
      base.surface = input.surface as SurfaceStyle;
    } else issues.push(issue(`${path}.surface`, 'Invalid surface style'));
  }

  if (isObject(input.typography)) {
    const t = input.typography;
    if (t.scaleRatio !== undefined) {
      if (t.scaleRatio === null) base.typography.scaleRatio = null;
      else if (typeof t.scaleRatio === 'number' && t.scaleRatio >= 1 && t.scaleRatio <= 1.75) {
        base.typography.scaleRatio = t.scaleRatio;
      } else issues.push(issue(`${path}.typography.scaleRatio`, 'Expected null or 1–1.75'));
    }
    if (isObject(t.weights)) {
      for (const key of ['body', 'medium', 'heading', 'bold'] as const) {
        const w = t.weights[key];
        if (w === undefined) continue;
        if (typeof w === 'number' && Number.isInteger(w) && w >= 100 && w <= 900) {
          base.typography.weights[key] = w;
        } else issues.push(issue(`${path}.typography.weights.${key}`, 'Expected integer 100–900'));
      }
    }
    if (isObject(t.tracking)) {
      for (const key of ['body', 'heading'] as const) {
        const tr = t.tracking[key];
        if (tr === undefined) continue;
        if (typeof tr === 'string' && TRACKING.test(tr)) base.typography.tracking[key] = tr;
        else issues.push(issue(`${path}.typography.tracking.${key}`, 'Invalid tracking'));
      }
    }
  }

  if (isObject(input.shape)) {
    const s = input.shape;
    if (s.radiusScale !== undefined) {
      if (typeof s.radiusScale === 'number' && s.radiusScale >= 0 && s.radiusScale <= 4) {
        base.shape.radiusScale = s.radiusScale;
      } else issues.push(issue(`${path}.shape.radiusScale`, 'Expected 0–4'));
    }
    if (s.borderWidth !== undefined) {
      if (typeof s.borderWidth === 'string' && isSafeCssLength(s.borderWidth)) {
        base.shape.borderWidth = s.borderWidth.trim();
      } else issues.push(issue(`${path}.shape.borderWidth`, 'Invalid CSS length'));
    }
  }

  if (isObject(input.motion)) {
    const m = input.motion;
    if (typeof m.easing === 'string') {
      if (isSafeCssEasing(m.easing)) base.motion.easing = m.easing.trim();
      else issues.push(issue(`${path}.motion.easing`, 'Invalid easing'));
    }
    if (isObject(m.durations)) {
      for (const key of ['fast', 'base', 'slow'] as const) {
        const d = m.durations[key];
        if (d === undefined) continue;
        if (typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 2000) {
          base.motion.durations[key] = d;
        } else issues.push(issue(`${path}.motion.durations.${key}`, 'Expected integer 0–2000 ms'));
      }
    }
  }

  if (isObject(input.focusRing)) {
    const f = input.focusRing;
    if (f.style !== undefined) {
      if (typeof f.style === 'string' && (FOCUS_STYLES as readonly string[]).includes(f.style)) {
        base.focusRing.style = f.style as FocusRingStyle;
      } else issues.push(issue(`${path}.focusRing.style`, 'Invalid focus ring style'));
    }
    for (const key of ['width', 'offset'] as const) {
      const v = f[key];
      if (v === undefined) continue;
      if (typeof v === 'string' && isSafeCssLength(v)) base.focusRing[key] = v.trim();
      else issues.push(issue(`${path}.focusRing.${key}`, 'Invalid CSS length'));
    }
  }

  return base;
}

function parseComponents(
  input: unknown,
  path: string,
  issues: ValidationIssue[]
): Theme['components'] {
  if (input === undefined) return undefined;
  if (!isObject(input)) {
    issues.push(issue(path, 'Expected a components object'));
    return undefined;
  }
  const out: NonNullable<Theme['components']> = {};
  for (const key of COMPONENT_HOOK_KEYS) {
    const v = input[key];
    if (v === undefined) continue;
    if (typeof v === 'string' && isAllowedHookValue(key as ComponentHookKey, v)) {
      out[key] = v as never;
    } else {
      issues.push(issue(`${path}.${key}`, `Invalid ${key} hook value`));
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Validate an unknown theme document. Returns a normalized {@link Theme} or
 * a list of path-addressed issues. Never throws.
 */
export function validateTheme(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!isObject(input)) {
    return { ok: false, issues: [issue('', 'Theme must be an object')] };
  }

  const id = requireString(input.id, 'id', issues, 64);
  if (id !== null && !THEME_ID.test(id)) {
    issues.push(issue('id', 'Use a lowercase kebab id starting with a letter'));
  }
  const name = requireString(input.name, 'name', issues, 40);
  let description = '';
  if (input.description !== undefined) {
    if (typeof input.description === 'string' && input.description.length <= 200) {
      description = input.description;
    } else issues.push(issue('description', 'Expected a string up to 200 characters'));
  }

  let fontFamily = DEFAULT_FONT_SANS;
  if (input.fontFamily !== undefined) {
    const f = requireString(input.fontFamily, 'fontFamily', issues, 300);
    if (f !== null) {
      if (isSafeFontFamily(f)) fontFamily = f.trim();
      else issues.push(issue('fontFamily', 'Unsafe font-family list'));
    }
  }

  let fontFamilyHeading: string | undefined;
  if (input.fontFamilyHeading !== undefined) {
    const f = requireString(input.fontFamilyHeading, 'fontFamilyHeading', issues, 300);
    if (f !== null) {
      if (isSafeFontFamily(f)) fontFamilyHeading = f.trim();
      else issues.push(issue('fontFamilyHeading', 'Unsafe font-family list'));
    }
  }

  let fontFamilyMono = DEFAULT_FONT_MONO;
  if (input.fontFamilyMono !== undefined) {
    const f = requireString(input.fontFamilyMono, 'fontFamilyMono', issues, 300);
    if (f !== null) {
      if (isSafeFontFamily(f)) fontFamilyMono = f.trim();
      else issues.push(issue('fontFamilyMono', 'Unsafe font-family list'));
    }
  }

  let radius = DEFAULT_RADIUS;
  if (input.radius !== undefined) {
    if (typeof input.radius === 'string' && isSafeCssLength(input.radius))
      radius = input.radius.trim();
    else issues.push(issue('radius', 'Invalid CSS length'));
  }

  let density = DEFAULT_DENSITY;
  if (input.density !== undefined) {
    if (typeof input.density === 'number' && input.density >= 0.75 && input.density <= 1.25) {
      density = input.density;
    } else issues.push(issue('density', 'Expected a number between 0.75 and 1.25'));
  }

  const light = parsePalette(input.light, 'light', issues);
  const dark = parsePalette(input.dark, 'dark', issues);
  const style = parseStyle(input.style, 'style', issues);
  const components = parseComponents(input.components, 'components', issues);

  let charts: Theme['charts'];
  if (input.charts !== undefined) {
    if (!isObject(input.charts)) {
      issues.push(issue('charts', 'Expected { light, dark } chart tokens'));
    } else {
      const cl = parseChartTokens(input.charts.light, 'charts.light', issues);
      const cd = parseChartTokens(input.charts.dark, 'charts.dark', issues);
      if (cl && cd) charts = { light: cl, dark: cd };
    }
  }

  if (issues.length > 0 || !id || !name || !light || !dark) {
    return { ok: false, issues };
  }

  const theme: Theme = {
    id,
    name,
    description,
    fontFamily,
    fontFamilyMono,
    radius,
    density,
    light,
    dark,
    style,
  };
  if (fontFamilyHeading !== undefined) theme.fontFamilyHeading = fontFamilyHeading;
  if (charts !== undefined) theme.charts = charts;
  if (components !== undefined) theme.components = components;

  return { ok: true, value: theme };
}

/** Validate and return a theme, or throw an Error listing issues. */
export function defineTheme(input: ThemeInput | unknown): Theme {
  const result = validateTheme(input);
  if (!result.ok) {
    const detail = result.issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid theme: ${detail}`);
  }
  return result.value;
}

/** Coerce a loose palette input (string colors) into a full SemanticPalette. */
export function coercePaletteInput(
  input: ThemeInput['light']
): Record<SemanticRole, ReturnType<typeof normalizeRoleValue>> {
  const out = {} as Record<SemanticRole, ReturnType<typeof normalizeRoleValue>>;
  for (const role of SEMANTIC_ROLES) {
    const raw = input[role] as SemanticRoleInput | undefined;
    if (raw === undefined) continue;
    out[role] = normalizeRoleValue(raw);
  }
  return out;
}
