/**
 * Constructors and read helpers over the document tree. Every walk is
 * iterative (an explicit stack), so a deep or hostile tree never overflows
 * the call stack; the validator caps depth and size before anything else
 * runs on untrusted input.
 */
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_VERSION } from './limits.ts';
import type {
  DocumentBlock,
  DocumentBlockId,
  DocumentInline,
  DocumentMeta,
  DocumentNode,
  EmbedKind,
  ParagraphBlock,
  TexuliDocument,
} from './types.ts';

/** Makes persisted ids. */
export type DocumentIdSource = () => DocumentBlockId;

/** A deterministic id source: `b1`, `b2`, … (or `<prefix>1`, …). */
export function createIdSource(prefix = 'b', start = 1): DocumentIdSource {
  let next = start;
  return () => `${prefix}${(next++).toString(36)}`;
}

/** An id source that skips every id already used in `doc`. */
export function freshIdSource(doc: TexuliDocument, prefix = 'b'): DocumentIdSource {
  const used = new Set(collectIds(doc));
  const source = createIdSource(prefix);
  return () => {
    let id = source();
    while (used.has(id)) id = source();
    used.add(id);
    return id;
  };
}

export function createDocument(
  options: { meta?: Partial<DocumentMeta>; blocks?: DocumentBlock[] } = {}
): TexuliDocument {
  return {
    format: DOCUMENT_FORMAT,
    formatVersion: DOCUMENT_FORMAT_VERSION,
    meta: { title: '', ...options.meta },
    blocks: options.blocks ?? [],
  };
}

export function paragraphBlock(id: DocumentBlockId, text = ''): ParagraphBlock {
  return { id, type: 'paragraph', content: text ? [{ type: 'text', text, marks: [] }] : [] };
}

/** The key that holds a node's children, or `null` for a leaf. */
export function childKey(node: DocumentNode): 'blocks' | 'items' | 'columns' | null {
  if (!('type' in node)) return 'blocks'; // a list item
  switch (node.type) {
    case 'list':
      return 'items';
    case 'columns':
      return 'columns';
    case 'quote':
    case 'callout':
    case 'toggle':
    case 'column':
      return 'blocks';
    default:
      return null;
  }
}

/** A node's children (blocks, items or columns); empty for a leaf. */
export function childrenOf(node: DocumentNode): readonly DocumentNode[] {
  const key = childKey(node);
  if (key === null) return [];
  return (node as unknown as Record<string, DocumentNode[]>)[key] ?? [];
}

/** What a walk visits: the node, its parent id (`null` at the root), its index and depth. */
export interface DocumentVisit {
  node: DocumentNode;
  parent: DocumentBlockId | null;
  index: number;
  depth: number;
}

/**
 * Visit every node in document order (pre-order). Return `false` from
 * `visit` to skip a node's children.
 */
export function walkDocument(
  doc: Pick<TexuliDocument, 'blocks'>,
  visit: (entry: DocumentVisit) => unknown
): void {
  const stack: DocumentVisit[] = [];
  for (let i = doc.blocks.length - 1; i >= 0; i -= 1) {
    stack.push({ node: doc.blocks[i] as DocumentNode, parent: null, index: i, depth: 0 });
  }
  while (stack.length > 0) {
    const entry = stack.pop() as DocumentVisit;
    if (visit(entry) === false) continue;
    const children = childrenOf(entry.node);
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push({
        node: children[i] as DocumentNode,
        parent: entry.node.id,
        index: i,
        depth: entry.depth + 1,
      });
    }
  }
}

/** Every persisted id in document order (duplicates included). */
export function collectIds(doc: Pick<TexuliDocument, 'blocks'>): DocumentBlockId[] {
  const ids: DocumentBlockId[] = [];
  walkDocument(doc, ({ node }) => {
    ids.push(node.id);
  });
  return ids;
}

/** Nodes in the document: blocks, columns and list items. */
export function countNodes(doc: Pick<TexuliDocument, 'blocks'>): number {
  let count = 0;
  walkDocument(doc, () => {
    count += 1;
  });
  return count;
}

export interface DocumentLocation {
  node: DocumentNode;
  /** The parent node, or `null` when the node is a top-level block. */
  parent: DocumentNode | null;
  index: number;
  depth: number;
}

/** Find a node by id, with its parent and index; `null` when absent. */
export function findNode(
  doc: Pick<TexuliDocument, 'blocks'>,
  id: DocumentBlockId
): DocumentLocation | null {
  const byId = new Map<DocumentBlockId, DocumentNode>();
  let found: DocumentLocation | null = null;
  walkDocument(doc, (entry) => {
    if (found) return false;
    byId.set(entry.node.id, entry.node);
    if (entry.node.id === id) {
      found = {
        node: entry.node,
        parent: entry.parent === null ? null : (byId.get(entry.parent) ?? null),
        index: entry.index,
        depth: entry.depth,
      };
      return false;
    }
    return undefined;
  });
  return found;
}

/** The plain text of inline content (a break is a newline). */
export function inlinePlainText(content: readonly DocumentInline[]): string {
  let out = '';
  for (const node of content) out += node.type === 'break' ? '\n' : node.text;
  return out;
}

/** The text a node holds itself (not its children): runs, code, titles, summaries. */
export function ownText(node: DocumentNode): string {
  if (!('type' in node)) return '';
  switch (node.type) {
    case 'paragraph':
    case 'heading':
      return inlinePlainText(node.content);
    case 'code':
      return node.text;
    case 'toggle':
      return inlinePlainText(node.summary);
    case 'callout':
      return node.title ?? '';
    case 'media':
      return node.alt;
    case 'page-link':
      return node.title;
    case 'embed':
      return node.title ?? '';
    default:
      return '';
  }
}

/** The document's plain text: one line group per text-bearing node. */
export function documentPlainText(doc: Pick<TexuliDocument, 'blocks'>): string {
  const parts: string[] = [];
  walkDocument(doc, ({ node }) => {
    const text = ownText(node);
    if (text) parts.push(text);
  });
  return parts.join('\n\n');
}

/** A reference the host resolves: a nested page or an embed payload. */
export interface DocumentRef {
  kind: EmbedKind | 'page';
  ref: string;
  /** The block that holds the reference. */
  block: DocumentBlockId;
}

/** Every host reference in the document, in order (nested pages and embeds by `ref`). */
export function collectRefs(doc: Pick<TexuliDocument, 'blocks'>): DocumentRef[] {
  const refs: DocumentRef[] = [];
  walkDocument(doc, ({ node }) => {
    if (!('type' in node)) return;
    if (node.type === 'page-link') refs.push({ kind: 'page', ref: node.ref, block: node.id });
    else if (node.type === 'embed' && node.ref !== undefined)
      refs.push({ kind: node.kind, ref: node.ref, block: node.id });
  });
  return refs;
}
