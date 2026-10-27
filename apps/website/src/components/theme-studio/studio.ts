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
  isSemanticRole,
  MOODS,
  NEUTRAL_FAMILIES,
  type NeutralFamily,
  parseHex,
  SEMANTIC_ROLES,
  type SemanticPaletteInput,
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

/* ── Starting points (T-82 punch-list row 2) ──────────────────────────── */

/** A one-click brand seed shown as a starting point in the studio. */
export type StudioSeedPreset = { id: string; label: string; hex: string };

/**
 * Fictional seed colors with stable hexes. Every hex passes `normalizeHex`,
 * so a click can never land the visitor in an error state (punch-list row 2).
 */
export const STUDIO_SEED_PRESETS: readonly StudioSeedPreset[] = Object.freeze([
  { id: 'harbor', label: 'Harbor blue', hex: '#2b6ce0' },
  { id: 'signal', label: 'Signal red', hex: '#e11d48' },
  { id: 'moss', label: 'Moss green', hex: '#3f6212' },
  { id: 'teal-tide', label: 'Teal tide', hex: '#0f766e' },
  { id: 'amber-dusk', label: 'Amber dusk', hex: '#b45309' },
  { id: 'grape', label: 'Grape', hex: '#7c3aed' },
  { id: 'ink-slate', label: 'Ink slate', hex: '#334155' },
  { id: 'rosewood', label: 'Rosewood', hex: '#9f1239' },
]);

/** A library theme featured as a starting point, with its gallery category. */
export type StudioLibraryTheme = { id: string; category: string };

/**
 * A small, budgeted slice of the 210-theme library. Payloads load from
 * `/theme-data/<id>.json` on click (same origin, one file per theme), never
 * upfront — the studio's first paint stays the default seed.
 */
export const FEATURED_LIBRARY_THEMES: readonly StudioLibraryTheme[] = Object.freeze([
  { id: 'enterprise-neutral', category: 'enterprise' },
  { id: 'editorial-luxury', category: 'editorial' },
  { id: 'devtools-night', category: 'devtools' },
  { id: 'playful-consumer', category: 'consumer' },
  { id: 'gaming-neon', category: 'gaming' },
  { id: 'okabe-blue', category: 'analytics' },
  { id: 'contrast-paper', category: 'accessible' },
  { id: 'retro-terminal', category: 'retro' },
]);

/** `devtools-night` → `Devtools night`, for buttons that predate the payload. */
export function humanizeThemeId(id: string): string {
  return id
    .split('-')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/* ── Import a library theme payload (T-82 punch-list row 2) ───────────── */

type LibraryPayloadLike = { name?: unknown; light?: unknown; dark?: unknown };

type PaletteResult = { ok: true; palette: SemanticPaletteInput } | { ok: false; message: string };

/** Rebuild one mode's palette from the payload's role list; fail closed. */
function paletteFromRoles(modePayload: unknown): PaletteResult {
  if (typeof modePayload !== 'object' || modePayload === null) {
    return { ok: false, message: 'The theme file is missing its light or dark roles.' };
  }
  const roles = (modePayload as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) {
    return { ok: false, message: 'The theme file has no role list to import.' };
  }
  const byRole = new Map<string, Record<string, unknown>>();
  for (const entry of roles) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.role === 'string') byRole.set(record.role, record);
  }
  const palette: Record<string, { default: string; hover?: string; active?: string }> = {};
  for (const role of SEMANTIC_ROLES) {
    const record = byRole.get(role);
    if (!record) {
      return { ok: false, message: `The theme file is missing the "${role}" role.` };
    }
    if (typeof record.default !== 'string') {
      return { ok: false, message: `The "${role}" role has no default color in the theme file.` };
    }
    const color: { default: string; hover?: string; active?: string } = { default: record.default };
    if (typeof record.hover === 'string') color.hover = record.hover;
    if (typeof record.active === 'string') color.active = record.active;
    palette[role] = color;
  }
  return { ok: true, palette: palette as SemanticPaletteInput };
}

/**
 * Turn a library theme's explorer payload (`/theme-data/<id>.json`) into an
 * editable studio theme. The draft keeps the studio's own id, so exports
 * stay studio drafts; the library name carries over. Fails closed: anything
 * that is not a full role payload returns a message instead of a theme.
 */
export function themeFromLibraryPayload(
  payload: unknown,
  options: { id?: string; name?: string } = {}
): StudioGenerateResult {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, message: 'The theme file did not hold a theme payload.' };
  }
  const data = payload as LibraryPayloadLike;
  const name =
    options.name ??
    (typeof data.name === 'string' && data.name.trim()
      ? data.name.trim()
      : 'Imported library theme');
  const light = paletteFromRoles(data.light);
  if (!light.ok) return light;
  const dark = paletteFromRoles(data.dark);
  if (!dark.ok) return dark;
  try {
    const theme = defineTheme({
      id: options.id ?? 'theme-studio',
      name,
      description: 'Imported from a library theme payload in the theme studio.',
      light: light.palette,
      dark: dark.palette,
    });
    return { ok: true, theme };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : 'The theme file could not be imported.';
    return { ok: false, message };
  }
}

