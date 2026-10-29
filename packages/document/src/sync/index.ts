/**
 * @texuli/document/sync: the owned CRDT behind an op-log transport
 * (ADR-010). A Fugue sequence for text and ordered lists, a move-safe tree,
 * last-writer-wins registers, `(replica, counter)` ids with a Lamport clock
 * and version vectors, local selective undo, presence, and the
 * `SyncAdapter` transport with in-memory and `BroadcastChannel` adapters.
 * Generic: it imports nothing else in `@texuli/document` and loads lazily.
 */
export {
  type BroadcastChannelLike,
  connectReplica,
  createBroadcastChannelAdapter,
  createMemorySyncHub,
  type MemorySyncHub,
  type PresenceChannel,
  type SyncAdapter,
  type SyncConnection,
  syncChannelName,
} from './adapters.ts';
export {
  checkPresence,
  createPresenceStore,
  PRESENCE_TTL,
  type PresenceCursor,
  type PresenceEntry,
  type PresenceState,
  type PresenceStore,
} from './presence.ts';
export {
  createReplica,
  type ReceiveResult,
  Replica,
  type ReplicaOptions,
  type SyncNodeJson,
  type SyncSnapshot,
} from './replica.ts';
export { compareStamps, type MarkExpand, type Stamp, type SyncTextRun } from './sequence.ts';
export {
  type Anchor,
  type CreateOp,
  type InsertOp,
  type ItemId,
  KEY_PATTERN,
  MAX_CLOCK,
  type MarkOp,
  type MoveOp,
  NODE_PATTERN,
  REPLICA_PATTERN,
  ROOT,
  type SeqOrigin,
  type SetOp,
  SYNC_LIMITS,
  type SyncBatch,
  type SyncJson,
  type SyncOp,
  type SyncOpBase,
  type SyncOpKind,
  TRASH,
  TYPE_PATTERN,
  type VersionVector,
  type VisibilityOp,
} from './types.ts';
export { type BatchCheck, checkBatch } from './validate.ts';
