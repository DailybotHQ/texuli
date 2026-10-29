/**
 * A replica of a synced tree (ADR-010): the tree CRDT, a sequence per text
 * field and a last-writer-wins register per property, fed by local edits
 * and remote batches. Remote operations are validated, deduplicated by id,
 * buffered until causally ready and integrated in any delivery order; every
 * replica that integrated the same operations holds the same state.
 *
 * Undo is local and selective: each local transaction records its inverse
 * intent, and undo emits new operations (hide what it inserted, revive what
 * it deleted, move back while the old parent exists, rewrite the previous
 * value). Shared history is never rewound.
 */
import {
  compareStamps,
  type MarkExpand,
  Sequence,
  type Stamp,
  type SyncTextRun,
  type UnitRef,
} from './sequence.ts';
import { Tree, type TreeNode } from './tree.ts';
import {
  type Anchor,
  type ItemId,
  type MarkOp,
  REPLICA_PATTERN,
  ROOT,
  type SeqOrigin,
  SYNC_LIMITS,
  type SyncBatch,
  type SyncJson,
  type SyncOp,
  TRASH,
  type VersionVector,
} from './types.ts';
import { checkBatch, unitCount, unitsOf } from './validate.ts';

export interface ReplicaOptions {
  /** This replica's id (host-supplied, random per session; up to 40 of `A–Z a–z 0–9 _ -`). */
  replica: string;
  /** How each mark key grows at its end (default: `link` never grows, others do). */
  markExpand?: (key: string) => MarkExpand;
  /** A closed set of mark keys; marks with other keys are dropped. */
  markKeys?: readonly string[];
  /** A closed set of node types; creates of other types are dropped. */
  types?: readonly string[];
  /** Undo steps kept (default 200). */
  undoLimit?: number;
}

export interface ReceiveResult {
  ok: boolean;
  /** Operations integrated (from this batch and buffered ones it unblocked). */
  integrated: number;
  duplicates: number;
  /** Operations waiting for their dependencies after this batch. */
  pending: number;
  /** Integrated operations whose references were invalid (no effect, deterministic). */
  dropped: number;
  /** Set when the batch was refused as a whole. */
  reason?: string;
  index?: number;
}

export interface SyncNodeJson {
  id: string;
  type: string;
  props: { [key: string]: SyncJson };
  text: { [field: string]: SyncTextRun[] };
  children: SyncNodeJson[];
}

export interface SyncSnapshot {
  /** Every integrated operation, in integration order. */
  ops: SyncOp[];
}

type Intent =
  | { kind: 'remove'; node: string }
  | { kind: 'retype'; node: string; type: string }
  | { kind: 'place'; node: string; parent: string | null; after: ItemId | null }
  | { kind: 'set'; node: string; key: string; value: SyncJson }
  | { kind: 'hide' | 'show'; node: string; field: string; ranges: [string, number, number][] }
  | {
      kind: 'marks';
      node: string;
      field: string;
      key: string;
      segments: { first: ItemId; last: ItemId; value: SyncJson }[];
    };

type Listener = (ops: SyncOp[], origin: 'local' | 'remote') => void;

type Draft =
  | Omit<Extract<SyncOp, { kind: 'create' }>, 'replica' | 'counter' | 'lamport' | 'deps'>
  | Omit<Extract<SyncOp, { kind: 'move' }>, 'replica' | 'counter' | 'lamport' | 'deps'>
  | Omit<Extract<SyncOp, { kind: 'set' }>, 'replica' | 'counter' | 'lamport' | 'deps'>
  | Omit<Extract<SyncOp, { kind: 'insert' }>, 'replica' | 'counter' | 'lamport' | 'deps'>
  | Omit<Extract<SyncOp, { kind: 'delete' | 'revive' }>, 'replica' | 'counter' | 'lamport' | 'deps'>
  | Omit<MarkOp, 'replica' | 'counter' | 'lamport' | 'deps'>;

