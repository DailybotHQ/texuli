import { isSafeCssLength } from '../contract/css-safe.ts';
import type { SemanticPalette, SemanticRoleValue } from '../contract/semantic.ts';
import {
  type ColorModeName,
  DEFAULT_DENSITY,
  DEFAULT_FONT_MONO,
  DEFAULT_FONT_SANS,
  DEFAULT_RADIUS,
  DEFAULT_THEME_STYLE,
  type Theme,
  type ThemeChartTokens,
} from '../contract/types.ts';
import type { ChartPaletteInput, ChartTokens } from '../palette/charts.ts';
import { contrastRatio, parseHex, relativeLuminance } from '../palette/contrast.ts';
import { type Oklch, oklchToHex, rgbToOklch } from '../palette/oklch.ts';
import { checkThemeContrast } from './contrast.ts';

/** Neutral families for surfaces, text and borders; `tinted` takes the seed's hue. */
export const NEUTRAL_FAMILIES = [
  'zinc',
  'slate',
  'stone',
  'gray',
  'warm',
  'cool',
  'tinted',
] as const;
export type NeutralFamily = (typeof NEUTRAL_FAMILIES)[number];

const NEUTRAL_TINTS: Record<Exclude<NeutralFamily, 'tinted'>, { h: number; c: number }> = {
  zinc: { h: 286, c: 0.006 },
  slate: { h: 257, c: 0.02 },
  stone: { h: 56, c: 0.008 },
  gray: { h: 265, c: 0.012 },
  warm: { h: 70, c: 0.016 },
  cool: { h: 225, c: 0.016 },
};

/** Seeds below this OKLCH chroma are gray: their brand colors stay gray. */
const ACHROMATIC = 0.04;

export interface ThemeFromSeedOptions {
  /** The brand color, `#rgb` or `#rrggbb`. */
  seed: string;
  /** A second brand color for secondary fills and charts; the seed's own hue by default. */
  secondary?: string;
  /** Defaults to `generated-<seed hex>`. */
  id?: string;
  /** Defaults to `Generated <seed hex>`. */
  name?: string;
  description?: string;
  /** Surfaces, text and borders. Defaults to `zinc`. */
  neutral?: NeutralFamily;
  /** `AAA` searches every text pair to 7:1 instead of 4.5:1. */
  contrast?: 'AA' | 'AAA';
  /** A CSS length; defaults to the contract's radius. */
  radius?: string;
  /** 0.75–1.25; defaults to 1. */
  density?: number;
  /**
   * Embeds chart tokens: pass `deriveChartTokens` from `@texuli/tokens` to get
   * validated categorical, sequential and diverging colors in `theme.charts`.
   * Left out, the generator stays small and charts derive from the palette later.
   */
  deriveCharts?: (palette: ChartPaletteInput, mode: ColorModeName) => ChartTokens;
}

/** @internal A `#rgb` / `#rrggbb` color in OKLCH (throws otherwise); shared with the design-system solver. */
export function seedOklch(color: string, label: string): Oklch {
  const rgb = parseHex(color);
  if (!rgb) throw new TypeError(`${label} must be a #rgb or #rrggbb color, got "${color}".`);
  return rgbToOklch(rgb);
}

/** @internal Hex from OKLCH with the lightness clamped; shared with the design-system solver. */
export const hex = (l: number, c: number, h: number) =>
  oklchToHex({ l: Math.min(1, Math.max(0, l)), c, h });

/**
 * The first lightness from `start`, stepping toward black (`dir` -1) or white
 * (+1), whose color reaches `minimum` against every background. Black or
 * white always does at the end of the range.
 */
export function search(
  h: number,
  c: number,
  start: number,
  dir: 1 | -1,
  backgrounds: readonly string[],
  minimum: number
): string {
  for (let step = 0; step <= 100; step++) {
    const color = hex(start + dir * step * 0.01, c, h);
    if (backgrounds.every((background) => contrastRatio(color, background) >= minimum))
      return color;
  }
  return dir < 0 ? '#000000' : '#ffffff';
}

/** Moves a color's lightness by `amount` away from `from`, which only raises their contrast. */
function shiftAway(color: string, from: string, amount: number): string {
  const { l, c, h } = seedOklch(color, 'Color');
  const dir = relativeLuminance(from) > relativeLuminance(color) ? -1 : 1;
  return hex(l + dir * amount, c, h);
}

