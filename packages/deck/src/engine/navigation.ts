/**
 * Framework-free deck navigation over a model-v2-shaped deck.
 *
 * Locations are pure data. Hidden slides are skipped by sequential moves;
 * `goTo` of a hidden or unknown id falls back to the first visible slide.
 * Vertical stacks come from `outline.sections` with `stack: true`: next/prev
 * walk steps, then vertical siblings, then the surrounding horizontal order.
 * `stepCount` is the maximum step index on the slide (number of advances);
 * navigable steps are `0 … stepCount` inclusive.
 */
import { layoutSteppablePaths } from '../model/layouts/index.ts';
import { type StepSource, slideSteps } from '../model/steps/index.ts';

export interface EngineSlide {
  id: string;
  hidden?: boolean;
  /** Step labels: `steps[i]` names step `i + 1`. */
  steps?: readonly string[];
  blocks?: readonly unknown[];
  props?: unknown;
  layout?: string;
  transition?: string;
}

export interface EngineSection {
  id: string;
  slideIds: readonly string[];
  /** When true, the section is a vertical stack (Reveal-style). */
  stack?: boolean;
}

export interface EngineDeck {
  slides: readonly EngineSlide[];
  outline?: { sections?: readonly EngineSection[] };
  navigation?: { start?: string; loop?: boolean; autoSlideMs?: number };
  style?: { transition?: string; motion?: string; aspect?: string; progress?: string };
  meta?: { locale?: string; dir?: 'ltr' | 'rtl' | 'auto'; title?: string };
}

/** Current place in the deck (immutable snapshot). */
export interface DeckLocation {
  /** Index into the full `deck.slides` array. */
  slideIndex: number;
  slideId: string;
  /** 0-based step on the current slide. */
  step: number;
  /** Maximum step index (number of advances). Navigable range is 0…stepCount. */
  stepCount: number;
  /** Set when the slide belongs to a stacked outline section. */
  sectionId?: string;
  /** 0-based index inside the stacked section. */
  verticalIndex?: number;
}

export interface NavigatorOptions {
  initialSlideId?: string;
  initialStep?: number;
  /**
   * How many advances each slide has (max step index). Defaults to
   * {@link modelSlideStepCount}.
   */
  stepCount?: (slide: EngineSlide) => number;
}

export interface DeckNavigator {
  getLocation(): DeckLocation;
  visibleSlides(): readonly EngineSlide[];
  next(): DeckLocation;
  prev(): DeckLocation;
  first(): DeckLocation;
  last(): DeckLocation;
  /**
   * Jump by slide id, by visible index (number), or by a full location.
   * Unknown or hidden ids fall back to the first visible slide.
   */
  goTo(slide: string | number | DeckLocation, step?: number): DeckLocation;
  goToVertical(sectionId: string, verticalIndex: number, step?: number): DeckLocation;
  stepCountFor(slideId: string): number;
}

/**
 * Count distinct positive model-v2 step markers plus explicit step labels.
 * Never throws; unknown shapes contribute nothing. The result is the maximum
 * step index (0 when the slide has no advances).
 */
