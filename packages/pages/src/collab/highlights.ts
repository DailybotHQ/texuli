/**
 * Highlights without touching the editor's DOM: comment and suggestion
 * ranges are painted with the CSS Custom Highlight API (`::highlight()`),
 * which never changes the contenteditable tree and never reaches the
 * accessibility tree (the sidebar is the accessible view). Where the API is
 * missing the text is not painted; the sidebar still lists everything.
 *
 * Highlights are registered by name on the page, so several editors share
 * one `Highlight` per name: each layer adds and removes only its own ranges.
 */
import { BLOCK_ATTR, pointToDom } from '@texuli/editor/editor';

/** Highlight names (style them with `::highlight(<name>)`). */
export const HIGHLIGHT_NAMES = Object.freeze({
  comment: 'tx-pages-comment',
  active: 'tx-pages-comment-active',
  insert: 'tx-pages-suggest-insert',
  delete: 'tx-pages-suggest-delete',
  /** Remote selections, one name per token color: `tx-pages-remote-1` to `-8`. */
  remote: (color: number) => `tx-pages-remote-${(Math.abs(Math.trunc(color)) % 8) + 1}`,
});

interface HighlightLike {
  add(range: AbstractRange): unknown;
  delete(range: AbstractRange): unknown;
  priority: number;
}

interface HighlightRegistryLike {
  get(name: string): HighlightLike | undefined;
  set(name: string, highlight: HighlightLike): unknown;
}

function registry(): HighlightRegistryLike | null {
  const css = (globalThis as { CSS?: { highlights?: HighlightRegistryLike } }).CSS;
  const Ctor = (globalThis as { Highlight?: new () => HighlightLike }).Highlight;
  return css?.highlights && typeof Ctor === 'function' ? css.highlights : null;
}

/** True when this browser paints `::highlight()` ranges. */
export function supportsHighlights(): boolean {
  return registry() !== null;
}

/** The text block element of a document block inside `root`. */
export function blockElement(root: Element, block: string): Element | null {
  for (const element of root.querySelectorAll(`[${BLOCK_ATTR}]`))
    if (element.getAttribute(BLOCK_ATTR) === block) return element;
  return null;
}

/** A DOM range over a UTF-16 range of a block's text, or `null` when the block is not rendered. */
export function rangeFor(root: Element, block: string, from: number, to: number): Range | null {
  const element = blockElement(root, block);
  if (!element) return null;
  const start = pointToDom(element, from);
  const end = pointToDom(element, Math.max(from, to));
  const range = element.ownerDocument.createRange();
  try {
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
  } catch {
    return null;
  }
  return range;
}

const PRIORITY: Record<string, number> = {
  'tx-pages-comment': 1,
  'tx-pages-comment-active': 2,
  'tx-pages-suggest-insert': 3,
  'tx-pages-suggest-delete': 3,
};

/** One editor's share of the page's highlights. */
export class HighlightLayer {
  readonly #owned = new Map<string, Range[]>();

  /** Replace this layer's ranges under `name`. */
  set(name: string, ranges: readonly Range[]): void {
    const highlights = registry();
    if (!highlights) return;
    let highlight = highlights.get(name);
    if (!highlight) {
      const Ctor = (globalThis as unknown as { Highlight: new () => HighlightLike }).Highlight;
      highlight = new Ctor();
      highlight.priority = PRIORITY[name] ?? 0;
      highlights.set(name, highlight);
    }
    for (const range of this.#owned.get(name) ?? []) highlight.delete(range);
    for (const range of ranges) highlight.add(range);
    this.#owned.set(name, [...ranges]);
  }

  /** Remove every range this layer added. */
  clear(): void {
    const highlights = registry();
    for (const [name, ranges] of this.#owned) {
      const highlight = highlights?.get(name);
      if (highlight) for (const range of ranges) highlight.delete(range);
    }
    this.#owned.clear();
  }
}