const defaultExpand = (key: string): MarkExpand => (key === 'link' ? 'none' : 'end');

export class Replica {
  readonly id: string;
  private readonly vv: VersionVector = {};
  private lamport = 0;
  private readonly tree = new Tree();
  private readonly log: SyncOp[] = [];
  private readonly buffer = new Map<string, Map<number, SyncOp>>();
  private buffered = 0;
  private readonly listeners = new Set<Listener>();
  private readonly expand: (key: string) => MarkExpand;
  private readonly markKeys: ReadonlySet<string> | null;
  private readonly types: ReadonlySet<string> | null;
  private readonly undoLimit: number;
  private readonly undoStack: Intent[][] = [];
  private readonly redoStack: Intent[][] = [];
  private capture: Intent[] | null = null;
  private steps = 0;
  private outbox: SyncOp[] | null = null;

  constructor(options: ReplicaOptions) {
    if (typeof options?.replica !== 'string' || !REPLICA_PATTERN.test(options.replica))
      throw new TypeError('A replica id is 1 to 40 of A–Z, a–z, 0–9, _ and -.');
    this.id = options.replica;
    this.expand = options.markExpand ?? defaultExpand;
    this.markKeys = options.markKeys ? new Set(options.markKeys) : null;
    this.types = options.types ? new Set(options.types) : null;
    this.undoLimit = Math.max(0, Math.floor(options.undoLimit ?? 200));
  }

  // ── reading ──────────────────────────────────────────────────────────

  /** A copy of the version vector. */
  versionVector(): VersionVector {
    return { ...this.vv };
  }

  /** The integrated operations a peer at `have` lacks, in causal order. */
  opsSince(have: VersionVector = {}): SyncOp[] {
    return this.log.filter((op) => op.counter + unitCount(op) > (have[op.replica] ?? 0));
  }

  snapshot(): SyncSnapshot {
    return { ops: [...this.log] };
  }

  /** Operations buffered while waiting for their dependencies. */
  get pending(): number {
    return this.buffered;
  }

  /** A node's type, parent and properties, or `null` when unknown. */
  node(id: string): {
    id: string;
    type: string;
    parent: string | null;
    props: { [key: string]: SyncJson };
  } | null {
    const node = this.tree.nodes.get(id);
    if (!node) return null;
    return { id, type: node.type, parent: node.parent, props: this.propsOf(node) };
  }

  /** Child ids in order. */
  children(id: string = ROOT): string[] {
    return this.tree.children(id).map((child) => child.id);
  }

  /** The visible text of a node's field. */
  text(node: string, field: string): string {
    return this.tree.nodes.get(node)?.texts.get(field)?.toString() ?? '';
  }

  /** The visible text of a node's field as runs with marks. */
  textRuns(node: string, field: string): SyncTextRun[] {
    return this.tree.nodes.get(node)?.texts.get(field)?.textRuns() ?? [];
  }

  /** The id of the visible unit at a code-point `index` of a node's field, or `null`. */
  itemAt(node: string, field: string, index: number): ItemId | null {
    const unit = this.tree.nodes.get(node)?.texts.get(field)?.visibleOrder()[index];
    return unit ? [unit.run.replica, unit.run.counter + unit.offset] : null;
  }

  /**
   * The visible code-point index an anchor stands for in a node's field
   * (comments, cursors and suggestions follow item ids through concurrent
   * edits), or `null` when the anchor names no item there.
   */
  anchorIndex(node: string, field: string, anchor: Anchor): number | null {
    const sequence = this.tree.nodes.get(node)?.texts.get(field);
    if (!sequence) return typeof anchor === 'string' ? 0 : null;
    return sequence.indexOfAnchor(anchor);
  }

  /** Whether an item of a node's field is visible (`false` when deleted or unknown). */
  isVisible(node: string, field: string, id: ItemId): boolean {
    return this.tree.nodes.get(node)?.texts.get(field)?.isVisible(id) ?? false;
  }