/* ── Theme-as-URL share links (T-82 punch-list row 8) ─────────────────── */

/** A share link's hash prefix; the rest is the recipe's URL-encoded params. */
export const STUDIO_SHARE_PREFIX = '#theme=';

/** One role edit that travels in a share link. */
export type StudioShareEdit = { role: SemanticRole; mode: StudioMode; hex: string };

/** The studio state a share link encodes (never the image itself). */
export type StudioShareState = {
  source: StudioSource;
  seed: string;
  secondary: string;
  words: string;
  neutral: string;
  contrast: StudioContrast;
  mode: StudioMode;
  edits: readonly StudioShareEdit[];
  /**
   * The library theme the studio started from. A library theme is a palette,
   * not a seed recipe, so the link names it and opening the link re-imports it.
   */
  library?: string;
};

/** Library ids a link may name: the kebab-case shape of `/theme-data/<id>.json`. */
const SHARE_LIBRARY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SHARE_LIBRARY_ID = 64;

function isShareLibraryId(id: string): boolean {
  return id.length <= MAX_SHARE_LIBRARY_ID && SHARE_LIBRARY_ID.test(id);
}

const SOURCE_CODES = { color: 'c', words: 'w', image: 'i' } as const;
const SOURCE_FROM_CODE: Record<string, StudioSource> = { c: 'color', w: 'words', i: 'image' };
const MODE_CODES = { light: 'l', dark: 'd' } as const;
const MAX_SHARE_EDITS = 40;
const MAX_SHARE_WORDS = 120;
const MAX_SHARE_CHARS = 1800;

function modeFromCode(code: string | null): StudioMode | null {
  return code === MODE_CODES.light ? 'light' : code === MODE_CODES.dark ? 'dark' : null;
}

/**
 * Encode the studio state into a link hash. Pure and local: the recipe is
 * the seed, words and role edits — an image source travels as the color it
 * produced, never as image data. `null` when the state cannot be a link.
 */
export function encodeStudioShare(state: StudioShareState): string | null {
  // An image source travels as the color it produced (the caller puts that
  // hex in `seed`): images never go into links, and the decoder refuses
  // image recipes, so what ships must be a color recipe.
  const source = SOURCE_CODES[state.source === 'image' ? 'color' : state.source];
  if (!source) return null;
  if (state.contrast !== 'AA' && state.contrast !== 'AAA') return null;
  const modeCode = MODE_CODES[state.mode as StudioMode];
  if (!modeCode) return null;
  const params = new URLSearchParams();
  params.set('s', source);
  const seed = state.seed.trim();
  if (seed) params.set('seed', seed);
  const secondary = state.secondary.trim();
  if (secondary) params.set('sec', secondary);
  const words = state.words.trim();
  if (words) {
    if (words.length > MAX_SHARE_WORDS) return null;
    params.set('w', words);
  }
  if (state.neutral.trim()) params.set('n', state.neutral.trim());
  params.set('c', state.contrast);
  params.set('m', modeCode);
  if (state.library !== undefined) {
    if (!isShareLibraryId(state.library)) return null;
    params.set('lib', state.library);
  }
  let edits = 0;
  for (const edit of state.edits) {
    if (!isSemanticRole(edit.role)) continue;
    const hex = normalizeHex(edit.hex);
    if (!hex) continue;
    const editMode = MODE_CODES[edit.mode as StudioMode];
    if (!editMode) continue;
    params.set(`r.${editMode}.${edit.role}`, hex);
    edits += 1;
    if (edits > MAX_SHARE_EDITS) return null;
  }
  const query = params.toString();
  if (query.length > MAX_SHARE_CHARS) return null;
  return `${STUDIO_SHARE_PREFIX}${query}`;
}

export type StudioShareResult =
  | { ok: true; share: StudioShareState }
  | { ok: false; message: string };

/** True when a `location.hash` looks like a theme share link. */
export function isStudioShareHash(hash: string): boolean {
  return hash.startsWith(STUDIO_SHARE_PREFIX);
}

/**
 * Decode a theme share hash back into studio state. Fails closed on unknown
 * sources, missing targets, unreadable colors and links past the caps, so a
 * broken link can never half-apply as a silently different theme.
 */
