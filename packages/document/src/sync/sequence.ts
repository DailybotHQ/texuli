/**
 * The sequence CRDT for text and every ordered list (ADR-010): Fugue's
 * non-interleaving tree, stored as run-length items (one insert of a word is
 * one run), with last-writer-wins visibility per item (delete and revive)
 * and marks anchored to item ids.
 *
 * Each run is a chain: character `i + 1` is the right child of character
 * `i`. Other runs hang off a character as left children, or off a run's
 * last character as right children; siblings sort by id. The order is the
 * tree's in-order traversal, computed iteratively and cached.
 */
import type { Anchor, ItemId, SeqOrigin, SyncJson } from './types.ts';

export interface Stamp {
  lamport: number;
  replica: string;
  counter: number;
}

export function compareStamps(a: Stamp, b: Stamp): number {
  if (a.lamport !== b.lamport) return a.lamport < b.lamport ? -1 : 1;
  if (a.replica !== b.replica) return a.replica < b.replica ? -1 : 1;
  return a.counter === b.counter ? 0 : a.counter < b.counter ? -1 : 1;
}

function compareIds(aReplica: string, aCounter: number, bReplica: string, bCounter: number) {
  if (aReplica !== bReplica) return aReplica < bReplica ? -1 : 1;
  return aCounter === bCounter ? 0 : aCounter < bCounter ? -1 : 1;
}

class Run {
  readonly replica: string;
  readonly counter: number;
  readonly units: readonly string[];
  readonly stamp: Stamp;
  /** Left children per offset (sorted by id). */
  left: Map<number, Run[]> | null = null;
  /** Right children of the last unit (sorted by id). */
  readonly right: Run[] = [];
  /** Visibility changes per offset; absent means visible since the insert. */
  vis: Map<number, { stamp: Stamp; deleted: boolean }> | null = null;
  /** Position of each unit in the full order (rebuilt with the order). */
  pos: Int32Array;

  constructor(replica: string, counter: number, units: readonly string[], stamp: Stamp) {
    this.replica = replica;
    this.counter = counter;
    this.units = units;
    this.stamp = stamp;
    this.pos = new Int32Array(units.length);
  }

  deleted(offset: number): boolean {
    return this.vis?.get(offset)?.deleted ?? false;
  }
}

/** One unit: a run and an offset into it. */
export interface UnitRef {
  run: Run;
  offset: number;
}

export const idOf = (ref: UnitRef): ItemId => [ref.run.replica, ref.run.counter + ref.offset];

function insertSorted(list: Run[], run: Run): void {
  let index = list.length;
  while (
    index > 0 &&
    compareIds(
      run.replica,
      run.counter,
      (list[index - 1] as Run).replica,
      (list[index - 1] as Run).counter
    ) < 0
  )
    index -= 1;
  list.splice(index, 0, run);
}

export interface MarkEntry {
  key: string;
  value: SyncJson;
  start: Anchor;
  end: Anchor;
  stamp: Stamp;
}

/** A visible stretch of text with the same marks. */
export interface SyncTextRun {
  text: string;
  marks: { [key: string]: SyncJson };
}

/** How a mark grows at its end: `end` (strong, em…) or `none` (links). */
export type MarkExpand = 'end' | 'none';

export class Sequence {
  private readonly roots: Run[] = [];
  private readonly byReplica = new Map<string, Run[]>();
  private readonly marks: MarkEntry[] = [];
  private order: UnitRef[] | null = null;
  private visible: UnitRef[] | null = null;

