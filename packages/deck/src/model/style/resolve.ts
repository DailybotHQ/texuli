/**
 * Resolve a deck style (plus an optional slide override) into a complete
 * style with every default applied, a normalized theme reference, the
 * transition the stage plays, and the `--tx-deck-*` CSS variables. Theme and
 * font resolution need token data, so they happen in the stage; here the
 * caller may pass the known ids to get `unknown-*` warnings.
 *
 * Pure and deterministic. It never throws: invalid fields are reported in
 * `issues` and fall back to their defaults; author strings (footer, logo)
 * never reach a CSS variable.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type ObjectSchema,
  type PathSegment,
  type Schema,
  validate,
} from '../../schema/index.ts';
import { isDeckBackgroundPreset } from '../backgrounds/schema.ts';
import {
  MAX_MOTION_MS,
  REDUCED_FADE_MS,
  resolveSlideTransition,
  SUBTLE_SCALE,
  TRANSITION_MS,
} from '../motion/transition.ts';
import { DECK_CANVAS, type DeckAspect, type DeckTransition } from '../shared.ts';
import {
  DECK_STYLE_DEFAULTS,
  type DeckDensity,
  type DeckMotion,
  type DeckRadius,
  type DeckStyle,
  deckStyle,
} from './schema.ts';
import {
  type DeckResolvedThemeMode,
  type DeckThemeReference,
  normalizeThemeReference,
  resolveThemeMode,
  THEME_CODES,
} from './theme.ts';

export const STYLE_CODES = Object.freeze({
  unknownTheme: THEME_CODES.unknownTheme,
  unknownFontPair: 'unknown-font-pair',
  unknownCodeTheme: 'unknown-code-theme',
} as const);

/** Every CSS variable the style sets starts with this prefix. */
export const DECK_VAR_PREFIX = '--tx-deck-';
export type DeckCssVar = `--tx-deck-${string}`;

/** Density multipliers (inside `@texuli/tokens` `DENSITY_MIN`..`DENSITY_MAX`, 0.75..1.25). */
export const DECK_DENSITY_SCALE: Readonly<Record<DeckDensity, number>> = Object.freeze({
  compact: 0.875,
  default: 1,
  comfortable: 1.125,
  spacious: 1.25,
});

export const DECK_RADIUS_VALUES: Readonly<Record<DeckRadius, string>> = Object.freeze({
  none: '0',
  small: '0.25rem',
  medium: '0.625rem',
  large: '1rem',
  full: '9999px',
});

export const DECK_ASPECT_RATIOS: Readonly<Record<DeckAspect, string>> = Object.freeze({
  '16:9': '16 / 9',
  '4:3': '4 / 3',
  '9:16': '9 / 16',
  '1:1': '1 / 1',
});

/** Full-motion durations in milliseconds (the motion module's table). */
export const DECK_TRANSITION_MS: Readonly<Record<DeckTransition, number>> = TRANSITION_MS;
/** `subtle` motion scales durations by this factor (and plays `zoom` as `fade`). */
export const DECK_SUBTLE_FACTOR = SUBTLE_SCALE;
/** Under reduced motion every transition is a short fade. */
export const DECK_REDUCED_MOTION_MS = REDUCED_FADE_MS;
/** No transition runs longer than this. */
export const DECK_TRANSITION_CAP_MS = MAX_MOTION_MS;

export interface DeckResolvedTransition {
  name: DeckTransition;
  durationMs: number;
}

/**
 * The transition the stage plays: `none` motion or transition → none;
 * reduced motion → a 150 ms fade; `subtle` → ×0.6 and zoom → fade; capped at
 * 400 ms. Delegates to the one resolver, `resolveSlideTransition`.
 */
export function resolveDeckTransition(
  transition: DeckTransition,
  motion: DeckMotion,
  reducedMotion = false
): DeckResolvedTransition {
  const resolved = resolveSlideTransition({ slide: { transition }, motion, reducedMotion });
  return { name: resolved.name, durationMs: resolved.durationMs };
}

type Defaulted = typeof DECK_STYLE_DEFAULTS;

/** A style with every default applied and the theme in its object form. */
export type ResolvedDeckStyle = Omit<DeckStyle, 'theme' | keyof Defaulted> & {
  -readonly [K in keyof Defaulted]-?: NonNullable<DeckStyle[K]>;
} & { theme?: DeckThemeReference };

export interface ResolveDeckStyleOptions {
  /** Slide-level fields (`theme`, `background`, `transition`, …) that win over the deck's. */
  override?: DeckStyle;
  /** The host's reduced-motion preference: lowers `motion`, never raises it. */
  reducedMotion?: boolean;
  /** The host's mode, used when the theme names none (or `system`). Default `light`. */
  hostMode?: DeckResolvedThemeMode;
  /** Known catalog theme ids; when given, an unknown one warns and falls back to the host default. */
  knownThemes?: readonly string[];
  /** Known font pairing ids; when given, an unknown one warns and uses the theme font. */
  knownFontPairs?: readonly string[];
  /** Known code highlight themes; when given, an unknown one warns and uses the default. */
  knownCodeThemes?: readonly string[];
  /** A prefix for issue paths, e.g. `['style']`. */
  path?: readonly PathSegment[];
}

export interface DeckStyleResolution {
  style: ResolvedDeckStyle;
  /** The concrete mode: theme reference, else host, else `light`. */
  mode: DeckResolvedThemeMode;
  /** The motion actually allowed (reduced motion lowers `full` to `subtle`). */
  motion: DeckMotion;
  transition: DeckResolvedTransition;
  /** The fixed virtual canvas for the aspect, in CSS pixels. */
  canvas: { width: number; height: number };
  cssVars: Record<DeckCssVar, string>;
  /** Invalid fields (errors, recovered with the default) and unknown ids (warnings). */
  issues: DeckDiagnostic[];
}

