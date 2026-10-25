interface InlineStyleValue {
  value: string;
  priority: string;
}

interface ScrollLockState {
  count: number;
  body: HTMLElement;
  root: HTMLElement;
  ownerWindow: Window | null;
  scrollX: number;
  scrollY: number;
  ios: boolean;
  rootStyles: Map<string, InlineStyleValue>;
  bodyStyles: Map<string, InlineStyleValue>;
}

const states = new WeakMap<Document, ScrollLockState>();
const ROOT_PROPERTIES = ['overflow', 'overscroll-behavior'] as const;
const BODY_PROPERTIES = [
  'overflow',
  'padding-inline-end',
  'position',
  'top',
  'inset-inline-start',
  'inline-size',
  'box-sizing',
] as const;

function captureStyles(
  element: HTMLElement,
  properties: readonly string[]
): Map<string, InlineStyleValue> {
  return new Map(
    properties.map((property) => [
      property,
      {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
      },
    ])
  );
}

function restoreStyles(element: HTMLElement, values: Map<string, InlineStyleValue>): void {
  for (const [property, { value, priority }] of values) {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  }
}

function setLockedStyle(element: HTMLElement, property: string, value: string): void {
  // An author stylesheet may mark these properties important. The lock must
  // still take effect, and the exact inline value/priority is restored later.
  element.style.setProperty(property, value, 'important');
}

function isIos(ownerWindow: Window | null): boolean {
  if (!ownerWindow) return false;
  const { navigator } = ownerWindow;
  const userAgent = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function readScrollPosition(
  document: Document,
  ownerWindow: Window | null
): { x: number; y: number } {
  const scrollingElement = document.scrollingElement;
  return {
    x: ownerWindow?.scrollX ?? scrollingElement?.scrollLeft ?? 0,
    y: ownerWindow?.scrollY ?? scrollingElement?.scrollTop ?? 0,
  };
}

function scrollbarGutter(root: HTMLElement, body: HTMLElement, ownerWindow: Window | null): number {
  if (!ownerWindow) return 0;
  const rootGutter = ownerWindow.getComputedStyle(root).scrollbarGutter;
  const bodyGutter = ownerWindow.getComputedStyle(body).scrollbarGutter;
  if (/(^|\s)stable(\s|$)/i.test(`${rootGutter} ${bodyGutter}`)) return 0;
  const rootStyle = ownerWindow.getComputedStyle(root);
  const borders =
    (Number.parseFloat(rootStyle.borderInlineStartWidth) || 0) +
    (Number.parseFloat(rootStyle.borderInlineEndWidth) || 0);
  return Math.max(0, ownerWindow.innerWidth - root.clientWidth - borders);
}

function applyLock(state: ScrollLockState): void {
  const { body, root, ownerWindow, ios, scrollY } = state;
  const gutter = scrollbarGutter(root, body, ownerWindow);
  const computedPadding = ownerWindow?.getComputedStyle(body).paddingInlineEnd ?? '0px';
  const padding = Number.parseFloat(computedPadding);

  setLockedStyle(root, 'overflow', 'hidden');
  setLockedStyle(root, 'overscroll-behavior', 'none');
  setLockedStyle(body, 'overflow', 'hidden');

  if (gutter > 0 && Number.isFinite(padding)) {
    setLockedStyle(body, 'padding-inline-end', `${padding + gutter}px`);
  }

  if (ios) {
    setLockedStyle(body, 'position', 'fixed');
    setLockedStyle(body, 'top', `${-scrollY}px`);
    setLockedStyle(body, 'inset-inline-start', '0');
    setLockedStyle(body, 'inline-size', '100%');
    setLockedStyle(body, 'box-sizing', 'border-box');
  }
}

function restore(state: ScrollLockState): void {
  restoreStyles(state.body, state.bodyStyles);
  restoreStyles(state.root, state.rootStyles);
  if (state.ios) state.ownerWindow?.scrollTo(state.scrollX, state.scrollY);
}

function releaseFor(document: Document): () => void {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    const state = states.get(document);
    if (!state) return;
    state.count -= 1;
    if (state.count > 0) return;
    states.delete(document);
    restore(state);
  };
}

/**
 * Locks page scrolling for a modal layer and returns an idempotent unlock
 * function. Locks are reference-counted per document, so nested dialogs keep
 * the page locked until the last one closes. Existing inline styles and their
 * priorities are restored exactly. Pass the owning document explicitly so
 * this module remains safe to import during SSR; without a document body this
 * returns a no-op cleanup function.
 */
export function lockScroll(document: Document): () => void {
  const current = states.get(document);
  if (current) {
    current.count += 1;
    return releaseFor(document);
  }

  const body = document.body;
  const root = document.documentElement;
  if (!body || !root) return () => {};

  const ownerWindow = document.defaultView;
  const position = readScrollPosition(document, ownerWindow);
  const state: ScrollLockState = {
    count: 1,
    body,
    root,
    ownerWindow,
    scrollX: position.x,
    scrollY: position.y,
    ios: isIos(ownerWindow),
    rootStyles: captureStyles(root, ROOT_PROPERTIES),
    bodyStyles: captureStyles(body, BODY_PROPERTIES),
  };

  applyLock(state);
  states.set(document, state);
  return releaseFor(document);
}
