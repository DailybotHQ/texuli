import type { Theme } from '../contract/types.ts';
import { oklchToHex } from '../palette/oklch.ts';
import { generateThemeFromSeed, type NeutralFamily, type ThemeFromSeedOptions } from './seed.ts';

/** What one mood word contributes: a hue and chroma, and optionally shape and spacing. */
interface Mood {
  h?: number;
  c?: number;
  neutral?: NeutralFamily;
  radius?: string;
  density?: number;
}

/**
 * Mood words, English. Color words set a hue and chroma; shape and spacing
 * words (`playful`, `minimal`, `compact`) also set radius or density.
 */
export const MOODS: Readonly<Record<string, Mood>> = {
  calm: { h: 190, c: 0.08, neutral: 'cool' },
  serene: { h: 200, c: 0.07, neutral: 'cool' },
  peaceful: { h: 175, c: 0.07 },
  energetic: { h: 35, c: 0.2 },
  vibrant: { h: 330, c: 0.22 },
  bold: { h: 25, c: 0.22 },
  playful: { h: 320, c: 0.18, radius: '1rem' },
  fun: { h: 300, c: 0.18, radius: '1rem' },
  friendly: { h: 45, c: 0.14, neutral: 'warm', radius: '0.875rem' },
  warm: { h: 50, c: 0.14, neutral: 'warm' },
  cozy: { h: 55, c: 0.11, neutral: 'warm' },
  cool: { h: 225, c: 0.12, neutral: 'cool' },
  serious: { h: 255, c: 0.1, neutral: 'slate', radius: '0.375rem' },
  corporate: { h: 250, c: 0.12, neutral: 'slate', radius: '0.375rem' },
  professional: { h: 245, c: 0.1, neutral: 'slate' },
  trust: { h: 240, c: 0.13, neutral: 'slate' },
  trustworthy: { h: 240, c: 0.13, neutral: 'slate' },
  finance: { h: 160, c: 0.1, neutral: 'slate' },
  health: { h: 195, c: 0.1, neutral: 'cool' },
  medical: { h: 200, c: 0.1, neutral: 'cool' },
  clean: { h: 210, c: 0.08, neutral: 'cool' },
  nature: { h: 145, c: 0.13, neutral: 'stone' },
  natural: { h: 140, c: 0.11, neutral: 'stone' },
  organic: { h: 130, c: 0.11, neutral: 'stone' },
  eco: { h: 145, c: 0.13, neutral: 'stone' },
  fresh: { h: 160, c: 0.15 },
  forest: { h: 150, c: 0.1, neutral: 'stone' },
  ocean: { h: 220, c: 0.14, neutral: 'cool' },
  sea: { h: 215, c: 0.13, neutral: 'cool' },
  sunset: { h: 35, c: 0.17, neutral: 'warm' },
  luxury: { h: 300, c: 0.09, neutral: 'stone', radius: '0.25rem' },
  elegant: { h: 290, c: 0.07, neutral: 'stone', radius: '0.25rem' },
  gold: { h: 85, c: 0.12, neutral: 'warm' },
  minimal: { c: 0.01, neutral: 'zinc', radius: '0.375rem' },
  minimalist: { c: 0.01, neutral: 'zinc', radius: '0.375rem' },
  monochrome: { c: 0, neutral: 'gray' },
  tech: { h: 210, c: 0.15, neutral: 'cool' },
  futuristic: { h: 200, c: 0.17, neutral: 'cool' },
  modern: { h: 230, c: 0.13 },
  retro: { h: 70, c: 0.13, neutral: 'warm' },
  vintage: { h: 65, c: 0.1, neutral: 'warm' },
  romantic: { h: 0, c: 0.14, neutral: 'warm' },
  creative: { h: 290, c: 0.17 },
  compact: { density: 0.875 },
  dense: { density: 0.875 },
  spacious: { density: 1.125 },
  airy: { density: 1.125 },
};

export interface MoodSeed {
  /** The seed color the words describe. */
  seed: string;
  neutral?: NeutralFamily;
  radius?: string;
  density?: number;
  /** The words that were recognized, in order. Empty when the seed came from a hash. */
  matched: string[];
}

/** FNV-1a: a stable hue for words the table does not know. */
function hashHue(text: string): number {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 360;
}

/**
 * What a few mood words ask for. Hues of several color words are averaged
 * around the color wheel (weighted by chroma), chroma is averaged, and the
 * first word that names a neutral family, radius or density wins. Unknown
 * words are ignored; text with no known word still gets a stable hue from a
 * hash, so the same words always give the same seed.
 */
export function moodSeed(words: string | readonly string[]): MoodSeed {
  const list = (typeof words === 'string' ? [words] : [...words])
    .flatMap((entry) => entry.toLowerCase().split(/[^\p{L}]+/u))
    .filter(Boolean);
  const matched = list.filter((word) => word in MOODS);
  let x = 0;
  let y = 0;
  let chroma = 0;
  let colors = 0;
  const pick: Pick<MoodSeed, 'neutral' | 'radius' | 'density'> = {};
  for (const word of matched) {
    const mood = MOODS[word] as Mood;
    if (mood.c !== undefined) {
      chroma += mood.c;
      colors++;
      if (mood.h !== undefined) {
        x += Math.cos((mood.h * Math.PI) / 180) * mood.c;
        y += Math.sin((mood.h * Math.PI) / 180) * mood.c;
      }
    }
    pick.neutral ??= mood.neutral;
    pick.radius ??= mood.radius;
    pick.density ??= mood.density;
  }
  const hue =
    x !== 0 || y !== 0 ? ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360 : hashHue(list.join(' '));
  const c = colors > 0 ? chroma / colors : 0.12;
  const out: MoodSeed = { seed: oklchToHex({ l: 0.55, c, h: hue }), matched };
  if (pick.neutral) out.neutral = pick.neutral;
  if (pick.radius) out.radius = pick.radius;
  if (pick.density !== undefined) out.density = pick.density;
  return out;
}

/** A theme from mood words, for example `'calm ocean'` or `['playful', 'warm']`. */
export function generateThemeFromMood(
  words: string | readonly string[],
  options: Omit<ThemeFromSeedOptions, 'seed'> = {}
): Theme {
  const { seed, neutral, radius, density, matched } = moodSeed(words);
  const label =
    matched.length > 0
      ? matched.join(' ')
      : (typeof words === 'string' ? words : words.join(' ')).trim();
  return generateThemeFromSeed({
    ...(neutral ? { neutral } : {}),
    ...(radius ? { radius } : {}),
    ...(density !== undefined ? { density } : {}),
    description: `Generated from the mood "${label}".`,
    ...options,
    seed,
  });
}