  /** Find a unit by id. */
  find(id: ItemId): UnitRef | null {
    const runs = this.byReplica.get(id[0]);
    if (!runs) return null;
    let low = 0;
    let high = runs.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const run = runs[mid] as Run;
      if (id[1] < run.counter) high = mid - 1;
      else if (id[1] >= run.counter + run.units.length) low = mid + 1;
      else return { run, offset: id[1] - run.counter };
    }
    return null;
  }

  /** Whether an origin names an item of this sequence in a valid place. */
  canInsert(origin: SeqOrigin): boolean {
    if (origin.parent === null) return origin.side === 'R';
    const parent = this.find(origin.parent);
    if (!parent) return false;
    // Only a run's last unit takes right children; inner units already have one.
    return origin.side === 'L' || parent.offset === parent.run.units.length - 1;
  }

  /** Integrate an insert (call `canInsert` first). Counters of one replica arrive in order. */
  insert(
    replica: string,
    counter: number,
    units: readonly string[],
    origin: SeqOrigin,
    stamp: Stamp
  ) {
    const run = new Run(replica, counter, units, stamp);
    if (origin.parent === null) insertSorted(this.roots, run);
    else {
      const parent = this.find(origin.parent) as UnitRef;
      if (origin.side === 'R') insertSorted(parent.run.right, run);
      else {
        parent.run.left ??= new Map();
        const list = parent.run.left.get(parent.offset) ?? [];
        insertSorted(list, run);
        parent.run.left.set(parent.offset, list);
      }
    }
    let runs = this.byReplica.get(replica);
    if (!runs) {
      runs = [];
      this.byReplica.set(replica, runs);
    }
    runs.push(run);
    this.order = null;
    this.visible = null;
  }

  /** Whether every unit of the ranges belongs to this sequence. */
  hasRanges(ranges: readonly (readonly [string, number, number])[]): boolean {
    for (const [replica, counter, length] of ranges) {
      let at = counter;
      const end = counter + length;
      while (at < end) {
        const ref = this.find([replica, at]);
        if (!ref) return false;
        at = ref.run.counter + ref.run.units.length;
      }
    }
    return true;
  }

  /** Last-writer-wins visibility for every unit of the ranges (call `hasRanges` first). */
  setVisibility(
    ranges: readonly (readonly [string, number, number])[],
    deleted: boolean,
    stamp: Stamp
  ): void {
    for (const [replica, counter, length] of ranges) {
      let at = counter;
      const end = counter + length;
      while (at < end) {
        const ref = this.find([replica, at]) as UnitRef;
        const run = ref.run;
        const stop = Math.min(end, run.counter + run.units.length);
        for (let id = at; id < stop; id += 1) {
          const offset = id - run.counter;
          const current = run.vis?.get(offset);
          if (compareStamps(stamp, current?.stamp ?? run.stamp) > 0) {
            run.vis ??= new Map();
            run.vis.set(offset, { stamp, deleted });
          }
        }
        at = stop;
      }
    }
    this.visible = null;
  }

  hasAnchor(anchor: Anchor): boolean {
    return typeof anchor === 'string' || this.find(anchor.id) !== null;
  }

  addMark(entry: MarkEntry): void {
    this.marks.push(entry);
  }

  /** Every unit in order, deleted ones included. */
  fullOrder(): UnitRef[] {
    if (this.order) return this.order;
    const out: UnitRef[] = [];
    // Tasks: walk a sibling list from index i, or a run from an offset
    // (`emit` once its left children are done).
    type Task = { list: Run[]; i: number } | { run: Run; offset: number; emit: boolean };
    const stack: Task[] = [];
    if (this.roots.length > 0) stack.push({ list: this.roots, i: 0 });
    while (stack.length > 0) {
      const task = stack.pop() as Task;
      if ('list' in task) {
        const run = task.list[task.i] as Run;
        if (task.i + 1 < task.list.length) stack.push({ list: task.list, i: task.i + 1 });
        stack.push({ run, offset: 0, emit: false });
        continue;
      }
      const { run, offset } = task;
      if (offset === run.units.length) {
        if (run.right.length > 0) stack.push({ list: run.right, i: 0 });
        continue;
      }
      if (task.emit) {
        run.pos[offset] = out.length;
        out.push({ run, offset });
        stack.push({ run, offset: offset + 1, emit: false });
        continue;
      }
      stack.push({ run, offset, emit: true });
      const left = run.left?.get(offset);
      if (left && left.length > 0) stack.push({ list: left, i: 0 });
    }
    this.order = out;
    return out;
  }

  /** Visible units in order. */
  visibleOrder(): UnitRef[] {
    if (this.visible) return this.visible;
    this.visible = this.fullOrder().filter((ref) => !ref.run.deleted(ref.offset));
    return this.visible;
  }

  get length(): number {
    return this.visibleOrder().length;
  }

  /** The origin for inserting right after `after` (a unit) or at the start (`null`). */
  originAfter(after: UnitRef | null): SeqOrigin {
    const order = this.fullOrder();
    if (after === null) {
      const first = order[0];
      return first ? { parent: idOf(first), side: 'L' } : { parent: null, side: 'R' };
    }
    const { run, offset } = after;
    const hasRight = offset < run.units.length - 1 || run.right.length > 0;
    if (!hasRight) return { parent: idOf(after), side: 'R' };
    const next = order[(run.pos[offset] as number) + 1] as UnitRef;
    return { parent: idOf(next), side: 'L' };
  }

  /** The origin for inserting at visible `index`. */
  originAt(index: number): SeqOrigin {
    const visible = this.visibleOrder();
    return this.originAfter(index === 0 ? null : (visible[index - 1] ?? null));
  }

  /** `[replica, counter, length]` ranges of the visible units `[from, to)`. */
  rangesOf(from: number, to: number): [string, number, number][] {
    const visible = this.visibleOrder();
    return compress(visible.slice(from, to));
  }

  /** The full-order position an anchor stands for (a boundary between units). */
  private bound(anchor: Anchor): number {
    if (anchor === 'start') return 0;
    if (anchor === 'end') return this.fullOrder().length;
    const ref = this.find(anchor.id) as UnitRef;
    const pos = ref.run.pos[ref.offset] as number;
    return anchor.side === 'before' ? pos : pos + 1;
  }

  /** The winning value of every mark key per full-order position (absent when unset). */
  private markValues(onlyKey?: string): Map<string, Map<number, SyncJson>> {
    this.fullOrder();
    const byKey = new Map<string, MarkEntry[]>();
    for (const entry of this.marks) {
      if (onlyKey !== undefined && entry.key !== onlyKey) continue;
      let list = byKey.get(entry.key);
      if (!list) {
        list = [];
        byKey.set(entry.key, list);
      }
      list.push(entry);
    }
    const out = new Map<string, Map<number, SyncJson>>();
    for (const [key, entries] of byKey) {
      entries.sort((a, b) => compareStamps(b.stamp, a.stamp));
      // Paint newest first; `skip` jumps over painted positions (union-find).
      const painted = new Map<number, SyncJson>();
      const skip = new Map<number, number>();
      const next = (x: number): number => {
        let root = x;
        while (skip.has(root)) root = skip.get(root) as number;
        let at = x;
        while (at !== root) {
          const step = skip.get(at) as number;
          skip.set(at, root);
          at = step;
        }
        return root;
      };
      for (const entry of entries) {
        const start = this.bound(entry.start);
        const end = this.bound(entry.end);
        for (let at = next(start); at < end; at = next(at)) {
          painted.set(at, entry.value);
          skip.set(at, at + 1);
        }
      }
      out.set(key, painted);
    }
    return out;
  }

  /** The visible text. */
  toString(): string {
    let out = '';
    for (const ref of this.visibleOrder()) out += ref.run.units[ref.offset];
    return out;
  }

  /** The visible text as runs with their marks (`null` values are no mark). */
  textRuns(): SyncTextRun[] {
    const values = this.markValues();
    const out: SyncTextRun[] = [];
    let signature = '';
    for (const ref of this.visibleOrder()) {
      const pos = ref.run.pos[ref.offset] as number;
      const marks: { [key: string]: SyncJson } = {};
      for (const [key, painted] of values) {
        const value = painted.get(pos);
        if (value !== undefined && value !== null) marks[key] = value;
      }
      const keys = Object.keys(marks).sort();
      const sorted: { [key: string]: SyncJson } = {};
      for (const key of keys) sorted[key] = marks[key] as SyncJson;
      const next = JSON.stringify(sorted);
      const last = out.at(-1);
      if (last && next === signature) last.text += ref.run.units[ref.offset];
      else {
        out.push({ text: ref.run.units[ref.offset] as string, marks: sorted });
        signature = next;
      }
    }
    return out;
  }

  /**
   * Segments of the visible units `[from, to)` with the same current value
   * of `key` (`null` when unset): what undoing a format restores.
   */
  markSegments(
    key: string,
    from: number,
    to: number
  ): { first: ItemId; last: ItemId; value: SyncJson }[] {
    const painted = this.markValues(key).get(key) ?? new Map<number, SyncJson>();
    const out: { first: ItemId; last: ItemId; value: SyncJson; sig: string }[] = [];
    for (const ref of this.visibleOrder().slice(from, to)) {
      const value = painted.get(ref.run.pos[ref.offset] as number) ?? null;
      const sig = JSON.stringify(value);
      const last = out.at(-1);
      if (last && last.sig === sig) last.last = idOf(ref);
      else out.push({ first: idOf(ref), last: idOf(ref), value, sig });
    }
    return out.map(({ first, last, value }) => ({ first, last, value }));
  }

  /** Anchors for marking the visible units `[from, to)` with an expand rule. */
  anchorsFor(from: number, to: number, expand: MarkExpand): { start: Anchor; end: Anchor } | null {
    const visible = this.visibleOrder();
    const first = visible[from];
    const last = visible[to - 1];
    if (!first || !last || to <= from) return null;
    const start: Anchor = { id: idOf(first), side: 'before' };
    if (expand === 'none') return { start, end: { id: idOf(last), side: 'after' } };
    const order = this.fullOrder();
    const after = order[(last.run.pos[last.offset] as number) + 1];
    return { start, end: after ? { id: idOf(after), side: 'before' } : 'end' };
  }

  /** Units of the sequence, deleted ones included. */
  get size(): number {
    return this.fullOrder().length;
  }
}

/** Consecutive ids of one replica (in the same run) become one range. */
export function compress(refs: readonly UnitRef[]): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (const ref of refs) {
    const counter = ref.run.counter + ref.offset;
    const last = out.at(-1);
    if (last && last[0] === ref.run.replica && last[1] + last[2] === counter) last[2] += 1;
    else out.push([ref.run.replica, counter, 1]);
  }
  return out;
}
