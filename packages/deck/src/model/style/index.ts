/**
 * Deck style (model v2 §3.1, §3.8): the `DeckStyle` schema and defaults,
 * theme references, and the pure resolver to `--tx-deck-*` CSS variables.
 * Theme data itself is resolved by the stage with `@texuli/tokens`.
 */
export {
  DECK_ASPECT_RATIOS,
  DECK_DENSITY_SCALE,
  DECK_RADIUS_VALUES,
  DECK_REDUCED_MOTION_MS,
  DECK_SUBTLE_FACTOR,
  DECK_TRANSITION_CAP_MS,
  DECK_TRANSITION_MS,
  DECK_VAR_PREFIX,
  type DeckCssVar,
  type DeckResolvedTransition,
  type DeckStyleResolution,
  type ResolveDeckStyleOptions,
  type ResolvedDeckStyle,
  resolveDeckStyle,
  resolveDeckTransition,
  STYLE_CODES,
} from './resolve.ts';
export {
  DECK_DENSITIES,
  DECK_MOTIONS,
  DECK_PROGRESS,
  DECK_RADII,
  DECK_STYLE_DEFAULTS,
  type DeckDensity,
  type DeckMotion,
  type DeckProgress,
  type DeckRadius,
  type DeckStyle,
  deckStyle,
  logoSrc,
} from './schema.ts';
export {
  DECK_THEME_MODES,
  DECK_THEME_SEED_MAX,
  type DeckResolvedThemeMode,
  type DeckThemeInput,
  type DeckThemeMode,
  type DeckThemeReference,
  deckThemeObject,
  deckThemeReference,
  EMBEDDED_THEME_LIMITS,
  normalizeThemeReference,
  resolveThemeMode,
  STYLE_SLUG_PATTERN,
  styleSlug,
  THEME_CODES,
} from './theme.ts';
