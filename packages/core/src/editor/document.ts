import {
  cleanText,
  inlineLength,
  inlineText,
  markKey,
  normalizeInline,
  sortMarks,
} from './inline.ts';
import {
  EDITOR_LIMITS,
  type EditorBlock,
  type EditorBlockId,
  type EditorDocument,
  type EditorInline,
  type EditorIssue,
  type EditorList,
  type EditorListItem,
  type EditorParagraph,
  type EditorQuote,
  type EditorTextBlock,
} from './types.ts';

/** A source of fresh block ids. */
export type EditorIdSource = () => EditorBlockId;

let counter = 0;
/** The default id source: unique for the page's lifetime. */
export const nextEditorId: EditorIdSource = () => `tx-ed-${(++counter).toString(36)}`;

/** A deterministic id source (`b1`, `b2`…), for tests and server rendering. */
export function createEditorIds(prefix = 'b'): EditorIdSource {
  let n = 0;
  return () => `${prefix}${++n}`;
}

export const LANG_PATTERN = /^[a-z][a-z0-9+-]{0,31}$/;

export const paragraph = (
  content: readonly EditorInline[] = [],
  id: EditorBlockId = nextEditorId()
): EditorParagraph => ({ id, type: 'paragraph', content });

/** A document with one empty paragraph. */
export const emptyEditorDocument = (newId: EditorIdSource = nextEditorId): EditorDocument => ({
  version: 1,
  blocks: [paragraph([], newId())],
});

export const isTextBlock = (block: EditorBlock): block is EditorTextBlock =>
  block.type === 'paragraph' || block.type === 'heading' || block.type === 'code';

export const isVoidBlock = (block: EditorBlock): boolean =>
  block.type === 'divider' || block.type === 'media';

/** Length of a text block in UTF-16 code units (a break counts 1). */
export const blockLength = (block: EditorTextBlock): number =>
  block.type === 'code' ? block.text.length : inlineLength(block.content);

/** Text of a text block; a break is `\n`. */
export const blockText = (block: EditorTextBlock): string =>
  block.type === 'code' ? block.text : inlineText(block.content);

/** What contains a block, outermost first. */
export type EditorAncestor =
  | { kind: 'quote'; quote: EditorQuote }
  | { kind: 'item'; list: EditorList; item: EditorListItem; itemIndex: number };

export interface EditorLocation {
  block: EditorBlock;
  /** Index among `siblings`. */
  index: number;
  siblings: readonly EditorBlock[];
  ancestors: readonly EditorAncestor[];
}

/** Where block `id` sits in the tree, or `null`. */
export function locateBlock(doc: EditorDocument, id: EditorBlockId): EditorLocation | null {
  const visit = (
    blocks: readonly EditorBlock[],
    ancestors: readonly EditorAncestor[]
  ): EditorLocation | null => {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index] as EditorBlock;
      if (block.id === id) return { block, index, siblings: blocks, ancestors };
      if (block.type === 'quote') {
        const found = visit(block.blocks, [...ancestors, { kind: 'quote', quote: block }]);
        if (found) return found;
      } else if (block.type === 'list') {
        for (let itemIndex = 0; itemIndex < block.items.length; itemIndex += 1) {
          const item = block.items[itemIndex] as EditorListItem;
          const found = visit(item.blocks, [
            ...ancestors,
            { kind: 'item', list: block, item, itemIndex },
          ]);
          if (found) return found;
        }
      }
    }
    return null;
  };
  return visit(doc.blocks, []);
}

/** The leaves (text and void blocks) in document order, with their nesting depth. */
export function editorLeaves(doc: EditorDocument): { block: EditorBlock; depth: number }[] {
  const out: { block: EditorBlock; depth: number }[] = [];
  const visit = (blocks: readonly EditorBlock[], depth: number) => {
    for (const block of blocks) {
      if (block.type === 'quote') visit(block.blocks, depth + 1);
      else if (block.type === 'list') for (const item of block.items) visit(item.blocks, depth + 1);
      else out.push({ block, depth });
    }
  };
  visit(doc.blocks, 0);
  return out;
}

const replaceAt = <T>(list: readonly T[], index: number, items: readonly T[]): T[] => [
  ...list.slice(0, index),
  ...items,
  ...list.slice(index + 1),
];

type Rewrite = {
  block?: (block: EditorBlock) => readonly EditorBlock[];
  item?: (item: EditorListItem, list: EditorList) => readonly EditorListItem[];
};

