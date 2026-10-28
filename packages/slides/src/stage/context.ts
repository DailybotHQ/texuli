/**
 * The stage's two Svelte contexts, the documented seam for the renderer,
 * chrome, overview and presenter lanes:
 *
 * - `getDeckStepContext()`: inside a mounted slide, the slide's current step
 *   and every fragment's phase (see `DeckStepContext` in `steps.ts`). Layout
 *   and component renderers read it instead of taking a `step` prop.
 * - `getDeckStageContext()`: anywhere inside `DeckStage`, the controller, the
 *   shown position, the messages, the resolved style and the stage toggles.
 *   Chrome components (toolbar, progress, overview, presenter) read it.
 *
 * Both getters return `undefined` outside a stage, so a component can also
 * render standalone (a thumbnail, a test).
 */
import type { DeckController, DeckState, ResolvedTransition } from '@texuli/deck/engine';
import type { Deck, DeckSlide, ResolvedDeckStyle } from '@texuli/deck/model';
import { getContext, setContext } from 'svelte';
import type { DeckFullscreenState } from './fullscreen.ts';
import type { DeckMediaTrust } from './media.ts';
import type { DeckTranslate } from './messages.ts';
import type { DeckStepContext } from './steps.ts';

const STEP_CONTEXT = Symbol.for('@texuli/slides/stage/step');
const STAGE_CONTEXT = Symbol.for('@texuli/slides/stage/stage');

/** Provide a slide's step context to the renderers below (the stage does this per mounted slide). */
export function setDeckStepContext(context: DeckStepContext): DeckStepContext {
  return setContext(STEP_CONTEXT, context);
}

/** The step context of the slide being rendered, or `undefined` outside a stage slide. */
export function getDeckStepContext(): DeckStepContext | undefined {
  return getContext<DeckStepContext | undefined>(STEP_CONTEXT);
}

/** One entry of the slide list the chrome shows (visible slides only, in order). */
export interface DeckStageSlideEntry {
  slide: DeckSlide;
  /** Index into `deck.slides`. */
  index: number;
  /** 0-based position among the visible slides. */
  position: number;
  /** The slide title, or the localized "Slide n" fallback. */
  title: string;
}

/** What chrome, overview and presenter components read from the stage (reactive getters). */
export interface DeckStageContext {
  readonly deck: Deck;
  /** The imperative engine controller (navigation, overview, blackout, pause). */
  readonly controller: DeckController;
  /** The position the stage shows (it trails the controller during a view transition). */
  readonly state: DeckState;
  readonly slide: DeckSlide;
  readonly slides: readonly DeckStageSlideEntry[];
  /** 0-based position of the shown slide among the visible slides. */
  readonly position: number;
  readonly t: DeckTranslate;
  readonly tier: DeckMediaTrust;
  readonly style: ResolvedDeckStyle;
  /** `style.progress`: where the progress bar goes (`none` hides it). */
  readonly progress: 'none' | 'top' | 'bottom';
  readonly locale: string;
  readonly dir: 'ltr' | 'rtl' | 'auto';
  readonly reducedMotion: boolean;
  /** The transition last resolved for a slide change. */
  readonly transition: ResolvedTransition | undefined;
  readonly presenter: boolean;
  readonly fullscreen: DeckFullscreenState;
  /** The instance namespace (presenter channel, view-transition names). */
  readonly namespace: string;
  next(): void;
  prev(): void;
  goTo(slideId: string, step?: number): void;
  setPresenter(open: boolean): void;
  toggleFullscreen(): void;
  /** Focus the active slide (after a chrome action that should hand focus back). */
  focusSlide(): void;
}

export function setDeckStageContext(context: DeckStageContext): DeckStageContext {
  return setContext(STAGE_CONTEXT, context);
}

/** The surrounding stage, or `undefined` outside `DeckStage`. */
export function getDeckStageContext(): DeckStageContext | undefined {
  return getContext<DeckStageContext | undefined>(STAGE_CONTEXT);
}
