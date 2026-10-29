/**
 * The reader's headings outline and anchors: every heading block, in
 * reading order (inside callouts, toggles, quotes and columns too), gets a
 * stable, unique anchor from its text. Framework-free; one iterative walk.
 */
import {
  type DocumentBlock,
  type DocumentBlockId,
  type DocumentHeadingLevel,
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
 * Every heading of the document with a unique anchor (`prefix` + slug,
 * `-2`, `-3`… for repeats), in reading order.
 */
export function documentOutline(
  doc: Pick<TexuliDocument, 'blocks'>,
  options: { prefix?: string } = {}
): OutlineEntry[] {
  const prefix = options.prefix ?? '';
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
      const base = `${prefix}${slugify(text)}`;
      let count = used.get(base) ?? 0;
      let anchor = base;
      do {
        count += 1;
        anchor = count === 1 ? base : `${base}-${count}`;
      } while (taken.has(anchor));
      used.set(base, count);
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