/** A fill and its text: the text that reads better, then the fill's lightness searched from `start`. */
function fill(h: number, c: number, start: number, minimum: number) {
  const base = hex(start, c, h);
  const foreground =
    contrastRatio('#ffffff', base) >= contrastRatio('#0a0a0a', base) ? '#ffffff' : '#0a0a0a';
  const color = search(h, c, start, foreground === '#ffffff' ? -1 : 1, [foreground], minimum);
  return { color, foreground };
}

/** @internal A fill's hover, active, disabled and focus states; shared with the design-system solver. */
export function interactive(
  color: string,
  against: string,
  disabledTowards: string,
  ring: string
): SemanticRoleValue {
  const { c, h } = seedOklch(color, 'Color');
  const target = seedOklch(disabledTowards, 'Color');
  const { l } = seedOklch(color, 'Color');
  return {
    default: color,
    hover: shiftAway(color, against, 0.05),
    active: shiftAway(color, against, 0.1),
    disabled: hex(l + (target.l - l) * 0.6, c * 0.3, h),
    focus: ring,
  };
}

function palette(
  mode: ColorModeName,
  brand: Oklch,
  secondaryHue: number,
  tint: { h: number; c: number },
  minimum: number
): SemanticPalette {
  const light = mode === 'light';
  const toText: 1 | -1 = light ? -1 : 1;
  const n = (lightL: number, darkL: number) => hex(light ? lightL : darkL, tint.c, tint.h);
  const canvas = n(0.97, 0.12);
  const background = n(0.99, 0.15);
  const surface = n(1, 0.2);
  const elevated = n(1, 0.25);
  const muted = n(0.965, 0.25);
  const subtle = n(0.935, 0.3);
  const sidebar = n(0.975, 0.18);
  const surfaces = [background, surface];
  const pageSurfaces = [background, surface, muted, elevated];
  const text = (backgrounds: string[], lightL: number, darkL: number, h = tint.h, c = tint.c * 2) =>
    search(h, c, light ? lightL : darkL, toText, backgrounds, minimum);
  const boundary = (lightL: number, darkL: number, h = tint.h, c = tint.c) =>
    search(h, c, light ? lightL : darkL, toText, surfaces, 3);

  const foreground = text([canvas, background, surface, elevated, muted, subtle], 0.2, 0.97);
  const mutedForeground = text([background, surface, muted, elevated], 0.5, 0.72);
  const subtleForeground = text([background, subtle], 0.42, 0.8);
  const sidebarForeground = text([sidebar], 0.26, 0.93);

  const gray = brand.c < ACHROMATIC;
  const brandC = gray ? brand.c : Math.min(brand.c, 0.22);
  const ring = search(brand.h, brandC, brand.l, toText, surfaces, 3);
  /**
   * Solid fill + on-fill text. When the fill also meets outline-ink AA on page
   * surfaces, keep it; otherwise darken/lighten until fill+ink both hold so
   * badge solids and outline tone text share one role.
   */
  const solidTone = (h: number, c: number, start: number, preferred?: string) => {
    const outlineSurfaces = [background, surface, muted, elevated];
    const onFill = (color: string) =>
      contrastRatio('#ffffff', color) >= contrastRatio('#0a0a0a', color) ? '#ffffff' : '#0a0a0a';
    const fillOk = (color: string) => contrastRatio(onFill(color), color) >= minimum;
    const inkOk = (color: string) =>
      outlineSurfaces.every((bg) => contrastRatio(color, bg) >= minimum);
    if (preferred && parseHex(preferred) && fillOk(preferred) && inkOk(preferred)) {
      return { color: preferred, foreground: onFill(preferred) };
    }
    // Prefer a dual-safe color (solid fill + outline ink on page surfaces).
    const base = fill(h, c, start, minimum);
    if (inkOk(base.color)) return base;
    const color = search(h, c, seedOklch(base.color, 'Color').l, toText, outlineSurfaces, minimum);
    const foreground = onFill(color);
    if (contrastRatio(foreground, color) >= minimum && inkOk(color)) {
      return { color, foreground };
    }
    const nudged = search(
      h,
      c,
      seedOklch(color, 'Color').l,
      foreground === '#ffffff' ? -1 : 1,
      [foreground, ...outlineSurfaces],
      minimum
    );
    return { color: nudged, foreground: onFill(nudged) };
  };
  const primaryStart = Math.min(0.75, Math.max(0.35, brand.l));
  const primaryPreferred = hex(brand.l, brandC, brand.h);
  const primary = solidTone(brand.h, brandC, primaryStart, primaryPreferred);
  const destructive = solidTone(27, 0.2, light ? 0.55 : 0.7);
  const success = solidTone(150, 0.16, light ? 0.55 : 0.7);
  const warning = solidTone(80, 0.16, light ? 0.55 : 0.7);
  const info = solidTone(250, 0.15, light ? 0.55 : 0.7);
  const soft = (h: number, c: number, lightL: number, darkL: number) => {
    const color = hex(light ? lightL : darkL, c, h);
    return { color, foreground: text([color], 0.22, 0.95, h, Math.min(c, 0.04)) };
  };
  /**
   * Soft tone surface for Alert/Callout: hosts body `foreground` and a tonal
   * title ink at the contrast floor (no CSS color-mix).
   */
  const toneSoft = (h: number, c: number) => {
    const softC = Math.min(c, 0.08);
    const softFill = (inks: readonly string[]) => {
      const start = light ? 0.97 : 0.22;
      for (let step = 0; step <= 100; step++) {
        const color = hex(start + (light ? -1 : 1) * step * 0.005, softC, h);
        if (inks.every((ink) => contrastRatio(ink, color) >= minimum)) return color;
      }
      return light ? '#f4f4f5' : '#27272a';
    };
    let color = softFill([foreground]);
    let ink = text([color], 0.28, 0.88, h, Math.min(c, 0.14));
    color = softFill([foreground, ink]);
    ink = text([color], 0.28, 0.88, h, Math.min(c, 0.14));
    color = softFill([foreground, ink]);
    return { color, foreground: ink };
  };
  const secondary = soft(secondaryHue, gray ? brand.c : 0.04, 0.93, 0.3);
  const accent = soft(brand.h, gray ? brand.c : 0.06, 0.95, 0.27);
  const selection = soft(brand.h, gray ? brand.c : 0.09, 0.87, 0.38);
  const primarySoft = toneSoft(brand.h, gray ? brand.c : brandC);
  const destructiveSoft = toneSoft(27, 0.14);
  const successSoft = toneSoft(150, 0.12);
  const warningSoft = toneSoft(80, 0.12);
  const infoSoft = toneSoft(250, 0.12);
  const link = text(pageSurfaces, 0.5, 0.75, brand.h, gray ? brand.c : Math.min(brand.c, 0.2));
  const linkVisited = text(pageSurfaces, 0.45, 0.78, (brand.h + 50) % 360, gray ? brand.c : 0.15);
  const input = boundary(0.62, 0.55);

  const fillRole = (pair: { color: string; foreground: string }) =>
    interactive(pair.color, pair.foreground, background, ring);
  const plain = (color: string): SemanticRoleValue => ({ default: color });
  return {
    background: plain(background),
    foreground: plain(foreground),
    surface: plain(surface),
    surfaceForeground: plain(foreground),
    elevated: plain(elevated),
    elevatedForeground: plain(foreground),
    muted: interactive(muted, mutedForeground, background, ring),
    mutedForeground: plain(mutedForeground),
    subtle: plain(subtle),
    subtleForeground: plain(subtleForeground),
    border: plain(n(0.91, 0.32)),
    borderStrong: plain(boundary(0.66, 0.6)),
    input: interactive(input, background, background, ring),
    ring: plain(ring),
    primary: fillRole(primary),
    primaryForeground: plain(primary.foreground),
    primarySoft: plain(primarySoft.color),
    primarySoftForeground: plain(primarySoft.foreground),
    secondary: fillRole(secondary),
    secondaryForeground: plain(secondary.foreground),
    accent: fillRole(accent),
    accentForeground: plain(accent.foreground),
    destructive: fillRole(destructive),
    destructiveForeground: plain(destructive.foreground),
    destructiveSoft: plain(destructiveSoft.color),
    destructiveSoftForeground: plain(destructiveSoft.foreground),
    success: fillRole(success),
    successForeground: plain(success.foreground),
    successSoft: plain(successSoft.color),
    successSoftForeground: plain(successSoft.foreground),
    warning: fillRole(warning),
    warningForeground: plain(warning.foreground),
    warningSoft: plain(warningSoft.color),
    warningSoftForeground: plain(warningSoft.foreground),
    info: fillRole(info),
    infoForeground: plain(info.foreground),
    infoSoft: plain(infoSoft.color),
    infoSoftForeground: plain(infoSoft.foreground),
    sidebar: plain(sidebar),
    sidebarForeground: plain(sidebarForeground),
    sidebarBorder: plain(n(0.91, 0.3)),
    sidebarPrimary: fillRole(primary),
    overlay: plain(light ? 'rgb(9 9 11 / 0.5)' : 'rgb(0 0 0 / 0.65)'),
    scrim: plain(light ? 'rgb(9 9 11 / 0.32)' : 'rgb(0 0 0 / 0.5)'),
    shadow: plain(light ? 'rgb(15 23 42 / 0.1)' : 'rgb(0 0 0 / 0.5)'),
    link: interactive(link, background, background, ring),
    linkVisited: plain(linkVisited),
    selection: plain(selection.color),
    selectionForeground: plain(selection.foreground),
    canvas: plain(canvas),
  };
}