  /** Whether a node is attached under the root (not removed, not in a detached subtree). */
  attached(id: string): boolean {
    return this.tree.attached(id);
  }

  private propsOf(node: TreeNode): { [key: string]: SyncJson } {
    const keys = [...node.props.keys()].sort();
    const out: { [key: string]: SyncJson } = {};
    for (const key of keys) {
      const value = (node.props.get(key) as { value: SyncJson }).value;
      if (value !== null) out[key] = value;
    }
    return out;
  }

  /** The attached tree as plain data (iterative; identical on converged replicas). */
  toJSON(): SyncNodeJson {
    const build = (node: TreeNode): SyncNodeJson => {
      const text: { [field: string]: SyncTextRun[] } = {};
      for (const field of [...node.texts.keys()].sort())
        text[field] = (node.texts.get(field) as Sequence).textRuns();
      return { id: node.id, type: node.type, props: this.propsOf(node), text, children: [] };
    };
    const root = build(this.tree.nodes.get(ROOT) as TreeNode);
    const stack: SyncNodeJson[] = [root];
    while (stack.length > 0) {
      const json = stack.pop() as SyncNodeJson;
      for (const child of this.tree.children(json.id)) {
        const entry = build(child);
        json.children.push(entry);
        stack.push(entry);
      }
    }
    return root;
  }

