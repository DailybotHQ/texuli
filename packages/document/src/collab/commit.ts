/**
 * Local changes into CRDT operations: the id-keyed tree diff of ADR-011.
 * `commitDocument(context, next)` compares the projected document the
 * editor started from with the one it produced (any mix of typed
 * operations, patches or a restore) and emits the replica operations that
 * make the projection equal `next`: register writes for metadata and
 * attributes, creates and moves for placement (only nodes outside a
 * longest kept order move, so concurrent moves elsewhere survive), moves to
 * the trash for removals, and one minimal insert and delete per changed
 * text, then the mark writes that make every unit's marks match.
 *
 * Positions are computed against the replica itself, not the old
 * document, so nodes and characters the projection leaves out are never
 * touched by an edit that did not see them. In suggestion mode, text the
 * user deletes is marked as a suggested deletion instead (unless it is
 * their own suggested insertion), and inserted text is marked as a
 * suggested insertion.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import type {
  DocumentBlockId,
  DocumentInline,
  DocumentNode,
  TexuliDocument,
} from '../model/types.ts';
import { equalData } from '../ops/clone.ts';
import { type ItemId, type Replica, ROOT, type SyncJson } from '../sync/index.ts';
import { indexDocument, longestIncreasing } from './diff.ts';
import { type FieldView, readView } from './project.ts';
import {
  attrsOf,
  childKeyOf,
  DOCUMENT_MARK_KEYS,
  encodeValue,
  kindOf,
  META_FIELDS,
  markToSync,
  PAGE_FIELD,
  SUGGEST_DELETE,
  SUGGEST_INSERT,
  textFieldOf,
} from './vocabulary.ts';

/** Suggestion mode: where marks get their suggestion id. */
export interface SuggestContext {
  /** True when the id names one of this author's own suggestions. */
  mine(id: string): boolean;
  /** The suggestion id of this transaction (its record is created on the first call). */
  create(): string;
}

export interface CommitContext {
  replica: Replica;
  /** The projected document the edit started from. */
  previous: TexuliDocument;
  suggest?: SuggestContext | null;
  /** URL tier of the projection (`untrusted` by default). */
  tier?: HrefTrust;
}

function childIds(node: DocumentNode | null, doc: TexuliDocument): DocumentBlockId[] {
  if (node === null) return doc.blocks.map((child) => child.id);
  const key = childKeyOf(kindOf(node));
  if (!key) return [];
  return ((node as unknown as Record<string, DocumentNode[]>)[key] ?? []).map((child) => child.id);
}

/** Desired units of a node's text: characters and the CRDT mark values per document key. */
function desiredUnits(node: DocumentNode, field: string, rich: boolean) {
  const chars: string[] = [];
  const marks: { [key: string]: SyncJson }[] = [];
  const value = (node as unknown as Record<string, unknown>)[field];
  if (!rich) {
    for (const char of typeof value === 'string' ? value : '') {
      chars.push(char);
      marks.push({});
    }
    return { chars, marks };
  }
  for (const part of (Array.isArray(value) ? value : []) as DocumentInline[]) {
    if (part.type === 'break') {
      chars.push('\n');
      marks.push({});
      continue;
    }
    const map: { [key: string]: SyncJson } = {};
    for (const mark of part.marks) {
      const [key, markValue] = markToSync(mark);
      map[key] = markValue;
    }
    for (const char of part.text) {
      chars.push(char);
      marks.push(map);
    }
  }
  return { chars, marks };
}

/** Contiguous runs of visible indices, `[from, to)`, in order. */
function groups(indices: number[]): [number, number][] {
  const sorted = [...indices].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const index of sorted) {
    const last = out.at(-1);
    if (last && last[1] === index) last[1] += 1;
    else out.push([index, index + 1]);
  }
  return out;
}

