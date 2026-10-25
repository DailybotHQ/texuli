/**
 * Returns whether this function is running with browser globals available.
 * The check happens only when called, so importing the core package is SSR-safe.
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Returns the node's document, including when `node` is itself a Document. */
export function getOwnerDocument(node: Node | null | undefined): Document | undefined {
  if (!node) return undefined;
  return node.nodeType === 9 ? (node as Document) : (node.ownerDocument ?? undefined);
}

/** Returns the window that owns a node, or `undefined` when it has no browsing context. */
export function getOwnerWindow(node: Node | null | undefined): Window | undefined {
  return getOwnerDocument(node)?.defaultView ?? undefined;
}

/**
 * Adds an event listener when a target exists and returns an idempotent cleanup
 * function. Passing no target is safe during SSR and returns a no-op cleanup.
 */
export function listen(
  target: EventTarget | null | undefined,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions
): () => void {
  if (!target) return () => {};

  target.addEventListener(type, listener, options);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    target.removeEventListener(type, listener, options);
  };
}

/**
 * Reads a media query without requiring browser globals. On the server (or
 * when a window does not implement `matchMedia`), `ssrDefault` is returned.
 */
export function matchesMedia(
  query: string,
  ownerWindow?: Pick<Window, 'matchMedia'> | null,
  ssrDefault = false
): boolean {
  if (!ownerWindow || typeof ownerWindow.matchMedia !== 'function') return ssrDefault;
  return ownerWindow.matchMedia(query).matches;
}

type AnimationFrameHost = Partial<Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>>;

/**
 * Schedules a frame and returns its cleanup function. Without a frame-capable
 * window, a timeout approximates the next frame and reports a monotonic time.
 */
export function requestFrame(
  callback: FrameRequestCallback,
  ownerWindow?: AnimationFrameHost | null
): () => void {
  if (ownerWindow?.requestAnimationFrame) {
    const id = ownerWindow.requestAnimationFrame.call(ownerWindow as Window, callback);
    return () => ownerWindow.cancelAnimationFrame?.call(ownerWindow as Window, id);
  }

  const id = setTimeout(() => callback(globalThis.performance?.now() ?? 0), 16);
  return () => clearTimeout(id);
}
