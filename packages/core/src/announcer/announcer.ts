import {
  createInertRegistry,
  getInertRegistry,
  type InertExemptionHandle,
  type InertRegistry,
} from '../inert/index.ts';
import { appendRegion, createLiveRegion, resolveAppendTarget } from './regions.ts';
import type {
  AnnounceOptions,
  AnnouncePoliteness,
  Announcer,
  AnnouncerClock,
  CreateAnnouncerOptions,
} from './types.ts';
import { ANNOUNCER_GLOBAL_KEY } from './types.ts';

const DEFAULT_POLITE_DEBOUNCE_MS = 150;
const DEFAULT_ASSERTIVE_DEBOUNCE_MS = 50;
const DEFAULT_DEDUPE_MS = 1000;
/** Gap after clearing a region before writing new text (SR re-announce). */
const CLEAR_GAP_MS = 16;

type RegionState = {
  node: HTMLElement | null;
  pending: string | null;
  timer: unknown;
  clearTimer: unknown;
  lastMessage: string;
  lastAt: number;
  exemption: InertExemptionHandle | null;
};

function defaultClock(documentRef: Document): AnnouncerClock {
  const view = documentRef.defaultView;
  return {
    now: () => (view?.performance?.now ? view.performance.now() : Date.now()),
    setTimeout: (callback, ms) => {
      if (view?.setTimeout) return view.setTimeout(callback, ms);
      return setTimeout(callback, ms);
    },
    clearTimeout: (id) => {
      if (view?.clearTimeout) view.clearTimeout(id as number);
      else clearTimeout(id as number);
    },
  };
}

function normalizeMessage(message: string): string | null {
  if (typeof message !== 'string') return null;
  const trimmed = message.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? null : trimmed;
}

function resolvePoliteness(options?: AnnounceOptions | AnnouncePoliteness): {
  politeness: AnnouncePoliteness;
  immediate: boolean;
} {
  if (options === 'polite' || options === 'assertive') {
    return { politeness: options, immediate: false };
  }
  if (options && typeof options === 'object') {
    return {
      politeness: options.politeness === 'assertive' ? 'assertive' : 'polite',
      immediate: options.immediate === true,
    };
  }
  return { politeness: 'polite', immediate: false };
}

function resolveInertRegistry(
  option: CreateAnnouncerOptions['inertRegistry']
): InertRegistry | null {
  if (option === null) return null;
  if (option) return option;
  try {
    return getInertRegistry();
  } catch {
    return createInertRegistry();
  }
}

/**
 * Create a live-region announcer bound to one document.
 *
 * Owns one polite (`role="status"`) and one assertive (`role="alert"`) region.
 * Announcements are debounced per region, deduplicated, written with
 * `textContent` only, and the region nodes are registered as inert exemptions
 * so they keep working under modals.
 */
