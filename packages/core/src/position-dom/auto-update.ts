import { getOwnerDocument, getOwnerWindow, listen, requestFrame } from '../env/index.ts';
import { getScrollAncestors, type PositionReference, referenceElement } from './measure.ts';

export interface AutoUpdateOptions {
  /** Update when any scroll ancestor (or the window) scrolls. Default true. */
  ancestorScroll?: boolean;
  /** Update when the window or the visual viewport resizes. Default true. */
  ancestorResize?: boolean;
  /** Update when the reference or the floating element changes size. Default true. */
  elementResize?: boolean;
  /**
   * Update when the reference moves without scrolling or resizing (content
   * inserted above it, a sibling collapsing). Default true where
   * `IntersectionObserver` exists.
   */
  layoutShift?: boolean;
  /**
   * Compare the reference's rect every frame: for an anchor that animates.
   * Off by default; it costs a layout read per frame.
   */
  animationFrame?: boolean;
}

/** A window with the observer constructors of its own realm (iframes included). */
type ObserverRealm = Window &
  Partial<Pick<typeof globalThis, 'ResizeObserver' | 'IntersectionObserver'>>;

// ── one ResizeObserver per window ────────────────────────────────────────

type ResizeCallback = () => void;
interface SharedObserver {
  observer: ResizeObserver;
  callbacks: Map<Element, Set<ResizeCallback>>;
}
const sharedObservers = new WeakMap<Window, SharedObserver>();

/**
 * Observes an element's size through the single `ResizeObserver` of its
 * window, created on first use and disconnected when nothing is observed.
 * Returns the cleanup function.
 */
export function observeResize(element: Element, callback: ResizeCallback): () => void {
  const ownerWindow = getOwnerWindow(element) as ObserverRealm | undefined;
  const Observer = ownerWindow?.ResizeObserver;
  if (!ownerWindow || !Observer) return () => {};
  let shared = sharedObservers.get(ownerWindow);
  if (!shared) {
    const callbacks = new Map<Element, Set<ResizeCallback>>();
    const observer = new Observer((entries: ResizeObserverEntry[]) => {
      for (const entry of entries) {
        for (const run of [...(callbacks.get(entry.target) ?? [])]) run();
      }
    });
    shared = { observer, callbacks };
    sharedObservers.set(ownerWindow, shared);
  }
  const { observer, callbacks } = shared;
  let set = callbacks.get(element);
  if (!set) {
    set = new Set();
    callbacks.set(element, set);
    observer.observe(element);
  }
  set.add(callback);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const current = callbacks.get(element);
    current?.delete(callback);
    if (current && current.size === 0) {
      callbacks.delete(element);
      observer.unobserve(element);
    }
    if (callbacks.size === 0) {
      observer.disconnect();
      sharedObservers.delete(ownerWindow);
    }
  };
}

// ── anchor movement ──────────────────────────────────────────────────────

/**
 * Calls `onMove` when an element moves on the page without a scroll or a
 * resize. An `IntersectionObserver` watches the element against a root margin
 * cut to its current box: any move changes the intersection ratio, which
 * reports the move and re-cuts the margin at the new box.
 */
export function observeMove(element: Element, onMove: () => void): () => void {
  const Observer = (getOwnerWindow(element) as ObserverRealm | undefined)?.IntersectionObserver;
  const root = getOwnerDocument(element)?.documentElement;
  if (!Observer || !root) return () => {};
  let observer: IntersectionObserver | undefined;

  const watch = (threshold: number) => {
    observer?.disconnect();
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const top = Math.floor(box.top);
    const left = Math.floor(box.left);
    const right = Math.floor(root.clientWidth - box.right);
    const bottom = Math.floor(root.clientHeight - box.bottom);
    let first = true;
    const next = new Observer(
      (entries: IntersectionObserverEntry[]) => {
        const ratio = entries[entries.length - 1]?.intersectionRatio ?? 0;
        if (first) {
          first = false;
          // Partly off screen: watch for a change from the ratio it starts at.
          if (Math.abs(ratio - threshold) > 1e-3 && ratio > 0) watch(ratio);
          return;
        }
        if (Math.abs(ratio - threshold) > 1e-3) {
          onMove();
          watch(1);
        }
      },
      {
        rootMargin: `${-top}px ${-right}px ${-bottom}px ${-left}px`,
        threshold: Math.min(1, Math.max(0, threshold)),
      }
    );
    observer = next;
    next.observe(element);
  };

  watch(1);
  return () => observer?.disconnect();
}

// ── auto-update ──────────────────────────────────────────────────────────

/**
 * Keeps a floating element positioned: calls `update` now, then at most once
 * per frame whenever a scroll ancestor scrolls, the viewport resizes, either
 * element changes size, or the reference moves. Every listener is passive;
 * returns the cleanup that removes all of them.
 */
export function autoUpdate(
  reference: PositionReference,
  floating: HTMLElement,
  update: () => void,
  options: AutoUpdateOptions = {}
): () => void {
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = true,
    layoutShift = true,
    animationFrame = false,
  } = options;
  const anchor = referenceElement(reference);
  const ownerWindow = getOwnerWindow(floating) ?? getOwnerWindow(anchor);
  const cleanups: (() => void)[] = [];

  let cancelFrame: (() => void) | undefined;
  const schedule = () => {
    if (cancelFrame) return;
    cancelFrame = requestFrame(() => {
      cancelFrame = undefined;
      update();
    }, ownerWindow);
  };

  const passive = { passive: true } as const;
  if (ancestorScroll) {
    const targets = new Set([...getScrollAncestors(anchor), ...getScrollAncestors(floating)]);
    for (const target of targets) cleanups.push(listen(target, 'scroll', schedule, passive));
  }
  if (ancestorResize && ownerWindow) {
    cleanups.push(listen(ownerWindow, 'resize', schedule, passive));
    const visual = ownerWindow.visualViewport;
    cleanups.push(listen(visual, 'resize', schedule, passive));
    if (ancestorScroll) cleanups.push(listen(visual, 'scroll', schedule, passive));
  }
  if (elementResize) {
    if (anchor) cleanups.push(observeResize(anchor, schedule));
    cleanups.push(observeResize(floating, schedule));
  }
  if (layoutShift && anchor) cleanups.push(observeMove(anchor, schedule));
  if (animationFrame) {
    let last = reference.getBoundingClientRect();
    let stop: (() => void) | undefined;
    const tick = () => {
      const next = reference.getBoundingClientRect();
      if (
        next.x !== last.x ||
        next.y !== last.y ||
        next.width !== last.width ||
        next.height !== last.height
      ) {
        update();
      }
      last = next;
      stop = requestFrame(tick, ownerWindow);
    };
    stop = requestFrame(tick, ownerWindow);
    cleanups.push(() => stop?.());
  }

  update();
  return () => {
    cancelFrame?.();
    cancelFrame = undefined;
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}
