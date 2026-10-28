/** @texuli/deck/authoring: typed builders, deterministic outlines, quality lint and JSON Patch. */
export {
  authoringLayoutIds,
  type DeckBuilderOptions,
  type DeckBuildResult,
  deck,
  type SlideOptions,
  slide,
} from './builder.ts';
export {
  DECK_AUTHORING_LIMITS,
  DECK_LINT_MAX_ISSUES,
  DECK_LINT_RULES,
  type DeckLintIssue,
  type DeckLintReport,
  type DeckLintRule,
  lintDeck,
} from './lint.ts';
export {
  DECK_OUTLINE_IDS,
  DECK_OUTLINES,
  type DeckOutlineId,
  type DeckOutlineTemplate,
  type DeckPacing,
  type GenerateBriefOptions,
  type GeneratedDeck,
  generateDeckFromBrief,
  type OutlineSlide,
} from './outlines.ts';
export {
  applyDeckPatch,
  type JsonPatchOperation,
  type JsonPatchResult,
  MAX_DECK_PATCH_OPERATIONS,
} from './patch.ts';
export { type LayoutChoice, type LayoutRequest, selectDeckLayouts } from './select-layouts.ts';
