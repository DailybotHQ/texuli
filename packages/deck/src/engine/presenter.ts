/**
 * Closed, versioned presenter protocol v1.
 *
 * Message shape: `{ type, slideId, step }` only (`hello` | `sync` | `request`).
 * Channel name: `texuli-deck-presenter/1:<namespace>`.
 * No `window`, `document` or `BroadcastChannel` is touched at import time;
 * transports are created only when a transport function is called.
 */

export const PRESENTER_MESSAGE_TYPES = ['hello', 'sync', 'request'] as const;
export type PresenterMessageType = (typeof PRESENTER_MESSAGE_TYPES)[number];

export interface PresenterMessage {
  type: PresenterMessageType;
  slideId: string;
  step: number;
}

/** Protocol prefix; the full channel name is `${prefix}${namespace}`. */
export const PRESENTER_PROTOCOL_PREFIX = 'texuli-deck-presenter/1:';
export const PRESENTER_PROTOCOL_VERSION = 1 as const;

const SLIDE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_STEP = 32;

/** Sanitize a deck namespace for a channel name. */
export function sanitizePresenterNamespace(namespace: string): string {
  // Bounded and linear: cap the host string before any pattern runs, then
  // trim the edge dashes with index scans (no `^-+|-+$` backtracking).
  const raw = typeof namespace === 'string' ? namespace.slice(0, 512).trim() : '';
  const dashed = raw.toLowerCase().replace(/[^a-z0-9._:-]+/g, '-');
  let start = 0;
  let end = dashed.length;
  while (start < end && dashed[start] === '-') start += 1;
  while (end > start && dashed[end - 1] === '-') end -= 1;
  const cleaned = dashed.slice(start, end).slice(0, 96);
  return cleaned || 'default';
}

/** Channel name for one deck namespace (same-origin BroadcastChannel). */
export function presenterChannelName(namespace: string): string {
  return `${PRESENTER_PROTOCOL_PREFIX}${sanitizePresenterNamespace(namespace)}`;
}

/** Type guard: closed shape, lowercase slide id, step 0…32. */
export function isPresenterMessage(value: unknown): value is PresenterMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  const keys = Object.keys(message);
  if (keys.length !== 3) return false;
  if (!PRESENTER_MESSAGE_TYPES.includes(message.type as PresenterMessageType)) return false;
  if (typeof message.slideId !== 'string' || !SLIDE_ID.test(message.slideId)) return false;
  if (typeof message.step !== 'number' || !Number.isInteger(message.step)) return false;
  if (message.step < 0 || message.step > MAX_STEP) return false;
  return true;
}

/** Parse an untrusted payload. Returns `null` when malformed (never throws). */
export function parsePresenterMessage(value: unknown): PresenterMessage | null {
  return isPresenterMessage(value)
    ? { type: value.type, slideId: value.slideId, step: value.step }
    : null;
}

/**
 * Build a protocol message. Returns `null` when the arguments are invalid
 * (never throws; the stage decides how to handle a rejected build).
 */
export function presenterMessage(
  type: PresenterMessageType,
  slideId: string,
  step: number
): PresenterMessage | null {
  return parsePresenterMessage({ type, slideId, step });
}

export interface PresenterTransport {
  readonly name: string;
  post(message: PresenterMessage): void;
  subscribe(listener: (message: PresenterMessage) => void): () => void;
  close(): void;
}

/** Duck-typed channel (BroadcastChannel or a test double). */
export interface PresenterChannelLike {
  postMessage(value: unknown): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  close(): void;
}

/** Wrap an existing channel-like object. Does not construct globals. */
export function createPresenterTransport(
  channel: PresenterChannelLike,
  name = 'channel'
): PresenterTransport {
  const listeners = new Set<(message: PresenterMessage) => void>();
  const onMessage = (event: { data: unknown }): void => {
    const message = parsePresenterMessage(event.data);
    if (!message) return;
    for (const listener of [...listeners]) listener(message);
  };
  channel.addEventListener('message', onMessage);
  return {
    name,
    post(message) {
      if (!isPresenterMessage(message)) return;
      try {
        channel.postMessage(message);
      } catch {
        // Closed or structured-clone failure — drop silently.
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      listeners.clear();
      channel.removeEventListener('message', onMessage);
      try {
        channel.close();
      } catch {
        // already closed
      }
    },
  };
}

/** In-memory bus for unit tests (same process, no DOM). */
export function createMemoryPresenterTransport(namespace = 'test'): PresenterTransport {
  const name = presenterChannelName(namespace);
  const listeners = new Set<(message: PresenterMessage) => void>();
  return {
    name,
    post(message) {
      if (!isPresenterMessage(message)) return;
      const copy: PresenterMessage = {
        type: message.type,
        slideId: message.slideId,
        step: message.step,
      };
      for (const listener of [...listeners]) listener(copy);
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    close() {
      listeners.clear();
    },
  };
}

/**
 * Optional BroadcastChannel transport. Returns `null` when the host has no
 * BroadcastChannel or construction fails. The factory is injected so the
 * module never reads `globalThis.BroadcastChannel` at import time.
 */
export function createBroadcastPresenterTransport(
  namespace: string,
  channelFactory?: new (name: string) => PresenterChannelLike
): PresenterTransport | null {
  const Factory =
    channelFactory ??
    (typeof globalThis !== 'undefined' &&
    typeof (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel === 'function'
      ? (globalThis as { BroadcastChannel: new (name: string) => PresenterChannelLike })
          .BroadcastChannel
      : undefined);
  if (typeof Factory !== 'function') return null;
  const name = presenterChannelName(namespace);
  let channel: PresenterChannelLike;
  try {
    channel = new Factory(name);
  } catch {
    return null;
  }
  return createPresenterTransport(channel, name);
}
