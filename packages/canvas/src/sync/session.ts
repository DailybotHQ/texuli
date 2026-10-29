/**
 * A collaborative canvas session: one replica, its projection, local edits
 * as canvas operations (one undo step each), selective undo through the
 * CRDT (it never rewinds other people's edits), a transport and presence.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import {
  connectReplica,
  createReplica,
  type ReceiveResult,
  Replica,
  SYNC_LIMITS,
  type SyncAdapter,
  type SyncBatch,
  type SyncOp,
} from '@texuli/document/sync';
import { createCanvas } from '../model/document.ts';
import { applyCanvasOps, type CanvasApplyResult, type CanvasOperation } from '../model/ops.ts';
import type { CanvasDocument } from '../model/types.ts';
import { CANVAS_NODE_TYPES, commitCanvas, projectCanvas } from './binding.ts';
import {
  type CanvasPresenceEntry,
  type CanvasPresenceState,
  type CanvasPresenceStore,
  createCanvasPresenceStore,
} from './presence.ts';

export interface CanvasSyncOptions {
  /** This replica's id: 1 to 40 of `A–Z a–z 0–9 _ -`, random per session. */
  replica: string;
  /**
   * The starting canvas. Every replica of a canvas starts from the same one
   * (its seed operations derive from the content, so identical starts merge
   * as one), or from none and a snapshot.
   */
  canvas?: CanvasDocument;
  /** URL tier the projection validates at (default `untrusted`). */
  trust?: HrefTrust;
  /** Undo steps kept (default 200). */
  undoLimit?: number;
}

export type CanvasSyncListener = (canvas: CanvasDocument, origin: 'local' | 'remote') => void;

export interface CanvasConnection {
  /** Announce this replica's pointer and selection (merged into the last state). */
  updatePresence(state: Partial<Pick<CanvasPresenceState, 'point' | 'selection'>>): void;
  close(): void;
}

function contentHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(36) + b.toString(36);
}

/**
 * The seed operations of a canvas: made by a replica named after the
 * content (`seed-<hash>`), so every replica that starts from the same
 * canvas derives the same operations and they merge as one.
 */
export function canvasSeedOperations(canvas: CanvasDocument): SyncOp[] {
  const seed = createReplica({
    replica: `seed-${contentHash(JSON.stringify(canvas))}`.slice(0, 40),
    types: CANVAS_NODE_TYPES,
  });
  commitCanvas(seed, canvas);
  return seed.snapshot().ops;
}

/** Send in batches the sync core accepts (`SYNC_LIMITS.batch` operations each). */
function chunked(adapter: SyncAdapter): SyncAdapter {
  return {
    ...adapter,
    send(batch: SyncBatch) {
      const ops = batch.ops ?? [];
      if (ops.length <= SYNC_LIMITS.batch) return adapter.send(batch);
      const { ops: _all, ...rest } = batch;
      for (let at = 0; at < ops.length; at += SYNC_LIMITS.batch) {
        const part: SyncBatch = { ops: ops.slice(at, at + SYNC_LIMITS.batch) };
        void adapter.send(at === 0 ? { ...rest, ...part } : part);
      }
    },
    subscribe: (onBatch) => adapter.subscribe(onBatch),
  };
}

export class CanvasSync {
  readonly replica: Replica;
  readonly trust: HrefTrust;
  /** Live peers on the presence channel (this replica excluded). */
  readonly presence: CanvasPresenceStore;
  #canvas: CanvasDocument;
  #listeners = new Set<CanvasSyncListener>();
  #off: () => void;

  constructor(options: CanvasSyncOptions) {
    this.trust = options.trust ?? 'untrusted';
    this.replica = new Replica({
      replica: options.replica,
      types: CANVAS_NODE_TYPES,
      undoLimit: options.undoLimit,
    });
    this.presence = createCanvasPresenceStore();
    if (options.canvas) {
      const ops = canvasSeedOperations(options.canvas);
      for (let at = 0; at < ops.length; at += SYNC_LIMITS.batch)
        this.replica.receive({ ops: ops.slice(at, at + SYNC_LIMITS.batch) });
    }
    this.#canvas = projectCanvas(this.replica, { trust: this.trust });
    this.#off = this.replica.onOps((_ops, origin) => {
      this.#canvas = projectCanvas(this.replica, { trust: this.trust });
      for (const listener of this.#listeners) listener(this.#canvas, origin);
    });
  }

  /** The projected canvas: always valid at the session's tier. */
  get canvas(): CanvasDocument {
    return this.#canvas;
  }

  get canUndo(): boolean {
    return this.replica.canUndo;
  }

  get canRedo(): boolean {
    return this.replica.canRedo;
  }

  /** Apply operations to the projection and commit the result as one undo step. */
  apply(ops: readonly CanvasOperation[]): CanvasApplyResult {
    const result = applyCanvasOps(this.#canvas, ops, { trust: this.trust });
    if (result.ok && ops.length > 0) commitCanvas(this.replica, result.doc);
    return result;
  }

  /** Commit a whole next canvas (validated first) as one undo step; false when it is invalid. */
  commit(next: CanvasDocument): boolean {
    const result = applyCanvasOps(next, [], { trust: this.trust });
    if (!result.ok) return false;
    commitCanvas(this.replica, result.doc);
    return true;
  }

  /** Undo this replica's last step (selective: other replicas' edits stay). */
  undo(): boolean {
    return this.replica.undo();
  }

  redo(): boolean {
    return this.replica.redo();
  }

  /** Receive a remote batch (untrusted; the replica validates it). */
  receive(batch: unknown): ReceiveResult {
    return this.replica.receive(batch);
  }

  /** Called with the projection after every local or remote change. */
  subscribe(listener: CanvasSyncListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Connect to a transport: batches both ways (split to the batch limit),
   * catch-up by version vectors, and presence when the adapter carries it.
   */
  connect(
    adapter: SyncAdapter,
    identity: { name: string; color: number } = { name: '', color: 0 }
  ): CanvasConnection {
    const connection = connectReplica(this.replica, chunked(adapter));
    let state: CanvasPresenceState = {
      replica: this.replica.id,
      name: identity.name,
      color: identity.color,
    };
    const channel = adapter.presence;
    const off = channel?.subscribe((value) => {
      const replica = (value as { replica?: unknown } | null)?.replica;
      if (replica === this.replica.id) return;
      const known = this.presence.list().some((entry) => entry.replica === replica);
      if (!this.presence.update(value)) return;
      // Answer a newcomer once, so peers that joined later see us too.
      if (!known) channel.send(state);
      for (const listener of this.#listeners) listener(this.#canvas, 'remote');
    });
    channel?.send(state);
    return {
      updatePresence: (next) => {
        state = { ...state, ...next };
        channel?.send(state);
      },
      close: () => {
        off?.();
        connection.close();
      },
    };
  }

  /** Live peers (shorthand for `presence.list()`). */
  peers(): CanvasPresenceEntry[] {
    return this.presence.list();
  }

  destroy(): void {
    this.#off();
    this.#listeners.clear();
  }
}

/** Start a collaborative canvas session. */
export function createCanvasSync(options: CanvasSyncOptions): CanvasSync {
  return new CanvasSync(options);
}

/** A blank canvas, for sessions that start empty and load a snapshot. */
export const EMPTY_CANVAS: CanvasDocument = Object.freeze(createCanvas()) as CanvasDocument;