function rewrite(blocks: readonly EditorBlock[], id: string, how: Rewrite): EditorBlock[] | null {
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i] as EditorBlock;
    if (block.id === id && how.block) return replaceAt(blocks, i, how.block(block));
    if (block.type === 'quote') {
      const inner = rewrite(block.blocks, id, how);
      if (inner) return replaceAt(blocks, i, [{ ...block, blocks: inner }]);
    } else if (block.type === 'list') {
      for (let j = 0; j < block.items.length; j += 1) {
        const item = block.items[j] as EditorListItem;
        if (item.id === id && how.item) {
          return replaceAt(blocks, i, [
            { ...block, items: replaceAt(block.items, j, how.item(item, block)) },
          ]);
        }
        const inner = rewrite(item.blocks, id, how);
        if (inner) {
          const items = replaceAt(block.items, j, [{ ...item, blocks: inner }]);
          return replaceAt(blocks, i, [{ ...block, items }]);
        }
      }
    }
  }
  return null;
}

/** Replace block `id` with `replace(block)` (any number of blocks). Unchanged parts keep identity. */
export function replaceBlock(
  doc: EditorDocument,
  id: EditorBlockId,
  replace: (block: EditorBlock) => readonly EditorBlock[]
): EditorDocument {
  const blocks = rewrite(doc.blocks, id, { block: replace });
  return blocks ? { ...doc, blocks } : doc;
}

/** Replace list item `id` with `replace(item, list)` (any number of items). */
export function replaceItem(
  doc: EditorDocument,
  id: EditorBlockId,
  replace: (item: EditorListItem, list: EditorList) => readonly EditorListItem[]
): EditorDocument {
  const blocks = rewrite(doc.blocks, id, { item: replace });
  return blocks ? { ...doc, blocks } : doc;
}

/** Remove every block whose id is in `ids`, then prune emptied containers. */
export function removeBlocks(
  doc: EditorDocument,
  ids: ReadonlySet<EditorBlockId>,
  newId = nextEditorId
) {
  const strip = (blocks: readonly EditorBlock[]): readonly EditorBlock[] => {
    let changed = false;
    const out: EditorBlock[] = [];
    for (const block of blocks) {
      if (ids.has(block.id)) {
        changed = true;
        continue;
      }
      let next: EditorBlock = block;
      if (block.type === 'quote') {
        const inner = strip(block.blocks);
        if (inner !== block.blocks) next = { ...block, blocks: inner };
      } else if (block.type === 'list') {
        let itemsChanged = false;
        const items = block.items.map((item) => {
          const inner = strip(item.blocks);
          if (inner === item.blocks) return item;
          itemsChanged = true;
          return { ...item, blocks: inner };
        });
        if (itemsChanged) next = { ...block, items };
      }
      if (next !== block) changed = true;
      out.push(next);
    }
    return changed ? out : blocks;
  };
  return normalizeDocument({ ...doc, blocks: strip(doc.blocks) }, newId);
}

/**
 * The model invariants, repaired: inline content canonical, empty containers
 * removed, list items starting with a paragraph, `checked` only on todo items,
 * `start` only on ordered lists, at least one block. Unchanged blocks keep
 * their identity (structural sharing).
 */
export function normalizeDocument(
  doc: EditorDocument,
  newId: EditorIdSource = nextEditorId
): EditorDocument {
  const blocks = normalizeBlocks(doc.blocks, newId);
  if (blocks.length === 0) return { version: 1, blocks: [paragraph([], newId())] };
  return blocks === doc.blocks && doc.version === 1 ? doc : { version: 1, blocks };
}

function normalizeBlocks(
  blocks: readonly EditorBlock[],
  newId: EditorIdSource
): readonly EditorBlock[] {
  let changed = false;
  const out: EditorBlock[] = [];
  for (const block of blocks) {
    const next = normalizeBlock(block, newId);
    if (next !== block) changed = true;
    if (next) out.push(next);
  }
  return changed ? out : blocks;
}

