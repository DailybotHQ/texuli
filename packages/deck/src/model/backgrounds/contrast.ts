/**
 * WCAG 2.x contrast math for deck backgrounds, on sRGB hex colors only.
 *
 * Every function here is pure and framework-free. Inputs are `#rgb` or
 * `#rrggbb` (and, through `opaqueColor`, `rgb()`/`rgba()` composited over a
 * base); `oklch()` and other color spaces are converted by the caller (the
 * stage reads them from `@texuli/tokens`). Outputs are always lowercase
 * `#rrggbb`, so a computed color can go into CSS without escaping.
 */

/** WCAG AA for normal-size body text: the floor every background guarantees. */
export const DECK_TEXT_CONTRAST_MIN = 4.5;

/** Scrim alphas move in steps of 0.05 … */
export const DECK_SCRIM_STEP = 0.05;
/** … up to 0.9 (an image or video always stays faintly visible). */
export const DECK_SCRIM_MAX = 0.9;

/** Light ink and the scrim under it; dark ink and the scrim under it. */
export const PURE_LIGHT = '#ffffff';
export const PURE_DARK = '#000000';

export type TextTone = 'light' | 'dark';
export type Rgb = readonly [number, number, number];

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/** `#rgb` or `#rrggbb` (any case, surrounding spaces ignored) as 0–255 channels; anything else is `null`. */
export function parseHexColor(color: unknown): Rgb | null {
  if (typeof color !== 'string' || color.length > 16) return null;
  const value = color.trim();
  let hex: string;
  const long = HEX6.exec(value);
  if (long) hex = long[1] as string;
  else {
    const short = HEX3.exec(value);
    if (!short) return null;
    hex = [...(short[1] as string)].map((c) => c + c).join('');
  }
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
}

const byte = (n: number): string =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');

/** Channels → lowercase `#rrggbb` (channels are clamped and rounded). */
export function toHex(rgb: Rgb): string {
  return `#${rgb.map(byte).join('')}`;
}

/** A hex color in its canonical form (`#rrggbb`, lowercase), or `null`. */
export function normalizeHex(color: unknown): string | null {
  const rgb = parseHexColor(color);
  return rgb ? toHex(rgb) : null;
}

/** sRGB → linear light (the IEC 61966-2-1 threshold; no 8-bit value differs from WCAG's 0.03928). */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function requireHex(color: string, fn: string): Rgb {
  const rgb = parseHexColor(color);
  if (!rgb) throw new TypeError(`${fn}(): expected a hex color, got ${JSON.stringify(color)}.`);
  return rgb;
}

