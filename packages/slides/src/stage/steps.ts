/**
 * The step host: what every fragment of one slide looks like at the current
 * step. Pure functions over the model's `slideSteps` result, so layout and
 * component renderers (and their tests) never re-implement the fragment
 * rules. The stage wraps them in a reactive {@link DeckStepContext} that
 * renderers read with `getDeckStepContext()`.
 */
import {
  activeCodeHighlight,
  type DeckSlide,
  type FragmentPhase,
  fragmentPhase,
  isPhaseShown,
  layoutSteppablePaths,
  type SlideFragment,
  type SlideSteps,
  slideSteps,
} from '@texuli/deck/model';

type Path = readonly (string | number)[];

/** The attributes a renderer spreads on one stepped element (`{}` when it is not stepped). */
export interface DeckFragmentAttributes {
  'data-tx-deck-fragment'?: FragmentPhase;
  'data-tx-deck-effect'?: string;
  'data-tx-deck-tone'?: string;
  'data-tx-deck-fragment-step'?: number;
  'aria-hidden'?: 'true';
  inert?: boolean;
}

/** The current step on one mounted slide, as layout and component renderers see it. */
export interface DeckStepContext {
  /** The slide id. */
  readonly slideId: string;
  /** The current step, clamped to `0 … count` (0 is the initial state). */
  readonly step: number;
  /** How many "next" presses the slide takes before the deck moves on. */
  readonly count: number;
  /** True on the active slide; the previous and next slides are mounted but inert. */
  readonly active: boolean;
  /** The step label (`slide.steps[step - 1]`), when the author named it. */
  readonly label: string | undefined;
  /** `forward` when the current step was reached by advancing on this slide. */
  readonly direction: 'forward' | 'backward' | 'none';
  /** The model's step table (fragments in step order). */
  readonly steps: SlideSteps;
  /** The fragment rooted exactly at `path` (slide-relative, `['props', 'cards', 1]`). */
  fragment(path: Path): SlideFragment | undefined;
  /** Its phase at the current step; `undefined` when `path` is not stepped. */
  phase(path: Path): FragmentPhase | undefined;
  /** Attributes for the element painting `path` (hidden ones get `aria-hidden` and `inert`). */
  attributes(path: Path): DeckFragmentAttributes;
  /**
   * The code highlight shown for the code block (or props code object) at
   * `ownerPath`: its line range and its index in `highlights`, or `null`
   * before the first highlight step.
   */
  codeHighlight(ownerPath: Path): { lines: string; index: number } | null;
  /** How many list items under `ownerPath` (`['blocks', 2]`) are shown. */
  visibleItems(ownerPath: Path): number | undefined;
}

/** The step table of a slide, with its layout's steppable prop paths. */
export function deckSlideSteps(slide: DeckSlide): SlideSteps {
  return slideSteps(slide, { steppablePaths: layoutSteppablePaths(slide.layout) });
}

function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((part, i) => part === b[i]);
}

function startsWith(path: Path, prefix: Path): boolean {
  return path.length >= prefix.length && prefix.every((part, i) => part === path[i]);
}

/** Clamp a requested step into `0 … count`. */
export function clampStep(step: number, count: number): number {
  if (!Number.isFinite(step)) return 0;
  return Math.max(0, Math.min(count, Math.trunc(step)));
}

export interface StepViewInput {
  slide: DeckSlide;
  steps: SlideSteps;
  step: number;
  active?: boolean;
  direction?: 'forward' | 'backward' | 'none';
}

/**
 * A plain (non-reactive) step context. The stage builds a reactive one with
 * {@link createDeckStepContext}; tests and print paths may use this directly.
 */
export function deckStepView(input: StepViewInput): DeckStepContext {
  return createDeckStepContext(() => input);
}

/**
 * A step context whose fields read `read()` on every access, so a reactive
 * `read` (Svelte `$derived` values) makes every consumer reactive too.
 */
export function createDeckStepContext(read: () => StepViewInput): DeckStepContext {
  const fragments = () => read().steps.steps.flatMap((step) => step.fragments);
  const current = () => {
    const input = read();
    return clampStep(input.step, input.steps.count);
  };
  const fragment = (path: Path) => fragments().find((item) => samePath(item.path, path));
  const phase = (path: Path) => {
    const found = fragment(path);
    return found ? fragmentPhase(found, current()) : undefined;
  };
  return {
    get slideId() {
      return read().slide.id;
    },
    get step() {
      return current();
    },
    get count() {
      return read().steps.count;
    },
    get active() {
      return read().active ?? true;
    },
    get label() {
      return read().steps.steps[current()]?.label;
    },
    get direction() {
      return read().direction ?? 'none';
    },
    get steps() {
      return read().steps;
    },
    fragment,
    phase,
    attributes(path) {
      const found = fragment(path);
      if (!found) return {};
      const now = fragmentPhase(found, current());
      const shown = isPhaseShown(now);
      return {
        'data-tx-deck-fragment': now,
        'data-tx-deck-effect': found.effect,
        ...(found.tone ? { 'data-tx-deck-tone': found.tone } : {}),
        'data-tx-deck-fragment-step': found.step,
        ...(shown ? {} : { 'aria-hidden': 'true' as const, inert: true }),
      };
    },
    codeHighlight(ownerPath) {
      const lines = activeCodeHighlight(fragments(), ownerPath, current());
      if (lines === null) return null;
      let index = -1;
      for (const item of fragments()) {
        if (item.kind !== 'highlight' || !startsWith(item.path, ownerPath)) continue;
        if (item.path.length !== ownerPath.length + 2) continue;
        if (item.step <= current()) index = Number(item.path[item.path.length - 1]);
      }
      return { lines, index: Math.max(0, index) };
    },
    visibleItems(ownerPath) {
      const items = fragments().filter(
        (item) =>
          item.kind === 'item' &&
          item.path.length === ownerPath.length + 2 &&
          startsWith(item.path, ownerPath)
      );
      if (items.length === 0) return undefined;
      return items.filter((item) => isPhaseShown(fragmentPhase(item, current()))).length;
    },
  };
}
