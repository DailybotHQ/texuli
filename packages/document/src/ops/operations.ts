/**
 * Typed operations on a document, addressed by persisted id (never by array
 * index), so they compose with history, agents' patches and sync. Each
 * applied operation yields its exact inverse; a transaction either applies
 * whole or leaves the input untouched, and is validated at the end (at the
 * `untrusted` tier by default).
 */

import { normalizeInline, sliceInline } from '@texuli/core/editor-model';
import type { HrefTrust } from '@texuli/core/url-policy';
import { childKey } from '../model/document.ts';
import type {
  DocumentBlockId,
  DocumentInline,
  DocumentJson,
  DocumentMark,
  DocumentMeta,
  DocumentNode,
  PageSettings,
  TexuliDocument,
} from '../model/types.ts';
import { validateDocument } from '../schema/index.ts';
import type { DocumentDiagnostic } from '../schema/validate.ts';
import { cloneData, equalData } from './clone.ts';

/** Attribute values; `null` removes an optional attribute. */
export type DocumentAttrs = { [key: string]: DocumentJson | undefined };

export type DocumentOperation =
  /** Insert a node (with its subtree) at `index` of `parent`'s children (`null` is the top level). */
  | { op: 'insert-node'; parent: DocumentBlockId | null; index: number; node: DocumentNode }
  | { op: 'remove-node'; id: DocumentBlockId }
  /** `index` counts after the node left its old place, as in RFC 6902 `move`. */
  | { op: 'move-node'; id: DocumentBlockId; parent: DocumentBlockId | null; index: number }
  | { op: 'set-attrs'; id: DocumentBlockId; attrs: DocumentAttrs }
  /** Offsets are UTF-16 code units of the node's text; a break counts 1. */
  | {
      op: 'insert-text';
      id: DocumentBlockId;
      offset: number;
      text: string;
      marks?: DocumentMark[];
    }
  | { op: 'delete-text'; id: DocumentBlockId; offset: number; length: number }
  /** Add (`value: true`) or remove a mark over `[from, to)`. */
  | {
      op: 'set-mark';
      id: DocumentBlockId;
      from: number;
      to: number;
      mark: DocumentMark;
      value: boolean;
    }
  /** Replace `[from, to)` with inline content (every inverse of a text edit is one). */
  | { op: 'replace-text'; id: DocumentBlockId; from: number; to: number; content: DocumentInline[] }
  | { op: 'set-meta'; meta: MetaChanges }
  | { op: 'set-page'; page: PageSettings | null };

/** Metadata changes; `null` removes an optional field. */
export type MetaChanges = { [K in keyof DocumentMeta]?: DocumentMeta[K] | null };

export type DocumentOperationKind = DocumentOperation['op'];

export const DOCUMENT_OPERATION_KINDS: readonly DocumentOperationKind[] = Object.freeze([
  'insert-node',
  'remove-node',
  'move-node',
  'set-attrs',
  'insert-text',
  'delete-text',
  'set-mark',
  'replace-text',
  'set-meta',
  'set-page',
]);

/** At most this many operations in one transaction. */
export const MAX_OPERATIONS = 10_000;

/** The attributes `set-attrs` may change, per node type (`item` is a list item). */
export const NODE_ATTRS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  paragraph: [],
  heading: ['level'],
  code: ['lang'],
  list: ['kind', 'start'],
  item: ['checked'],
  quote: [],
  divider: [],
  media: ['ref', 'alt'],
  callout: ['tone', 'title'],
  toggle: ['open'],
  columns: [],
  column: ['width'],
  'page-link': ['ref', 'title'],
  block: ['family', 'block', 'props'],
  embed: ['kind', 'ref', 'inline', 'title'],
});

const META_KEYS = new Set([
  'title',
  'description',
  'locale',
  'dir',
  'authors',
  'tags',
  'created',
  'updated',
]);

export interface ApplyOptions {
  /** Validate the result at this tier (`untrusted` by default), or skip with `false`. */
  validate?: HrefTrust | false;
}

export type ApplyResult =
  | {
      ok: true;
      document: TexuliDocument;
      /** Apply these to undo the transaction (already in reverse order). */
      inverse: DocumentOperation[];
      /** Warnings from validation. */
      issues: DocumentDiagnostic[];
    }
  | {
      ok: false;
      /** The failing operation, or `-1` for the transaction or the validation. */
      index: number;
      reason: string;
      issues: DocumentDiagnostic[];
    };

class OpError extends Error {}

type Children = DocumentNode[];

const nodeKind = (node: DocumentNode): string => ('type' in node ? node.type : 'item');

/** A mutable working copy with an id index; one per transaction. */
class Workspace {
  readonly doc: TexuliDocument;
  readonly nodes = new Map<DocumentBlockId, DocumentNode>();
  readonly parents = new Map<DocumentBlockId, DocumentNode | null>();