/** WCAG relative luminance (0 for black, 1 for white). Throws `TypeError` on a non-hex color. */
export function relativeLuminance(color: string): number {
  const [r, g, b] = requireHex(color, 'relativeLuminance');
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio, 1 to 21, order independent. Throws `TypeError` on a non-hex color. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** `top` over `base` at `alpha` (0–1), composited in sRGB as browsers paint it. */
export function compositeOver(base: string, top: string, alpha: number): string {
  const b = requireHex(base, 'compositeOver');
  const t = requireHex(top, 'compositeOver');
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 0;
  return toHex([0, 1, 2].map((i) => (b[i] as number) * (1 - a) + (t[i] as number) * a) as never);
}

const RGB =
  /^rgba?\(\s*(\d{1,3})\s*[\s,]\s*(\d{1,3})\s*[\s,]\s*(\d{1,3})\s*(?:[,/]\s*(\d{0,3}(?:\.\d{1,6})?)(%?)\s*)?\)$/i;

/**
 * A palette color as an opaque hex: hex passes through (canonicalized),
 * `rgb()`/`rgba()` is composited over `base` (dark-mode borders carry alpha).
 * Anything else is `null`, so the contrast math never guesses at a color.
 */
export function opaqueColor(color: unknown, base: string): string | null {
  const hex = normalizeHex(color);
  if (hex) return hex;
  if (typeof color !== 'string' || color.length > 64) return null;
  const match = RGB.exec(color.trim());
  if (!match) return null;
  const rgb = [match[1], match[2], match[3]].map((n) => Math.min(255, Number(n))) as never as Rgb;
  const raw = match[4];
  let alpha = 1;
  if (raw !== undefined && raw !== '') {
    alpha = Number(raw) / (match[5] === '%' ? 100 : 1);
    if (!Number.isFinite(alpha)) return null;
  }
  return compositeOver(base, toHex(rgb), alpha);
}

/** Points along a linear sRGB gradient: every stop and `perSegment - 1` points between each pair. */
export function sampleGradient(stops: readonly string[], perSegment = 16): string[] {
  const steps = Math.max(1, Math.min(256, Math.floor(perSegment)));
  const out: string[] = [];
  stops.forEach((stop, i) => {
    out.push(toHex(requireHex(stop, 'sampleGradient')));
    const next = stops[i + 1];
    if (next === undefined) return;
    for (let k = 1; k < steps; k++) out.push(compositeOver(stop, next, k / steps));
  });
  return out;
}

/** The lowest contrast of `ink` over any of `backgrounds` (21 for an empty list). */
export function worstContrast(ink: string, backgrounds: readonly string[]): number {
  let worst = 21;
  for (const background of backgrounds) worst = Math.min(worst, contrastRatio(ink, background));
  return worst;
}

/** Round to the scrim grid (0.05) without float noise. */
const stepAlpha = (step: number): number => Math.round(step * DECK_SCRIM_STEP * 100) / 100;
const MAX_STEP = Math.round(DECK_SCRIM_MAX / DECK_SCRIM_STEP);

/** The first scrim step at or above `alpha` (an author overlay is never weakened). */
export function scrimStepFor(alpha: number): number {
  if (!Number.isFinite(alpha) || alpha <= 0) return 0;
  return Math.min(MAX_STEP, Math.ceil(alpha / DECK_SCRIM_STEP - 1e-9));
}

export interface InkChoice {
  tone: TextTone;
  ink: string;
  /** Black under light ink, white under dark ink. */
  scrimColor: string;
  /** 0 to 0.9 in 0.05 steps; 0 means no scrim is painted. */
  scrim: number;
  /** Worst-case contrast of `ink` over every background with the scrim, ≥ `minimum`. */
  contrast: number;
}

/**
 * The lowest scrim (in 0.05 steps, from `minimumScrim` up to 0.9) under which
 * `ink` reaches `minimum` over every background, or `null` when none does.
 */
export function inkWithScrim(
  tone: TextTone,
  ink: string,
  backgrounds: readonly string[],
  minimumScrim = 0,
  minimum = DECK_TEXT_CONTRAST_MIN
): InkChoice | null {
  const scrimColor = tone === 'light' ? PURE_DARK : PURE_LIGHT;
  for (let step = scrimStepFor(minimumScrim); step <= MAX_STEP; step++) {
    const alpha = stepAlpha(step);
    const seen =
      alpha === 0 ? backgrounds : backgrounds.map((bg) => compositeOver(bg, scrimColor, alpha));
    const contrast = worstContrast(ink, seen);
    if (contrast >= minimum) return { tone, ink, scrimColor, scrim: alpha, contrast };
  }
  return null;
}

export interface ChooseInkOptions {
  /** Only this tone (an image declared dark or light). */
  forced?: TextTone;
  /** The author's overlay: the scrim never goes below it. */
  minimumScrim?: number;
  /** The contrast floor; values below 4.5 are raised to 4.5. */
  minimum?: number;
}

/**
 * The ink for a set of backgrounds. Each tone tries the theme ink first and
 * pure white or black second; the choice needs the lightest scrim, then
 * prefers the theme ink, then the higher contrast. Pure ink over a 0.9 scrim
 * always clears AA (about 15:1 against any pixel), so a result always exists.
 */
export function chooseInk(
  backgrounds: readonly string[],
  inks: { light: string; dark: string },
  options: ChooseInkOptions = {}
): InkChoice {
  const minimum = Math.max(DECK_TEXT_CONTRAST_MIN, Math.min(21, options.minimum ?? 0));
  const tones: TextTone[] = options.forced ? [options.forced] : ['light', 'dark'];
  let best: { choice: InkChoice; themed: boolean } | undefined;
  for (const tone of tones) {
    const pure = tone === 'light' ? PURE_LIGHT : PURE_DARK;
    const themeInk = normalizeHex(inks[tone]) ?? pure;
    const candidates = themeInk === pure ? [pure] : [themeInk, pure];
    for (const ink of candidates) {
      const choice = inkWithScrim(tone, ink, backgrounds, options.minimumScrim ?? 0, minimum);
      if (!choice) continue;
      const themed = ink !== pure;
      const better =
        !best ||
        choice.scrim < best.choice.scrim ||
        (choice.scrim === best.choice.scrim &&
          ((themed && !best.themed) ||
            (themed === best.themed && choice.contrast > best.choice.contrast)));
      if (better) best = { choice, themed };
    }
  }
  if (best) return best.choice;
  // Only reachable with a `minimum` above what a 0.9 scrim allows: report the strongest attempt.
  const tone = options.forced ?? 'light';
  const ink = tone === 'light' ? PURE_LIGHT : PURE_DARK;
  const scrimColor = tone === 'light' ? PURE_DARK : PURE_LIGHT;
  const seen = backgrounds.map((bg) => compositeOver(bg, scrimColor, DECK_SCRIM_MAX));
  return { tone, ink, scrimColor, scrim: DECK_SCRIM_MAX, contrast: worstContrast(ink, seen) };
}
