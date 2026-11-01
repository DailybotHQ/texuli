/**
 * Text rows: a top-level text block of a block list is edited by its own
 * `@texuli/editor` surface over a one-block editor document. The document
 * text blocks are the core editor vocabulary (ADR-011), so the mapping is
 * the identity; what the editor changes comes back as document operations
 * addressed by persisted id, never as a mutated tree.
 */
import type { EditorBlock, EditorDocument } from '@texuli/core/editor-model';
import type { DocumentBlock, DocumentBlockId, DocumentInline } from '@texuli/document/model';
import { type DocumentOperation, equalData } from '@texuli/document/ops-core';

/** Block types a text row edits through the editor surface. */
export const TEXT_ROW_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'code',
  'list',
  'quote',
]);

const EDITOR_TYPES: ReadonlySet<string> = new Set([
  'paragraph',
  'heading',
  'code',
  'list',
  'quote',
  'divider',
  'media',
]);

/**
 * True when the block and everything inside it is core editor vocabulary,
 * so one editor surface can hold it (a quote that holds a callout cannot).
 * Iterative and bounded by the document caps.
 */
export function isEditorBlock(block: DocumentBlock): boolean {
  const stack: DocumentBlock[] = [block];
  while (stack.length > 0) {
    const current = stack.pop() as DocumentBlock;
    if (!EDITOR_TYPES.has(current.type)) return false;
    if (current.type === 'quote') stack.push(...current.blocks);
    else if (current.type === 'list') for (const item of current.items) stack.push(...item.blocks);
  }
  return true;
}

/** True when the block is edited as a text row. */
export function isTextRow(block: DocumentBlock): boolean {
  return TEXT_ROW_TYPES.has(block.type) && isEditorBlock(block);
}

/** The one-block editor document a text row's surface edits. */
export function rowEditorDocument(block: DocumentBlock): EditorDocument {
  return { version: 1, blocks: [block as unknown as EditorBlock] };
}

/** UTF-16 length of inline content; a break counts 1 (the document's offsets). */
export function inlineLength(content: readonly DocumentInline[]): number {
  let length = 0;
  for (const part of content) length += part.type === 'break' ? 1 : part.text.length;
  return length;
}

function textOf(block: DocumentBlock): readonly DocumentInline[] {
  if (block.type === 'paragraph' || block.type === 'heading') return block.content;
  if (block.type === 'code')
    return block.text ? [{ type: 'text', text: block.text, marks: [] }] : [];
  return [];
}

/** Operations that turn `previous` into `next` when both keep the same id. */
export function updateOperations(
  previous: DocumentBlock,
  next: DocumentBlock,
  parent: DocumentBlockId | null,
  index: number
): DocumentOperation[] {
  if (equalData(previous, next)) return [];
  const sameText =
    previous.type === next.type &&
    (next.type === 'paragraph' || next.type === 'heading' || next.type === 'code');
  if (sameText) {
    const ops: DocumentOperation[] = [];
    if (next.type === 'heading' && previous.type === 'heading' && next.level !== previous.level)
      ops.push({ op: 'set-attrs', id: next.id, attrs: { level: next.level } });
    if (next.type === 'code' && previous.type === 'code' && next.lang !== previous.lang)
      ops.push({ op: 'set-attrs', id: next.id, attrs: { lang: next.lang ?? null } });
    const before = textOf(previous);
    const after = textOf(next);
    if (!equalData(before, after))
      ops.push({
        op: 'replace-text',
        id: next.id,
        from: 0,
        to: inlineLength(before),
        content: after.map((part) => ({ ...part })) as DocumentInline[],
      });
    return ops;
  }
  return [
    { op: 'remove-node', id: previous.id },
    { op: 'insert-node', parent, index, node: next },
  ];
}

/**
 * The operations for one text row whose editor document changed: the row
 * block `previous` (at `index` of `parent`) became the editor blocks `next`
 * (a split adds blocks around it, a conversion replaces it).
 */
export function textRowOperations(
  parent: DocumentBlockId | null,
  index: number,
  previous: DocumentBlock,
  next: readonly EditorBlock[]
): DocumentOperation[] {
  const blocks = next as unknown as readonly DocumentBlock[];
  const keep = blocks.findIndex((block) => block.id === previous.id);
  const ops: DocumentOperation[] = [];
  if (keep < 0) {
    ops.push({ op: 'remove-node', id: previous.id });
    blocks.forEach((block, offset) => {
      ops.push({ op: 'insert-node', parent, index: index + offset, node: block });
    });
    return ops;
  }
  for (let offset = 0; offset < keep; offset += 1)
    ops.push({
      op: 'insert-node',
      parent,
      index: index + offset,
      node: blocks[offset] as DocumentBlock,
    });
  ops.push(...updateOperations(previous, blocks[keep] as DocumentBlock, parent, index + keep));
  for (let offset = keep + 1; offset < blocks.length; offset += 1)
    ops.push({
      op: 'insert-node',
      parent,
      index: index + offset,
      node: blocks[offset] as DocumentBlock,
    });
  return ops;
}

