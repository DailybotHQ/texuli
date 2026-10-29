/**
 * The streaming bits `<Player>` needs before the streaming session loads
 * (ADR-014). Kept apart so the session (tokenizer, assembler, node checks)
 * loads only when a `stream` is passed.
 */

/** Marker id for a streamed node that is not admitted yet. Never a catalog id. */
export const STREAM_PENDING_ID = 'tx-stream-pending';

/** Why a streamed node is not painted: still `pending`, `held` by a check, or `incomplete` after an interruption. */
export type StreamNodeState = 'pending' | 'held' | 'incomplete';

/** What `<Player stream>` reads: text chunks (or UTF-8 bytes) in order, split anywhere. */
export type BlueprintStreamSource = AsyncIterable<string | Uint8Array>;

/** Where a streamed paint stands, for `onStreamProgress`. */
export interface PlayerStreamProgress {
  phase: 'streaming' | 'complete' | 'interrupted';
  /** Nodes painted now. */
  painted: number;
  /** Nodes held by a node-level check or the canonical order, until the final verdict. */
  held: number;
  /** UTF-8 bytes read. */
  bytes: number;
  /** Why the stream stopped (`interrupted` only). */
  error: { code: string; offset: number; message: string } | null;
}

/** How often (at most) a streaming paint is applied. */
export const STREAM_PAINT_INTERVAL_MS = 50;
/** How often (at most) streaming progress is announced politely. */
export const STREAM_ANNOUNCE_INTERVAL_MS = 4000;