const SHAPE = (deckStyle as ObjectSchema).shape;

/** Validate each field on its own so one bad field never discards the rest. */
function salvage(
  input: unknown,
  path: readonly PathSegment[],
  issues: DeckDiagnostic[]
): DeckStyle {
  if (input === undefined) return {};
  const whole = validate(deckStyle, input, { path, maxIssues: 50 });
  issues.push(...whole.issues);
  if (whole.ok) return whole.value;
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(SHAPE)) {
    if (!Object.hasOwn(input, key)) continue;
    let value: unknown;
    try {
      value = (input as Record<string, unknown>)[key];
    } catch {
      continue;
    }
    const field = validate(SHAPE[key] as Schema, value, { maxIssues: 1 });
    if (field.ok && field.value !== undefined) out[key] = field.value;
  }
  return out as DeckStyle;
}

function knownOr<T extends string>(
  value: T | undefined,
  known: readonly string[] | undefined,
  code: string,
  label: string,
  path: PathSegment[],
  issues: DeckDiagnostic[]
): T | undefined {
  if (value === undefined || known === undefined || known.includes(value)) return value;
  issues.push(
    createDiagnostic(code, `Unknown ${label} "${value}"; using the default.`, path, {
      severity: 'warning',
      fix: `Use one of: ${known
        .slice(0, 20)
        .map((id) => JSON.stringify(id))
        .join(', ')}${known.length > 20 ? ', …' : ''}.`,
    })
  );
  return undefined;
}

/** Resolve `style` (and `options.override`) into defaults, transition and `--tx-deck-*` variables. */
export function resolveDeckStyle(
  style?: unknown,
  options: ResolveDeckStyleOptions = {}
): DeckStyleResolution {
  const path = [...(options.path ?? [])];
  const issues: DeckDiagnostic[] = [];
  const base = salvage(style, path, issues);
  const override = salvage(options.override, path, issues);
  const merged: DeckStyle = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
  }

  let theme = normalizeThemeReference(merged.theme);
  if (theme?.kind === 'catalog' && options.knownThemes !== undefined) {
    const id = knownOr(
      theme.id,
      options.knownThemes,
      STYLE_CODES.unknownTheme,
      'theme',
      [...path, 'theme'],
      issues
    );
    if (id === undefined) theme = undefined;
  }
  const fontPair = knownOr(
    merged.fontPair,
    options.knownFontPairs,
    STYLE_CODES.unknownFontPair,
    'font pairing',
    [...path, 'fontPair'],
    issues
  );
  const codeTheme = knownOr(
    merged.codeTheme,
    options.knownCodeThemes,
    STYLE_CODES.unknownCodeTheme,
    'code theme',
    [...path, 'codeTheme'],
    issues
  );

  const resolved: ResolvedDeckStyle = {
    aspect: merged.aspect ?? DECK_STYLE_DEFAULTS.aspect,
    density: merged.density ?? DECK_STYLE_DEFAULTS.density,
    radius: merged.radius ?? DECK_STYLE_DEFAULTS.radius,
    motion: merged.motion ?? DECK_STYLE_DEFAULTS.motion,
    transition: merged.transition ?? DECK_STYLE_DEFAULTS.transition,
    background: merged.background ?? DECK_STYLE_DEFAULTS.background,
    slideNumbers: merged.slideNumbers ?? DECK_STYLE_DEFAULTS.slideNumbers,
    progress: merged.progress ?? DECK_STYLE_DEFAULTS.progress,
    math: merged.math ?? DECK_STYLE_DEFAULTS.math,
  };
  if (theme !== undefined) resolved.theme = theme;
  if (fontPair !== undefined) resolved.fontPair = fontPair;
  if (codeTheme !== undefined) resolved.codeTheme = codeTheme;
  if (merged.logo !== undefined) resolved.logo = merged.logo;
  if (merged.footer !== undefined) resolved.footer = merged.footer;

  const reduced = options.reducedMotion === true;
  const motion: DeckMotion = reduced && resolved.motion === 'full' ? 'subtle' : resolved.motion;
  const transition = resolveDeckTransition(resolved.transition, resolved.motion, reduced);
  const canvas = { ...DECK_CANVAS[resolved.aspect] };
  const background = resolved.background;

  const cssVars: Record<DeckCssVar, string> = {
    '--tx-deck-aspect-ratio': DECK_ASPECT_RATIOS[resolved.aspect],
    '--tx-deck-canvas-width': `${canvas.width}px`,
    '--tx-deck-canvas-height': `${canvas.height}px`,
    '--tx-deck-density': String(DECK_DENSITY_SCALE[resolved.density]),
    '--tx-deck-radius': DECK_RADIUS_VALUES[resolved.radius],
    '--tx-deck-motion': motion,
    '--tx-deck-transition': transition.name,
    '--tx-deck-transition-duration': `${transition.durationMs}ms`,
    // A preset id or the spec kind: enum keywords only, never an author string.
    '--tx-deck-background': isDeckBackgroundPreset(background)
      ? background
      : typeof background === 'object'
        ? background.kind
        : DECK_STYLE_DEFAULTS.background,
    '--tx-deck-progress': resolved.progress,
    '--tx-deck-slide-numbers': resolved.slideNumbers ? '1' : '0',
  };

  return {
    style: resolved,
    mode: resolveThemeMode(theme, options.hostMode),
    motion,
    transition,
    canvas,
    cssVars,
    issues,
  };
}