export function createAnnouncer(options: CreateAnnouncerOptions): Announcer {
  const documentRef = options.document;
  if (!documentRef || typeof documentRef.createElement !== 'function') {
    throw new TypeError('createAnnouncer: document must be a Document');
  }

  const clock = options.clock ?? defaultClock(documentRef);
  const politeDebounceMs = options.politeDebounceMs ?? DEFAULT_POLITE_DEBOUNCE_MS;
  const assertiveDebounceMs = options.assertiveDebounceMs ?? DEFAULT_ASSERTIVE_DEBOUNCE_MS;
  const dedupeMs = options.dedupeMs ?? DEFAULT_DEDUPE_MS;
  const inertRegistry = resolveInertRegistry(options.inertRegistry);
  const inertLabel = options.inertLabel ?? 'announcer';

  const polite: RegionState = {
    node: null,
    pending: null,
    timer: null,
    clearTimer: null,
    lastMessage: '',
    lastAt: 0,
    exemption: null,
  };
  const assertive: RegionState = {
    node: null,
    pending: null,
    timer: null,
    clearTimer: null,
    lastMessage: '',
    lastAt: 0,
    exemption: null,
  };

  let destroyed = false;

  const stateOf = (politeness: AnnouncePoliteness): RegionState =>
    politeness === 'assertive' ? assertive : polite;

  const ensureRegion = (politeness: AnnouncePoliteness): HTMLElement => {
    const state = stateOf(politeness);
    if (state.node) return state.node;
    const node = createLiveRegion(documentRef, politeness);
    const parent = resolveAppendTarget(documentRef, options.appendTo);
    appendRegion(node, parent);
    state.node = node;
    if (inertRegistry) {
      state.exemption = inertRegistry.exempt({
        element: node,
        label: `${inertLabel}:${politeness}`,
      });
    }
    return node;
  };

  const cancelTimers = (state: RegionState) => {
    if (state.timer !== null) {
      clock.clearTimeout(state.timer);
      state.timer = null;
    }
    if (state.clearTimer !== null) {
      clock.clearTimeout(state.clearTimer);
      state.clearTimer = null;
    }
  };

  const deliver = (politeness: AnnouncePoliteness, message: string) => {
    if (destroyed) return;
    const state = stateOf(politeness);
    const now = clock.now();
    if (dedupeMs > 0 && message === state.lastMessage && now - state.lastAt < dedupeMs) {
      state.pending = null;
      return;
    }
    const node = ensureRegion(politeness);
    // Clear first so repeated identical text (after dedupe window) is re-read.
    node.textContent = '';
    cancelTimers(state);
    state.clearTimer = clock.setTimeout(() => {
      state.clearTimer = null;
      if (destroyed || state.node !== node) return;
      node.textContent = message;
      state.lastMessage = message;
      state.lastAt = clock.now();
      state.pending = null;
    }, CLEAR_GAP_MS);
  };

  const flush = (politeness: AnnouncePoliteness) => {
    const state = stateOf(politeness);
    state.timer = null;
    const message = state.pending;
    if (message === null) return;
    deliver(politeness, message);
  };

  const announcer: Announcer = {
    get regions() {
      return {
        get polite() {
          return ensureRegion('polite');
        },
        get assertive() {
          return ensureRegion('assertive');
        },
      };
    },

    ensure() {
      if (destroyed) return;
      ensureRegion('polite');
      ensureRegion('assertive');
    },

    announce(message, optionsOrPoliteness) {
      if (destroyed) return;
      const text = normalizeMessage(message);
      if (text === null) return;
      const { politeness, immediate } = resolvePoliteness(optionsOrPoliteness);
      const state = stateOf(politeness);
      state.pending = text;
      if (immediate) {
        cancelTimers(state);
        deliver(politeness, text);
        return;
      }
      if (state.timer !== null) clock.clearTimeout(state.timer);
      const delay = politeness === 'assertive' ? assertiveDebounceMs : politeDebounceMs;
      if (delay <= 0) {
        state.timer = null;
        deliver(politeness, text);
        return;
      }
      state.timer = clock.setTimeout(() => flush(politeness), delay);
    },

    clear() {
      if (destroyed) return;
      for (const state of [polite, assertive]) {
        cancelTimers(state);
        state.pending = null;
        state.lastMessage = '';
        state.lastAt = 0;
        if (state.node) state.node.textContent = '';
      }
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const state of [polite, assertive]) {
        cancelTimers(state);
        state.pending = null;
        state.exemption?.release();
        state.exemption = null;
        state.node?.remove();
        state.node = null;
      }
    },
  };

  return announcer;
}

export type AnnouncerGlobal = {
  [ANNOUNCER_GLOBAL_KEY]?: WeakMap<Document, Announcer>;
};

/**
 * Page-wide announcer for `documentRef`, stored on `globalObject` (default
 * `globalThis`). Separate documents get separate instances.
 */
export function getAnnouncer(
  documentRef: Document,
  options?: Omit<CreateAnnouncerOptions, 'document'>,
  globalObject: AnnouncerGlobal = globalThis as AnnouncerGlobal
): Announcer {
  let map = globalObject[ANNOUNCER_GLOBAL_KEY];
  if (!map) {
    map = new WeakMap();
    globalObject[ANNOUNCER_GLOBAL_KEY] = map;
  }
  const existing = map.get(documentRef);
  if (existing) return existing;
  const created = createAnnouncer({ ...options, document: documentRef });
  map.set(documentRef, created);
  return created;
}

/**
 * Drop the shared announcer for `documentRef` (tests). Destroys the instance
 * when one was stored.
 */
export function resetAnnouncer(
  documentRef?: Document,
  globalObject: AnnouncerGlobal = globalThis as AnnouncerGlobal
): void {
  const map = globalObject[ANNOUNCER_GLOBAL_KEY];
  if (!map) return;
  if (documentRef) {
    const existing = map.get(documentRef);
    existing?.destroy();
    map.delete(documentRef);
    return;
  }
  delete globalObject[ANNOUNCER_GLOBAL_KEY];
}
