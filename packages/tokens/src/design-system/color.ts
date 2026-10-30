/**
 * Colors of a design-system document: `#rgb`, `#rrggbb`, `#rrggbbaa` and a
 * numeric `oklch(L C H[ / A])` (the spec's closed form), parsed to an sRGB
 * hex for contrast math. The authored string is what the compiler emits; the
 * hex is gamut-mapped (`oklchToHex`) and translucent colors are composited
 * over their surface before a ratio is taken.
 */

import { contrastRatio, parseHex } from '../palette/contrast.ts';
import { oklchToHex } from '../palette/oklch.ts';

export interface ParsedColor {
  /** `#rrggbb`, lowercase. */
  hex: string;
  /** 0–1. */
  alpha: number;
}

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/i;
const RGB = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[/,]\s*([\d.]+)(%?)\s*)?\)$/i;

const fraction = (value: string | undefined, percent: string | undefined): number =>
  value === undefined ? 1 : Math.min(1, Math.max(0, Number(value) / (percent ? 100 : 1)));

const byte = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');

/** Parse a document color (and `rgb()`, which themes use for overlays); `undefined` when unknown. */
export function parseDsColor(value: string): ParsedColor | undefined {
  if (typeof value !== 'string') return;
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return {
      hex: `#${full.slice(0, 6).toLowerCase()}`,
      alpha: full.length === 8 ? Number.parseInt(full.slice(6), 16) / 255 : 1,
    };
  }
  const oklch = OKLCH.exec(v);
  if (oklch) {
    const l = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    return {
      hex: oklchToHex({ l, c: Number(oklch[3]), h: Number(oklch[4]) }),
      alpha: fraction(oklch[5], oklch[6]),
    };
  }
  const rgb = RGB.exec(v);
  if (rgb) {
    return {
      hex: `#${byte(Number(rgb[1]))}${byte(Number(rgb[2]))}${byte(Number(rgb[3]))}`,
      alpha: fraction(rgb[4], rgb[5]),
    };
  }
}

/** The opaque color a translucent `color` shows over `under` (both `#rrggbb`). */
export function composite(color: ParsedColor, under: string): string {
  if (color.alpha >= 1) return color.hex;
  const top = parseHex(color.hex) as [number, number, number];
  const bottom = parseHex(under) ?? [255, 255, 255];
  return `#${top.map((c, i) => byte(c * color.alpha + (bottom[i] as number) * (1 - color.alpha))).join('')}`;
}

/**
 * A theme color in the document's closed form, or `undefined` when it has
 * none: hex and numeric `oklch()` stay as written; `rgb()` becomes
 * `#rrggbb[aa]`.
 */
export function toDocColor(value: string): string | undefined {
  const v = value.trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return v;
  if (OKLCH.test(v) && /^oklch\([\d.%/ ]+\)$/.test(v)) return v;
  if (!RGB.test(v)) return;
  const parsed = parseDsColor(v) as ParsedColor;
  return parsed.alpha >= 1 ? parsed.hex : `${parsed.hex}${byte(parsed.alpha * 255)}`;
}

/** The better of white and near-black on `fill`, falling back to pure black or white. */
export function onColor(fill: string, minimum: number): string {
  const light = contrastRatio('#ffffff', fill);
  const dark = contrastRatio('#0a0a0a', fill);
  if (Math.max(light, dark) >= minimum || light >= dark)
    return light >= dark ? '#ffffff' : '#0a0a0a';
  return '#000000';
}