  constructor(doc: TexuliDocument) {
    this.doc = doc;
    for (const node of doc.blocks) this.index(node, null);
  }

  /** Index a subtree (iteratively); a duplicate id throws. */
  index(root: DocumentNode, parent: DocumentNode | null): void {
    const stack: [DocumentNode, DocumentNode | null][] = [[root, parent]];
    while (stack.length > 0) {
      const [node, owner] = stack.pop() as [DocumentNode, DocumentNode | null];
      if (typeof node?.id !== 'string') throw new OpError('Every node needs an id.');
      if (this.nodes.has(node.id)) throw new OpError(`The id "${node.id}" is already used.`);
      this.nodes.set(node.id, node);
      this.parents.set(node.id, owner);
      for (const child of this.children(node) ?? []) stack.push([child, node]);
    }
  }

  unindex(root: DocumentNode): void {
    const stack: DocumentNode[] = [root];
    while (stack.length > 0) {
      const node = stack.pop() as DocumentNode;
      this.nodes.delete(node.id);
      this.parents.delete(node.id);
      for (const child of this.children(node) ?? []) stack.push(child);
    }
  }

  children(node: DocumentNode | null): Children | null {
    if (node === null) return this.doc.blocks as Children;
    const key = childKey(node);
    if (key === null) return null;
    const record = node as unknown as Record<string, Children>;
    if (!Array.isArray(record[key])) record[key] = [];
    return record[key] as Children;
  }

  node(id: DocumentBlockId): DocumentNode {
    const node = this.nodes.get(id);
    if (!node) throw new OpError(`No node has the id "${id}".`);
    return node;
  }

  parentOf(id: DocumentBlockId | null): DocumentNode | null {
    return id === null ? null : this.node(id);
  }

  /** The node's parent and index among its siblings. */
  place(id: DocumentBlockId): { parent: DocumentNode | null; index: number } {
    const node = this.node(id);
    const parent = this.parents.get(id) ?? null;
    const index = (this.children(parent) as Children).indexOf(node);
    return { parent, index };
  }
}

/** Whether `parent` can hold `node` as a child. */
function accepts(parent: DocumentNode | null, node: DocumentNode): boolean {
  const kind = nodeKind(node);
  const parentKind = parent === null ? 'root' : nodeKind(parent);
  if (parentKind === 'list') return kind === 'item';
  if (parentKind === 'columns') return kind === 'column';
  if (['root', 'quote', 'callout', 'toggle', 'column', 'item'].includes(parentKind))
    return kind !== 'item' && kind !== 'column';
  return false;
}

function position(value: unknown, max: number, what: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max)
    throw new OpError(`The ${what} must be a whole number from 0 to ${max}.`);
  return value as number;
}

/** The text field of a node and whether it holds marks. */
function textField(node: DocumentNode): { key: 'content' | 'summary' | 'text'; rich: boolean } {
  const kind = nodeKind(node);
  if (kind === 'paragraph' || kind === 'heading') return { key: 'content', rich: true };
  if (kind === 'toggle') return { key: 'summary', rich: true };
  if (kind === 'code') return { key: 'text', rich: false };
  throw new OpError(`A ${kind} node holds no text.`);
}

function readInline(node: DocumentNode): DocumentInline[] {
  const field = textField(node);
  const value = (node as unknown as Record<string, unknown>)[field.key];
  if (!field.rich) {
    const text = typeof value === 'string' ? value : '';
    return text ? [{ type: 'text', text, marks: [] }] : [];
  }
  return Array.isArray(value) ? (value as DocumentInline[]) : [];
}

function writeInline(node: DocumentNode, content: readonly DocumentInline[]): void {
  const field = textField(node);
  const record = node as unknown as Record<string, unknown>;
  if (!field.rich) {
    let text = '';
    for (const part of content) {
      if (part.type === 'break') text += '\n';
      else if (part.marks.length > 0) throw new OpError('Code blocks hold plain text only.');
      else text += part.text;
    }
    record[field.key] = text;
    return;
  }
  record[field.key] = [...normalizeInline(content)].map((part) =>
    part.type === 'text' ? { type: 'text', text: part.text, marks: [...part.marks] } : part
  );
}

const lengthOf = (content: readonly DocumentInline[]) => {
  let length = 0;
  for (const part of content) length += part.type === 'break' ? 1 : part.text.length;
  return length;
};

/** Plain text to inline: newlines become breaks. */
function textToRuns(text: string, marks: readonly DocumentMark[]): DocumentInline[] {
  const out: DocumentInline[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (index > 0) out.push({ type: 'break' });
    if (line) out.push({ type: 'text', text: line, marks: [...marks] });
  });
  return out;
}

