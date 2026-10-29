/**
 * Presence (ADR-010): ephemeral and never in the op log. Each replica
 * announces a host-provided display name, a token color index and an
 * optional cursor anchored to an item id; entries expire 30 seconds after
 * their last heartbeat. Remote states are validated before they are kept.
 */
import { type ItemId, KEY_PATTERN, NODE_PATTERN, REPLICA_PATTERN } from './types.ts';

export interface PresenceCursor {
  node: string;
  field: string;
  /** The item the caret follows (`null` at the start of the text). */
  after: ItemId | null;
}

export interface PresenceState {
  replica: string;
  /** Host-provided display name (at most 64 characters). */
  name: string;
  /** A token color index, 0 to 11. */
  color: number;
  cursor?: PresenceCursor;
}

export interface PresenceEntry extends PresenceState {
  /** When the last heartbeat arrived (the store's clock). */
  seen: number;
}

export const PRESENCE_TTL = 30_000;

export interface PresenceStore {
  /** Keep or refresh a state; false when it is malformed. */
  update(state: unknown): boolean;
  remove(replica: string): void;
  /** Live entries, sorted by replica id; expired ones are pruned. */
  list(): PresenceEntry[];
}

/** C0/C1 controls, line separators and bidi overrides or isolates. */
function unsafeName(name: string): boolean {
  for (let i = 0; i < name.length; i += 1) {
    const c = name.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return true;
  }
  return false;
}

/** Validate a presence state into a fresh copy, or `null`. */
export function checkPresence(value: unknown): PresenceState | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.replica !== 'string' || !REPLICA_PATTERN.test(raw.replica)) return null;
  if (typeof raw.name !== 'string' || raw.name.length > 64 || unsafeName(raw.name)) return null;
  if (!Number.isInteger(raw.color) || (raw.color as number) < 0 || (raw.color as number) > 11)
    return null;
  const state: PresenceState = { replica: raw.replica, name: raw.name, color: raw.color as number };
  if (raw.cursor !== undefined) {
    const cursor = raw.cursor as Record<string, unknown> | null;
    if (cursor === null || typeof cursor !== 'object') return null;
    if (typeof cursor.node !== 'string' || !NODE_PATTERN.test(cursor.node)) return null;
    if (typeof cursor.field !== 'string' || !KEY_PATTERN.test(cursor.field)) return null;
    let after: ItemId | null = null;
    if (cursor.after !== null) {
      const id = cursor.after;
      if (
        !Array.isArray(id) ||
        id.length !== 2 ||
        typeof id[0] !== 'string' ||
        !REPLICA_PATTERN.test(id[0]) ||
        !Number.isSafeInteger(id[1]) ||
        id[1] < 0
      )
        return null;
      after = [id[0], id[1]];
    }
    state.cursor = { node: cursor.node, field: cursor.field, after };
  }
  return state;
}

export function createPresenceStore(
  options: { ttl?: number; now?: () => number } = {}
): PresenceStore {
  const ttl = options.ttl ?? PRESENCE_TTL;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, PresenceEntry>();
  return {
    update(value) {
      const state = checkPresence(value);
      if (!state) return false;
      entries.set(state.replica, { ...state, seen: now() });
      return true;
    },
    remove(replica) {
      entries.delete(replica);
    },
    list() {
      const at = now();
      for (const [replica, entry] of entries) if (at - entry.seen > ttl) entries.delete(replica);
      return [...entries.values()].sort((a, b) => (a.replica < b.replica ? -1 : 1));
    },
  };
}
