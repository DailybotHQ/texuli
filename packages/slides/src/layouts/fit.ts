/**
 * Keeps layout content inside the canvas (ported from Protoyard's
 * `design/fit.ts`). Layout CSS clamps lines first; these attachments handle
 * what CSS cannot know (an unusually long title, a dense table) by measuring
 * and shrinking down to a floor that keeps the deck text minimums. They only
 * write CSSOM properties (`style.fontSize`, `style.zoom`), which a strict CSP
 * allows, and do nothing where layout is not measurable (SSR, tests).
 */

/** Minimum rendered sizes on the canvas, in canvas pixels (deck lint reads the same numbers). */
export const LAYOUT_TEXT_MINIMUMS = Object.freeze({ bodyPx: 24, labelPx: 18 });

/**
 * The zoom that makes `needed` px fit in `available` px, never above 1 and
 * never below `min`. Zero or invalid sizes (not laid out yet) give 1.
 */
export function fitScale(needed: number, available: number, min: number): number {
  if (!(needed > 0) || !(available > 0)) return 1;
  // A couple of pixels of rounding never justify shrinking a slide.
  if (needed <= available + 2) return 1;
  return Math.max(min, Math.floor((available / needed) * 1000) / 1000);
}

/**
 * The font size that fits, stepping down 6 % at a time from `start` and
 * stopping at `minPx`. `overflows(size)` reports whether `size` still overflows.
 */
export function fitFontSize(
  start: number,
  minPx: number,
  overflows: (size: number) => boolean
): number {
  let size = start;
  let guard = 0;
  while (size > minPx && overflows(size) && guard < 40) {
    size = Math.max(minPx, Math.round(size * 0.94 * 10) / 10);
    guard += 1;
  }
  return size;
}

type Box = Pick<HTMLElement, 'scrollHeight' | 'clientHeight' | 'scrollWidth' | 'clientWidth'>;

/**
 * True when a (line-clamped) text box hides content. Glyph ascenders and
 * descenders make `scrollHeight` a few pixels taller than a tight line box,
 * so only half a line or more counts.
 */
export function textOverflows(node: Box, fontSize: number): boolean {
  const tolerance = Math.max(4, fontSize * 0.5);
  return (
    node.scrollHeight > node.clientHeight + tolerance ||
    node.scrollWidth > node.clientWidth + tolerance
  );
}

function watch(node: HTMLElement, run: () => void): () => void {
  if (typeof requestAnimationFrame !== 'function') return () => {};
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(run);
  };
  schedule();
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  resize?.observe(node);
  // Images, fonts and lazy block families change the size after the first measure.
  node.addEventListener('load', schedule, true);
  const mutations = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null;
  mutations?.observe(node, { childList: true, subtree: true });
  return () => {
    cancelAnimationFrame(frame);
    resize?.disconnect();
    mutations?.disconnect();
    node.removeEventListener('load', schedule, true);
  };
}

/**
 * Steps one text element's font size down until it no longer overflows its
 * box (CSS sets the starting size and a line clamp), never below `minPx`.
 */
export function fitText(minPx: number) {
  return (node: HTMLElement) =>
    watch(node, () => {
      node.style.fontSize = '';
      const start = Number.parseFloat(getComputedStyle(node).fontSize) || 0;
      if (!start || node.clientHeight === 0) return;
      const size = fitFontSize(start, minPx, (candidate) => {
        node.style.fontSize = `${candidate}px`;
        return textOverflows(node, candidate);
      });
      node.style.fontSize = size < start ? `${size}px` : '';
      node.dataset.txDeckFit = size < start ? String(size) : '1';
    });
}

/**
 * Zooms `node` (CSS `zoom`, so layout follows) until its content fits its own
 * box, never below `min` (0.75 keeps 24 px body text at the 18 px label floor).
 */
export function fitContent(min = 0.75) {
  return (node: HTMLElement) =>
    watch(node, () => {
      node.style.zoom = '';
      if (node.clientHeight === 0) return;
      let scale = fitScale(node.scrollHeight, node.clientHeight, min);
      // Content reflows under the zoom, so tighten until it fits there too.
      for (let pass = 0; scale < 1 && pass < 6; pass += 1) {
        node.style.zoom = String(scale);
        if (node.scrollHeight <= node.clientHeight + 2 || scale <= min) break;
        scale = Math.max(
          min,
          Math.floor(scale * (node.clientHeight / node.scrollHeight) * 1000) / 1000
        );
      }
      node.style.zoom = scale < 1 ? String(scale) : '';
      node.dataset.txDeckFit = scale < 1 ? String(scale) : '1';
    });
}
