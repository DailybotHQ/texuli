/**
 * Transports (ADR-010). A `SyncAdapter` carries batches between replicas
 * and, optionally, snapshots and presence; hosts own networking and storage
 * (WebSocket, IndexedDB, a server) behind the same interface. Texuli ships
 * an in-memory hub (tests, same-page panes) and a `BroadcastChannel`
 * adapter (tabs of one origin). Nothing here reads a browser global until a
 * host creates an adapter.
 */

import type { PresenceState } from './presence.ts';
import type { ReceiveResult, Replica, SyncSnapshot } from './replica.ts';
import type { SyncBatch } from './types.ts';

export interface PresenceChannel {
  send(state: PresenceState): void;
  subscribe(onState: (state: unknown) => void): () => void;
}

export interface SyncAdapter {
  send(batch: SyncBatch): void | Promise<void>;
  /** Remote batches (untrusted: the replica validates them). */
  subscribe(onBatch: (batch: unknown) => void): () => void;
  loadSnapshot?(): Promise<SyncSnapshot | null>;
  saveSnapshot?(snapshot: SyncSnapshot): Promise<void>;
  presence?: PresenceChannel;
}

export interface SyncConnection {
  /** Stop sending and receiving. */
  close(): void;
}

/**
 * Connect a replica to an adapter: local operations are sent as they
 * happen, remote batches are received, and both sides exchange version
 * vectors so each sends what the other lacks (offline edits included).
 */
export function connectReplica(
  replica: Replica,
  adapter: SyncAdapter,
  options: { onReceive?: (result: ReceiveResult) => void } = {}
): SyncConnection {
  const offLocal = replica.onOps((ops, origin) => {
    if (origin === 'local') void adapter.send({ ops });
  });
  const offRemote = adapter.subscribe((batch) => {
    const result = replica.receive(batch);
    options.onReceive?.(result);
    if (!result.ok || batch === null || typeof batch !== 'object') return;
    const { have, reply } = batch as SyncBatch;
    if (have !== undefined) {
      const missing = replica.opsSince(have);
      if (missing.length > 0 || reply)
        void adapter.send(
          reply ? { ops: missing, have: replica.versionVector() } : { ops: missing }
        );
    }
  });
  void adapter.send({ have: replica.versionVector(), reply: true });
  return {
    close() {
      offLocal();
      offRemote();
    },
  };
}

export interface MemorySyncHub {
  /** A new adapter on the hub; batches reach every other adapter. */
  adapter(): SyncAdapter;
  /** Deliver queued messages (manual mode); returns how many were delivered. */
  flush(): number;
  /** Messages waiting (manual mode). */
  readonly queued: number;
}

/**
 * An in-memory hub. Messages are copied through JSON (as a wire would)
 * and delivered on a microtask, or only on `flush()` with `manual: true`.
 */
export function createMemorySyncHub(options: { manual?: boolean } = {}): MemorySyncHub {
  const members = new Set<{
    listeners: Set<(batch: unknown) => void>;
    presence: Set<(state: unknown) => void>;
  }>();
  const queue: (() => void)[] = [];
  let snapshot: SyncSnapshot | null = null;
  const deliver = (run: () => void) => {
    if (options.manual) queue.push(run);
    else queueMicrotask(run);
  };
  return {
    adapter() {
      const member = {
        listeners: new Set<(batch: unknown) => void>(),
        presence: new Set<(state: unknown) => void>(),
      };
      members.add(member);
      const broadcast = (
        pick: (other: typeof member) => Set<(value: unknown) => void>,
        value: unknown
      ) => {
        const wire = JSON.stringify(value);
        for (const other of members)
          if (other !== member)
            for (const listener of pick(other)) deliver(() => listener(JSON.parse(wire)));
      };
      return {
        send(batch) {
          broadcast((other) => other.listeners, batch);
        },
        subscribe(onBatch) {
          member.listeners.add(onBatch);
          return () => member.listeners.delete(onBatch);
        },
        async loadSnapshot() {
          return snapshot ? (JSON.parse(JSON.stringify(snapshot)) as SyncSnapshot) : null;
        },
        async saveSnapshot(next) {
          snapshot = JSON.parse(JSON.stringify(next)) as SyncSnapshot;
        },
        presence: {
          send(state) {
            broadcast((other) => other.presence, state);
          },
          subscribe(onState) {
            member.presence.add(onState);
            return () => member.presence.delete(onState);
          },
        },
      };
    },
    flush() {
      let delivered = 0;
      while (queue.length > 0) {
        (queue.shift() as () => void)();
        delivered += 1;
      }
      return delivered;
    },
    get queued() {
      return queue.length;
    },
  };
}

/** The part of `BroadcastChannel` the adapter uses. */
export interface BroadcastChannelLike {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  close(): void;
}

const CHANNEL_PREFIX = 'texuli-sync/1:';

/** The channel name for a document key. */
export function syncChannelName(key: string): string {
  return `${CHANNEL_PREFIX}${key}`;
}

/**
 * An adapter over `BroadcastChannel` (tabs of one origin). Pass `channel`
 * to supply the channel yourself (tests, workers); otherwise the global
 * `BroadcastChannel` is used, read only when this function runs.
 */
export function createBroadcastChannelAdapter(
  key: string,
  options: { channel?: (name: string) => BroadcastChannelLike } = {}
): SyncAdapter & { close(): void } {
  const name = syncChannelName(key);
  let channel: BroadcastChannelLike;
  if (options.channel) channel = options.channel(name);
  else {
    const Ctor = (globalThis as { BroadcastChannel?: new (name: string) => BroadcastChannelLike })
      .BroadcastChannel;
    if (typeof Ctor !== 'function')
      throw new TypeError('BroadcastChannel is not available here; pass options.channel.');
    channel = new Ctor(name);
  }
  const listeners = new Set<(event: { data: unknown }) => void>();
  const on = (kind: 'batch' | 'presence', handler: (payload: unknown) => void) => {
    const listener = (event: { data: unknown }) => {
      const data = event?.data as { texuli?: unknown; kind?: unknown; payload?: unknown } | null;
      if (data && typeof data === 'object' && data.texuli === 'sync/1' && data.kind === kind)
        handler(data.payload);
    };
    channel.addEventListener('message', listener);
    listeners.add(listener);
    return () => {
      channel.removeEventListener('message', listener);
      listeners.delete(listener);
    };
  };
  return {
    send(batch) {
      channel.postMessage({ texuli: 'sync/1', kind: 'batch', payload: batch });
    },
    subscribe(onBatch) {
      return on('batch', onBatch);
    },
    presence: {
      send(state) {
        channel.postMessage({ texuli: 'sync/1', kind: 'presence', payload: state });
      },
      subscribe(onState) {
        return on('presence', onState);
      },
    },
    close() {
      for (const listener of listeners) channel.removeEventListener('message', listener);
      listeners.clear();
      channel.close();
    },
  };
}