function normalizeBlock(block: EditorBlock, newId: EditorIdSource): EditorBlock | null {
  switch (block.type) {
    case 'paragraph':
    case 'heading': {
      const content = normalizeInline(block.content);
      return content === block.content ? block : { ...block, content };
    }
    case 'code':
      return block.lang === undefined || LANG_PATTERN.test(block.lang)
        ? block
        : { id: block.id, type: 'code', text: block.text };
    case 'quote': {
      const inner = normalizeBlocks(block.blocks, newId);
      if (inner.length === 0) return null;
      return inner === block.blocks ? block : { ...block, blocks: inner };
    }
    case 'list': {
      let changed = false;
      const items: EditorListItem[] = [];
      for (const item of block.items) {
        const next = normalizeItem(item, block.kind, newId);
        if (next !== item) changed = true;
        if (next) items.push(next);
      }
      if (items.length === 0) return null;
      const start = block.kind === 'ordered' ? block.start : undefined;
      const startOk = start === undefined || (Number.isInteger(start) && start >= 0);
      if (!changed && startOk && start === block.start && start !== 1) return block;
      const list: EditorList = { id: block.id, type: 'list', kind: block.kind, items };
      if (startOk && start !== undefined && start !== 1) list.start = start;
      return list;
    }
    default:
      return block;
  }
}

function normalizeItem(
  item: EditorListItem,
  kind: EditorList['kind'],
  newId: EditorIdSource
): EditorListItem | null {
  let blocks = normalizeBlocks(item.blocks, newId);
  if (blocks.length === 0) return null;
  const first = blocks[0] as EditorBlock;
  if (first.type === 'heading') blocks = [paragraph(first.content, first.id), ...blocks.slice(1)];
  else if (first.type !== 'paragraph') blocks = [paragraph([], newId()), ...blocks];
  const checked = kind === 'todo' ? item.checked === true : undefined;
  if (blocks === item.blocks && checked === item.checked) return item;
  return checked === undefined ? { id: item.id, blocks } : { id: item.id, checked, blocks };
}

/** The plain text of a document: blocks joined by blank lines, breaks as `\n`. */
export function editorPlainText(doc: EditorDocument): string {
  return editorLeaves(doc)
    .map(({ block }) =>
      isTextBlock(block) ? blockText(block) : block.type === 'media' ? block.alt : ''
    )
    .filter(Boolean)
    .join('\n\n');
}

/** Characters of text in a document. */
export const editorCharCount = (doc: EditorDocument): number =>
  editorLeaves(doc).reduce(
    (sum, { block }) => sum + (isTextBlock(block) ? blockLength(block) : 0),
    0
  );

/** Blocks in a document, containers and list items included. */
export function editorBlockCount(blocks: readonly EditorBlock[]): number {
  let count = 0;
  for (const block of blocks) {
    count += 1;
    if (block.type === 'quote') count += editorBlockCount(block.blocks);
    else if (block.type === 'list')
      for (const item of block.items) count += 1 + editorBlockCount(item.blocks);
  }
  return count;
}

const issue = (code: EditorIssue['code'], message: string, block?: string): EditorIssue =>
  block === undefined ? { code, message } : { code, message, block };

/**
 * Every broken invariant of `doc`, or `[]` for a valid document. Never throws,
 * whatever the input; transforms are tested against it.
 */
