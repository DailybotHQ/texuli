/**
 * The move-safe tree CRDT (ADR-010): Kleppmann's replicated move operation.
 * Moves are ordered by stamp (Lamport time, replica, counter); a move that
 * arrives late undoes the newer moves, applies, and redoes them. A move
 * that would make a node its own ancestor (or nest deeper than the cap) is
 * skipped, the same way on every replica. Sibling order is a sequence
 * CRDT of slots: every move makes a slot in its new parent, and a node is
 * shown at the slot of its winning move.
 */
import { compareStamps, Sequence, type Stamp } from './sequence.ts';
import { type ItemId, ROOT, type SeqOrigin, SYNC_LIMITS, type SyncJson, TRASH } from './types.ts';

export interface Register {
  value: SyncJson;
  stamp: Stamp;
}

export interface TreeNode {
  readonly id: string;
  type: string;
  typeStamp: Stamp | null;
  /** Ids of the create operations that registered the node. */
  readonly creates: ItemId[];
  /** Current parent: a node id, `trash`, or `null` while never attached. */
  parent: string | null;
  slot: ItemId | null;
  readonly props: Map<string, Register>;
  readonly texts: Map<string, Sequence>;
  /** The slots of this node's children. */
  slots: Sequence | null;
}

export interface MoveRecord {
  stamp: Stamp;
  node: string;
  parent: string;
  slot: ItemId | null;
  /** Set while applied: the place the move left. */
  before: { parent: string | null; slot: ItemId | null } | null;
}

const slotKey = (id: ItemId) => `${id[0]}:${id[1]}`;

export class Tree {
  readonly nodes = new Map<string, TreeNode>();
  /** Every move, in stamp order. */
  private readonly log: MoveRecord[] = [];
  private pending: MoveRecord[] = [];
  /** Slot id → the node its move placed. */
  private readonly slotOwner = new Map<string, string>();

  constructor() {
    this.nodes.set(ROOT, this.blank(ROOT, 'root'));
    const root = this.nodes.get(ROOT) as TreeNode;
    root.parent = null;
  }

  private blank(id: string, type: string): TreeNode {
    return {
      id,
      type,
      typeStamp: null,
      creates: [],
      parent: null,
      slot: null,
      props: new Map(),
      texts: new Map(),
      slots: null,
    };
  }

  create(node: string, type: string, id: ItemId, stamp: Stamp): void {
    let entry = this.nodes.get(node);
    if (!entry) {
      entry = this.blank(node, type);
      this.nodes.set(node, entry);
    }
    entry.creates.push(id);
    if (entry.typeStamp === null || compareStamps(stamp, entry.typeStamp) > 0) {
      entry.type = type;
      entry.typeStamp = stamp;
    }
  }

  slotsOf(node: TreeNode): Sequence {
    node.slots ??= new Sequence();
    return node.slots;
  }

  /** Record a move's slot now and queue the move for `flush`. */
  move(record: MoveRecord, origin: SeqOrigin | undefined): void {
    if (record.slot !== null && origin) {
      const parent = this.nodes.get(record.parent) as TreeNode;
      this.slotsOf(parent).insert(record.slot[0], record.slot[1], ['·'], origin, record.stamp);
      this.slotOwner.set(slotKey(record.slot), record.node);
    }
    this.pending.push(record);
  }

  /**
   * Apply the queued moves in stamp order: undo the applied moves newer than
   * the oldest queued one, then apply the merged list. Linear in the queued
   * moves plus the moves they reorder.
   */
  flush(): void {
    if (this.pending.length === 0) return;
    const incoming = this.pending.sort((a, b) => compareStamps(a.stamp, b.stamp));
    this.pending = [];
    const oldest = incoming[0] as MoveRecord;
    const redo: MoveRecord[] = [];
    while (
      this.log.length > 0 &&
      compareStamps((this.log.at(-1) as MoveRecord).stamp, oldest.stamp) > 0
    ) {
      const record = this.log.pop() as MoveRecord;
      this.undo(record);
      redo.push(record);
    }
    redo.reverse();
    let i = 0;
    let j = 0;
    while (i < incoming.length || j < redo.length) {
      const a = incoming[i];
      const b = redo[j];
      const next =
        b === undefined || (a !== undefined && compareStamps(a.stamp, b.stamp) < 0) ? a : b;
      if (next === a) i += 1;
      else j += 1;
      this.apply(next as MoveRecord);
      this.log.push(next as MoveRecord);
    }
  }

  private undo(record: MoveRecord): void {
    if (record.before === null) return;
    const node = this.nodes.get(record.node) as TreeNode;
    node.parent = record.before.parent;
    node.slot = record.before.slot;
    record.before = null;
  }

  private apply(record: MoveRecord): void {
    const node = this.nodes.get(record.node) as TreeNode;
    if (record.parent !== TRASH) {
      // Skip a move under the node itself or a descendant, or too deep.
      let at: string | null = record.parent;
      let steps = 0;
      while (at !== null && at !== ROOT && at !== TRASH) {
        if (at === record.node) return;
        steps += 1;
        if (steps > SYNC_LIMITS.treeDepth) return;
        at = this.nodes.get(at)?.parent ?? null;
      }
    }
    record.before = { parent: node.parent, slot: node.slot };
    node.parent = record.parent;
    node.slot = record.slot;
  }

  /** Whether a node is attached under the root (not removed, not detached). */
  attached(id: string): boolean {
    let at: string | null = id;
    let steps = 0;
    while (at !== null && at !== ROOT) {
      if (at === TRASH) return false;
      steps += 1;
      if (steps > SYNC_LIMITS.treeDepth + 1) return false;
      at = this.nodes.get(at)?.parent ?? null;
    }
    return at === ROOT;
  }

  /** The children of a node, in slot order. */
  children(id: string): TreeNode[] {
    const node = this.nodes.get(id);
    if (!node?.slots) return [];
    const out: TreeNode[] = [];
    for (const ref of node.slots.fullOrder()) {
      const slot: ItemId = [ref.run.replica, ref.run.counter + ref.offset];
      const owner = this.slotOwner.get(slotKey(slot));
      if (owner === undefined) continue;
      const child = this.nodes.get(owner);
      if (
        child &&
        child.parent === id &&
        child.slot !== null &&
        slotKey(child.slot) === slotKey(slot)
      )
        out.push(child);
    }
    return out;
  }
}
