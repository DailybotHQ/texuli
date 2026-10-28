/**
 * What a slide preview needs to paint a slide exactly as the stage does: the
 * deck, the renderer tables, the paint tier, the messages, the virtual canvas
 * and the per-slide background palette. `DeckStage` builds one with reactive
 * getters and hands it to the overview and the presenter views; the popup
 * window reuses the same object, so its previews follow the stage's theme
 * and renderers.
 */
import type { Deck, DeckBackgroundPalette, DeckSlide } from '@texuli/deck/model';
import type { DeckMediaTrust } from '../media.ts';
import type { DeckTranslate } from '../messages.ts';
import type { DeckRenderers } from '../renderers.ts';
import { deckSlideSteps } from '../steps.ts';

export interface DeckPreviewPaint {
  readonly deck: Deck;
  readonly renderers: readonly DeckRenderers[];
  readonly tier: DeckMediaTrust;
  readonly t: DeckTranslate;
  /** The virtual canvas (1280 × 720 for 16:9, …). */
  readonly canvas: { width: number; height: number };
  readonly resolveAvatar?: (id: string) => string | undefined;
  /** The background palette of one slide (its theme reference and mode). */
  palette(slide: DeckSlide): DeckBackgroundPalette;
}

/** The scale that fits the virtual canvas into a box `width` pixels wide (0 when unmeasured). */
export function previewScale(width: number, canvas: { width: number }): number {
  if (!Number.isFinite(width) || width <= 0 || !(canvas.width > 0)) return 0;
  return width / canvas.width;
}

/** The last step of a slide: thumbnails and previews show every fragment. */
export function lastStep(slide: DeckSlide): number {
  return deckSlideSteps(slide).count;
}

/** The label of a slide's step (`steps[n].label`), when the deck names it. */
export function stepLabel(slide: DeckSlide | undefined, step: number): string | undefined {
  if (!slide) return undefined;
  const label = deckSlideSteps(slide).steps[step]?.label;
  return typeof label === 'string' && label.trim() ? label : undefined;
}

/** Where the presenter is: the shown entry, what follows and whether a move is possible. */
export interface PresenterPosition<Entry extends { index: number }> {
  /** 0-based position among the visible slides. */
  position: number;
  current: Entry | undefined;
  following: Entry | undefined;
  /** The shown slide still has steps to reveal. */
  hasMoreSteps: boolean;
  atStart: boolean;
  atEnd: boolean;
}

export function presenterPosition<Entry extends { index: number }>(
  slides: readonly Entry[],
  slideIndex: number,
  step: number,
  stepCount: number
): PresenterPosition<Entry> {
  const position = Math.max(
    0,
    slides.findIndex((entry) => entry.index === slideIndex)
  );
  const hasMoreSteps = step < stepCount;
  return {
    position,
    current: slides[position],
    following: slides[position + 1],
    hasMoreSteps,
    atStart: position === 0 && step <= 0,
    atEnd: position >= slides.length - 1 && !hasMoreSteps,
  };
}
