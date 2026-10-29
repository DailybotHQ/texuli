/**
 * Id-keyed document diffs. `diffDocuments(from, to)` returns operations of
 * `@texuli/document/ops` that turn `from` into `to`: this is how a merged
 * replica state reaches an editor's op log (the single edit path), and how
 * a version restore is planned. `describeChanges` lists what changed
 * between two versions for people.
 *
 * Both are linear in the documents (plus a longest-increasing-subsequence
 * pass per reordered child list), and never recurse.
 */
import { type EditorMark, markKey, sliceInline } from '@texuli/core/editor-model';
import { ownText } from '../model/document.ts';
import type {
  DocumentBlockId,
  DocumentInline,
  DocumentNode,
  TexuliDocument,
} from '../model/types.ts';
import { cloneData, equalData } from '../ops/clone.ts';
import type { DocumentOperation, MetaChanges } from '../ops/operations.ts';
import { attrsOf, childKeyOf, kindOf, META_FIELDS, textFieldOf } from './vocabulary.ts';

interface Entry {
  node: DocumentNode;
  parent: DocumentBlockId | null;
}

const ROOT_KEY = '';
const keyOf = (parent: DocumentBlockId | null) => parent ?? ROOT_KEY;

function childList(node: DocumentNode): DocumentNode[] {
  const key = childKeyOf(kindOf(node));
  return key ? ((node as unknown as Record<string, DocumentNode[]>)[key] ?? []) : [];
}

/** Every node by id with its parent id, in pre-order. */
export function indexDocument(doc: Pick<TexuliDocument, 'blocks'>): Map<DocumentBlockId, Entry> {
  const out = new Map<DocumentBlockId, Entry>();
  const stack: Entry[] = [];
  for (let i = doc.blocks.length - 1; i >= 0; i -= 1)
    stack.push({ node: doc.blocks[i] as DocumentNode, parent: null });
  while (stack.length > 0) {
    const entry = stack.pop() as Entry;
    out.set(entry.node.id, entry);
    const children = childList(entry.node);
    for (let i = children.length - 1; i >= 0; i -= 1)
      stack.push({ node: children[i] as DocumentNode, parent: entry.node.id });
  }
  return out;
}

/** Indices (into `values`) of one longest strictly increasing subsequence. */
export function longestIncreasing(values: readonly number[]): Set<number> {
  const tails: number[] = [];
  const previous = new Int32Array(values.length).fill(-1);
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i] as number;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if ((values[tails[mid] as number] as number) < value) low = mid + 1;
      else high = mid;
    }
    if (low > 0) previous[i] = tails[low - 1] as number;
    tails[low] = i;
  }
  const out = new Set<number>();
  let at = tails.length > 0 ? (tails[tails.length - 1] as number) : -1;
  while (at >= 0) {
    out.add(at);
    at = previous[at] as number;
  }
  return out;
}

/** A node without its children (they are placed by their own operations). */
function shellOf(node: DocumentNode): DocumentNode {
  const copy = cloneData(node) as unknown as Record<string, unknown>;
  const key = childKeyOf(kindOf(node));
  if (key) copy[key] = [];
  return copy as unknown as DocumentNode;
}

/** UTF-16 units with their marks, as `[char, markSignature]` per code point. */
function unitsOf(content: readonly DocumentInline[]): { chars: string[]; sigs: string[] } {
  const chars: string[] = [];
  const sigs: string[] = [];
  for (const part of content) {
    if (part.type === 'break') {
      chars.push('\n');
      sigs.push('');
      continue;
    }
    const sig = part.marks.map((mark: EditorMark) => markKey(mark)).join('|');
    for (const char of part.text) {
      chars.push(char);
      sigs.push(sig);
    }
  }
  return { chars, sigs };
}

