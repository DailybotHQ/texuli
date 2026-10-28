/**
 * @texuli/deck/model: deck model v2 (ADR-009). The schemas and types,
 * `parseDeck` with all-issues diagnostics, the untrusted loader, migration
 * from Texuli v1, grammar trees and Protoyard, the JSON Schema export, the
 * diagnostic code table, and the leaf modules: layouts, style and themes,
 * backgrounds, steps and motion.
 */
export * from './backgrounds/index.ts';
export {
  DECK_CODES,
  type DeckCode,
  type DeckCodeInfo,
  type DeckIssue,
  isDeckCode,
} from './codes.ts';
export {
  BLOCK_CONTAINERS,
  BLOCK_JSON_LIMITS,
  BLOCK_TONES,
  BLOCK_TYPE_PATTERN,
  COMPONENT_HEIGHTS,
  COMPONENT_ID_PATTERN,
  type ComponentSlide,
  type CustomSlide,
  componentItem,
  componentSlide,
  customSlide,
  DECK_DIRECTIONS,
  DECK_FORMAT_VERSION,
  DECK_MODEL_LIMITS,
  DECK_SLIDE_KINDS,
  DECK_SLIDE_LAYOUTS,
  type Deck,
  type DeckDirection,
  type DeckJsonSchemaOptions,
  type DeckMeta,
  type DeckNavigation,
  type DeckOutline,
  type DeckSection,
  type DeckSlide,
  type DeckSlideKind,
  type DeckSlideLayout,
  deckJsonSchema,
  deckMeta,
  deckNavigation,
  deckOutline,
  deckSchema,
  deckSection,
  deckSlide,
  type FreeSlide,
  forEachNested,
  freeSlide,
  ISO_DATE_PATTERN,
  isSlideId,
  isSlideLayout,
  type JsonObject,
  type LayoutSlide,
  LOCALE_PATTERN,
  SLIDE_MASTERS,
  type SlideBase,
  type SlideBlock,
  type SlideComponentItem,
  type SlideItem,
  type SlideMasterId,
  STEP_FIELD_KEYS,
  slideItem,
} from './deck.ts';
export * from './layouts/index.ts';
export {
  DEFAULT_UNTRUSTED_DECK_LIMITS,
  jsonErrorOffset,
  jsonTextDepth,
  lineColumn,
  loadUntrustedDeck,
  type UntrustedDeckLimits,
  type UntrustedDeckOptions,
  type UntrustedDeckResult,
} from './loader.ts';
export {
  DECK_SOURCES,
  type DeckMigration,
  type DeckSource,
  detectDeckShape,
  migrateDeck,
} from './migrate.ts';
export * from './motion/index.ts';
export {
  type DeckComponentInput,
  type DeckHookResult,
  type DeckParseResult,
  type ParseDeckOptions,
  parseDeck,
  stripStepFields,
} from './parse.ts';
export {
  copyPlainData,
  type PlainCopyOptions,
  type PlainCopyResult,
  stripHiddenCharacters,
  utf8Length,
} from './plain.ts';
export * from './shared.ts';
export * from './steps/index.ts';
export * from './style/index.ts';
