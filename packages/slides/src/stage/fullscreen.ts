/**
 * Fullscreen state of a `DeckStage`: `native` uses the Fullscreen API;
 * `viewport` is the fallback where the stage fills the browser window.
 */
export type DeckFullscreenState = 'off' | 'native' | 'viewport';

/** Whether `element` can enter native fullscreen in `doc`. */
export function canUseNativeFullscreen(element: Element | undefined, doc: Document): boolean {
  return Boolean(
    element && typeof element.requestFullscreen === 'function' && doc.fullscreenEnabled === true
  );
}