export function validateEditorDocument(doc: unknown): EditorIssue[] {
  const issues: EditorIssue[] = [];
  const record = doc as { version?: unknown; blocks?: unknown } | null;
  if (!record || typeof record !== 'object' || !Array.isArray(record.blocks)) {
    return [issue('invalid-shape', 'A document is { version: 1, blocks: [...] }.')];
  }
  if (record.version !== 1) issues.push(issue('version-unsupported', 'Only version 1 is known.'));
  if (record.blocks.length === 0)
    issues.push(issue('invalid-shape', 'A document has at least one block.'));
  const ids = new Set<string>();
  let chars = 0;
  const seen = (id: unknown): boolean => {
    if (typeof id !== 'string' || id === '') {
      issues.push(issue('invalid-shape', 'Every block and item has a non-empty string id.'));
      return false;
    }
    if (ids.has(id)) issues.push(issue('duplicate-id', `Id "${id}" is used twice.`, id));
    ids.add(id);
    return true;
  };
  const text = (value: unknown, id: string, keep: string): void => {
    if (typeof value !== 'string') {
      issues.push(issue('invalid-shape', 'Text must be a string.', id));
      return;
    }
    chars += value.length;
    if (cleanText(value, keep).text !== value) {
      issues.push(
        issue('characters-stripped', 'Text holds characters the model never stores.', id)
      );
    }
  };
  const inline = (content: unknown, id: string) => {
    if (!Array.isArray(content)) {
      issues.push(issue('invalid-shape', 'Inline content must be an array.', id));
      return;
    }
    for (const node of content as EditorInline[]) {
      if (node?.type === 'break') {
        chars += 1;
        continue;
      }
      if (node?.type !== 'text' || !Array.isArray(node.marks)) {
        issues.push(issue('invalid-shape', 'Inline nodes are text runs or breaks.', id));
        return;
      }
      text(node.text, id, '');
      for (const mark of node.marks) {
        if (mark?.type === 'link' && (typeof mark.href !== 'string' || mark.href === '')) {
          issues.push(issue('invalid-shape', 'A link mark has an href.', id));
        } else if (
          mark?.type === 'extension' &&
          (typeof mark.name !== 'string' ||
            mark.name === '' ||
            typeof mark.id !== 'string' ||
            mark.id === '')
        ) {
          issues.push(issue('invalid-shape', 'An extension mark has a name and an id.', id));
        } else if (!['link', 'strong', 'em', 'strike', 'code', 'extension'].includes(mark?.type)) {
          issues.push(issue('unknown-mark', `Unknown mark "${String(mark?.type)}".`, id));
        }
      }
      if (
        sortMarks(node.marks) !== node.marks ||
        new Set(node.marks.map(markKey)).size !== node.marks.length
      ) {
        issues.push(issue('not-normalized', 'Marks are unique and in canonical order.', id));
      }
    }
    if (normalizeInline(content as EditorInline[]) !== content) {
      issues.push(issue('not-normalized', 'Runs are non-empty and neighbors differ in marks.', id));
    }
  };
  const visit = (blocks: unknown, depth: number): void => {
    if (!Array.isArray(blocks)) {
      issues.push(issue('invalid-shape', 'Blocks must be an array.'));
      return;
    }
    for (const raw of blocks) {
      const block = raw as EditorBlock;
      if (!block || typeof block !== 'object' || !seen(block.id)) continue;
      const id = block.id;
      switch (block.type) {
        case 'paragraph':
          inline(block.content, id);
          break;
        case 'heading':
          if (![1, 2, 3, 4].includes(block.level))
            issues.push(issue('invalid-shape', 'Heading levels are 1 to 4.', id));
          inline(block.content, id);
          break;
        case 'code':
          text(block.text, id, '\n\t');
          if (block.lang !== undefined && !LANG_PATTERN.test(block.lang)) {
            issues.push(issue('invalid-shape', 'A code language is a short lowercase name.', id));
          }
          break;
        case 'quote':
        case 'list': {
          if (depth >= EDITOR_LIMITS.depth)
            issues.push(issue('depth-capped', 'Lists and quotes nest at most 4 levels.', id));
          if (block.type === 'quote') {
            if (!Array.isArray(block.blocks) || block.blocks.length === 0) {
              issues.push(issue('invalid-shape', 'A quote holds blocks.', id));
            }
            visit(block.blocks, depth + 1);
            break;
          }
          if (!['bullet', 'ordered', 'todo'].includes(block.kind))
            issues.push(issue('invalid-shape', 'Unknown list kind.', id));
          if (block.start !== undefined && block.kind !== 'ordered')
            issues.push(issue('not-normalized', 'Only ordered lists have a start.', id));
          if (!Array.isArray(block.items) || block.items.length === 0) {
            issues.push(issue('invalid-shape', 'A list holds items.', id));
            break;
          }
          for (const item of block.items) {
            if (!item || !seen(item.id)) continue;
            if ((block.kind === 'todo') !== (typeof item.checked === 'boolean')) {
              issues.push(
                issue('not-normalized', 'Todo items, and only they, are checked or not.', item.id)
              );
            }
            if (!Array.isArray(item.blocks) || item.blocks[0]?.type !== 'paragraph') {
              issues.push(issue('invalid-shape', 'A list item starts with a paragraph.', item.id));
            }
            visit(item.blocks, depth + 1);
          }
          break;
        }
        case 'divider':
          break;
        case 'media':
          if (typeof block.ref !== 'string' || block.ref === '')
            issues.push(issue('invalid-shape', 'Media has a ref.', id));
          text(block.alt, id, '');
          break;
        default:
          issues.push(
            issue(
              'unknown-node',
              `Unknown block type "${String((block as { type?: unknown }).type)}".`,
              id
            )
          );
      }
    }
  };
  visit(record.blocks, 0);
  if (ids.size > EDITOR_LIMITS.blocks) issues.push(issue('blocks-capped', 'Too many blocks.'));
  if (chars > EDITOR_LIMITS.chars) issues.push(issue('text-truncated', 'Too much text.'));
  return issues;
}
