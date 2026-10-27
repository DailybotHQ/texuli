import type { Point, Rect, TextDirection } from '@texuli/drag';
import type { ScrollMetrics, ScrollTarget } from '@texuli/drag/auto-scroll';
import type { MeasuredContainer, MeasuredItem, SortableContainer } from '@texuli/drag/sortable';

/** DOM helpers for the sortable binding. Every one takes its elements; none runs at module load. */

export function rectOf(element: Element): Rect {
  const box = element.getBoundingClientRect();
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

/** Text direction of an element: the nearest explicit `dir`, else the computed style. */
export function directionOf(element: Element): TextDirection {
  const explicit = element.closest('[dir]')?.getAttribute('dir')?.toLowerCase();
  if (explicit === 'rtl' || explicit === 'ltr') return explicit;
  return getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}

export interface MeasureSources {
  readonly containers: readonly SortableContainer[];
  readonly lists: ReadonlyMap<string, HTMLElement>;
  readonly items: ReadonlyMap<string, HTMLElement>;
}

/**
 * Measures every registered list and item once (the drag-start snapshot, or
 * after a scroll). Lists without an element are skipped; an item's child
 * list is the container whose `parentId` is that item.
 */
export function measureContainers({
  containers,
  lists,
  items,
}: MeasureSources): MeasuredContainer[] {
  const childOf = new Map<string, string>();
  for (const container of containers) {
    if (container.parentId != null && lists.has(container.id))
      childOf.set(container.parentId, container.id);
  }
  const measured: MeasuredContainer[] = [];
  for (const container of containers) {
    const list = lists.get(container.id);
    if (!list) continue;
    const direction = directionOf(list);
    const rows: MeasuredItem[] = [];
    for (const id of container.items) {
      const element = items.get(id);
      if (!element) continue;
      const child = childOf.get(id);
      rows.push(
        child === undefined
          ? { id, rect: rectOf(element) }
          : { id, rect: rectOf(element), childContainerId: child }
      );
    }
    measured.push({
      id: container.id,
      rect: rectOf(list),
      orientation: container.orientation ?? 'vertical',
      direction,
      ...(container.disabled ? { disabled: true } : {}),
      items: rows,
    });
  }
  return measured;
}

const SCROLLS = /(auto|scroll|overlay)/;

/** Scrollable ancestors of `element`, nearest first, ending with the page scroller. */
export function scrollTargets(element: Element): ScrollTarget[] {
  const doc = element.ownerDocument;
  const view = doc.defaultView;
  const targets: ScrollTarget[] = [];
  for (
    let node = element.parentElement;
    node && node !== doc.body && node !== doc.documentElement;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    const scrollsY = SCROLLS.test(style.overflowY) && node.scrollHeight > node.clientHeight;
    const scrollsX = SCROLLS.test(style.overflowX) && node.scrollWidth > node.clientWidth;
    if (scrollsY || scrollsX) targets.push(elementTarget(node));
  }
  const page = doc.scrollingElement;
  if (page && view) {
    targets.push({
      metrics: (): ScrollMetrics => ({
        rect: { x: 0, y: 0, width: view.innerWidth, height: view.innerHeight },
        scrollLeft: page.scrollLeft,
        scrollTop: page.scrollTop,
        scrollWidth: page.scrollWidth,
        scrollHeight: page.scrollHeight,
        clientWidth: page.clientWidth,
        clientHeight: page.clientHeight,
      }),
      scrollBy: (dx, dy) => view.scrollBy(dx, dy),
    });
  }
  return targets;
}

function elementTarget(node: HTMLElement): ScrollTarget {
  return {
    metrics: () => ({
      rect: rectOf(node),
      scrollLeft: node.scrollLeft,
      scrollTop: node.scrollTop,
      scrollWidth: node.scrollWidth,
      scrollHeight: node.scrollHeight,
      clientWidth: node.clientWidth,
      clientHeight: node.clientHeight,
    }),
    scrollBy: (dx, dy) => {
      node.scrollLeft += dx;
      node.scrollTop += dy;
    },
  };
}

export function reducedMotion(element: Element): boolean {
  return (
    element.ownerDocument.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
    false
  );
}

/** Rects of every element, keyed like the input (FLIP "first"). */
export function snapshotRects(elements: ReadonlyMap<string, HTMLElement>): Map<string, Point> {
  const rects = new Map<string, Point>();
  for (const [id, element] of elements) {
    const box = element.getBoundingClientRect();
    rects.set(id, { x: box.left, y: box.top });
  }
  return rects;
}

/**
 * FLIP: animate each element from its old position to its new one. Skipped
 * under reduced motion and where the Web Animations API is missing.
 */
export function playFlip(
  before: ReadonlyMap<string, Point>,
  elements: ReadonlyMap<string, HTMLElement>,
  skip: ReadonlySet<string>,
  duration = 160
): void {
  for (const [id, element] of elements) {
    if (skip.has(id) || typeof element.animate !== 'function') continue;
    const first = before.get(id);
    if (!first) continue;
    const box = element.getBoundingClientRect();
    const dx = first.x - box.left;
    const dy = first.y - box.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
      duration,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  }
}