  /** Called with every batch of integrated operations; returns an unsubscribe function. */
  onOps(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ── integration ──────────────────────────────────────────────────────

  private covered(op: SyncOp, id: ItemId): boolean {
    const bound = id[0] === op.replica ? op.counter : (op.deps[id[0]] ?? 0);
    return id[1] < bound;
  }

  private nodeFor(op: SyncOp, id: string): TreeNode | null {
    const node = this.tree.nodes.get(id);
    if (!node) return null;
    if (id === ROOT) return node;
    return node.creates.some((create) => this.covered(op, create)) ? node : null;
  }

  private anchorOk(op: SyncOp, sequence: Sequence, anchor: Anchor): boolean {
    if (typeof anchor === 'string') return true;
    return this.covered(op, anchor.id) && sequence.hasAnchor(anchor);
  }

  /** Apply one causally ready operation; false when its references are invalid. */
  private apply(op: SyncOp): boolean {
    const stamp: Stamp = { lamport: op.lamport, replica: op.replica, counter: op.counter };
    switch (op.kind) {
      case 'create':
        if (this.types && !this.types.has(op.type)) return false;
        this.tree.create(op.node, op.type, [op.replica, op.counter], stamp);
        return true;
      case 'move': {
        const node = this.nodeFor(op, op.node);
        if (!node || node.id === ROOT) return false;
        if (op.parent !== TRASH) {
          const parent = this.nodeFor(op, op.parent);
          if (!parent || !op.slot) return false;
          if (op.slot.parent !== null && !this.covered(op, op.slot.parent)) return false;
          if (!this.tree.slotsOf(parent).canInsert(op.slot)) return false;
        }
        this.tree.move(
          {
            stamp,
            node: op.node,
            parent: op.parent,
            slot: op.parent === TRASH ? null : [op.replica, op.counter],
            before: null,
          },
          op.slot
        );
        return true;
      }
      case 'set': {
        const node = this.nodeFor(op, op.node);
        if (!node) return false;
        const current = node.props.get(op.key);
        if (!current || compareStamps(stamp, current.stamp) > 0)
          node.props.set(op.key, { value: op.value, stamp });
        return true;
      }
      case 'insert': {
        const node = this.nodeFor(op, op.node);
        if (!node) return false;
        if (op.origin.parent !== null && !this.covered(op, op.origin.parent)) return false;
        const sequence = node.texts.get(op.field) ?? new Sequence();
        if (!sequence.canInsert(op.origin)) return false;
        node.texts.set(op.field, sequence);
        sequence.insert(op.replica, op.counter, unitsOf(op.text), op.origin, stamp);
        return true;
      }
      case 'delete':
      case 'revive': {
        const node = this.nodeFor(op, op.node);
        const sequence = node?.texts.get(op.field);
        if (!sequence) return false;
        for (const [replica, counter, length] of op.ranges)
          if (!this.covered(op, [replica, counter + length - 1])) return false;
        if (!sequence.hasRanges(op.ranges)) return false;
        sequence.setVisibility(op.ranges, op.kind === 'delete', stamp);
        return true;
      }
      case 'mark': {
        if (this.markKeys && !this.markKeys.has(op.key)) return false;
        const node = this.nodeFor(op, op.node);
        const sequence = node?.texts.get(op.field);
        if (!sequence) return false;
        if (!this.anchorOk(op, sequence, op.start) || !this.anchorOk(op, sequence, op.end))
          return false;
        sequence.addMark({ key: op.key, value: op.value, start: op.start, end: op.end, stamp });
        return true;
      }
    }
  }

  private ready(op: SyncOp): boolean {
    if ((this.vv[op.replica] ?? 0) !== op.counter) return false;
    for (const replica of Object.keys(op.deps))
      if ((this.vv[replica] ?? 0) < (op.deps[replica] as number)) return false;
    return true;
  }

  /** Integrate a ready operation: advance the clocks, apply it, log it. */
  private integrate(op: SyncOp): boolean {
    const applied = this.apply(op);
    this.vv[op.replica] = op.counter + unitCount(op);
    if (op.lamport > this.lamport) this.lamport = op.lamport;
    this.log.push(op);
    return applied;
  }

  /**
   * Receive a remote batch: validate its shape (refused whole when
   * malformed), drop duplicates, buffer what is not ready, integrate the
   * rest in causal order. Never throws.
   */
  receive(batch: SyncBatch | unknown): ReceiveResult {
    const checked = checkBatch(batch);
    if (!checked.ok)
      return {
        ok: false,
        integrated: 0,
        duplicates: 0,
        pending: this.buffered,
        dropped: 0,
        reason: checked.reason,
        index: checked.index,
      };
    let duplicates = 0;
    for (const op of checked.ops) {
      const seen = this.vv[op.replica] ?? 0;
      if (op.counter < seen) {
        duplicates += 1;
        continue;
      }
      let queue = this.buffer.get(op.replica);
      if (!queue) {
        queue = new Map();
        this.buffer.set(op.replica, queue);
      }
      if (queue.has(op.counter)) {
        duplicates += 1;
        continue;
      }
      if (this.buffered >= SYNC_LIMITS.pending) continue;
      queue.set(op.counter, op);
      this.buffered += 1;
    }
    const integrated: SyncOp[] = [];
    let dropped = 0;
    let progress = true;
    while (progress) {
      progress = false;
      for (const [replica, queue] of this.buffer) {
        let op = queue.get(this.vv[replica] ?? 0);
        while (op && this.ready(op)) {
          queue.delete(op.counter);
          this.buffered -= 1;
          if (!this.integrate(op)) dropped += 1;
          integrated.push(op);
          progress = true;
          op = queue.get(this.vv[replica] ?? 0);
        }
      }
    }
    // Entries whose counter now falls inside an integrated operation can never become ready.
    for (const [replica, queue] of this.buffer) {
      const seen = this.vv[replica] ?? 0;
      for (const counter of queue.keys())
        if (counter < seen) {
          queue.delete(counter);
          this.buffered -= 1;
        }
      if (queue.size === 0) this.buffer.delete(replica);
    }
    this.tree.flush();
    if (integrated.length > 0)
      for (const listener of this.listeners) listener(integrated, 'remote');
    return { ok: true, integrated: integrated.length, duplicates, pending: this.buffered, dropped };
  }

  // ── local edits ──────────────────────────────────────────────────────

  private emit(draft: Draft): SyncOp {
    const deps: VersionVector = {};
    for (const [replica, counter] of Object.entries(this.vv))
      if (replica !== this.id) deps[replica] = counter;
    const op = {
      ...draft,
      replica: this.id,
      counter: this.vv[this.id] ?? 0,
      lamport: this.lamport + 1,
      deps,
    } as SyncOp;
    this.integrate(op);
    this.tree.flush();
    if (this.outbox) this.outbox.push(op);
    else for (const listener of this.listeners) listener([op], 'local');
    return op;
  }

  private record(intent: Intent): void {
    if (this.capture) this.capture.push(intent);
  }

  /**
   * Run local edits as one transaction: one undo step, and one batch to
   * listeners. Nested calls join the outer transaction.
   */
  transact(run: () => void): void {
    this.batch(run, 'edit');
  }

  private batch(run: () => void, mode: 'edit' | 'undo' | 'redo'): Intent[] {
    if (this.capture) {
      run();
      return [];
    }
    const intents: Intent[] = [];
    this.capture = intents;
    this.outbox = [];
    try {
      run();
    } finally {
      const ops = this.outbox;
      this.capture = null;
      this.outbox = null;
      if (mode === 'edit' && intents.length > 0) {
        this.steps += 1;
        this.undoStack.push(intents);
        if (this.undoStack.length > this.undoLimit) this.undoStack.shift();
        this.redoStack.length = 0;
      }
      if (ops.length > 0) for (const listener of this.listeners) listener(ops, 'local');
    }
    return intents;
  }

  private edit<T>(run: () => T): T {
    let out: T | undefined;
    this.batch(() => {
      out = run();
    }, 'edit');
    return out as T;
  }

  private requireNode(id: string): TreeNode {
    const node = this.tree.nodes.get(id);
    if (!node) throw new RangeError(`No node has the id "${id}".`);
    return node;
  }

  /** The slot origin for placing a child at `index` among `parent`'s other children. */
  private slotAt(parent: TreeNode, index: number, moving?: string): SeqOrigin {
    const siblings = this.tree.children(parent.id).filter((child) => child.id !== moving);
    if (!Number.isSafeInteger(index) || index < 0 || index > siblings.length)
      throw new RangeError(`The index must be from 0 to ${siblings.length}.`);
    const slots = this.tree.slotsOf(parent);
    if (index === 0) return slots.originAfter(null);
    const before = siblings[index - 1] as TreeNode;
    return slots.originAfter(slots.find(before.slot as ItemId));
  }

  /** Create a node of `type` at `index` under `parent`; returns its id. */
  insertNode(
    type: string,
    parent: string = ROOT,
    index = 0,
    options: { id?: string; props?: { [key: string]: SyncJson } } = {}
  ): string {
    return this.edit(() => {
      const target = this.requireNode(parent);
      const id = options.id ?? `${this.id}.${(this.vv[this.id] ?? 0).toString(36)}`;
      if (this.tree.nodes.has(id)) throw new RangeError(`The id "${id}" is already used.`);
      const slot = this.slotAt(target, index);
      this.emit({ kind: 'create', node: id, type });
      for (const [key, value] of Object.entries(options.props ?? {}))
        this.emit({ kind: 'set', node: id, key, value });
      this.emit({ kind: 'move', node: id, parent, slot });
      this.record({ kind: 'remove', node: id });
      return id;
    });
  }

  /**
   * Register a node that no parent holds (a container for annotations, for
   * example), once: concurrent calls with the same id merge. Not an undo
   * step. Returns the id.
   */
  ensureNode(id: string, type: string): string {
    if (this.tree.nodes.has(id)) return id;
    this.batch(() => {
      this.emit({ kind: 'create', node: id, type });
    }, 'edit');
    return id;
  }

  /** Change a node's type (last writer wins; undo restores the previous type). */
  setNodeType(id: string, type: string): void {
    this.edit(() => {
      const node = this.requireNode(id);
      if (id === ROOT) throw new RangeError('The root keeps its type.');
      if (node.type === type) return;
      const previous = node.type;
      this.emit({ kind: 'create', node: id, type });
      this.record({ kind: 'retype', node: id, type: previous });
    });
  }

  /** Move a node to `index` among `parent`'s children (counted without the node). */
  moveNode(id: string, parent: string, index: number): void {
    this.edit(() => {
      const node = this.requireNode(id);
      if (id === ROOT) throw new RangeError('The root does not move.');
      const before = { parent: node.parent, after: node.slot };
      this.emit({
        kind: 'move',
        node: id,
        parent,
        slot: this.slotAt(this.requireNode(parent), index, id),
      });
      this.record({ kind: 'place', node: id, ...before });
    });
  }

  /** Remove a node (it moves to the trash; undo moves it back). */
  removeNode(id: string): void {
    this.edit(() => {
      const node = this.requireNode(id);
      if (id === ROOT) throw new RangeError('The root cannot be removed.');
      if (node.parent === TRASH) return;
      const before = { parent: node.parent, after: node.slot };
      this.emit({ kind: 'move', node: id, parent: TRASH });
      this.record({ kind: 'place', node: id, ...before });
    });
  }

  /** Set a property (last writer wins); `null` clears it. */
  setProp(id: string, key: string, value: SyncJson): void {
    this.edit(() => {
      const node = this.requireNode(id);
      const previous = node.props.get(key)?.value ?? null;
      this.emit({ kind: 'set', node: id, key, value });
      this.record({ kind: 'set', node: id, key, value: previous });
    });
  }

  private sequence(id: string, field: string): Sequence {
    const node = this.requireNode(id);
    return node.texts.get(field) ?? new Sequence();
  }

  /** Insert text at a visible code-point index of a node's field. */
  insertText(id: string, field: string, index: number, text: string): void {
    if (text === '') return;
    this.edit(() => {
      const sequence = this.sequence(id, field);
      if (!Number.isSafeInteger(index) || index < 0 || index > sequence.length)
        throw new RangeError(`The index must be from 0 to ${sequence.length}.`);
      const units = unitsOf(text);
      for (let start = 0; start < units.length; start += SYNC_LIMITS.text) {
        const chunk = units.slice(start, start + SYNC_LIMITS.text);
        const current = this.sequence(id, field);
        const op = this.emit({
          kind: 'insert',
          node: id,
          field,
          origin: current.originAt(index + start),
          text: chunk.join(''),
        });
        this.record({
          kind: 'hide',
          node: id,
          field,
          ranges: [[this.id, op.counter, chunk.length]],
        });
      }
    });
  }

  /** Delete `length` visible code points from `index`. */
  deleteText(id: string, field: string, index: number, length: number): void {
    if (length <= 0) return;
    this.edit(() => {
      const sequence = this.sequence(id, field);
      if (!Number.isSafeInteger(index) || index < 0 || index + length > sequence.length)
        throw new RangeError('The range is outside the text.');
      const ranges = sequence.rangesOf(index, index + length);
      this.emit({ kind: 'delete', node: id, field, ranges });
      this.record({ kind: 'show', node: id, field, ranges });
    });
  }

  /** Set (or with `null` remove) a mark over the visible code points `[from, to)`. */
  formatText(
    id: string,
    field: string,
    from: number,
    to: number,
    key: string,
    value: SyncJson
  ): void {
    this.edit(() => {
      const sequence = this.sequence(id, field);
      if (
        !Number.isSafeInteger(from) ||
        !Number.isSafeInteger(to) ||
        from < 0 ||
        to > sequence.length
      )
        throw new RangeError('The range is outside the text.');
      const anchors = sequence.anchorsFor(from, to, this.expand(key));
      if (!anchors) return;
      const segments = sequence.markSegments(key, from, to);
      this.emit({
        kind: 'mark',
        node: id,
        field,
        key,
        value,
        start: anchors.start,
        end: anchors.end,
      });
      this.record({ kind: 'marks', node: id, field, key, segments });
    });
  }

  // ── undo ─────────────────────────────────────────────────────────────

  /** Local transactions recorded as undo steps since the replica was created (monotonic). */
  get editCount(): number {
    return this.steps;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Undo the newest local transaction with new operations; false when there is none. */
  undo(): boolean {
    const intents = this.undoStack.pop();
    if (!intents) return false;
    this.redoStack.push(this.batch(() => this.run(intents), 'undo'));
    return true;
  }

  redo(): boolean {
    const intents = this.redoStack.pop();
    if (!intents) return false;
    this.undoStack.push(this.batch(() => this.run(intents), 'redo'));
    return true;
  }

  /** Execute intents newest first; each records its own inverse into the capture. */
  private run(intents: readonly Intent[]): void {
    for (let i = intents.length - 1; i >= 0; i -= 1) {
      const intent = intents[i] as Intent;
      const node = this.tree.nodes.get(intent.node);
      if (!node) continue;
      switch (intent.kind) {
        case 'remove':
          if (node.parent !== TRASH) this.removeNode(intent.node);
          break;
        case 'retype':
          this.setNodeType(intent.node, intent.type);
          break;
        case 'place': {
          const parent = intent.parent;
          if (parent === null) break;
          if (parent === TRASH) {
            this.removeNode(intent.node);
            break;
          }
          if (parent !== ROOT && !this.tree.attached(parent)) break;
          const target = this.tree.nodes.get(parent) as TreeNode;
          const slots = this.tree.slotsOf(target);
          const anchor = intent.after ? slots.find(intent.after) : null;
          const before = { parent: node.parent, after: node.slot };
          // Back right after the old slot: where the node was, whatever moved since.
          this.emit({ kind: 'move', node: intent.node, parent, slot: slots.originAfter(anchor) });
          this.record({ kind: 'place', node: intent.node, ...before });
          break;
        }
        case 'set':
          this.setProp(intent.node, intent.key, intent.value);
          break;
        case 'hide':
        case 'show': {
          const sequence = node.texts.get(intent.field);
          if (!sequence) break;
          this.emit({
            kind: intent.kind === 'hide' ? 'delete' : 'revive',
            node: intent.node,
            field: intent.field,
            ranges: intent.ranges,
          });
          this.record({
            kind: intent.kind === 'hide' ? 'show' : 'hide',
            node: intent.node,
            field: intent.field,
            ranges: intent.ranges,
          });
          break;
        }
        case 'marks': {
          const sequence = node.texts.get(intent.field);
          if (!sequence) break;
          for (const segment of intent.segments) {
            const first = sequence.find(segment.first);
            const last = sequence.find(segment.last);
            if (!first || !last) continue;
            const from = this.indexOfUnit(sequence, first);
            const to = this.indexOfUnit(sequence, last);
            const redo =
              from >= 0 && to >= from ? sequence.markSegments(intent.key, from, to + 1) : [];
            this.emit({
              kind: 'mark',
              node: intent.node,
              field: intent.field,
              key: intent.key,
              value: segment.value,
              start: { id: segment.first, side: 'before' },
              end: { id: segment.last, side: 'after' },
            });
            if (redo.length > 0)
              this.record({
                kind: 'marks',
                node: intent.node,
                field: intent.field,
                key: intent.key,
                segments: redo,
              });
          }
          break;
        }
      }
    }
  }

  private indexOfUnit(sequence: Sequence, ref: UnitRef): number {
    if (ref.run.deleted(ref.offset)) return -1;
    return sequence
      .visibleOrder()
      .findIndex((other) => other.run === ref.run && other.offset === ref.offset);
  }
}

/** Create a replica. */
export function createReplica(options: ReplicaOptions): Replica {
  return new Replica(options);
}