/** The first and last text leaf ids of an editor block (caret targets). */
export function textLeaves(block: DocumentBlock): { first: string | null; last: string | null } {
  const ids: string[] = [];
  const stack: DocumentBlock[] = [block];
  while (stack.length > 0) {
    const current = stack.pop() as DocumentBlock;
    if (current.type === 'paragraph' || current.type === 'heading' || current.type === 'code')
      ids.push(current.id);
    else if (current.type === 'quote')
      for (let i = current.blocks.length - 1; i >= 0; i -= 1)
        stack.push(current.blocks[i] as DocumentBlock);
    else if (current.type === 'list')
      for (let i = current.items.length - 1; i >= 0; i -= 1) {
        const item = current.items[i];
        if (!item) continue;
        for (let j = item.blocks.length - 1; j >= 0; j -= 1)
          stack.push(item.blocks[j] as DocumentBlock);
      }
  }
  return { first: ids[0] ?? null, last: ids.at(-1) ?? null };
}

/** True when `id` is the block or a node inside it (iterative). */
export function containsId(block: DocumentBlock, id: string): boolean {
  const stack: DocumentBlock[] = [block];
  while (stack.length > 0) {
    const current = stack.pop() as DocumentBlock;
    if (current.id === id) return true;
    if (current.type === 'quote' || current.type === 'callout' || current.type === 'toggle')
      stack.push(...current.blocks);
    else if (current.type === 'list')
      for (const item of current.items) {
        if (item.id === id) return true;
        stack.push(...item.blocks);
      }
    else if (current.type === 'columns')
      for (const column of current.columns) {
        if (column.id === id) return true;
        stack.push(...column.blocks);
      }
  }
  return false;
}

/** The text length of a text leaf inside a block (0 when absent). */
export function leafLength(block: DocumentBlock, leaf: string): number {
  const stack: DocumentBlock[] = [block];
  while (stack.length > 0) {
    const current = stack.pop() as DocumentBlock;
    if (current.id === leaf) return inlineLength(textOf(current));
    if (current.type === 'quote') stack.push(...current.blocks);
    else if (current.type === 'list') for (const item of current.items) stack.push(...item.blocks);
  }
  return 0;
}

/** A short plain-text excerpt of a block for names and announcements. */
export function blockExcerpt(block: DocumentBlock, max = 40): string {
  let text = '';
  const stack: DocumentBlock[] = [block];
  while (stack.length > 0 && text.length < max) {
    const current = stack.pop() as DocumentBlock;
    switch (current.type) {
      case 'paragraph':
      case 'heading':
        for (const part of current.content) text += part.type === 'break' ? ' ' : part.text;
        text += ' ';
        break;
      case 'code':
        text += `${current.text} `;
        break;
      case 'quote':
      case 'callout':
        for (let i = current.blocks.length - 1; i >= 0; i -= 1)
          stack.push(current.blocks[i] as DocumentBlock);
        if (current.type === 'callout' && current.title) text += `${current.title} `;
        break;
      case 'toggle':
        for (const part of current.summary) text += part.type === 'break' ? ' ' : part.text;
        text += ' ';
        break;
      case 'list':
        for (let i = current.items.length - 1; i >= 0; i -= 1) {
          const item = current.items[i];
          if (item)
            for (let j = item.blocks.length - 1; j >= 0; j -= 1)
              stack.push(item.blocks[j] as DocumentBlock);
        }
        break;
      case 'columns':
        for (let i = current.columns.length - 1; i >= 0; i -= 1) {
          const column = current.columns[i];
          if (column)
            for (let j = column.blocks.length - 1; j >= 0; j -= 1)
              stack.push(column.blocks[j] as DocumentBlock);
        }
        break;
      case 'page-link':
        text += `${current.title} `;
        break;
      case 'embed':
        text += `${current.title ?? ''} `;
        break;
      case 'media':
        text += `${current.alt} `;
        break;
      case 'block':
        text += `${current.block} `;
        break;
      default:
        break;
    }
  }
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
