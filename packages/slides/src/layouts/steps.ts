/**
 * Prop-step attributes for layout renderers. A catalog layout marks a
 * fragment on a props object (`{ step: 2, fragment: 'fade-up' }`); the deck
 * model records it at a slide-relative path (`['props', 'cards', 1]`) and the
 * stage's step context answers its phase. Layouts address paths relative to
 * `props` (`['cards', 1]`, or `[]` for the whole body) and spread the result
 * on the element that paints that object.
 */
import type { DeckCatalogLayoutId, LayoutProps, SlideBase } from '@texuli/deck/model';
import { getDeckStepContext } from '../stage/context.ts';
import type { DeckSlideRenderContext } from '../stage/renderers.ts';
import type { DeckFragmentAttributes, DeckStepContext } from '../stage/steps.ts';

export type PropPath = readonly (string | number)[];

export interface LayoutSteps {
  /** Fragment attributes for the props object at `path` (`{}` when it is not stepped). */
  at(path: PropPath): DeckFragmentAttributes;
  /** The code highlight index for the props code object at `path`, or `undefined` before the first. */
  highlight(path: PropPath): number | undefined;
}

/** Step helpers over a step context; without one (a thumbnail, print) nothing is stepped. */
export function layoutSteps(step: DeckStepContext | undefined): LayoutSteps {
  return {
    at(path) {
      return step ? step.attributes(['props', ...path]) : {};
    },
    highlight(path) {
      return step?.codeHighlight(['props', ...path])?.index;
    },
  };
}

/**
 * The step helpers of the slide being rendered: the stage's step context, or
 * the one on the render context when mounted outside a stage slide. Call it
 * while the component initializes (it reads a Svelte context); `read` is a
 * getter so a changed `context` prop is always the one read.
 */
export function useLayoutSteps(read: () => Pick<DeckSlideRenderContext, 'step'>): LayoutSteps {
  const fromStage = getDeckStepContext();
  const current = () => layoutSteps(fromStage ?? read().step);
  return {
    at: (path) => current().at(path),
    highlight: (path) => current().highlight(path),
  };
}

/** A catalog layout slide narrowed to one layout id. */
export type LayoutSlideOf<Id extends DeckCatalogLayoutId> = SlideBase & {
  layout: Id;
  props: LayoutProps[Id];
};

/** The props every layout renderer receives (the stage's `DeckSlideRendererProps`). */
export interface LayoutRendererProps<Id extends DeckCatalogLayoutId> {
  slide: LayoutSlideOf<Id>;
  context: DeckSlideRenderContext;
}
