/**
 * Resolve a background against a palette into paint layers, a text tone and
 * `--tx-deck-bg-*` CSS variables, with the body-text guarantee: the text
 * color reaches WCAG AA (4.5:1) over everything behind it. Gradients are
 * checked at their stops and 15 points between each pair, patterns on their
 * base and their lines, media at the worst possible pixel (pure black and
 * pure white). When the background alone is not enough, a scrim (black under
 * light text, white under dark text) is added at the lowest alpha in 0.05
 * steps, up to 0.9, that works; an author `overlay` only ever raises it.
 *
 * Pure and deterministic. It never throws: an invalid background or an
 * unreadable palette color is reported in `issues` and replaced by a
 * documented fallback.
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type PathSegment,
  validate,
} from '../../schema/index.ts';
import {
  chooseInk,
  compositeOver,
  DECK_TEXT_CONTRAST_MIN,
  type InkChoice,
  opaqueColor,
  PURE_DARK,
  PURE_LIGHT,
  relativeLuminance,
  sampleGradient,
  type TextTone,
} from './contrast.ts';
import {
  BACKGROUND_CODES,
  DECK_BACKGROUND_PRESETS,
  DECK_GRADIENT_ANGLE,
  DECK_GRADIENTS,
  DECK_PALETTE_ROLES,
  DEFAULT_DECK_BACKGROUND,
  type DeckBackgroundKind,
  type DeckBackgroundPalette,
  type DeckBackgroundPresetId,
  type DeckBackgroundSpec,
  type DeckPaletteRole,
  type DeckPattern,
  type DeckSolidToken,
  deckBackground,
  isDeckBackgroundPreset,
} from './schema.ts';

/** Every CSS variable a background sets starts with this prefix. */
export const DECK_BG_VAR_PREFIX = '--tx-deck-bg-';
export type DeckBackgroundCssVar = `--tx-deck-bg-${string}`;

/** One paint layer, bottom to top. Colors are always computed `#rrggbb`. */
export type DeckBackgroundLayer =
  | { type: 'color'; color: string }
  | { type: 'gradient'; angle: number; stops: string[] }
  | { type: 'pattern'; pattern: DeckPattern; color: string; ink: string }
  | {
      type: 'media';
      media: 'image' | 'video';
      /** Syntax-checked only: the stage applies the URL policy at the host tier. */
      src: string;
      full: boolean;
      fit: 'cover' | 'contain';
      position: 'center' | 'top' | 'bottom' | 'left' | 'right';
      alt?: string;
      poster?: string;
      /** Background video is always muted, looping, inline and without controls. */
      muted?: true;
      autoplay?: true;
      loop?: true;
      playsInline?: true;
    }
  | { type: 'scrim'; color: string; alpha: number };

export interface ResolvedDeckBackground {
  kind: DeckBackgroundKind;
  /** The preset id, when the background came from one (or fell back to the default). */
  preset?: DeckBackgroundPresetId;
  /** Bottom to top: a base color, then the gradient, pattern or media, then the scrim. */
  layers: DeckBackgroundLayer[];
  /** `light` text on dark backgrounds, `dark` text on light ones. */
  textTone: TextTone;
  textColor: string;
  /** Scrim alpha: 0 to 0.9 in 0.05 steps (0 means none is painted). */
  scrim: number;
  /** Black under light text, white under dark text. */
  scrimColor: string;
  /** Worst-case contrast of `textColor` over the background and scrim, ≥ 4.5 (floored to 0.01). */
  contrast: number;
  /** `--tx-deck-bg-*` variables built only from computed colors, numbers and enum keywords. */
  cssVars: Record<DeckBackgroundCssVar, string>;
  /** Recovered problems (invalid background, unreadable palette colors). */
  issues: DeckDiagnostic[];
}

export interface ResolveDeckBackgroundOptions {
  /** Raise the body-text floor (values below 4.5 are ignored). */
  minimumContrast?: number;
  /** A prefix for issue paths, e.g. `['slides', 2, 'background']`. */
  path?: readonly PathSegment[];
  slideId?: string;
}

/** Any pixel of an image or video: the scrim must hold against both extremes. */
const ANY_PIXEL = [PURE_DARK, PURE_LIGHT] as const;
/** Points per gradient segment the guarantee is checked at. */
const GRADIENT_SAMPLES = 16;
/** Fade steps between the background (0) and the border (full strength) for pattern lines. */
const PATTERN_INK_STEPS = 20;

type Palette = Record<DeckPaletteRole | 'inverse', string>;

