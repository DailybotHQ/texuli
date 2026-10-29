/**
 * Block lists as data: the reading order of rows (for arrow-key handoff),
 * the sortable containers the drag engine works on, and where a keyboard
 * move lands. Framework-free; every walk is iterative.
 */

import type { DocumentBlock, DocumentBlockId, TexuliDocument } from '@texuli/document/model';
import type { SortableContainer } from '@texuli/drag/sortable';
import { isTextRow } from './text.ts';

/** The container id of the top-level block list (`:` never occurs in a block id). */
export const ROOT_LIST = ':root';

/** The drag group every block list shares, so blocks move between lists. */
export const BLOCK_GROUP = 'pages-blocks';

/** The block lists a row may hold: callouts, toggles, columns and quotes that are not text rows. */
export function childList(block: DocumentBlock): readonly DocumentBlock[] | null {
  if (block.type === 'callout' || block.type === 'toggle') return block.blocks;
  if (block.type === 'quote' && !isTextRow(block)) return block.blocks;
  return null;
}

/** A parent id from a list id (`null` for the top level). */
export const parentOfList = (list: string): DocumentBlockId | null =>
  list === ROOT_LIST ? null : list;

/** A list id from a parent id. */
export const listOfParent = (parent: DocumentBlockId | null): string => parent ?? ROOT_LIST;

/**
 * Every block list in the document as a sortable container, in reading
 * order: the top level, then each container's list. Nested lists carry the
 * row that holds them as `parentId`, so a block never drops into itself.
 */
export function blockContainers(doc: Pick<TexuliDocument, 'blocks'>): SortableContainer[] {
  const out: SortableContainer[] = [
    { id: ROOT_LIST, items: doc.blocks.map((block) => block.id), group: BLOCK_GROUP },
  ];
  const stack: { blocks: readonly DocumentBlock[] }[] = [{ blocks: doc.blocks }];
  while (stack.length > 0) {
    const { blocks } = stack.pop() as { blocks: readonly DocumentBlock[] };
    for (const block of blocks) {
      const children = childList(block);
      if (children) {
        out.push({
          id: block.id,
          items: children.map((child) => child.id),
          group: BLOCK_GROUP,
          parentId: block.id,
        });
        stack.push({ blocks: children });
      } else if (block.type === 'columns') {
        for (const column of block.columns) {
          out.push({
            id: column.id,
            items: column.blocks.map((child) => child.id),
            group: BLOCK_GROUP,
            parentId: block.id,
          });
          stack.push({ blocks: column.blocks });
        }
      }
    }
  }
  return out;
}

/**
 * Row ids in reading order (top level, then into callouts, open toggles,
 * quotes and each column in turn): the order arrow keys walk.
 */
export function rowOrder(doc: Pick<TexuliDocument, 'blocks'>): DocumentBlockId[] {
  const out: DocumentBlockId[] = [];
  const stack: DocumentBlock[] = [];
  for (let i = doc.blocks.length - 1; i >= 0; i -= 1) stack.push(doc.blocks[i] as DocumentBlock);
  while (stack.length > 0) {
    const block = stack.pop() as DocumentBlock;
    out.push(block.id);
    let children: readonly DocumentBlock[] = [];
    if (block.type === 'columns') children = block.columns.flatMap((column) => column.blocks);
    else if (block.type === 'toggle') children = block.open === false ? [] : block.blocks;
    else children = childList(block) ?? [];
    for (let i = children.length - 1; i >= 0; i -= 1) stack.push(children[i] as DocumentBlock);
  }
  return out;
}

/** The row before or after `id` in reading order, or `null` at the ends. */
export function adjacentRow(
  doc: Pick<TexuliDocument, 'blocks'>,
  id: DocumentBlockId,
  direction: -1 | 1
): DocumentBlockId | null {
  const order = rowOrder(doc);
  const index = order.indexOf(id);
  if (index < 0) return null;
  return order[index + direction] ?? null;
}

/** Where a keyboard move by `delta` lands among `count` siblings: the final index, or `null`. */
export function moveTarget(index: number, delta: number, count: number): number | null {
  const target = index + delta;
  if (!Number.isInteger(target) || target < 0 || target >= count || target === index) return null;
  return target;
}