function textContent(node: DocumentNode): DocumentInline[] | null {
  const field = textFieldOf(kindOf(node));
  if (!field) return null;
  const value = (node as unknown as Record<string, unknown>)[field.field];
  if (!field.rich)
    return typeof value === 'string' && value ? [{ type: 'text', text: value, marks: [] }] : [];
  return Array.isArray(value) ? (value as DocumentInline[]) : [];
}

/** One `replace-text` covering what differs between two texts (common prefix and suffix kept). */
function textOperation(
  id: DocumentBlockId,
  a: DocumentInline[],
  b: DocumentInline[]
): DocumentOperation | null {
  const left = unitsOf(a);
  const right = unitsOf(b);
  const same = (i: number, j: number) =>
    left.chars[i] === right.chars[j] && left.sigs[i] === right.sigs[j];
  let prefix = 0;
  while (prefix < left.chars.length && prefix < right.chars.length && same(prefix, prefix))
    prefix += 1;
  let suffix = 0;
  while (
    suffix < left.chars.length - prefix &&
    suffix < right.chars.length - prefix &&
    same(left.chars.length - 1 - suffix, right.chars.length - 1 - suffix)
  )
    suffix += 1;
  if (prefix === left.chars.length && prefix === right.chars.length) return null;
  const utf16 = (chars: string[], end: number) => {
    let length = 0;
    for (let i = 0; i < end; i += 1) length += (chars[i] as string).length;
    return length;
  };
  const from = utf16(left.chars, prefix);
  const to = utf16(left.chars, left.chars.length - suffix);
  const rightFrom = utf16(right.chars, prefix);
  const rightTo = utf16(right.chars, right.chars.length - suffix);
  return {
    op: 'replace-text',
    id,
    from,
    to,
    content: cloneData(sliceInline(b, rightFrom, rightTo)) as DocumentInline[],
  };
}

/** Attribute changes of a node kept by id (`null` removes an optional attribute). */
function attrChanges(a: DocumentNode, b: DocumentNode): Record<string, unknown> | null {
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  let changes: Record<string, unknown> | null = null;
  for (const key of attrsOf(kindOf(b))) {
    if (equalData(left[key], right[key])) continue;
    changes ??= {};
    changes[key] = right[key] === undefined ? null : cloneData(right[key]);
  }
  return changes;
}

/**
 * Operations that turn `from` into `to`, matched by persisted id: metadata
 * and page changes, inserts (as shells, then their children), moves (only
 * nodes outside a longest kept subsequence of each child list), removals,
 * attribute changes and one minimal `replace-text` per changed text. A node
 * whose kind changed is removed and inserted again.
 */
