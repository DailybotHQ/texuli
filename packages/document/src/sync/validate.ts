/**
 * Shape validation of remote batches (ADR-010): every operation is checked
 * before anything integrates (ids, clocks, vector sizes, payload sizes and
 * the closed vocabulary), in time linear in the batch. Whether referenced
 * items exist is decided later, deterministically, at integration.
 */
import {
  type Anchor,
  type ItemId,
  KEY_PATTERN,
  SYNC_LIMITS as L,
  MAX_CLOCK,
  NODE_PATTERN,
  REPLICA_PATTERN,
  ROOT,
  type SeqOrigin,
  type SyncJson,
  type SyncOp,
  TRASH,
  TYPE_PATTERN,
  type VersionVector,
} from './types.ts';

class Invalid extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

interface Budget {
  chars: number;
}

function spend(budget: Budget, chars: number): void {
  budget.chars += chars;
  if (budget.chars > L.batchChars) throw new Invalid('The batch is too large.');
}

function clock(value: unknown, min: number, what: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > MAX_CLOCK)
    throw new Invalid(`${what} must be a whole number from ${min} to 2^48.`);
  return value as number;
}

function matches(value: unknown, pattern: RegExp, what: string): string {
  if (typeof value !== 'string' || value.length > 64 || !pattern.test(value))
    throw new Invalid(`${what} is malformed.`);
  return value;
}

function itemId(value: unknown): ItemId {
  if (!Array.isArray(value) || value.length !== 2)
    throw new Invalid('An item id is [replica, counter].');
  return [matches(value[0], REPLICA_PATTERN, 'A replica id'), clock(value[1], 0, 'A counter')];
}

function origin(value: unknown): SeqOrigin {
  if (!isRecord(value)) throw new Invalid('An origin is an object.');
  const side = value.side;
  if (side !== 'L' && side !== 'R') throw new Invalid('An origin side is L or R.');
  if (value.parent === null) {
    if (side !== 'R') throw new Invalid('The start takes right children only.');
    return { parent: null, side };
  }
  return { parent: itemId(value.parent), side };
}

function anchor(value: unknown): Anchor {
  if (value === 'start' || value === 'end') return value;
  if (!isRecord(value)) throw new Invalid('An anchor is start, end or { id, side }.');
  if (value.side !== 'before' && value.side !== 'after')
    throw new Invalid('An anchor side is before or after.');
  return { id: itemId(value.id), side: value.side };
}

/** Bounded JSON: depth, keys, items and string length; iterative. */
export function checkJson(value: unknown, budget: Budget = { chars: 0 }): void {
  const stack: [unknown, number][] = [[value, 0]];
  while (stack.length > 0) {
    const [current, depth] = stack.pop() as [unknown, number];
    if (current === null || typeof current === 'boolean') continue;
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) throw new Invalid('Numbers must be finite.');
      continue;
    }
    if (typeof current === 'string') {
      if (current.length > L.valueString) throw new Invalid('A string value is too long.');
      spend(budget, current.length);
      continue;
    }
    if (depth >= L.valueDepth) throw new Invalid('A value is nested too deeply.');
    if (Array.isArray(current)) {
      if (current.length > L.valueItems) throw new Invalid('An array value is too long.');
      for (const item of current) stack.push([item, depth + 1]);
      continue;
    }
    if (!isRecord(current)) throw new Invalid('Values are plain JSON data.');
    const keys = Object.keys(current);
    if (keys.length > L.valueKeys) throw new Invalid('An object value has too many keys.');
    for (const key of keys) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype')
        throw new Invalid('Prototype-related keys are refused.');
      if (key.length > 64) throw new Invalid('A key is too long.');
      spend(budget, key.length);
      stack.push([current[key], depth + 1]);
    }
  }
}

function deps(value: unknown): VersionVector {
  if (!isRecord(value)) throw new Invalid('deps is an object.');
  const keys = Object.keys(value);
  if (keys.length > L.replicas) throw new Invalid('deps names too many replicas.');
  const out: VersionVector = {};
  for (const key of keys)
    out[matches(key, REPLICA_PATTERN, 'A replica id')] = clock(value[key], 0, 'A deps entry');
  return out;
}

/** Code points of a string. */
export function unitsOf(text: string): string[] {
  return Array.from(text);
}

/** Counters an operation uses. */
export function unitCount(op: SyncOp): number {
  return op.kind === 'insert' ? unitsOf(op.text).length : 1;
}

