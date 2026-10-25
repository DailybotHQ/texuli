/**
 * Name/meta → OKLCH hue family ranges for library seed honesty.
 * Used by the quality guard so a "teal" theme cannot ship a pink primary.
 */

export type HueFamilyId =
  | 'red'
  | 'orange'
  | 'amber'
  | 'olive'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'pink'
  | 'magenta'
  | 'slate'
  | 'gray'
  | 'brown'
  | 'black'
  | 'any';

/** Inclusive hue arcs on the OKLCH wheel (0–360). */
export type HueArc = { readonly start: number; readonly end: number };

/** Wide arcs — brand seeds often sit near family borders in OKLCH. */
export const HUE_FAMILY_ARCS: Readonly<Record<HueFamilyId, readonly HueArc[]>> = {
  red: [
    { start: 0, end: 50 },
    { start: 345, end: 360 },
  ],
  orange: [{ start: 20, end: 85 }],
  amber: [{ start: 40, end: 115 }],
  olive: [{ start: 85, end: 175 }],
  green: [{ start: 110, end: 185 }],
  teal: [{ start: 150, end: 235 }],
  cyan: [{ start: 170, end: 250 }],
  sky: [{ start: 190, end: 270 }],
  blue: [{ start: 215, end: 295 }],
  indigo: [{ start: 245, end: 315 }],
  violet: [{ start: 260, end: 335 }],
  purple: [{ start: 275, end: 350 }],
  pink: [
    { start: 315, end: 360 },
    { start: 0, end: 40 },
  ],
  magenta: [
    { start: 295, end: 360 },
    { start: 0, end: 30 },
  ],
  brown: [{ start: 25, end: 105 }],
  slate: [{ start: 195, end: 295 }],
  gray: [{ start: 0, end: 360 }],
  black: [{ start: 0, end: 360 }],
  any: [{ start: 0, end: 360 }],
};

/** Exact id/name segments that map to a family (single words). */
export const SEGMENT_FAMILY: Readonly<Record<string, HueFamilyId>> = {
  // pure colors
  red: 'red',
  crimson: 'red',
  scarlet: 'red',
  ember: 'red',
  rose: 'pink',
  pink: 'pink',
  blush: 'pink',
  coral: 'red',
  magenta: 'magenta',
  fuchsia: 'magenta',
  orange: 'orange',
  citrus: 'orange',
  peach: 'orange',
  copper: 'orange',
  terracotta: 'orange',
  rust: 'orange',
  clay: 'orange',
  amber: 'amber',
  gold: 'amber',
  saffron: 'amber',
  honey: 'amber',
  yellow: 'amber',
  sand: 'amber',
  olive: 'olive',
  lime: 'olive',
  green: 'green',
  emerald: 'green',
  forest: 'green',
  fern: 'green',
  moss: 'green',
  ivy: 'green',
  climate: 'green',
  earth: 'green',
  volt: 'green',
  teal: 'teal',
  cyan: 'cyan',
  sky: 'sky',
  azure: 'sky',
  glacier: 'sky',
  arctic: 'sky',
  polar: 'sky',
  frost: 'sky',
  winter: 'sky',
  blue: 'blue',
  navy: 'blue',
  cobalt: 'blue',
  denim: 'blue',
  indigo: 'indigo',
  violet: 'violet',
  purple: 'purple',
  plum: 'purple',
  // neutrals / product cues
  slate: 'slate',
  graphite: 'slate',
  steel: 'slate',
  iron: 'slate',
  charcoal: 'slate',
  ink: 'slate',
  ash: 'gray',
  smoke: 'gray',
  fog: 'gray',
  silver: 'gray',
  mono: 'gray',
  monochrome: 'gray',
  minimal: 'slate',
  brown: 'brown',
  umber: 'brown',
  sepia: 'brown',
  soil: 'brown',
  loam: 'brown',
  bark: 'brown',
  cedar: 'brown',
  // product / brand cues with known seeds
  harbor: 'teal',
  midnight: 'cyan',
  clinic: 'teal',
  health: 'green',
  crypto: 'blue',
  aurora: 'violet',
  orbit: 'indigo',
  pixel: 'violet',
  forge: 'violet',
  quartz: 'pink',
  mute: 'gray',
  summit: 'teal',
  glass: 'blue',
  brutalist: 'black',
  phosphor: 'amber',
  signal: 'cyan',
  vector: 'sky',
  northstar: 'indigo',
  prompt: 'indigo',
  spark: 'indigo',
  trace: 'indigo',
  console: 'cyan',
  crt: 'cyan',
  kernel: 'teal',
  heap: 'pink',
  byte: 'orange',
  pipe: 'slate',
  stack: 'amber',
  root: 'orange',
  horizon: 'sky',
  lumen: 'amber',
  velvet: 'pink',
  hearth: 'orange',
  nimbus: 'sky',
  contrast: 'any',
  accessible: 'any',
  okabe: 'any',
  hc: 'any',
  paper: 'any',
  black: 'black',
  white: 'any',
};

/** Pure color segment names — preferred when they appear last in an id. */
const PURE_COLOR_SEGMENTS = new Set([
  'red',
  'crimson',
  'orange',
  'amber',
  'yellow',
  'gold',
  'olive',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'navy',
  'indigo',
  'violet',
  'purple',
  'pink',
  'rose',
  'magenta',
  'fuchsia',
  'brown',
  'slate',
  'gray',
  'grey',
]);

function segments(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Resolve a hue family from a theme id (preferred) or display name.
 * Hyphenated ids: if the last segment is a pure color word, use it; otherwise
 * the first matching color segment wins (e.g. indigo-harbor → indigo).
 */
export function familyFromText(...parts: readonly (string | undefined)[]): HueFamilyId | undefined {
  for (const part of parts) {
    if (!part) continue;
    const segs = segments(part);
    if (segs.length === 0) continue;
    // High-contrast catalog ids (hc-*) encode contrast mode, not a single hue.
    if (segs[0] === 'hc') return 'any';
    // 1) Pure color segments win (first occurrence): indigo-harbor → indigo, harbor-teal → teal.
    for (const seg of segs) {
      if (PURE_COLOR_SEGMENTS.has(seg) && SEGMENT_FAMILY[seg]) return SEGMENT_FAMILY[seg];
    }
    // 2) Otherwise rightmost product/cue segment (quartz-mute → mute/gray).
    for (let i = segs.length - 1; i >= 0; i -= 1) {
      const family = SEGMENT_FAMILY[segs[i]!];
      if (family) return family;
    }
  }
  return undefined;
}

export function hueInFamily(hue: number, family: HueFamilyId, chroma: number): boolean {
  if (family === 'any') return true;
  if (family === 'gray' || family === 'black') return chroma < 0.1;
  if (family === 'slate' && chroma < 0.09) return true;
  const arcs = HUE_FAMILY_ARCS[family];
  const h = ((hue % 360) + 360) % 360;
  return arcs.some((arc) => {
    if (arc.start <= arc.end) return h >= arc.start && h <= arc.end;
    return h >= arc.start || h <= arc.end;
  });
}
