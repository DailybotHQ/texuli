/**
 * A same-origin link between `DeckStage` instances, for a presenter screen in
 * a second window or tab of the same browser. It rides on `BroadcastChannel`:
 * no server, no network, and it never crosses origins or devices.
 */

export const DECK_SYNC_PROTOCOL = 'texuli-deck-sync/1';

/** A slide position: the slide id and its reveal step. */
export interface DeckSyncPosition {
  slideId: string;
  step: number;
}

/** Messages on the channel; anything else is ignored. */
export type DeckSyncMessage =
  | {
      protocol: typeof DECK_SYNC_PROTOCOL;
      kind: 'position';
      deck: string;
      slideId: string;
      step: number;
    }
  | { protocol: typeof DECK_SYNC_PROTOCOL; kind: 'hello'; deck: string };

export interface DeckSync {
  /** Share this instance's position. */
  post(position: DeckSyncPosition): void;
  /** Ask the other instances to share their position (a newly opened screen). */
  hello(): void;
  /** Receive positions and hellos from the other instances. */
  subscribe(listener: (message: DeckSyncMessage) => void): () => void;
  close(): void;
}

/** The part of `BroadcastChannel` the link uses, so tests and hosts can pass their own. */
export interface DeckSyncChannel {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}

export interface DeckSyncOptions {
  /**
   * Names the deck, so two decks on one channel ignore each other. Use the
   * same key in both windows (for example the deck's stored id).
   */
  deck: string;
  /** Channel name; defaults to `texuli-deck`. */
  channel?: string;
  /** Opens the channel; defaults to the global `BroadcastChannel`. */
  open?: (name: string) => DeckSyncChannel;
}

const SLIDE_ID = /^[a-z][a-z0-9-]{0,47}$/;
const DECK_KEY = /^[A-Za-z0-9._:-]{1,120}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accept only the closed message shapes: the protocol tag, a known kind, a
 * matching deck key, a slide id in deck syntax and a step from 0 to 32.
 * Extra fields fail the message.
 */
export function parseDeckSyncMessage(value: unknown, deck: string): DeckSyncMessage | null {
  if (!isRecord(value) || value.protocol !== DECK_SYNC_PROTOCOL || value.deck !== deck) return null;
  const keys = Object.keys(value).sort().join(',');
  if (value.kind === 'hello') {
    return keys === 'deck,kind,protocol'
      ? { protocol: DECK_SYNC_PROTOCOL, kind: 'hello', deck }
      : null;
  }
  if (value.kind !== 'position' || keys !== 'deck,kind,protocol,slideId,step') return null;
  const { slideId, step } = value;
  if (typeof slideId !== 'string' || !SLIDE_ID.test(slideId)) return null;
  if (typeof step !== 'number' || !Number.isInteger(step) || step < 0 || step > 32) return null;
  return { protocol: DECK_SYNC_PROTOCOL, kind: 'position', deck, slideId, step };
}

/**
 * Open a deck link, or return `null` when the browser has no
 * `BroadcastChannel` (or the deck key is not usable), so a host can say the
 * presenter screen is unavailable instead of failing silently.
 */
export function createDeckSync(options: DeckSyncOptions): DeckSync | null {
  const { deck, channel = 'texuli-deck' } = options;
  if (!DECK_KEY.test(deck)) return null;
  const open =
    options.open ??
    (typeof BroadcastChannel === 'function'
      ? (name: string) => new BroadcastChannel(name) as DeckSyncChannel
      : undefined);
  if (!open) return null;
  const port = open(channel);
  const listeners = new Set<(message: DeckSyncMessage) => void>();
  const onMessage = (event: MessageEvent) => {
    const message = parseDeckSyncMessage(event.data, deck);
    if (!message) return;
    for (const listener of listeners) listener(message);
  };
  port.addEventListener('message', onMessage);
  let closed = false;
  return {
    post(position) {
      if (closed) return;
      port.postMessage({
        protocol: DECK_SYNC_PROTOCOL,
        kind: 'position',
        deck,
        slideId: position.slideId,
        step: position.step,
      });
    },
    hello() {
      if (!closed) port.postMessage({ protocol: DECK_SYNC_PROTOCOL, kind: 'hello', deck });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close() {
      if (closed) return;
      closed = true;
      listeners.clear();
      port.removeEventListener('message', onMessage);
      port.close();
    },
  };
}