export function diffDocuments(from: TexuliDocument, to: TexuliDocument): DocumentOperation[] {
  const operations: DocumentOperation[] = [];
  const meta: Record<string, unknown> = {};
  let metaChanged = false;
  for (const field of META_FIELDS) {
    const before = (from.meta as unknown as Record<string, unknown>)[field];
    const after = (to.meta as unknown as Record<string, unknown>)[field];
    if (equalData(before, after)) continue;
    meta[field] = after === undefined ? null : cloneData(after);
    metaChanged = true;
  }
  if (metaChanged) operations.push({ op: 'set-meta', meta: meta as MetaChanges });
  if (!equalData(from.page, to.page))
    operations.push({ op: 'set-page', page: to.page === undefined ? null : cloneData(to.page) });

  const before = indexDocument(from);
  const after = indexDocument(to);
  // The structure as the operations change it: child id lists and parents.
  const lists = new Map<string, DocumentBlockId[]>();
  const parents = new Map<DocumentBlockId, string>();
  lists.set(
    ROOT_KEY,
    from.blocks.map((node) => node.id)
  );
  for (const [id, entry] of before) {
    lists.set(
      id,
      childList(entry.node).map((node) => node.id)
    );
    parents.set(id, keyOf(entry.parent));
  }
  const present = new Set<DocumentBlockId>(before.keys());
  const removeFromMirror = (id: DocumentBlockId) => {
    const stack = [id];
    while (stack.length > 0) {
      const at = stack.pop() as DocumentBlockId;
      present.delete(at);
      stack.push(...(lists.get(at) ?? []));
    }
  };

  // A node whose kind changed leaves first, with its subtree.
  for (const [id, entry] of after) {
    const old = before.get(id);
    if (!old || kindOf(old.node) === kindOf(entry.node) || !present.has(id)) continue;
    const parentKey = parents.get(id) as string;
    const list = lists.get(parentKey) as DocumentBlockId[];
    list.splice(list.indexOf(id), 1);
    removeFromMirror(id);
    operations.push({ op: 'remove-node', id });
  }

  // Placement, parents before children (pre-order of `to`).
  const created = new Set<DocumentBlockId>();
  const order: (DocumentBlockId | null)[] = [null, ...after.keys()];
  for (const parent of order) {
    const node = parent === null ? null : (after.get(parent) as Entry).node;
    const target = (node === null ? to.blocks : childList(node)).map((child) => child.id);
    if (node !== null && childKeyOf(kindOf(node)) === null) continue;
    const parentKey = keyOf(parent);
    let list = lists.get(parentKey);
    if (!list) {
      list = [];
      lists.set(parentKey, list);
    }
    if (list.length === target.length && list.every((id, i) => id === target[i])) continue;
    const position = new Map(list.map((id, i) => [id, i]));
    const kept: number[] = [];
    const keptAt: number[] = [];
    target.forEach((id, i) => {
      const at = position.get(id);
      if (at !== undefined) {
        kept.push(at);
        keptAt.push(i);
      }
    });
    const keep = new Set<number>();
    for (const index of longestIncreasing(kept)) keep.add(keptAt[index] as number);
    for (let i = 0; i < target.length; i += 1) {
      if (keep.has(i)) continue;
      const id = target[i] as DocumentBlockId;
      if (present.has(id)) {
        const oldParent = parents.get(id) as string;
        const oldList = lists.get(oldParent) as DocumentBlockId[];
        oldList.splice(oldList.indexOf(id), 1);
      }
      const index = i === 0 ? 0 : list.indexOf(target[i - 1] as DocumentBlockId) + 1;
      if (present.has(id)) {
        operations.push({ op: 'move-node', id, parent, index });
      } else {
        const entry = after.get(id) as Entry;
        operations.push({ op: 'insert-node', parent, index, node: shellOf(entry.node) });
        present.add(id);
        created.add(id);
        lists.set(id, []);
      }
      list.splice(index, 0, id);
      parents.set(id, parentKey);
    }
  }

  // Removals: the highest nodes that left the document.
  for (const id of before.keys()) {
    if (after.has(id) || !present.has(id)) continue;
    const parentKey = parents.get(id) as string;
    if (parentKey !== ROOT_KEY && present.has(parentKey) && !after.has(parentKey)) continue;
    const list = lists.get(parentKey);
    if (list) list.splice(list.indexOf(id), 1);
    removeFromMirror(id);
    operations.push({ op: 'remove-node', id });
  }
  // Nodes under removed parents that were not removed through an ancestor.
  for (const id of before.keys()) {
    if (after.has(id) || !present.has(id)) continue;
    removeFromMirror(id);
    operations.push({ op: 'remove-node', id });
  }

  // Attributes and text of the nodes that stayed.
  for (const [id, entry] of after) {
    if (created.has(id)) continue;
    const old = before.get(id);
    if (!old) continue;
    const changes = attrChanges(old.node, entry.node);
    if (changes) operations.push({ op: 'set-attrs', id, attrs: changes as never });
    const a = textContent(old.node);
    const b = textContent(entry.node);
    if (a && b) {
      const text = textOperation(id, a, b);
      if (text) operations.push(text);
    }
  }
  return operations;
}