/** Make a node's text field in the replica equal the node's text in `next`. */
function writeText(context: CommitContext, node: DocumentNode, field: string, rich: boolean): void {
  const { replica } = context;
  const suggest = context.suggest ?? null;
  const id = node.id;
  const view = readView(replica, id, field, rich, context.tier);
  const want = desiredUnits(node, field, rich);
  const a = view.chars;
  const b = want.chars;
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix += 1;
  const delFrom = prefix;
  const delTo = a.length - suffix;
  const insert = b.slice(prefix, b.length - suffix);
  // The units the edit took out of the text, and what happens to each.
  const span = new Set<string>();
  const remove: ItemId[] = [];
  const strike: ItemId[] = [];
  for (let i = delFrom; i < delTo; i += 1) {
    const item = view.ids[i] as ItemId;
    span.add(`${item[0]}:${item[1]}`);
    if (!suggest) remove.push(item);
    else {
      const inserted = view.inserted[i] ?? null;
      if (inserted !== null && suggest.mine(inserted)) remove.push(item);
      else if (view.deleted[i] === null) strike.push(item);
      // An already suggested deletion stays as it is.
    }
  }

  if (insert.length > 0) {
    const at =
      suggest && delTo > delFrom
        ? (view.raw[delTo - 1] as number) + 1
        : prefix < a.length
          ? (view.raw[prefix] as number)
          : a.length > 0
            ? (view.raw[a.length - 1] as number) + 1
            : 0;
    replica.insertText(id, field, at, insert.join(''));
    if (suggest) {
      const before = prefix > 0 ? (view.inserted[prefix - 1] ?? null) : null;
      const sid = before !== null && suggest.mine(before) ? before : suggest.create();
      replica.formatText(id, field, at, at + insert.length, SUGGEST_INSERT, sid);
    }
  }

  // Marks: the replica's units without the ones the edit took out line up with the wanted units.
  if (rich) {
    const now = readView(replica, id, field, rich, context.tier);
    const units: number[] = [];
    for (let i = 0; i < now.chars.length; i += 1) {
      const item = now.ids[i] as ItemId;
      if (!span.has(`${item[0]}:${item[1]}`)) units.push(i);
    }
    if (units.length === b.length) {
      for (const key of DOCUMENT_MARK_KEYS) {
        let start = -1;
        let value: SyncJson = null;
        let sig = '';
        const flush = (end: number) => {
          if (start < 0) return;
          for (const [from, to] of rawRuns(now, units, start, end))
            replica.formatText(id, field, from, to, key, value);
          start = -1;
        };
        for (let j = 0; j < units.length; j += 1) {
          const current = now.marks[units[j] as number]?.find((mark) => mark.type === key);
          const have = current ? markToSync(current)[1] : null;
          const wanted = (want.marks[j] as { [key: string]: SyncJson })[key] ?? null;
          const differs = JSON.stringify(have) !== JSON.stringify(wanted);
          const nextSig = differs ? JSON.stringify(wanted) : '';
          if (start >= 0 && nextSig !== sig) flush(j);
          if (differs && start < 0) {
            start = j;
            value = wanted;
            sig = nextSig;
          }
        }
        flush(units.length);
      }
    }
  }

  if (strike.length > 0 && suggest) {
    const near = view.deleted[delFrom - 1] ?? view.deleted[delTo] ?? null;
    const sid = near !== null && suggest.mine(near) ? near : suggest.create();
    for (const [from, to] of groups(indexesOf(replica, id, field, strike)))
      replica.formatText(id, field, from, to, SUGGEST_DELETE, sid);
  }
  if (remove.length > 0) deleteItems(replica, id, field, remove);
}

/** Visible replica ranges covering the aligned units `[start, end)`, split where they are not contiguous. */
function rawRuns(view: FieldView, units: number[], start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  for (let j = start; j < end; j += 1) {
    const raw = view.raw[units[j] as number] as number;
    const last = out.at(-1);
    if (last && last[1] === raw) last[1] += 1;
    else out.push([raw, raw + 1]);
  }
  return out;
}

function indexesOf(replica: Replica, node: string, field: string, items: ItemId[]): number[] {
  const out: number[] = [];
  for (const item of items) {
    if (!replica.isVisible(node, field, item)) continue;
    const index = replica.anchorIndex(node, field, { id: item, side: 'before' });
    if (index !== null) out.push(index);
  }
  return out;
}

function deleteItems(replica: Replica, node: string, field: string, items: ItemId[]): void {
  const runs = groups(indexesOf(replica, node, field, items));
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const [from, to] = runs[i] as [number, number];
    replica.deleteText(node, field, from, to - from);
  }
}