export function decodeStudioShare(hash: string): StudioShareResult {
  if (!isStudioShareHash(hash)) {
    return { ok: false, message: 'That is not a theme studio link.' };
  }
  const query = hash.slice(STUDIO_SHARE_PREFIX.length);
  if (query.length > MAX_SHARE_CHARS) {
    return { ok: false, message: 'The theme link is too long to open.' };
  }
  const params = new URLSearchParams(query);
  const source = SOURCE_FROM_CODE[params.get('s') ?? ''];
  if (!source) {
    return { ok: false, message: 'The theme link has no usable recipe.' };
  }
  if (source === 'image') {
    return {
      ok: false,
      message:
        'The link was made from an image recipe; images never travel in links, so pick the image again.',
    };
  }
  const contrast = params.get('c') === 'AAA' ? 'AAA' : params.get('c') === 'AA' ? 'AA' : null;
  const mode = modeFromCode(params.get('m'));
  if (!contrast || !mode) {
    return { ok: false, message: 'The theme link is missing its contrast target or preview mode.' };
  }
  const rawWords = params.get('w') ?? '';
  if (rawWords.length > MAX_SHARE_WORDS) {
    return { ok: false, message: 'The mood words in the link are too long to open.' };
  }
  const library = params.get('lib');
  if (library !== null && !isShareLibraryId(library)) {
    return { ok: false, message: 'The theme link names an unreadable library theme.' };
  }
  const rawNeutral = params.get('n') ?? '';
  const neutral = isNeutralFamily(rawNeutral) ? rawNeutral : 'zinc';
  const edits: StudioShareEdit[] = [];
  for (const [key, value] of params) {
    if (!key.startsWith('r.')) continue;
    const parts = key.split('.');
    const editMode = parts.length === 3 ? modeFromCode(parts[1]) : null;
    const roleName = parts[2] ?? '';
    if (!editMode || !isSemanticRole(roleName)) {
      return { ok: false, message: 'The theme link carries an unreadable role edit.' };
    }
    const hex = normalizeHex(value);
    if (!hex) {
      return { ok: false, message: `The theme link carries an unreadable color for ${roleName}.` };
    }
    edits.push({ role: roleName, mode: editMode, hex });
    if (edits.length > MAX_SHARE_EDITS) {
      return { ok: false, message: 'The theme link carries too many role edits.' };
    }
  }
  return {
    ok: true,
    share: {
      source,
      seed: params.get('seed') ?? '',
      secondary: params.get('sec') ?? '',
      words: rawWords,
      neutral,
      contrast,
      mode,
      edits,
      ...(library !== null ? { library } : {}),
    },
  };
}

/** Where the studio's theme came from; it decides what a share link can carry. */
export type StudioOrigin = { kind: 'recipe' } | { kind: 'library'; id: string } | { kind: 'image' };

/**
 * The share state for the theme on screen, or `null` when it cannot travel
 * in a link. A recipe (seed or words) shares as itself; a library theme
 * shares its id, because regenerating from its primary color would build a
 * different palette; an image theme comes from pixels, which never go into
 * links, so it has no link at all.
 */
export function studioShareFor(
  origin: StudioOrigin,
  recipe: Omit<StudioShareState, 'edits' | 'library'>,
  edits: readonly StudioShareEdit[]
): StudioShareState | null {
  if (origin.kind === 'image') return null;
  return {
    ...recipe,
    edits,
    ...(origin.kind === 'library' ? { library: origin.id } : {}),
  };
}

export type StudioSharedTheme =
  | {
      ok: true;
      theme: Theme;
      origin: StudioOrigin;
      /** The role edits that applied, in link order (the next share carries them). */
      edits: StudioShareEdit[];
      skipped: number;
    }
  | { ok: false; message: string };

/**
 * Rebuild the theme a decoded link describes: re-import the named library
 * theme (through `loadLibrary`, the site's `/theme-data/` loader) or
 * regenerate the recipe, then re-apply the role edits. Unreadable edits are
 * skipped and counted; a library theme that does not load fails closed.
 */
export async function themeFromShare(
  share: StudioShareState,
  loadLibrary: (id: string) => Promise<unknown>
): Promise<StudioSharedTheme> {
  let base: StudioGenerateResult;
  let origin: StudioOrigin;
  if (share.library !== undefined) {
    const payload = isShareLibraryId(share.library) ? await loadLibrary(share.library) : null;
    if (!payload) {
      return { ok: false, message: 'The library theme in the link could not be loaded.' };
    }
    base = themeFromLibraryPayload(payload);
    origin = { kind: 'library', id: share.library };
  } else {
    base = generateStudioTheme({
      source: share.source,
      seed: share.seed,
      secondary: share.secondary || undefined,
      words: share.words,
      neutral: share.neutral as NeutralFamily,
      contrast: share.contrast,
      id: 'theme-studio',
      name: 'Theme studio',
    });
    origin = { kind: 'recipe' };
  }
  if (!base.ok) return base;
  let theme = base.theme;
  const edits: StudioShareEdit[] = [];
  for (const edit of share.edits) {
    const applied = setRoleDefault(theme, edit.role, edit.hex, [edit.mode]);
    if (!applied.ok) continue;
    theme = applied.theme;
    edits.push(edit);
  }
  return { ok: true, theme, origin, edits, skipped: share.edits.length - edits.length };
}
