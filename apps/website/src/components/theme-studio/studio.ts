/**
 * Pure theme-studio helpers: generate, tune roles, AA report, export.
 * No DOM. Used by the island and unit tests.
 */

import type { SemanticRole } from '@texuli/tokens';
import {
  type ContrastIssue,
  checkThemeContrast,
  compileThemeCss,
  defineTheme,
  generateThemeFromMood,
  generateThemeFromSeed,
  MOODS,
  NEUTRAL_FAMILIES,
  type NeutralFamily,
  parseHex,
  SEMANTIC_ROLES,
  type Theme,
  themeVariables,
} from '@texuli/tokens';

export type StudioSource = 'color' | 'words' | 'image';
export type StudioContrast = 'AA' | 'AAA';
export type StudioMode = 'light' | 'dark';
export type StudioExportFormat = 'css' | 'json';

/** Roles users can retune in the studio (hex-friendly defaults). */
export const TUNABLE_ROLES: readonly SemanticRole[] = Object.freeze([
  'primary',
  'secondary',
  'accent',
  'destructive',
  'success',
  'warning',
  'info',
  'background',
  'foreground',
  'surface',
  'muted',
  'mutedForeground',
  'border',
  'link',
  'linkVisited',
]);

export const STUDIO_NEUTRALS: readonly NeutralFamily[] = NEUTRAL_FAMILIES;

export const STUDIO_MOOD_WORDS: readonly string[] = Object.freeze(
  Object.keys(MOODS).sort((a, b) => a.localeCompare(b))
);

export type StudioGenerateInput = {
  source: StudioSource;
  /** Brand hex for color source. */
  seed?: string;
  /** Mood words for words source. */
  words?: string;
  /** Image seed hex (from dominantColors) for image source. */
  imageSeed?: string;
  secondary?: string;
  neutral?: NeutralFamily;
  contrast?: StudioContrast;
  id?: string;
  name?: string;
};

export type StudioGenerateResult = { ok: true; theme: Theme } | { ok: false; message: string };

export type AaPairRow = {
  mode: StudioMode;
  foreground: string;
  background: string;
  state: string;
  ratio: number;
  required: number;
  pass: boolean;
};

/** Normalize a user color string to #rrggbb or null. */
export function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const rgb = parseHex(withHash);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function isNeutralFamily(value: string): value is NeutralFamily {
  return (NEUTRAL_FAMILIES as readonly string[]).includes(value);
}

/**
 * Build a theme from color, mood words, or a pre-extracted image seed.
 * Image pixel reading stays in the island; this only consumes a seed hex.
 */
export function generateStudioTheme(input: StudioGenerateInput): StudioGenerateResult {
  const contrast = input.contrast ?? 'AA';
  const neutral = input.neutral && isNeutralFamily(input.neutral) ? input.neutral : undefined;
  const id = input.id ?? 'theme-studio';
  const name = input.name ?? 'Theme studio';

  try {
    if (input.source === 'words') {
      const words = (input.words ?? '').trim();
      if (!words)
        return { ok: false, message: 'Enter one or more mood words (for example calm ocean).' };
      const theme = generateThemeFromMood(words, {
        id,
        name,
        description: `Generated from mood words: ${words}.`,
        contrast,
        ...(neutral ? { neutral } : {}),
      });
      return { ok: true, theme: defineTheme(theme) };
    }

    const seedRaw = input.source === 'image' ? (input.imageSeed ?? input.seed) : (input.seed ?? '');
    const seed = normalizeHex(seedRaw ?? '');
    if (!seed) {
      return {
        ok: false,
        message:
          input.source === 'image'
            ? 'Pick an image so a brand color can be extracted.'
            : 'Enter a brand color as #rgb or #rrggbb.',
      };
    }
    const secondary = input.secondary ? normalizeHex(input.secondary) : undefined;
    if (input.secondary && !secondary) {
      return { ok: false, message: 'Secondary color must be #rgb or #rrggbb.' };
    }

    const theme = generateThemeFromSeed({
      seed,
      id,
      name,
      description:
        input.source === 'image'
          ? `Generated from image seed ${seed}.`
          : `Generated from seed ${seed}.`,
      contrast,
      ...(neutral ? { neutral } : {}),
      ...(secondary ? { secondary } : {}),
    });
    return { ok: true, theme: defineTheme(theme) };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Theme generation failed.';
    return { ok: false, message };
  }
}

/** Override one role's default color on both modes or a single mode. */
export function setRoleDefault(
  theme: Theme,
  role: SemanticRole,
  hex: string,
  modes: readonly StudioMode[] = ['light', 'dark']
): StudioGenerateResult {
  const color = normalizeHex(hex);
  if (!color) return { ok: false, message: 'Role color must be #rgb or #rrggbb.' };
  if (!(SEMANTIC_ROLES as readonly string[]).includes(role)) {
    return { ok: false, message: `Unknown role "${role}".` };
  }

  try {
    const next = structuredClone(theme) as Theme;
    for (const mode of modes) {
      const current = next[mode][role];
      next[mode][role] = { ...current, default: color };
    }
    // Re-validate; may throw if the contract rejects the value.
    return { ok: true, theme: defineTheme(next) };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Role update failed.';
    return { ok: false, message };
  }
}

export function aaReport(theme: Theme, textMinimum = 4.5): AaPairRow[] {
  return checkThemeContrast(theme, { textMinimum }).map((issue: ContrastIssue) => ({
    mode: (issue.mode ?? 'light') as StudioMode,
    foreground: issue.foreground,
    background: issue.background,
    state: issue.state,
    ratio: Math.round(issue.ratio * 100) / 100,
    required: issue.required,
    pass: false,
  }));
}

/** Full pair list with pass flags (issues only miss; invent pass rows for summary). */
export function aaSummary(
  theme: Theme,
  contrast: StudioContrast = 'AA'
): {
  textMinimum: number;
  failing: AaPairRow[];
  failCount: number;
  passLabel: string;
} {
  const textMinimum = contrast === 'AAA' ? 7 : 4.5;
  const failing = aaReport(theme, textMinimum);
  return {
    textMinimum,
    failing,
    failCount: failing.length,
    passLabel:
      failing.length === 0
        ? `All gated pairs meet WCAG ${contrast} (${textMinimum}:1 text).`
        : `${failing.length} pair(s) below WCAG ${contrast}.`,
  };
}

export function exportThemeJson(theme: Theme): string {
  return `${JSON.stringify(theme, null, 2)}\n`;
}

export function exportThemeCss(theme: Theme): string {
  return compileThemeCss(theme);
}

export function buildStudioExport(format: StudioExportFormat, theme: Theme): string {
  return format === 'json' ? exportThemeJson(theme) : exportThemeCss(theme);
}

/** CSS variables for applying a theme mode to a preview host. */
export function studioModeVars(theme: Theme, mode: StudioMode): Record<string, string> {
  return themeVariables({ theme, mode });
}

export function roleDefault(theme: Theme, mode: StudioMode, role: SemanticRole): string {
  return theme[mode][role]?.default ?? '';
}
