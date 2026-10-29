/**
 * The sync wire format (ADR-010): plain JSON operations stamped with
 * `(replica, counter)` ids, a Lamport clock and the causal dependencies the
 * author had seen, as a version vector.
 */

/** An item id: the replica that made it and its counter on that replica. */
export type ItemId = readonly [replica: string, counter: number];

/**
 * Units integrated per replica: `vv[r] = n` means every unit of `r` with a
 * counter below `n` is integrated. An insert of `k` code points uses `k`
 * counters; every other operation uses one.
 */
export type VersionVector = { [replica: string]: number };

/** A Fugue position: a child (left `L` or right `R`) of an existing item, or of the start (`null`, `R`). */
export interface SeqOrigin {
  parent: ItemId | null;
  side: 'L' | 'R';
}

/** A mark boundary: just before or after an item, or the start or end of the sequence. */
export type Anchor = { id: ItemId; side: 'before' | 'after' } | 'start' | 'end';

export type SyncJson = string | number | boolean | null | SyncJson[] | { [key: string]: SyncJson };

export interface SyncOpBase {
  replica: string;
  counter: number;
  lamport: number;
  /** What the author had integrated (its own replica omitted). */
  deps: VersionVector;
}

/** Register a node and its type (the type is a last-writer-wins value). */
export interface CreateOp extends SyncOpBase {
  kind: 'create';
  node: string;
  type: string;
}

/** Move a node under `parent` at a new slot (`trash` removes it; no slot then). */
export interface MoveOp extends SyncOpBase {
  kind: 'move';
  node: string;
  parent: string;
  slot?: SeqOrigin;
}

/** Set a node property (last writer wins); `null` clears it. */
export interface SetOp extends SyncOpBase {
  kind: 'set';
  node: string;
  key: string;
  value: SyncJson;
}

/** Insert text into a node's text field. */
export interface InsertOp extends SyncOpBase {
  kind: 'insert';
  node: string;
  field: string;
  origin: SeqOrigin;
  text: string;
}

/** Hide (`delete`) or show again (`revive`) items: `[replica, counter, length]` ranges. */
export interface VisibilityOp extends SyncOpBase {
  kind: 'delete' | 'revive';
  node: string;
  field: string;
  ranges: (readonly [string, number, number])[];
}

/** Set a mark over `[start, end)`; `value: null` removes it. */
export interface MarkOp extends SyncOpBase {
  kind: 'mark';
  node: string;
  field: string;
  key: string;
  value: SyncJson;
  start: Anchor;
  end: Anchor;
}

export type SyncOp = CreateOp | MoveOp | SetOp | InsertOp | VisibilityOp | MarkOp;
export type SyncOpKind = SyncOp['kind'];

/**
 * What adapters carry. `ops` are operations; `have` announces a version
 * vector so the peer sends what it lacks (`reply: true` asks for the
 * peer's own `have` back).
 */
export interface SyncBatch {
  ops?: SyncOp[];
  have?: VersionVector;
  reply?: boolean;
}

/** The node every tree starts with. */
export const ROOT = 'root';
/** The parent of removed nodes. */
export const TRASH = 'trash';

export const SYNC_LIMITS = Object.freeze({
  /** Operations in one batch. */
  batch: 10_000,
  /** Code points in one insert. */
  text: 10_000,
  /** Ranges in one delete or revive, and the items they cover. */
  ranges: 10_000,
  rangeItems: 1_000_000,
  /** Replicas in a version vector. */
  replicas: 1_024,
  /** Operations buffered while waiting for their dependencies. */
  pending: 100_000,
  /** UTF-16 code units of strings and JSON in one batch. */
  batchChars: 8_000_000,
  /** Property values: nesting, keys, items and string length. */
  valueDepth: 8,
  valueKeys: 100,
  valueItems: 1_000,
  valueString: 10_000,
  /** Ancestors a move checks for a cycle; a deeper move is skipped. */
  treeDepth: 256,
});

/** Replica ids: up to 40 characters, so generated node ids (`<replica>.<counter>`) stay within 64. */
export const REPLICA_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
export const NODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
export const TYPE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
export const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
/** The largest counter or Lamport time accepted. */
export const MAX_CLOCK = 2 ** 48;
