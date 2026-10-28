/**
 * Deck style on the stage: v2 theme references (catalog id, embedded theme,
 * palette seed) resolved with `@texuli/tokens`, the color mode, and the theme
 * palette as the `#rrggbb` colors `resolveDeckBackground` needs for its
 * contrast guarantee. Catalog themes keep loading through the v1 path
 * (`loadDeckLibraryTheme`, or the host's `loadTheme`).
 */
import type {
  Deck,
  DeckBackgroundPalette,
  DeckSlide,
  DeckThemeReference,
} from '@texuli/deck/model';
import { normalizeThemeReference } from '@texuli/deck/model';
import type { Theme } from '@texuli/tokens/contract';
import { defineTheme } from '@texuli/tokens/contract';
import type { MatchMedia, ResolvedColorMode } from '@texuli/tokens/modes';
import { resolveColorMode } from '@texuli/tokens/modes';

/** The reference a slide renders with: its own theme, else the deck's. */
export function slideThemeReference(
  deck: Pick<Deck, 'style'>,
  slide: Pick<DeckSlide, 'theme'> | undefined
): DeckThemeReference | undefined {
  return normalizeThemeReference(slide?.theme ?? deck.style?.theme);
}

/** A stable cache key for a reference (`catalog:ocean`, `seed:42`, `embedded:<theme id>`). */
export function deckThemeKey(reference: DeckThemeReference | undefined): string | undefined {
  if (!reference) return undefined;
  switch (reference.kind) {
    case 'catalog':
      return `catalog:${reference.id}`;
    case 'seed':
      return `seed:${reference.seed}`;
    case 'embedded': {
      const id = (reference.theme as { id?: unknown }).id;
      return `embedded:${typeof id === 'string' ? id : JSON.stringify(reference.theme).slice(0, 200)}`;
    }
  }
}

/** Every distinct theme reference in a deck, the deck's own first (for preloading). */
export function deckThemeReferences(deck: Pick<Deck, 'style' | 'slides'>): DeckThemeReference[] {
  const out = new Map<string, DeckThemeReference>();
  for (const input of [deck.style?.theme, ...deck.slides.map((slide) => slide.theme)]) {
    const reference = normalizeThemeReference(input);
    const key = deckThemeKey(reference);
    if (reference && key && !out.has(key)) out.set(key, reference);
  }
  return [...out.values()];
}

/** The `data-tx-theme` id a reference paints with. */
export function deckThemeId(reference: DeckThemeReference | undefined): string | undefined {
  if (!reference) return undefined;
  if (reference.kind === 'catalog') return reference.id;
  if (reference.kind === 'seed') return `seed-${reference.seed}`;
  const id = (reference.theme as { id?: unknown }).id;
  return typeof id === 'string' ? id : undefined;
}

/** A 24-bit hex color from a uint32 palette seed (the low 24 bits). */
export function seedColor(seed: number): string {
  const value = Math.max(0, Math.trunc(Number.isFinite(seed) ? seed : 0)) & 0xffffff;
  return `#${value.toString(16).padStart(6, '0')}`;
}

export type DeckThemeLoaderFn = (id: string) => Promise<Theme>;

/**
 * Resolve a reference to a validated token theme, or `null` when it cannot
 * be used (unknown catalog id, an embedded theme `defineTheme` refuses, no
 * loader). Seeds load the generator on first use.
 */
export async function loadDeckTheme(
  reference: DeckThemeReference,
  loadCatalog: DeckThemeLoaderFn | null
): Promise<Theme | null> {
  try {
    switch (reference.kind) {
      case 'catalog':
        return loadCatalog ? defineTheme(await loadCatalog(reference.id)) : null;
      case 'embedded':
        return defineTheme(reference.theme);
      case 'seed': {
        const { generateThemeFromSeed } = await import('@texuli/tokens/generator');
        return generateThemeFromSeed({
          seed: seedColor(reference.seed),
          id: `seed-${reference.seed}`,
          name: `Seed ${reference.seed}`,
        });
      }
    }
  } catch {
    return null;
  }
}

const HOST_MODES: readonly string[] = ['light', 'dark', 'high-contrast'];

/**
 * The mode a reference paints in: its own mode, else (for `system` or none)
 * the host page's explicit `data-tx-mode`, else the viewer's preferences.
 */
export function resolveStageMode(
  reference: DeckThemeReference | undefined,
  hostMode: string | null | undefined,
  matchMedia?: MatchMedia
): ResolvedColorMode {
  const requested = reference?.mode ?? 'system';
  if (requested !== 'system') return requested;
  if (hostMode && HOST_MODES.includes(hostMode)) return hostMode as ResolvedColorMode;
  return resolveColorMode('system', matchMedia);
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Neutral fallbacks when no theme is known (host CSS paints the stage). */
export const DECK_FALLBACK_PALETTES: Readonly<Record<'light' | 'dark', DeckBackgroundPalette>> =
  Object.freeze({
    light: Object.freeze({
      background: '#ffffff',
      foreground: '#18181b',
      surface: '#f4f4f5',
      primary: '#2563eb',
      accent: '#7c3aed',
      muted: '#e4e4e7',
      border: '#d4d4d8',
      info: '#0369a1',
      success: '#15803d',
      warning: '#a16207',
      destructive: '#b91c1c',
    }),
    dark: Object.freeze({
      background: '#09090b',
      foreground: '#fafafa',
      surface: '#18181b',
      primary: '#60a5fa',
      accent: '#a78bfa',
      muted: '#27272a',
      border: '#3f3f46',
      info: '#38bdf8',
      success: '#4ade80',
      warning: '#facc15',
      destructive: '#f87171',
    }),
  });

const ROLES = [
  'background',
  'foreground',
  'surface',
  'primary',
  'accent',
  'muted',
  'border',
  'info',
  'success',
  'warning',
  'destructive',
] as const;

/**
 * The background palette of a theme in a mode, as hex colors. High contrast
 * (system colors) and any non-hex value fall back to the neutral palette, so
 * the contrast math always has real colors to work with.
 */
export function deckBackgroundPalette(
  theme: Pick<Theme, 'light' | 'dark'> | null | undefined,
  mode: ResolvedColorMode
): DeckBackgroundPalette {
  const base = DECK_FALLBACK_PALETTES[mode === 'dark' ? 'dark' : 'light'];
  if (!theme || mode === 'high-contrast') return base;
  const palette = theme[mode];
  const out: Record<string, string> = { ...base };
  for (const role of ROLES) {
    const value = (palette as Record<string, { default?: unknown } | undefined>)[role]?.default;
    if (typeof value === 'string' && HEX.test(value)) out[role] = value;
  }
  return out as unknown as DeckBackgroundPalette;
}
