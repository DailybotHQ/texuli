/**
 * DOM measurement for the paged view: a rendered block's height and the
 * places it may split (the bottoms of its text lines), in CSS pixels. Line
 * boxes come from `Range.getClientRects()` over the block's text, merged
 * per visual line; a split never cuts through an image, a canvas, an
 * embedded frame or a table row.
 */
import type { UnitMeasure } from '@texuli/document/paged';

/** Elements a split never cuts through. */
export const ATOMIC_SELECTOR = 'img, svg, video, canvas, iframe, tr, [data-paged-atomic]';

/** Merge vertical intervals that overlap (one visual line) and return their bottoms, ascending. */
export function lineBottoms(intervals: readonly (readonly [number, number])[]): number[] {
  const sorted = intervals
    .filter(([top, bottom]) => Number.isFinite(top) && Number.isFinite(bottom) && bottom > top)
    .slice()
    .sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  let end = Number.NEGATIVE_INFINITY;
  for (const [top, bottom] of sorted) {
    // A rect that starts above the current line's bottom belongs to that line.
    if (top < end - 0.5) {
      end = Math.max(end, bottom);
      out[out.length - 1] = end;
    } else {
      end = bottom;
      out.push(end);
    }
  }
  return out;
}

/** Drop split points that fall inside an atomic element. */
export function splitPoints(
  bottoms: readonly number[],
  atoms: readonly (readonly [number, number])[],
  height: number
): number[] {
  return bottoms.filter(
    (y) => y > 0 && y < height && !atoms.some(([top, bottom]) => y > top + 0.5 && y < bottom - 0.5)
  );
}

/** Measure one rendered top-level block. */
export function measureUnit(element: HTMLElement): UnitMeasure {
  const box = element.getBoundingClientRect();
  const origin = box.top;
  const height = box.height;
  const atoms: [number, number][] = [];
  for (const atom of element.querySelectorAll(ATOMIC_SELECTOR)) {
    const rect = atom.getBoundingClientRect();
    if (rect.height > 0) atoms.push([rect.top - origin, rect.bottom - origin]);
  }
  const owner = element.ownerDocument;
  const walker = owner.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = owner.createRange();
  const intervals: [number, number][] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue?.trim()) continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) {
      if (rect.height > 0) intervals.push([rect.top - origin, rect.bottom - origin]);
    }
  }
  range.detach?.();
  return { height, lines: splitPoints(lineBottoms(intervals), atoms, height) };
}