function writeAttrs(replica: Replica, node: DocumentNode): void {
  const record = node as unknown as Record<string, unknown>;
  const props = replica.node(node.id)?.props ?? {};
  for (const key of attrsOf(kindOf(node))) {
    const wanted = encodeValue(record[key]);
    if (!equalData(props[key] ?? null, wanted)) replica.setProp(node.id, key, wanted);
  }
}

/**
 * Emit the replica operations that turn the projection of `context.previous`
 * into `next`. Call it inside `replica.transact` so the change is one undo
 * step and one batch.
 */
export function commitDocument(context: CommitContext, next: TexuliDocument): void {
  const { replica, previous } = context;
  for (const field of META_FIELDS) {
    const before = (previous.meta as unknown as Record<string, unknown>)[field];
    const after = (next.meta as unknown as Record<string, unknown>)[field];
    if (!equalData(before, after)) replica.setProp(ROOT, field, encodeValue(after));
  }
  if (!equalData(previous.page, next.page))
    replica.setProp(ROOT, PAGE_FIELD, encodeValue(next.page));

  const before = indexDocument(previous);
  const after = indexDocument(next);
  const created = new Set<DocumentBlockId>();
  const revived = new Set<DocumentBlockId>();

  // Placement, parents first (pre-order of `next`).
  const parents: (DocumentBlockId | null)[] = [null, ...after.keys()];
  for (const parent of parents) {
    const node = parent === null ? null : (after.get(parent)?.node ?? null);
    if (parent !== null && (!node || childKeyOf(kindOf(node)) === null)) continue;
    const target = childIds(node, next);
    const old =
      parent === null
        ? previous.blocks.map((child) => child.id)
        : before.has(parent)
          ? childIds(before.get(parent)?.node ?? null, previous)
          : null;
    if (
      old &&
      old.length === target.length &&
      old.every((id, i) => id === target[i]) &&
      !created.has(parent ?? '')
    ) {
      // Unchanged list, unless a child changed kind (handled below with the attributes).
      continue;
    }
    const holder = parent ?? ROOT;
    const raw = replica.children(holder);
    const position = new Map(raw.map((id, i) => [id, i]));
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
      const child = (after.get(id) as { node: DocumentNode }).node;
      const kind = kindOf(child);
      const siblings = replica.children(holder).filter((other) => other !== id);
      const index = i === 0 ? 0 : siblings.indexOf(target[i - 1] as DocumentBlockId) + 1;
      const existing = replica.node(id);
      if (existing) {
        if (existing.type !== kind) replica.setNodeType(id, kind);
        replica.moveNode(id, holder, index);
        if (!before.has(id)) revived.add(id);
      } else {
        const props: { [key: string]: SyncJson } = {};
        const record = child as unknown as Record<string, unknown>;
        for (const key of attrsOf(kind)) {
          if (record[key] !== undefined) props[key] = encodeValue(record[key]);
        }
        replica.insertNode(kind, holder, index, { id, props });
        created.add(id);
      }
    }
  }

  // Removals: what the edit saw and dropped (never what it did not see).
  for (const [id, entry] of before) {
    if (after.has(id)) continue;
    if (entry.parent !== null && !after.has(entry.parent)) continue;
    if (replica.node(id)) replica.removeNode(id);
  }

  // Types, attributes and text.
  for (const [id, entry] of after) {
    const node = entry.node;
    const kind = kindOf(node);
    const old = before.get(id)?.node;
    const isNew = created.has(id);
    if (!isNew) {
      if (old && equalData(old, node) && !revived.has(id)) continue;
      const existing = replica.node(id);
      if (existing && existing.type !== kind) replica.setNodeType(id, kind);
      if (!old || !shallowAttrsEqual(old, node, kind)) writeAttrs(replica, node);
    }
    const text = textFieldOf(kind);
    if (!text) continue;
    const field = text.field;
    const oldValue = old ? (old as unknown as Record<string, unknown>)[field] : undefined;
    const value = (node as unknown as Record<string, unknown>)[field];
    if (!isNew && !revived.has(id) && old && kindOf(old) === kind && equalData(oldValue, value))
      continue;
    writeText(context, node, field, text.rich);
  }
}

function shallowAttrsEqual(a: DocumentNode, b: DocumentNode, kind: string): boolean {
  if (kindOf(a) !== kind) return false;
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  return attrsOf(kind).every((key) => equalData(left[key], right[key]));
}
