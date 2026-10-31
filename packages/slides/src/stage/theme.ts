import type { Theme } from '@texuli/tokens/contract';
import {
  defineTheme,
  flattenSemanticPalette,
  semanticTokenToCssVar,
} from '@texuli/tokens/contract';
import { themeVariables } from '@texuli/tokens/css';
import type { MatchMedia, ResolvedColorMode } from '@texuli/tokens/modes';
import { colorSchemeValue, resolveColorMode, resolveSemanticPalette } from '@texuli/tokens/modes';
import type { Deck, DeckThemeReference } from '../model/index.ts';

/**
 * Resolve a catalog theme id to a validated token theme; reject unknown ids.
 * The library default (`loadDeckLibraryTheme`) lives in `./library-theme.ts`,
 * so this module, which the core entries import, never references the
 * theme library (G127).
 */
export type DeckThemeLoader = (id: string) => Promise<Theme>;

/** Unique catalog theme ids a deck references, deck default first, for preloading. */
export function deckCatalogThemeIds(deck: Pick<Deck, 'meta' | 'slides'>): string[] {
  const ids = new Set<string>();
  for (const ref of [deck.meta.themeRef, ...deck.slides.map((slide) => slide.themeRef)]) {
    if (ref?.kind === 'catalog') ids.add(ref.id);
  }
  return [...ids];
}

/** Mode values a host may set with `data-tx-mode` on an ancestor. */
const HOST_MODES: readonly string[] = ['light', 'dark', 'high-contrast'];

/**
 * Resolve a reference's mode with the token engine. A missing mode means
 * `system`. `system` follows the host's explicit `data-tx-mode` when one is
 * given (`hostMode`), so a deck never paints light tokens inside a dark page;
 * otherwise it honors `prefers-contrast: more` before `prefers-color-scheme`.
 */
export function resolveDeckThemeMode(
  ref: DeckThemeReference | undefined,
  matchMedia?: MatchMedia,
  hostMode?: string | null
): ResolvedColorMode {
  const requested = ref?.mode ?? 'system';
  if (requested === 'system' && hostMode && HOST_MODES.includes(hostMode)) {
    return hostMode as ResolvedColorMode;
  }
  return resolveColorMode(requested, matchMedia);
}

/**
 * Validated `--tx-*` custom properties for one theme and resolved mode. High
 * contrast keeps the theme's light style tokens and swaps every semantic color
 * for the token engine's system-color palette.
 */
export function deckThemeVariables(
  theme: Theme,
  mode: ResolvedColorMode,
  options: { reducedMotion?: boolean } = {}
): Record<string, string> {
  const vars = themeVariables({
    theme,
    mode: mode === 'dark' ? 'dark' : 'light',
    reducedMotion: options.reducedMotion ?? false,
  });
  if (mode === 'high-contrast') {
    const palette = flattenSemanticPalette(resolveSemanticPalette(theme, mode));
    for (const [token, value] of Object.entries(palette)) {
      const [role, state] = token.split('.');
      vars[semanticTokenToCssVar(role as string, state)] = value;
    }
  }
  vars['color-scheme'] = colorSchemeValue(mode);
  return vars;
}

/**
 * Resolve catalog ids once per cache. Rejected ids resolve to `null`, so the
 * caller can fall back to inherited or host CSS.
 */
export function createDeckThemeCache(loader: DeckThemeLoader) {
  const entries = new Map<string, Promise<Theme | null>>();
  return {
    load(id: string): Promise<Theme | null> {
      let entry = entries.get(id);
      if (!entry) {
        entry = loader(id).then(
          (theme) => defineTheme(theme),
          () => null
        );
        entries.set(id, entry);
      }
      return entry;
    },
  };
}
