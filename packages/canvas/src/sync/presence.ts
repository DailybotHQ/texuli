/**
 * Canvas presence: who is here, where their pointer is (a world point) and
 * what they have selected (shape ids). Ephemeral and never in the op log;
 * carried on the adapter's presence channel next to `@texuli/document/sync`
 * presence and validated before it is kept. Entries expire `PRESENCE_TTL`
 * after their last heartbeat.
 */
import { PRESENCE_TTL, REPLICA_PATTERN } from '@texuli/document/sync';
import { CANVAS_ID_PATTERN, CANVAS_LIMITS } from '../model/limits.ts';

/** Shape ids a presence selection carries at most. */
export const PRESENCE_SELECTION_LIMIT = 200;

export interface CanvasPresenceState {
  replica: string;
  /** Host-provided display name (at most 64 characters). */
  name: string;
  /** A token color index, 0 to 11. */
  color: number;
  /** The pointer in world units, when it is over the canvas. */
  point?: { x: number; y: number };
  /** Selected shape and connector ids. */
  selection?: string[];
}

export interface CanvasPresenceEntry extends CanvasPresenceState {
  /** When the last heartbeat arrived (the store's clock). */
  seen: number;
}

export interface CanvasPresenceStore {
  /** Keep or refresh a state; false when it is malformed. */
  update(state: unknown): boolean;
  remove(replica: string): void;
  /** Live entries, sorted by replica id; expired ones are pruned. */
  list(): CanvasPresenceEntry[];
}

function unsafeName(name: string): boolean {
  for (let i = 0; i < name.length; i += 1) {
    const c = name.charCodeAt(i);
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
    if ((c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return true;
  }
  return false;
}

const finiteCoord = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  Math.abs(value) <= CANVAS_LIMITS.coordinate;

/** Validate a remote presence state into a fresh copy, or `null`. Bounded work. */
export function checkCanvasPresence(value: unknown): CanvasPresenceState | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.replica !== 'string' || !REPLICA_PATTERN.test(raw.replica)) return null;
  if (typeof raw.name !== 'string' || raw.name.length > 64 || unsafeName(raw.name)) return null;
  if (!Number.isInteger(raw.color) || (raw.color as number) < 0 || (raw.color as number) > 11)
    return null;
  const state: CanvasPresenceState = {
    replica: raw.replica,
    name: raw.name,
    color: raw.color as number,
  };
  if (raw.point !== undefined) {
    const point = raw.point as Record<string, unknown> | null;
    if (!point || typeof point !== 'object' || !finiteCoord(point.x) || !finiteCoord(point.y))
      return null;
    state.point = { x: point.x, y: point.y };
  }
  if (raw.selection !== undefined) {
    const selection = raw.selection;
    if (!Array.isArray(selection) || selection.length > PRESENCE_SELECTION_LIMIT) return null;
    const ids: string[] = [];
    for (const id of selection) {
      if (typeof id !== 'string' || !CANVAS_ID_PATTERN.test(id)) return null;
      ids.push(id);
    }
    state.selection = ids;
  }
  return state;
}

export function createCanvasPresenceStore(
  options: { ttl?: number; now?: () => number } = {}
): CanvasPresenceStore {
  const ttl = options.ttl ?? PRESENCE_TTL;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, CanvasPresenceEntry>();
  return {
    update(value) {
      const state = checkCanvasPresence(value);
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
