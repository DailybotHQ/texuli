import type { InertRegistry } from '../inert/index.ts';

/** Live-region politeness. One DOM region exists per value per announcer. */
export type AnnouncePoliteness = 'polite' | 'assertive';

/**
 * Clock used for debounce and dedupe. Defaults to the document's window
 * timers / `Date.now`. Tests inject a fake.
 */
export interface AnnouncerClock {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
}

export interface CreateAnnouncerOptions {
  /** Document that owns the live regions (required; no import-time DOM). */
  document: Document;
  /**
   * Parent for the region nodes. Defaults to `document.body` when present,
   * otherwise `document.documentElement`.
   */
  appendTo?: Element;
  /** Debounce for polite announcements in ms (default 150). */
  politeDebounceMs?: number;
  /** Debounce for assertive announcements in ms (default 50). */
  assertiveDebounceMs?: number;
  /**
   * Skip a message identical to the last one delivered on the same region
   * within this many ms (default 1000). `0` disables dedupe.
   */
  dedupeMs?: number;
  /**
   * Inert registry used to exempt the region nodes under modals. Defaults to
   * the page-wide registry when the option is omitted; pass `null` to skip
   * registration (tests).
   */
  inertRegistry?: InertRegistry | null;
  /** Optional debug label prefix for inert exemptions. */
  inertLabel?: string;
  /** Timer / now source (tests). */
  clock?: AnnouncerClock;
}

export interface AnnounceOptions {
  politeness?: AnnouncePoliteness;
  /**
   * When true, bypass debounce and deliver on the next task (still clears the
   * region first so repeated text is re-read).
   */
  immediate?: boolean;
}

export interface Announcer {
  /**
   * Queue `message` for the polite or assertive region. Empty / whitespace
   * messages are ignored. Text is set via `textContent` only (no HTML).
   */
  announce: (message: string, options?: AnnounceOptions | AnnouncePoliteness) => void;
  /** Clear both regions and cancel pending debounced work. */
  clear: () => void;
  /** Remove nodes, release inert exemptions, cancel timers. Idempotent. */
  destroy: () => void;
  /** The live-region elements (created lazily on first announce or ensure). */
  readonly regions: {
    readonly polite: HTMLElement;
    readonly assertive: HTMLElement;
  };
  /** Force-create both regions and register exemptions without announcing. */
  ensure: () => void;
}

/** Versioned key for a page-wide announcer map on `globalThis`. */
export const ANNOUNCER_GLOBAL_KEY = '__TEXULI_ANNOUNCER_V1__' as const;