function checkOp(raw: unknown, budget: Budget): SyncOp {
  if (!isRecord(raw)) throw new Invalid('An operation is an object.');
  const base = {
    replica: matches(raw.replica, REPLICA_PATTERN, 'The replica id'),
    counter: clock(raw.counter, 0, 'The counter'),
    lamport: clock(raw.lamport, 1, 'The Lamport time'),
    deps: deps(raw.deps),
  };
  const node = () => matches(raw.node, NODE_PATTERN, 'The node id');
  const field = () => matches(raw.field, KEY_PATTERN, 'The field');
  switch (raw.kind) {
    case 'create': {
      const id = node();
      if (id === ROOT || id === TRASH) throw new Invalid('The root and the trash are not created.');
      return {
        ...base,
        kind: 'create',
        node: id,
        type: matches(raw.type, TYPE_PATTERN, 'The type'),
      };
    }
    case 'move': {
      const id = node();
      if (id === ROOT || id === TRASH) throw new Invalid('The root and the trash do not move.');
      const parent = raw.parent === TRASH ? TRASH : matches(raw.parent, NODE_PATTERN, 'The parent');
      if (parent === TRASH) {
        if (raw.slot !== undefined) throw new Invalid('A removal has no slot.');
        return { ...base, kind: 'move', node: id, parent };
      }
      return { ...base, kind: 'move', node: id, parent, slot: origin(raw.slot) };
    }
    case 'set': {
      checkJson(raw.value, budget);
      if (raw.value === undefined) throw new Invalid('A value is required.');
      return {
        ...base,
        kind: 'set',
        node: node(),
        key: matches(raw.key, KEY_PATTERN, 'The key'),
        value: raw.value as SyncJson,
      };
    }
    case 'insert': {
      if (typeof raw.text !== 'string' || raw.text.length === 0)
        throw new Invalid('An insert holds text.');
      if (raw.text.length > L.text * 2 || unitsOf(raw.text).length > L.text)
        throw new Invalid('An insert holds at most 10,000 code points.');
      spend(budget, raw.text.length);
      return {
        ...base,
        kind: 'insert',
        node: node(),
        field: field(),
        origin: origin(raw.origin),
        text: raw.text,
      };
    }
    case 'delete':
    case 'revive': {
      if (!Array.isArray(raw.ranges) || raw.ranges.length === 0 || raw.ranges.length > L.ranges)
        throw new Invalid('ranges holds 1 to 10,000 ranges.');
      let items = 0;
      const ranges = raw.ranges.map((range: unknown) => {
        if (!Array.isArray(range) || range.length !== 3)
          throw new Invalid('A range is [replica, counter, length].');
        const length = clock(range[2], 1, 'A range length');
        items += length;
        if (items > L.rangeItems) throw new Invalid('The ranges cover too many items.');
        return [
          matches(range[0], REPLICA_PATTERN, 'A replica id'),
          clock(range[1], 0, 'A counter'),
          length,
        ] as const;
      });
      spend(budget, ranges.length * 3);
      return { ...base, kind: raw.kind, node: node(), field: field(), ranges };
    }
    case 'mark': {
      checkJson(raw.value, budget);
      if (raw.value === undefined) throw new Invalid('A value is required.');
      return {
        ...base,
        kind: 'mark',
        node: node(),
        field: field(),
        key: matches(raw.key, KEY_PATTERN, 'The key'),
        value: raw.value as SyncJson,
        start: anchor(raw.start),
        end: anchor(raw.end),
      };
    }
    default:
      throw new Invalid('Unknown operation kind.');
  }
}

export type BatchCheck =
  | { ok: true; ops: SyncOp[]; have?: VersionVector; reply: boolean }
  | { ok: false; index: number; reason: string };

/** Validate a batch's shape: a fresh, typed copy, or the first problem. */
export function checkBatch(batch: unknown): BatchCheck {
  if (!isRecord(batch)) return { ok: false, index: -1, reason: 'A batch is an object.' };
  const raw = batch.ops ?? [];
  if (!Array.isArray(raw) || raw.length > L.batch)
    return { ok: false, index: -1, reason: `A batch holds at most ${L.batch} operations.` };
  const budget: Budget = { chars: 0 };
  const ops: SyncOp[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    try {
      ops.push(checkOp(raw[index], budget));
    } catch (error) {
      return {
        ok: false,
        index,
        reason: error instanceof Invalid ? error.message : 'The operation is malformed.',
      };
    }
  }
  let have: VersionVector | undefined;
  if (batch.have !== undefined) {
    try {
      have = deps(batch.have);
    } catch (error) {
      return {
        ok: false,
        index: -1,
        reason: error instanceof Invalid ? error.message : 'have is malformed.',
      };
    }
  }
  return have
    ? { ok: true, ops, have, reply: batch.reply === true }
    : { ok: true, ops, reply: batch.reply === true };
}