function replaceRange(
  node: DocumentNode,
  from: number,
  to: number,
  insert: readonly DocumentInline[]
): DocumentOperation {
  const content = readInline(node);
  const length = lengthOf(content);
  position(from, length, 'start offset');
  position(to, length, 'end offset');
  if (from > to) throw new OpError('The range starts after it ends.');
  const removed = sliceInline(content, from, to).map((part) =>
    part.type === 'text' ? { ...part, marks: [...part.marks] } : part
  );
  writeInline(node, [
    ...sliceInline(content, 0, from),
    ...insert,
    ...sliceInline(content, to),
  ] as DocumentInline[]);
  return {
    op: 'replace-text',
    id: node.id,
    from,
    to: from + lengthOf(insert),
    content: removed as DocumentInline[],
  };
}

function applyOne(space: Workspace, operation: DocumentOperation): DocumentOperation {
  if (operation === null || typeof operation !== 'object')
    throw new OpError('An operation is an object.');
  switch (operation.op) {
    case 'insert-node': {
      const parent = space.parentOf(operation.parent);
      const children = space.children(parent);
      if (!children) throw new OpError('The parent holds no children.');
      const node = cloneData(operation.node);
      if (!accepts(parent, node))
        throw new OpError(`A ${nodeKind(node)} cannot go inside this parent.`);
      const index = position(operation.index, children.length, 'index');
      space.index(node, parent);
      children.splice(index, 0, node);
      return { op: 'remove-node', id: node.id };
    }
    case 'remove-node': {
      const { parent, index } = space.place(operation.id);
      const children = space.children(parent) as Children;
      const [node] = children.splice(index, 1) as [DocumentNode];
      space.unindex(node);
      return {
        op: 'insert-node',
        parent: parent === null ? null : parent.id,
        index,
        node: cloneData(node),
      };
    }
    case 'move-node': {
      const node = space.node(operation.id);
      const target = space.parentOf(operation.parent);
      for (let at: DocumentNode | null = target; at !== null; at = space.parents.get(at.id) ?? null)
        if (at === node) throw new OpError('A node cannot move inside itself.');
      if (!accepts(target, node))
        throw new OpError(`A ${nodeKind(node)} cannot go inside this parent.`);
      const from = space.place(operation.id);
      const source = space.children(from.parent) as Children;
      const children = space.children(target);
      if (!children) throw new OpError('The parent holds no children.');
      const length = children === source ? children.length - 1 : children.length;
      const index = position(operation.index, length, 'index');
      source.splice(from.index, 1);
      children.splice(index, 0, node);
      space.parents.set(node.id, target);
      return {
        op: 'move-node',
        id: node.id,
        parent: from.parent === null ? null : from.parent.id,
        index: from.index,
      };
    }
    case 'set-attrs': {
      const node = space.node(operation.id);
      const allowed = NODE_ATTRS[nodeKind(node)] ?? [];
      const record = node as unknown as Record<string, DocumentJson | undefined>;
      const previous: DocumentAttrs = {};
      const attrs = operation.attrs;
      if (attrs === null || typeof attrs !== 'object') throw new OpError('attrs is an object.');
      const next = cloneData(attrs);
      for (const key of Object.keys(next)) {
        if (!allowed.includes(key))
          throw new OpError(`A ${nodeKind(node)} has no attribute "${key}".`);
        previous[key] = Object.hasOwn(record, key) ? cloneData(record[key]) : null;
      }
      for (const [key, value] of Object.entries(next)) {
        if (value === null) delete record[key];
        else record[key] = value;
      }
      return { op: 'set-attrs', id: node.id, attrs: previous };
    }
    case 'insert-text': {
      const node = space.node(operation.id);
      if (typeof operation.text !== 'string') throw new OpError('text is a string.');
      const marks = operation.marks === undefined ? [] : cloneData(operation.marks);
      if (!Array.isArray(marks)) throw new OpError('marks is an array.');
      const offset = position(operation.offset, lengthOf(readInline(node)), 'offset');
      const inverse = replaceRange(node, offset, offset, textToRuns(operation.text, marks));
      return {
        op: 'delete-text',
        id: node.id,
        offset,
        length: (inverse as { to: number }).to - offset,
      };
    }
    case 'delete-text': {
      const node = space.node(operation.id);
      const from = position(operation.offset, lengthOf(readInline(node)), 'offset');
      const length = position(operation.length, lengthOf(readInline(node)) - from, 'length');
      return replaceRange(node, from, from + length, []);
    }
    case 'set-mark': {
      const node = space.node(operation.id);
      if (!textField(node).rich) throw new OpError('Code blocks hold plain text only.');
      const content = readInline(node);
      const length = lengthOf(content);
      const from = position(operation.from, length, 'start offset');
      const to = position(operation.to, length, 'end offset');
      if (from > to) throw new OpError('The range starts after it ends.');
      const mark = cloneData(operation.mark);
      if (mark === null || typeof mark !== 'object' || typeof mark.type !== 'string')
        throw new OpError('mark is a mark object.');
      const middle = sliceInline(content, from, to).map((part): DocumentInline => {
        if (part.type === 'break') return part;
        const rest = part.marks.filter((other) => other.type !== mark.type);
        return {
          type: 'text',
          text: part.text,
          marks: operation.value ? [...rest, mark] : rest,
        };
      });
      const removed = sliceInline(content, from, to);
      writeInline(node, [
        ...sliceInline(content, 0, from),
        ...middle,
        ...sliceInline(content, to),
      ] as DocumentInline[]);
      return {
        op: 'replace-text',
        id: node.id,
        from,
        to,
        content: cloneData(removed) as DocumentInline[],
      };
    }
    case 'replace-text': {
      const node = space.node(operation.id);
      const content = cloneData(operation.content);
      if (!Array.isArray(content)) throw new OpError('content is an array.');
      for (const part of content)
        if (
          part === null ||
          typeof part !== 'object' ||
          (part.type !== 'break' &&
            (part.type !== 'text' || typeof part.text !== 'string' || !Array.isArray(part.marks)))
        )
          throw new OpError('content holds text runs and breaks.');
      return replaceRange(node, operation.from, operation.to, content);
    }
    case 'set-meta': {
      const meta = space.doc.meta as unknown as Record<string, DocumentJson | undefined>;
      const changes = cloneData(operation.meta) as Record<string, DocumentJson>;
      if (changes === null || typeof changes !== 'object') throw new OpError('meta is an object.');
      const previous: Record<string, DocumentJson> = {};
      for (const key of Object.keys(changes)) {
        if (!META_KEYS.has(key)) throw new OpError(`The metadata has no field "${key}".`);
        if (key === 'title' && changes[key] === null)
          throw new OpError('The title cannot be removed.');
        previous[key] = Object.hasOwn(meta, key) ? cloneData(meta[key] as DocumentJson) : null;
      }
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) delete meta[key];
        else meta[key] = value;
      }
      return { op: 'set-meta', meta: previous as MetaChanges };
    }
    case 'set-page': {
      const previous = space.doc.page === undefined ? null : cloneData(space.doc.page);
      if (operation.page === null) delete space.doc.page;
      else space.doc.page = cloneData(operation.page);
      return { op: 'set-page', page: previous };
    }
    default:
      throw new OpError(
        `Unknown operation "${String((operation as { op?: unknown }).op).slice(0, 32)}".`
      );
  }
}

