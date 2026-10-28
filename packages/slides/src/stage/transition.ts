/**
 * Slide transitions, actually rendered. The engine resolves what to play
 * (`resolveDeckTransition`: slide override → deck style → fade, lowered by
 * the motion ceiling and reduced motion); this module plays it:
 *
 * - **View Transitions** (`document.startViewTransition`) when the browser
 *   has them: the outgoing and incoming slides share one
 *   `view-transition-name` scoped to the stage instance, so several decks on
 *   a page never collide and the rest of the page does not animate. `morph`
 *   pairs elements that carry the same `data-tx-deck-morph-id` on both
 *   slides (auto-animate). Durations come from the resolved transition.
 * - **CSS fallback** otherwise: the stage marks the incoming slide
 *   (`data-tx-deck-enter`) and `styles.css` animates it.
 * - **Cut** for `none` (motion `none`, or the author's choice).
 *
 * Names and timing are set through the CSSOM (never a `style` attribute),
 * so the stage stays inside a strict style CSP.
 */
import type { ResolvedTransition } from '@texuli/deck/engine';

export type DeckTransitionMode = 'view-transition' | 'css' | 'cut';
export type DeckTransitionDirection = 'forward' | 'backward';

/** The part of a `ViewTransition` the stage uses. */
export interface DeckViewTransition {
  ready: Promise<unknown>;
  finished: Promise<unknown>;
}

interface AnimatableRoot {
  animate?(
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions & { pseudoElement?: string }
  ): unknown;
}

/** The part of `Document` the player needs (injectable for tests). */
export interface DeckTransitionDocument {
  startViewTransition?: (update: () => void) => DeckViewTransition;
  documentElement?: AnimatableRoot;
}

/** The attribute morph targets carry on both slides. */
export const DECK_MORPH_ATTRIBUTE = 'data-tx-deck-morph-id';

/** A view-transition-name-safe identifier. */
export function viewTransitionIdent(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return /^[a-z]/.test(cleaned) ? cleaned : `x${cleaned}`;
}

/** The name prefix of one stage instance: `tx-deck-<namespace>-`. */
export function viewTransitionPrefix(namespace: string): string {
  return `tx-deck-${viewTransitionIdent(namespace)}-`;
}

type Styled = {
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): void };
};

function setName(element: Styled, name: string, kind: 'slide' | 'morph'): void {
  element.style.setProperty('view-transition-name', name);
  element.style.setProperty('view-transition-class', `tx-deck tx-deck-${kind}`);
}

function clearName(element: Styled): void {
  element.style.removeProperty('view-transition-name');
  element.style.removeProperty('view-transition-class');
}

interface MorphTarget extends Styled {
  getAttribute(name: string): string | null;
  classList?: { contains(token: string): boolean };
  firstElementChild?: unknown;
}

/** A box-less wrapper (`display: contents`) cannot be captured: its first child is. */
const BOXLESS_CLASS = 'tx-deck-stage__fragment';

interface SlideElement extends Styled {
  querySelectorAll(selector: string): ArrayLike<MorphTarget> & Iterable<MorphTarget>;
}

function morphTargets(root: SlideElement | null | undefined): Map<string, MorphTarget> {
  const out = new Map<string, MorphTarget>();
  if (!root) return out;
  for (const element of root.querySelectorAll(`[${DECK_MORPH_ATTRIBUTE}]`)) {
    const id = element.getAttribute(DECK_MORPH_ATTRIBUTE);
    if (!id || out.has(id)) continue;
    const child = element.firstElementChild as MorphTarget | null | undefined;
    out.set(id, element.classList?.contains(BOXLESS_CLASS) && child?.style ? child : element);
  }
  return out;
}