/** The chart palette view the chart engine repairs: five series hues around the brand. */
function chartInput(
  p: SemanticPalette,
  mode: ColorModeName,
  brandHue: number,
  secondaryHue: number
): ChartPaletteInput {
  const l = mode === 'light' ? 0.58 : 0.72;
  const [chart1, chart2, chart3, chart4, chart5] = [
    brandHue,
    secondaryHue,
    brandHue + 90,
    brandHue + 180,
    brandHue + 270,
  ].map((h) => hex(l, 0.16, h % 360)) as [string, string, string, string, string];
  return {
    surface: p.surface.default,
    background: p.background.default,
    destructive: p.destructive.default,
    border: p.border.default,
    mutedForeground: p.mutedForeground.default,
    chart1,
    chart2,
    chart3,
    chart4,
    chart5,
  };
}

/**
 * A complete, validated light and dark theme from one brand color (and an
 * optional second one). Every text pair in `THEME_CONTRAST_PAIRS` reaches
 * 4.5:1 (7:1 with `contrast: 'AAA'`) and every boundary 3:1, in both modes
 * and in the hover and active states; the function throws rather than return
 * a theme that misses one. The same input always returns the same theme.
 */
export function generateThemeFromSeed(options: ThemeFromSeedOptions): Theme {
  const brand = seedOklch(options.seed, 'Seed');
  const secondary = options.secondary ? seedOklch(options.secondary, 'Secondary') : brand;
  const neutral = options.neutral ?? 'zinc';
  if (!NEUTRAL_FAMILIES.includes(neutral)) {
    throw new TypeError(
      `Unknown neutral family "${neutral}" (known: ${NEUTRAL_FAMILIES.join(', ')}).`
    );
  }
  const tint = neutral === 'tinted' ? { h: brand.h, c: 0.016 } : NEUTRAL_TINTS[neutral];
  const minimum = options.contrast === 'AAA' ? 7 : 4.5;
  const light = palette('light', brand, secondary.h, tint, minimum);
  const dark = palette('dark', brand, secondary.h, tint, minimum);
  const seedHex = oklchToHex(brand).slice(1);
  const id = options.id ?? `generated-${seedHex}`;
  const name = options.name ?? `Generated ${seedHex}`;
  const description =
    options.description ??
    `Generated from #${seedHex}${options.secondary ? ` and ${options.secondary}` : ''}.`;
  // The caller's fields follow the theme contract's own rules (validateTheme).
  if (!/^[a-z][a-z0-9-]*$/.test(id) || id.length > 64) {
    throw new TypeError(`Theme id "${id}" must be a lowercase kebab id of at most 64 characters.`);
  }
  if (!name || name.length > 40) throw new TypeError('Theme name must have 1–40 characters.');
  if (description.length > 200)
    throw new TypeError('Theme description must have at most 200 characters.');
  const radius = options.radius?.trim() ?? DEFAULT_RADIUS;
  if (!isSafeCssLength(radius))
    throw new TypeError(`Theme radius "${radius}" is not a CSS length.`);
  const density = options.density ?? DEFAULT_DENSITY;
  if (!(density >= 0.75 && density <= 1.25))
    throw new TypeError('Theme density must be 0.75–1.25.');
  const theme: Theme = {
    id,
    name,
    description,
    fontFamily: DEFAULT_FONT_SANS,
    fontFamilyMono: DEFAULT_FONT_MONO,
    radius,
    density,
    light,
    dark,
    style: structuredClone(DEFAULT_THEME_STYLE),
  };
  const { deriveCharts } = options;
  if (deriveCharts) {
    // The chart engine always returns 8 categorical and 9-step ramps: the contract's tuples.
    const derive = (mode: ColorModeName, p: SemanticPalette) =>
      deriveCharts(chartInput(p, mode, brand.h, secondary.h), mode) as unknown as ThemeChartTokens;
    theme.charts = { light: derive('light', light), dark: derive('dark', dark) };
  }
  const issues = checkThemeContrast(theme, { textMinimum: minimum });
  if (issues.length > 0) {
    const first = issues[0];
    throw new Error(
      `Generated theme misses contrast: ${first?.foreground} on ${first?.background} (${first?.mode}).`
    );
  }
  return theme;
}
