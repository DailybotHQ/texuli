import { getOwnerDocument, getOwnerWindow } from '../env/index.ts';
import { type Rect, rect } from '../position-math/index.ts';

/**
 * Something to position against that is not an element: a pointer location
 * for a context menu, a text selection, a canvas point. `contextElement` is the
 * element it belongs to (for scroll ancestors and the document).
 */
export interface VirtualElement {
  getBoundingClientRect(): Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;
  contextElement?: Element;
}

export type PositionReference = Element | VirtualElement;

/** The element a reference lives in: itself, or a virtual reference's context. */
export function referenceElement(reference: PositionReference): Element | undefined {
  return isElement(reference) ? reference : reference.contextElement;
}

function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

/** A reference's border box in viewport coordinates. */
export function measureRect(target: PositionReference): Rect {
  const box = target.getBoundingClientRect();
  return rect(box.x, box.y, box.width, box.height);
}

/**
 * The visible viewport: the visual viewport when the window has one (pinch
 * zoom, an on-screen keyboard), else the layout viewport without scrollbars.
 */
export function getViewportRect(ownerWindow: Window): Rect {
  const visual = ownerWindow.visualViewport;
  if (visual) return rect(visual.offsetLeft, visual.offsetTop, visual.width, visual.height);
  const root = ownerWindow.document.documentElement;
  return rect(0, 0, root.clientWidth, root.clientHeight);
}

/** A container's padding box without its scrollbars, in viewport coordinates. */
export function getContainerRect(container: Element): Rect {
  const box = container.getBoundingClientRect();
  return rect(
    box.x + container.clientLeft,
    box.y + container.clientTop,
    container.clientWidth || box.width,
    container.clientHeight || box.height
  );
}

/** The overlap of two rects (a zero-size rect when they do not meet). */
export function intersectRects(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return rect(
    x,
    y,
    Math.min(a.x + a.width, b.x + b.width) - x,
    Math.min(a.y + a.height, b.y + b.height) - y
  );
}

const SCROLLS = /auto|scroll|overlay|hidden|clip/;

/**
 * Every ancestor whose scrolling moves `node`, nearest first, crossing shadow
 * roots, and finally the window. Scroll events do not bubble, so auto-update
 * listens on each of these.
 */
export function getScrollAncestors(node: Node | undefined): (Element | Window)[] {
  const ownerWindow = getOwnerWindow(node);
  if (!node || !ownerWindow) return [];
  const doc = getOwnerDocument(node);
  const found: (Element | Window)[] = [];
  let current: Node | null = node.parentNode;
  while (current && current !== doc && current !== doc?.documentElement) {
    if (current.nodeType === 11) {
      current = (current as ShadowRoot).host;
      continue;
    }
    if (current.nodeType === 1) {
      const style = ownerWindow.getComputedStyle(current as Element);
      if (SCROLLS.test(`${style.overflow}${style.overflowX}${style.overflowY}`)) {
        found.push(current as Element);
      }
    }
    current = current.parentNode;
  }
  found.push(ownerWindow);
  return found;
}

/** The text direction an element renders with (its computed `direction`). */
export function readDirection(element: Element | undefined): 'ltr' | 'rtl' {
  const ownerWindow = getOwnerWindow(element);
  if (!element || !ownerWindow) return 'ltr';
  return ownerWindow.getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
}
