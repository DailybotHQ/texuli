/**
 * Typed inline styles for email (ADR-016). No CSS parser and no free-form
 * CSS: a style is an object over a closed property allowlist, every value
 * is checked against its property's grammar (colors are concrete sRGB hex,
 * lengths are bounded pixels or percents, keywords come from closed sets),
 * and the serializer refuses anything else. The result goes into an
 * escaped `style` attribute through `@texuli/core/markup`.
 */
import type { Theme } from '@texuli/tokens/build';
import { oklchToHex } from '@texuli/tokens/palette';

/** The CSS properties an email style may set. */
export const EMAIL_STYLE_PROPERTIES = [
  'background-color',
  'border',
  'border-bottom',
  'border-collapse',
  'border-left',
  'border-radius',
  'border-right',
  'border-top',
  'color',
  'display',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'letter-spacing',
  'line-height',
  'margin',
  'max-width',
  'mso-hide',
  'opacity',
  'overflow',
  'padding',
  'text-align',
  'text-decoration',
  'vertical-align',
  'white-space',
  'width',
  'word-break',
] as const;
export type EmailStyleProperty = (typeof EMAIL_STYLE_PROPERTIES)[number];

/** A typed style: property → value. Numbers are pixels (unitless for `line-height`, `opacity` and `font-weight`). */
export type EmailStyle = Partial<Record<EmailStyleProperty, string | number>>;

const HEX = /^#[0-9a-f]{6}$/;
const LENGTH = /^(?:0|\d{1,4}(?:\.\d{1,2})?(?:px|%))$/;
const LENGTHS = /^(?:0|\d{1,4}(?:\.\d{1,2})?px)(?: (?:0|\d{1,4}(?:\.\d{1,2})?px)){0,3}$/;
const BORDER = /^(?:0|\d{1,2}px (?:solid|dashed|dotted) #[0-9a-f]{6})$/;
/** Font stacks: names of letters, digits, spaces and `-`, optionally quoted, comma-separated. */
const FONT_FAMILY =
  /^(?:"[A-Za-z0-9 -]{1,40}"|[A-Za-z0-9 -]{1,40})(?:, ?(?:"[A-Za-z0-9 -]{1,40}"|[A-Za-z0-9 -]{1,40})){0,7}$/;

const KEYWORDS: Partial<Record<EmailStyleProperty, ReadonlySet<string>>> = {
  'border-collapse': new Set(['collapse', 'separate']),
  display: new Set(['block', 'inline-block', 'none', 'table', 'inline']),
  'font-style': new Set(['normal', 'italic']),
  'font-weight': new Set(['400', '500', '600', '700', 'normal', 'bold']),
  'mso-hide': new Set(['all']),
  overflow: new Set(['hidden']),
  'text-align': new Set(['left', 'right', 'center']),
  'text-decoration': new Set(['none', 'underline', 'line-through']),
  'vertical-align': new Set(['top', 'middle', 'bottom']),
  'white-space': new Set(['pre-wrap', 'nowrap', 'normal']),
  'word-break': new Set(['break-word', 'break-all']),
};

function checkValue(property: EmailStyleProperty, value: string | number): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > 10_000) return null;
    const rounded = Math.round(value * 100) / 100;
    if (property === 'line-height' || property === 'opacity' || property === 'font-weight') {
      return String(rounded);
    }
    return rounded === 0 ? '0' : `${rounded}px`;
  }
  const keywords = KEYWORDS[property];
  if (keywords) return keywords.has(value) ? value : null;
  switch (property) {
    case 'color':
    case 'background-color':
      return HEX.test(value) ? value : null;
    case 'border':
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left':
      return BORDER.test(value) ? value : null;
    case 'padding':
    case 'margin':
      return LENGTHS.test(value) ? value : null;
    case 'font-family':
      return FONT_FAMILY.test(value) ? value : null;
    default:
      return LENGTH.test(value) ? value : null;
  }
}

/**
 * Serialize a typed style to a declaration list. Throws on a property
 * outside the allowlist or a value outside its grammar: styles are written
 * by this module, so a refusal is a bug, never content.
 */
export function serializeEmailStyle(style: EmailStyle): string {
  const allowed = EMAIL_STYLE_PROPERTIES as readonly string[];
  const parts: string[] = [];
  for (const [property, value] of Object.entries(style)) {
    if (value === undefined) continue;
    if (!allowed.includes(property))
      throw new TypeError(`Email style property not allowed: ${property}`);
    const checked = checkValue(property as EmailStyleProperty, value);
    if (checked === null) throw new TypeError(`Email style value refused for ${property}`);
    parts.push(`${property}:${checked}`);
  }
  return parts.join(';');
}