/** One change between two versions of a document. */
export type DocumentChange =
  | { kind: 'meta'; fields: string[] }
  | { kind: 'page' }
  | { kind: 'added' | 'removed'; block: DocumentBlockId; type: string; text: string }
  | { kind: 'moved'; block: DocumentBlockId; type: string; text: string }
  | { kind: 'text'; block: DocumentBlockId; type: string; before: string; after: string }
  | { kind: 'formatting'; block: DocumentBlockId; type: string; text: string }
  | { kind: 'attributes'; block: DocumentBlockId; type: string; keys: string[] };

const excerpt = (node: DocumentNode) => ownText(node).slice(0, 200);

/**
 * The changes between two versions, for people: metadata, page settings,
 * added and removed nodes (the highest of each subtree), moved nodes (those
 * outside a longest kept order), text edits (plain text before and after),
 * formatting-only edits and attribute changes, in the order of `to`.
 */
export function describeChanges(from: TexuliDocument, to: TexuliDocument): DocumentChange[] {
  const changes: DocumentChange[] = [];
  const fields = META_FIELDS.filter(
    (field) =>
      !equalData(
        (from.meta as unknown as Record<string, unknown>)[field],
        (to.meta as unknown as Record<string, unknown>)[field]
      )
  );
  if (fields.length > 0) changes.push({ kind: 'meta', fields: [...fields] });
  if (!equalData(from.page, to.page)) changes.push({ kind: 'page' });
  const before = indexDocument(from);
  const after = indexDocument(to);
  const moved = new Set<DocumentBlockId>();
  const lists: [DocumentBlockId | null, readonly DocumentNode[], readonly DocumentNode[]][] = [
    [null, from.blocks, to.blocks],
  ];
  for (const [id, entry] of after) {
    const old = before.get(id);
    if (old) lists.push([id, childList(old.node), childList(entry.node)]);
  }
  for (const [parent, oldList, newList] of lists) {
    const position = new Map(oldList.map((node, i) => [node.id, i]));
    const kept: number[] = [];
    const ids: DocumentBlockId[] = [];
    for (const node of newList) {
      const at = position.get(node.id);
      if (at === undefined) {
        const old = before.get(node.id);
        if (old && keyOf(old.parent) !== keyOf(parent)) moved.add(node.id);
        continue;
      }
      kept.push(at);
      ids.push(node.id);
    }
    const keep = longestIncreasing(kept);
    ids.forEach((id, i) => {
      if (!keep.has(i)) moved.add(id);
    });
  }
  for (const [id, entry] of after) {
    const type = kindOf(entry.node);
    const old = before.get(id);
    if (!old || kindOf(old.node) !== type) {
      const parentAdded = entry.parent !== null && !before.has(entry.parent);
      if (!parentAdded) changes.push({ kind: 'added', block: id, type, text: excerpt(entry.node) });
      continue;
    }
    if (moved.has(id)) changes.push({ kind: 'moved', block: id, type, text: excerpt(entry.node) });
    const a = textContent(old.node);
    const b = textContent(entry.node);
    if (a && b && !equalData(a, b)) {
      const beforeText = ownText(old.node);
      const afterText = ownText(entry.node);
      if (beforeText === afterText)
        changes.push({ kind: 'formatting', block: id, type, text: excerpt(entry.node) });
      else changes.push({ kind: 'text', block: id, type, before: beforeText, after: afterText });
    }
    const attrs = attrChanges(old.node, entry.node);
    if (attrs) changes.push({ kind: 'attributes', block: id, type, keys: Object.keys(attrs) });
  }
  for (const [id, entry] of before) {
    const now = after.get(id);
    if (now && kindOf(now.node) === kindOf(entry.node)) continue;
    const parentGone =
      entry.parent !== null &&
      (!after.has(entry.parent) ||
        kindOf((after.get(entry.parent) as Entry).node) !==
          kindOf((before.get(entry.parent) as Entry).node));
    if (!parentGone)
      changes.push({
        kind: 'removed',
        block: id,
        type: kindOf(entry.node),
        text: excerpt(entry.node),
      });
  }
  return changes;
}