/**
 * Apply a transaction of operations. On success the result is a new
 * document (the input is never mutated) with the inverse transaction; on
 * failure nothing changes and the failing index and reason are reported.
 */
export function applyOperations(
  doc: TexuliDocument,
  operations: readonly DocumentOperation[],
  options: ApplyOptions = {}
): ApplyResult {
  if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS)
    return {
      ok: false,
      index: -1,
      reason: `A transaction holds at most ${MAX_OPERATIONS} operations.`,
      issues: [],
    };
  let space: Workspace;
  try {
    space = new Workspace(cloneData(doc));
  } catch (error) {
    return { ok: false, index: -1, reason: message(error), issues: [] };
  }
  const inverse: DocumentOperation[] = [];
  for (let index = 0; index < operations.length; index += 1) {
    try {
      inverse.push(applyOne(space, operations[index] as DocumentOperation));
    } catch (error) {
      return { ok: false, index, reason: message(error), issues: [] };
    }
  }
  inverse.reverse();
  if (options.validate === false) return { ok: true, document: space.doc, inverse, issues: [] };
  const checked = validateDocument(space.doc, { trust: options.validate ?? 'untrusted' });
  if (!checked.ok)
    return {
      ok: false,
      index: -1,
      reason: 'The result is not a valid document.',
      issues: checked.issues,
    };
  return { ok: true, document: checked.document, inverse, issues: checked.issues };
}

/** Apply a single operation (a one-operation transaction). */
export function applyOperation(
  doc: TexuliDocument,
  operation: DocumentOperation,
  options: ApplyOptions = {}
): ApplyResult {
  return applyOperations(doc, [operation], options);
}

/** Whether two documents hold the same data. */
export function sameDocument(left: TexuliDocument, right: TexuliDocument): boolean {
  return equalData(left, right);
}

function message(error: unknown): string {
  if (error instanceof OpError) return error.message;
  if (error instanceof Error && error.name === 'Error' && error.message) return error.message;
  return 'The operation was refused.';
}