/** The resolved sRGB colors an email paints with. */
export interface EmailPalette {
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  primary: string;
  primaryForeground: string;
  link: string;
  infoSoft: string;
  infoSoftForeground: string;
  successSoft: string;
  successSoftForeground: string;
  warningSoft: string;
  warningSoftForeground: string;
  destructiveSoft: string;
  destructiveSoftForeground: string;
}

/** The default palette (light): neutral, AA contrast for text on each surface. */
export const DEFAULT_EMAIL_PALETTE: Readonly<EmailPalette> = Object.freeze({
  background: '#f4f4f5',
  surface: '#ffffff',
  foreground: '#18181b',
  muted: '#52525b',
  border: '#d4d4d8',
  primary: '#1d4ed8',
  primaryForeground: '#ffffff',
  link: '#1d4ed8',
  infoSoft: '#e0ecff',
  infoSoftForeground: '#1e3a8a',
  successSoft: '#dcfce7',
  successSoftForeground: '#14532d',
  warningSoft: '#fef3c7',
  warningSoftForeground: '#713f12',
  destructiveSoft: '#fee2e2',
  destructiveSoftForeground: '#7f1d1d',
});

const PALETTE_ROLES: Readonly<Record<keyof EmailPalette, string>> = {
  background: 'background',
  surface: 'surface',
  foreground: 'foreground',
  muted: 'mutedForeground',
  border: 'border',
  primary: 'primary',
  primaryForeground: 'primaryForeground',
  link: 'link',
  infoSoft: 'infoSoft',
  infoSoftForeground: 'infoSoftForeground',
  successSoft: 'successSoft',
  successSoftForeground: 'successSoftForeground',
  warningSoft: 'warningSoft',
  warningSoftForeground: 'warningSoftForeground',
  destructiveSoft: 'destructiveSoft',
  destructiveSoftForeground: 'destructiveSoftForeground',
};

function channel(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, '0');
}

/**
 * A theme color as concrete sRGB `#rrggbb`: `#rgb`, `#rrggbb`, `rgb(…)`
 * and `oklch(…)` (gamut-mapped by `oklchToHex`) resolve; anything else
 * (custom properties, `color-mix`, keywords) is `null`, because mail
 * clients have neither OKLCH nor custom properties.
 */
export function toSrgbHex(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 80) return null;
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${[...color.slice(1)].map((digit) => digit + digit).join('')}`;
  }
  const rgb =
    /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(color);
  if (rgb) return `#${channel(Number(rgb[1]))}${channel(Number(rgb[2]))}${channel(Number(rgb[3]))}`;
  const oklch =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/.exec(color);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] === '%' ? 100 : 1);
    const chroma = Number(oklch[3]);
    const hue = Number(oklch[4]);
    if (![lightness, chroma, hue].every(Number.isFinite)) return null;
    try {
      return oklchToHex({ l: lightness, c: chroma, h: hue });
    } catch {
      return null;
    }
  }
  return null;
}

/** Resolve a theme's `--tx-*` roles for one mode to sRGB; unresolvable roles keep the default. */
export function resolveEmailPalette(
  theme?: Theme | null,
  mode: 'light' | 'dark' = 'light'
): EmailPalette {
  const palette: EmailPalette = { ...DEFAULT_EMAIL_PALETTE };
  const roles = theme?.[mode] as Record<string, { default?: unknown } | undefined> | undefined;
  if (!roles) return palette;
  for (const key of Object.keys(PALETTE_ROLES) as (keyof EmailPalette)[]) {
    const resolved = toSrgbHex(roles[PALETTE_ROLES[key]]?.default);
    if (resolved) palette[key] = resolved;
  }
  return palette;
}

/** A safe font stack from a theme's `fontFamily`, else the system stack. */
export function emailFontFamily(theme?: Theme | null): string {
  const system = 'Arial, Helvetica, sans-serif';
  const requested = theme?.fontFamily?.replace(/'/g, '"');
  if (!requested) return system;
  const names = requested
    .split(',')
    .map((name) => name.trim())
    .filter((name) => /^(?:"[A-Za-z0-9 -]{1,40}"|[A-Za-z0-9 -]{1,40})$/.test(name))
    .slice(0, 5);
  return names.length > 0 ? `${names.join(', ')}, ${system}` : system;
}