function normalizePalette(
  input: DeckBackgroundPalette,
  issues: DeckDiagnostic[],
  options: ResolveDeckBackgroundOptions
): Palette {
  const where = (role: string): PathSegment[] => [...(options.path ?? []), 'palette', role];
  const raw = (role: string): unknown =>
    input !== null && typeof input === 'object' && Object.hasOwn(input, role)
      ? (input as unknown as Record<string, unknown>)[role]
      : undefined;
  const bad = (role: string, fallback: string): void => {
    issues.push(
      createDiagnostic(
        BACKGROUND_CODES.invalidPaletteColor,
        `Palette role "${role}" is not a hex or rgb() color; using ${fallback}.`,
        where(role),
        { severity: 'warning', fix: 'Pass the role as #rrggbb.', slideId: options.slideId }
      )
    );
  };
  let background = opaqueColor(raw('background'), PURE_LIGHT);
  if (!background) {
    background = PURE_LIGHT;
    bad('background', background);
  }
  const out = { background } as Palette;
  for (const role of DECK_PALETTE_ROLES) {
    if (role === 'background') continue;
    const color = opaqueColor(raw(role), background);
    if (color) out[role] = color;
    else {
      // Foreground falls back to the pure ink that reads on the background; the rest to the background.
      const fallback =
        role === 'foreground'
          ? relativeLuminance(background) > 0.179
            ? PURE_DARK
            : PURE_LIGHT
          : background;
      bad(role, fallback);
      out[role] = fallback;
    }
  }
  const inverse = raw('inverse');
  if (inverse === undefined) out.inverse = out.foreground;
  else {
    const color = opaqueColor(inverse, background);
    if (!color) bad('inverse', out.foreground);
    out.inverse = color ?? out.foreground;
  }
  return out;
}

/** The theme's text-bearing pair, as the light and the dark ink. */
function themeInks(palette: Palette): { light: string; dark: string } {
  const fg = palette.foreground;
  const bg = palette.background;
  return relativeLuminance(fg) >= relativeLuminance(bg)
    ? { light: fg, dark: bg }
    : { light: bg, dark: fg };
}

/**
 * The line color of a dot or grid pattern: the theme `border`, faded toward
 * the base only as far as text stays at AA on the lines without any scrim
 * (a pattern paints none). Strong 3:1 borders would otherwise be as dark as text.
 */
function patternInk(base: string, border: string, inks: { light: string; dark: string }): string {
  for (let step = PATTERN_INK_STEPS; step > 0; step -= 1) {
    const ink =
      step === PATTERN_INK_STEPS ? border : compositeOver(base, border, step / PATTERN_INK_STEPS);
    if (chooseInk([base, ink], inks).scrim === 0) return ink;
  }
  return base;
}

function solidColor(token: DeckSolidToken, palette: Palette): string {
  return palette[token];
}

function pickSpec(
  input: unknown,
  issues: DeckDiagnostic[],
  options: ResolveDeckBackgroundOptions
): { spec: DeckBackgroundSpec; preset?: DeckBackgroundPresetId } {
  if (input === undefined) {
    return {
      spec: DECK_BACKGROUND_PRESETS[DEFAULT_DECK_BACKGROUND],
      preset: DEFAULT_DECK_BACKGROUND,
    };
  }
  if (isDeckBackgroundPreset(input)) return { spec: DECK_BACKGROUND_PRESETS[input], preset: input };
  const checked = validate(deckBackground, input, { path: options.path ?? [], maxIssues: 20 });
  if (checked.ok && typeof checked.value === 'object') return { spec: checked.value };
  for (const issue of checked.issues) {
    issues.push(options.slideId === undefined ? issue : { ...issue, slideId: options.slideId });
  }
  // The validation issues explain the problem; the fallback is documented, not repeated.
  if (checked.issues.length > 0) {
    return {
      spec: DECK_BACKGROUND_PRESETS[DEFAULT_DECK_BACKGROUND],
      preset: DEFAULT_DECK_BACKGROUND,
    };
  }
  issues.push(
    createDiagnostic(
      BACKGROUND_CODES.unknownBackground,
      `The background is not valid; using ${DEFAULT_DECK_BACKGROUND}.`,
      options.path ?? [],
      {
        fix: `Use a preset id or a background spec (${DEFAULT_DECK_BACKGROUND} is the default).`,
        slideId: options.slideId,
      }
    )
  );
  return {
    spec: DECK_BACKGROUND_PRESETS[DEFAULT_DECK_BACKGROUND],
    preset: DEFAULT_DECK_BACKGROUND,
  };
}

