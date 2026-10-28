/**
 * The print readiness gate: a print view is ready once nothing under it is
 * still loading (lazy layouts, component families, slide previews, code
 * tokenizing), every image has loaded or failed, and fonts are settled.
 * Browser-only and dependency-free; the print view calls it.
 */

/** Markers of content that is still painting. */
export const DECK_PRINT_UNSETTLED = [
  '.tx-deck-stage__loading',
  '[data-tx-deck-preview-ready="false"]',
  '[data-tx-block="code"][data-grammar]:not([data-grammar="none"]):not([data-tokenized])',
].join(', ');

export interface DeckPrintSettleResult {
  /** False when the timeout elapsed first (the view prints what it has). */
  settled: boolean;
  /** Images still pending at the end. */
  pendingImages: number;
}

function nextFrame(view: Window | null): Promise<void> {
  return new Promise((resolve) => {
    if (view && typeof view.requestAnimationFrame === 'function') {
      view.requestAnimationFrame(() => resolve());
    } else setTimeout(resolve, 16);
  });
}

function pendingImages(root: Element): HTMLImageElement[] {
  return [...root.querySelectorAll('img')].filter((image) => {
    // Print cannot rely on lazy loading: off-screen pages must load now.
    image.loading = 'eager';
    return !image.complete;
  });
}

/** Wait until `root` holds no loading markers and no pending images, then fonts. */
export async function settleDeckPrint(
  root: Element,
  timeoutMs = 10_000,
  isActive: () => boolean = () => true
): Promise<DeckPrintSettleResult> {
  const view = root.ownerDocument.defaultView;
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let quiet = 0;
  // Two quiet frames in a row: a family that just mounted may start a nested load.
  while (isActive() && Date.now() < deadline) {
    const busy = root.querySelector(DECK_PRINT_UNSETTLED) !== null;
    const images = pendingImages(root);
    if (!busy && images.length === 0) {
      quiet += 1;
      if (quiet >= 2) break;
    } else quiet = 0;
    if (images.length > 0 && !busy) {
      await Promise.race([
        Promise.all(
          images.map(
            (image) =>
              new Promise<void>((resolve) => {
                image.addEventListener('load', () => resolve(), { once: true });
                image.addEventListener('error', () => resolve(), { once: true });
              })
          )
        ),
        new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now()))),
      ]);
    } else await nextFrame(view);
  }
  const fonts = (root.ownerDocument as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (fonts?.ready) {
    await Promise.race([
      fonts.ready.catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now()))),
    ]);
  }
  await nextFrame(view);
  const left = pendingImages(root).length;
  const settled = root.querySelector(DECK_PRINT_UNSETTLED) === null && left === 0;
  return { settled, pendingImages: left };
}
