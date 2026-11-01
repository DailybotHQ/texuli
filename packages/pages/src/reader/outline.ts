/**
 * The reader's headings outline and anchors: every heading block, in
 * reading order (inside callouts, toggles, quotes and columns too), gets a
 * stable, unique anchor from its text. Framework-free; one iterative walk.
 */
import {
  type DocumentBlock,
  type DocumentBlockId,
  type DocumentHeadingLevel,
  type HeadingBlock,
  inlinePlainText,
  type TexuliDocument,
} from '@texuli/document/model';

export interface OutlineEntry {
  /** The heading block's id. */
  id: DocumentBlockId;
  /** The `id` attribute the heading renders with (the `#` target). */
  anchor: string;
  level: DocumentHeadingLevel;
  text: string;
}

/** A URL-fragment-safe slug: folded, lower case, `a-z`, `0-9` and single dashes, at most 64 characters. */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return slug || 'section';
}

/**
 * A host's own anchor for a heading (for example its block id, so existing
 * `#overview` links keep resolving); `undefined` falls back to the slug.
 */
export type HeadingAnchorFor = (block: HeadingBlock) => string | null | undefined;

/** A fragment-safe host anchor: a letter, then letters, digits, `_` or `-`, at most 64 characters. */
const HOST_ANCHOR = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export interface DocumentOutlineOptions {
  /** Put before every anchor, the host's own included. */
  prefix?: string;
  /**
   * The host's anchor for a heading. Used when it is fragment-safe and not
   * already taken; otherwise the heading gets its slug.
   */
  anchorFor?: HeadingAnchorFor;
}

/**
 * Every heading of the document with a unique anchor (`prefix` + the host's
 * `anchorFor` id, or `prefix` + slug with `-2`, `-3`… for repeats), in
 * reading order.
 */
export function documentOutline(
  doc: Pick<TexuliDocument, 'blocks'>,
  options: DocumentOutlineOptions = {}
): OutlineEntry[] {
  const prefix = options.prefix ?? '';
  const anchorFor = options.anchorFor;
  const used = new Map<string, number>();
  const taken = new Set<string>();
  const out: OutlineEntry[] = [];
  const stack: DocumentBlock[] = [];
  for (let i = doc.blocks.length - 1; i >= 0; i -= 1) stack.push(doc.blocks[i] as DocumentBlock);
  while (stack.length > 0) {
    const block = stack.pop() as DocumentBlock;
    let children: readonly DocumentBlock[] = [];
    if (block.type === 'heading') {
      const text = inlinePlainText(block.content).replace(/\s+/g, ' ').trim();
      let own: unknown;
      try {
        own = anchorFor?.(block);
      } catch {
        own = undefined;
      }
      let anchor = typeof own === 'string' && HOST_ANCHOR.test(own) ? `${prefix}${own}` : '';
      if (!anchor || taken.has(anchor)) {
        const base = `${prefix}${slugify(text)}`;
        let count = used.get(base) ?? 0;
        do {
          count += 1;
          anchor = count === 1 ? base : `${base}-${count}`;
        } while (taken.has(anchor));
        used.set(base, count);
      }
      taken.add(anchor);
      out.push({
        id: block.id,
        anchor,
        level: block.level,
        text,
      });
    } else if (block.type === 'quote' || block.type === 'callout' || block.type === 'toggle') {
      children = block.blocks;
    } else if (block.type === 'columns') {
      children = block.columns.flatMap((column) => column.blocks);
    }
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i] as DocumentBlock);
  }
  return out;
}