/**
 * Resolve `background` (a preset id, a spec, or `undefined` for the default
 * `solid-color`) against `palette` (semantic role → hex, see
 * `DeckBackgroundPalette`).
 */
export function resolveDeckBackground(
  background: unknown,
  palette: DeckBackgroundPalette,
  options: ResolveDeckBackgroundOptions = {}
): ResolvedDeckBackground {
  const issues: DeckDiagnostic[] = [];
  const colors = normalizePalette(palette, issues, options);
  const { spec, preset } = pickSpec(background, issues, options);
  const inks = themeInks(colors);
  const minimum = Math.max(DECK_TEXT_CONTRAST_MIN, options.minimumContrast ?? 0);
  const layers: DeckBackgroundLayer[] = [];
  const cssVars: Record<DeckBackgroundCssVar, string> = {};
  let base: string;
  let choice: InkChoice;

  switch (spec.kind) {
    case 'solid': {
      base = spec.color ? spec.color.toLowerCase() : solidColor(spec.token ?? 'background', colors);
      layers.push({ type: 'color', color: base });
      choice = chooseInk([base], inks, { minimum });
      break;
    }
    case 'gradient': {
      const stops = DECK_GRADIENTS[spec.gradient].map((role) => colors[role]);
      const angle = spec.angle ?? DECK_GRADIENT_ANGLE;
      base = stops[0] as string;
      layers.push({ type: 'color', color: base }, { type: 'gradient', angle, stops });
      choice = chooseInk(sampleGradient(stops, GRADIENT_SAMPLES), inks, { minimum });
      cssVars['--tx-deck-bg-gradient'] = `linear-gradient(${angle}deg, ${stops.join(', ')})`;
      break;
    }
    case 'pattern': {
      base = colors.background;
      const ink = patternInk(base, colors.border, inks);
      layers.push(
        { type: 'color', color: base },
        { type: 'pattern', pattern: spec.pattern, color: base, ink }
      );
      choice = chooseInk([base, ink], inks, { minimum });
      cssVars['--tx-deck-bg-pattern'] = spec.pattern;
      cssVars['--tx-deck-bg-pattern-ink'] = ink;
      break;
    }
    default: {
      // image, image-full, video, video-full: light text over a dark scrim unless declared light.
      const forced: TextTone = spec.tone === 'light' ? 'dark' : 'light';
      base = forced === 'light' ? PURE_DARK : PURE_LIGHT;
      const isVideo = spec.kind === 'video' || spec.kind === 'video-full';
      const fit = 'fit' in spec && spec.fit ? spec.fit : 'cover';
      const position = spec.position ?? 'center';
      layers.push(
        { type: 'color', color: base },
        {
          type: 'media',
          media: isVideo ? 'video' : 'image',
          src: spec.src,
          full: spec.kind.endsWith('-full'),
          fit,
          position,
          ...('alt' in spec && spec.alt ? { alt: spec.alt } : {}),
          ...('poster' in spec && spec.poster ? { poster: spec.poster } : {}),
          ...(isVideo
            ? { muted: true, autoplay: true, loop: true, playsInline: true }
            : ({} as Record<string, never>)),
        }
      );
      choice = chooseInk(ANY_PIXEL, inks, {
        forced,
        minimumScrim: spec.overlay ?? 0,
        minimum,
      });
      cssVars['--tx-deck-bg-media-fit'] = fit;
      cssVars['--tx-deck-bg-media-position'] = position;
      break;
    }
  }

  if (choice.scrim > 0)
    layers.push({ type: 'scrim', color: choice.scrimColor, alpha: choice.scrim });
  const ordered: Record<DeckBackgroundCssVar, string> = {
    '--tx-deck-bg-color': base,
    '--tx-deck-bg-text': choice.ink,
    '--tx-deck-bg-tone': choice.tone,
    '--tx-deck-bg-scrim': choice.scrim > 0 ? choice.scrimColor : 'transparent',
    '--tx-deck-bg-scrim-alpha': String(choice.scrim),
    ...cssVars,
  };

  return {
    kind: spec.kind,
    ...(preset ? { preset } : {}),
    layers,
    textTone: choice.tone,
    textColor: choice.ink,
    scrim: choice.scrim,
    scrimColor: choice.scrimColor,
    contrast: Math.floor(choice.contrast * 100) / 100,
    cssVars: ordered,
    issues,
  };
}
