import { safeParseBlock, walkBlocks } from '@texuli/blocks/core';
import {
  type DraftDiagnostic,
  type DraftValidation,
  type ValidateDraftOptions,
  validateDraft,
} from '@texuli/catalog/validate';
import {
  type Deck,
  type DeckIssue,
  type DeckThemeReference,
  type DeckTransition,
  resolveSlideMaster,
  resolveSlideTheme,
  resolveSlideTransition,
  type SlideMasterLayout,
} from '../model/index.ts';
import {
  DECK_ROOT_CATALOG_ID,
  DECK_SLIDE_CATALOG_ID,
  parseDeckRenderTree,
  projectLegacyDeck,
} from './index.ts';

/** A deck-semantics finding; catalog findings keep their own `check`. */
export interface DeckDraftIssue {
  check: 'deck';
  code: 'deck-schema' | 'deck-legacy-cards';
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

export type DeckDraftDiagnostic = DraftDiagnostic | DeckDraftIssue;

/** What a host needs to present one validated slide. */
export interface ResolvedDeckSlide {
  slideId: string;
  master: SlideMasterLayout;
  transition: DeckTransition;
  themeRef: DeckThemeReference | undefined;
  /** Highest block `step` on the slide (0 when no block declares one). */
  stepCount: number;
}

export interface DeckDraftResult {
  /** True only when the catalog draft and the deck semantics both pass. */
  ok: boolean;
  /**
   * The catalog status (`parse`, `over-limits`, `invalid`) when the catalog
   * check fails; otherwise `valid` or, when only the deck semantics fail,
   * `invalid`.
   */
  status: DraftValidation['status'];
  /** The catalog result as returned by `validateDraft`. */
  draft: DraftValidation;
  /** The validated deck, or `null` when either side failed. */
  deck: Deck | null;
  /** Catalog diagnostics followed by deck diagnostics. */
  diagnostics: readonly DeckDraftDiagnostic[];
  /** Per-slide resolution, empty unless `ok`. */
  slides: readonly ResolvedDeckSlide[];
}

export interface ValidateDeckDraftOptions
  extends Omit<ValidateDraftOptions, 'frameRoots' | 'checkBlock'> {
  /** Resolve transitions as under reduced motion (every slide cuts). */
  reducedMotion?: boolean;
}

function deckIssues(issues: readonly DeckIssue[]): DeckDraftIssue[] {
  return issues.map((issue) => ({
    check: 'deck',
    code: 'deck-schema',
    severity: 'error',
    path: issue.path,
    message: issue.message,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The agent entry point for decks. Runs the catalog's `validateDraft` with
 * deep block schemas and `layout-deck` as the only root, then the deck
 * semantics the catalog cannot see (slide id syntax and uniqueness, declared
 * masters, theme references, settings) through `parseDeckRenderTree`. A tree
 * of `layout-card` slides still projects through `projectLegacyDeck`, with a
 * `deck-legacy-cards` warning. Never throws.
 */
export function validateDeckDraft(
  input: unknown,
  options: ValidateDeckDraftOptions
): DeckDraftResult {
  const { reducedMotion = false, ...draftOptions } = options;
  const draft = validateDraft(input, {
    ...draftOptions,
    frameRoots: [DECK_ROOT_CATALOG_ID],
    checkBlock: (block) => safeParseBlock(block),
  });
  const diagnostics: DeckDraftDiagnostic[] = [...draft.diagnostics];
  const tree = draft.draft;
  let deck: Deck | null = null;

  if (isRecord(tree) && tree.id === DECK_ROOT_CATALOG_ID) {
    const children = Array.isArray(tree.children) ? tree.children : [];
    const legacy =
      children.length > 0 &&
      children.every((child) => isRecord(child) && child.id === 'layout-card');
    const parsed = legacy ? projectLegacyDeck(tree) : parseDeckRenderTree(tree);
    if (legacy) {
      diagnostics.push({
        check: 'deck',
        code: 'deck-legacy-cards',
        severity: 'warning',
        path: 'children',
        message: `Legacy layout-card slides were projected; emit ${DECK_SLIDE_CATALOG_ID} children instead.`,
      });
    }
    if (parsed.success) deck = parsed.deck;
    else diagnostics.push(...deckIssues(parsed.issues));
  }

  const ok = draft.ok && deck !== null;
  return {
    ok,
    status: draft.ok ? (ok ? 'valid' : 'invalid') : draft.status,
    draft,
    deck: ok ? deck : null,
    diagnostics,
    slides:
      ok && deck
        ? deck.slides.map((slide) => ({
            slideId: slide.id,
            master: resolveSlideMaster(slide.master),
            transition: resolveSlideTransition(deck, slide, { reducedMotion }),
            themeRef: resolveSlideTheme(deck, slide),
            stepCount: Math.max(0, ...walkBlocks(slide.blocks).map(({ block }) => block.step ?? 0)),
          }))
        : [],
  };
}