export function modelSlideStepCount(slide: EngineSlide): number {
  return slideSteps(slide as StepSource, {
    steppablePaths: layoutSteppablePaths(slide.layout ?? 'free'),
  }).count;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

/**
 * Create a pure navigator over a deck-shaped object. The deck is read once;
 * later mutations of the input are ignored.
 */
export function createDeckNavigator(
  deck: EngineDeck,
  options: NavigatorOptions = {}
): DeckNavigator {
  const slides = deck.slides ?? [];
  const steps = slides.map((slide) =>
    Math.max(0, Math.floor(options.stepCount?.(slide) ?? modelSlideStepCount(slide)) || 0)
  );
  const visible = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide }) => slide.hidden !== true);
  const byId = new Map(slides.map((slide, index) => [slide.id, index] as const));
  const stackBySlide = new Map<
    string,
    { sectionId: string; index: number; ids: readonly string[] }
  >();
  for (const section of deck.outline?.sections ?? []) {
    if (!section.stack) continue;
    const ids = section.slideIds ?? [];
    ids.forEach((id, index) => {
      stackBySlide.set(id, { sectionId: section.id, index, ids });
    });
  }

  const fallback = visible[0] ?? (slides[0] ? { slide: slides[0], index: 0 } : undefined);
  let current = fallback?.index ?? 0;
  let step = clamp(options.initialStep ?? 0, 0, steps[current] ?? 0);

  const resolveStart = (id: string | undefined): void => {
    if (!id) return;
    const initial = visible.find(({ slide }) => slide.id === id);
    if (initial) {
      current = initial.index;
      step = clamp(options.initialStep ?? 0, 0, steps[current] ?? 0);
    }
  };
  if (options.initialSlideId) resolveStart(options.initialSlideId);
  else resolveStart(deck.navigation?.start);

  const make = (): DeckLocation => {
    const slide = slides[current];
    if (!slide) return { slideIndex: 0, slideId: '', step: 0, stepCount: 0 };
    const stack = stackBySlide.get(slide.id);
    return {
      slideIndex: current,
      slideId: slide.id,
      step,
      stepCount: steps[current] ?? 0,
      ...(stack ? { sectionId: stack.sectionId, verticalIndex: stack.index } : {}),
    };
  };

  const set = (index: number, nextStep = 0): DeckLocation => {
    current = index;
    step = clamp(nextStep, 0, steps[current] ?? 0);
    return make();
  };

  const atVisible = (index: number): number | undefined => visible[index]?.index;

  const moveVertical = (direction: -1 | 1, fromId: string): number | undefined => {
    const stack = stackBySlide.get(fromId);
    if (!stack) return undefined;
    for (
      let offset = stack.index + direction;
      offset >= 0 && offset < stack.ids.length;
      offset += direction
    ) {
      const nextIndex = byId.get(stack.ids[offset] ?? '');
      if (nextIndex !== undefined && slides[nextIndex]?.hidden !== true) return nextIndex;
    }
    return undefined;
  };

  const moveAcross = (direction: -1 | 1): DeckLocation => {
    const now = make();
    if (direction > 0 && now.step < now.stepCount) return set(current, step + 1);
    if (direction < 0 && now.step > 0) return set(current, step - 1);

    const vertical = moveVertical(direction, now.slideId);
    if (vertical !== undefined) {
      return set(vertical, direction > 0 ? 0 : (steps[vertical] ?? 0));
    }

    const visibleIndex = visible.findIndex(({ index }) => index === current);
    let target = atVisible(visibleIndex + direction);
    if (target === undefined && deck.navigation?.loop === true && visible.length > 0) {
      target = direction > 0 ? visible[0]?.index : visible[visible.length - 1]?.index;
    }
    if (target === undefined) return make();
    return set(target, direction > 0 ? 0 : (steps[target] ?? 0));
  };

  return {
    getLocation: make,
    visibleSlides: () => visible.map(({ slide }) => slide),
    next: () => moveAcross(1),
    prev: () => moveAcross(-1),
    first: () => (visible[0] ? set(visible[0].index, 0) : make()),
    last: () => {
      const last = visible[visible.length - 1];
      return last ? set(last.index, steps[last.index] ?? 0) : make();
    },
    goTo: (target, targetStep = 0) => {
      let index: number | undefined;
      let resolvedStep = targetStep;
      if (typeof target === 'string') {
        index = byId.get(target);
      } else if (typeof target === 'number') {
        if (visible.length === 0) return make();
        index = visible[clamp(target, 0, visible.length - 1)]?.index;
      } else {
        index = byId.get(target.slideId);
        resolvedStep = target.step;
      }
      if (index === undefined || slides[index]?.hidden === true) {
        return fallback ? set(fallback.index, 0) : make();
      }
      return set(index, resolvedStep);
    },
    goToVertical: (sectionId, verticalIndex, targetStep = 0) => {
      const section = deck.outline?.sections?.find((item) => item.id === sectionId && item.stack);
      const id = section?.slideIds[clamp(verticalIndex, 0, (section?.slideIds.length ?? 1) - 1)];
      const index = id ? byId.get(id) : undefined;
      if (index === undefined || slides[index]?.hidden === true) return make();
      return set(index, targetStep);
    },
    stepCountFor: (slideId) => {
      const index = byId.get(slideId);
      return index === undefined ? 0 : (steps[index] ?? 0);
    },
  };
}