/** Keyframes for the incoming (`new`) and outgoing (`old`) slide snapshots. */
export function transitionKeyframes(
  name: ResolvedTransition['name'],
  direction: DeckTransitionDirection,
  rtl = false
): { old: Keyframe[]; new: Keyframe[] } {
  const sign = (direction === 'forward' ? 1 : -1) * (rtl ? -1 : 1);
  switch (name) {
    case 'fade-up':
      return {
        old: [{ opacity: 1 }, { opacity: 0 }],
        new: [
          { opacity: 0, transform: 'translateY(4%)' },
          { opacity: 1, transform: 'none' },
        ],
      };
    case 'slide':
      return {
        old: [{ transform: 'none' }, { transform: `translateX(${-100 * sign}%)` }],
        new: [{ transform: `translateX(${100 * sign}%)` }, { transform: 'none' }],
      };
    case 'zoom':
      return {
        old: [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: 'scale(1.04)' },
        ],
        new: [
          { opacity: 0, transform: 'scale(0.92)' },
          { opacity: 1, transform: 'none' },
        ],
      };
    default:
      return { old: [{ opacity: 1 }, { opacity: 0 }], new: [{ opacity: 0 }, { opacity: 1 }] };
  }
}

export interface PlayDeckTransitionOptions {
  resolved: ResolvedTransition;
  direction: DeckTransitionDirection;
  /** Apply the slide change to the DOM synchronously (the stage calls `flushSync` inside). */
  update(): void;
  /** `document`, or `null` to force the CSS fallback. */
  doc?: DeckTransitionDocument | null;
  namespace: string;
  /** The outgoing and incoming slide elements (read after `update` for the incoming one). */
  from?: () => SlideElement | null | undefined;
  to?: () => SlideElement | null | undefined;
  rtl?: boolean;
}

export interface PlayedDeckTransition {
  mode: DeckTransitionMode;
  /** Resolves when the animation ends (at once for a cut or the CSS fallback). */
  finished: Promise<void>;
}

/**
 * Play one slide change. The DOM update always happens (synchronously for a
 * cut and the CSS fallback, inside the view-transition callback otherwise);
 * a failing animation never blocks navigation.
 */
export function playDeckTransition(options: PlayDeckTransitionOptions): PlayedDeckTransition {
  const { resolved, doc } = options;
  if (resolved.name === 'none' || resolved.durationMs <= 0) {
    options.update();
    return { mode: 'cut', finished: Promise.resolve() };
  }
  const start = doc?.startViewTransition;
  if (typeof start !== 'function') {
    options.update();
    return { mode: 'css', finished: Promise.resolve() };
  }

  const prefix = viewTransitionPrefix(options.namespace);
  const slideName = `${prefix}slide`;
  const from = options.from?.() ?? null;
  const fromMorphs = resolved.name === 'morph' ? morphTargets(from) : new Map();
  const named: Styled[] = [];
  const name = (element: Styled, value: string, kind: 'slide' | 'morph' = 'morph') => {
    setName(element, value, kind);
    named.push(element);
  };
  if (from) name(from, slideName, 'slide');
  for (const [id, element] of fromMorphs) name(element, `${prefix}m-${viewTransitionIdent(id)}`);

  const cleanup = () => {
    for (const element of named.splice(0)) clearName(element);
  };

  let transition: DeckViewTransition;
  try {
    transition = start.call(doc, () => {
      cleanup();
      options.update();
      const to = options.to?.() ?? null;
      if (!to) return;
      name(to, slideName, 'slide');
      if (fromMorphs.size === 0) return;
      for (const [id, element] of morphTargets(to)) {
        if (fromMorphs.has(id)) name(element, `${prefix}m-${viewTransitionIdent(id)}`);
      }
    });
  } catch {
    cleanup();
    options.update();
    return { mode: 'css', finished: Promise.resolve() };
  }

  const root = doc?.documentElement;
  const timing = { duration: resolved.durationMs, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
  void Promise.resolve(transition.ready)
    .then(() => {
      if (typeof root?.animate !== 'function') return;
      const frames = transitionKeyframes(
        resolved.name === 'morph' ? 'fade' : resolved.name,
        options.direction,
        options.rtl
      );
      root.animate(frames.old, {
        ...timing,
        fill: 'both',
        pseudoElement: `::view-transition-old(${slideName})`,
      });
      root.animate(frames.new, {
        ...timing,
        fill: 'both',
        pseudoElement: `::view-transition-new(${slideName})`,
      });
    })
    .catch(() => undefined);

  const finished = Promise.resolve(transition.finished)
    .catch(() => undefined)
    .then(() => {
      cleanup();
    });
  return { mode: 'view-transition', finished };
}
