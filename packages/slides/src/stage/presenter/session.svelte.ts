/**
 * The presenter window session of one stage: opens a second same-origin
 * window, links it to the stage over the engine's closed presenter protocol
 * v1 (two `BroadcastChannel` ends on `texuli-deck-presenter/1:<namespace>`)
 * and reports why it fell back to the in-page split view when it could not.
 *
 * The window is opened synchronously inside the user's click (so popup
 * blockers see the gesture), with the noopener-safe pattern: an empty
 * same-origin document whose `opener` is cleared at once, populated with DOM
 * APIs only (never an HTML string). The window's view itself is a lazy chunk
 * (`./popup.ts`), loaded after the window exists. While the window is open
 * the stage follows the session's transport through its `DeckPresenterHost`.
 */
import {
  createBroadcastPresenterTransport,
  type PresenterChannelLike,
  type PresenterTransport,
  sanitizePresenterNamespace,
} from '@texuli/deck/engine';
import type { DeckStageContext } from '../context.ts';
import type { DeckPresenterHost } from './host.ts';
import type { DeckPreviewPaint } from './paint.ts';
import type { DeckPresenterTimers } from './timers.ts';

/** Why the presenter window did not open (the split view stays, with the reason shown). */
export type DeckPresenterFallbackReason =
  | 'popup-blocked'
  | 'no-broadcast'
  | 'no-window'
  | 'load-error';

/** Opens a window; return `null` to simulate a blocked popup. */
export type DeckPresenterOpenWindow = (
  url: string,
  target: string,
  features: string
) => Window | null;

export interface DeckPresenterSessionOptions {
  /** `window.open` replacement (tests, embedding hosts). */
  openWindow?: DeckPresenterOpenWindow;
  /** The channel constructor; `null` forces the no-BroadcastChannel fallback. */
  channel?: (new (name: string) => PresenterChannelLike) | null;
  /** The two linked transport ends (`[stage, window]`), replacing the channel pair. */
  transports?: (namespace: string) => readonly [PresenterTransport, PresenterTransport] | null;
  /** Loads the window view (the lazy chunk). */
  load?: () => Promise<typeof import('./popup.ts')>;
  /** The opener window; defaults to the global `window`. */
  opener?: Window | null;
  /** The stage that follows the window while it is open. */
  host?: DeckPresenterHost;
}

export interface DeckPresenterOpenInput {
  stage: DeckStageContext;
  paint: DeckPreviewPaint;
  timers: DeckPresenterTimers;
  /** The stage root, mirrored (theme, mode, direction) onto the window's root. */
  stageRoot: HTMLElement | null;
}

export interface DeckPresenterSession {
  readonly status: 'closed' | 'opening' | 'open';
  readonly reason: DeckPresenterFallbackReason | null;
  /** The stage's end of the link while the window is open. */
  readonly transport: PresenterTransport | null;
  /** Open (or focus) the window; resolves `true` once its view is mounted. */
  open(input: DeckPresenterOpenInput): Promise<boolean>;
  close(): void;
}

export const DECK_PRESENTER_WINDOW_FEATURES =
  'popup=yes,width=1100,height=720,menubar=no,toolbar=no,location=no';

/** The window name for one deck namespace (re-opening focuses the same window). */
export function presenterWindowName(namespace: string): string {
  return `texuli-presenter-${sanitizePresenterNamespace(namespace).replace(/[^a-z0-9-]/g, '-')}`;
}

function channelPair(
  namespace: string,
  channel: (new (name: string) => PresenterChannelLike) | undefined
): readonly [PresenterTransport, PresenterTransport] | null {
  const stageEnd = createBroadcastPresenterTransport(namespace, channel);
  if (!stageEnd) return null;
  const windowEnd = createBroadcastPresenterTransport(namespace, channel);
  if (!windowEnd) {
    stageEnd.close();
    return null;
  }
  return [stageEnd, windowEnd];
}

export function createDeckPresenterSession(
  options: DeckPresenterSessionOptions = {}
): DeckPresenterSession {
  let status = $state<'closed' | 'opening' | 'open'>('closed');
  let reason = $state<DeckPresenterFallbackReason | null>(null);
  let transport = $state.raw<PresenterTransport | null>(null);
  let popup: Window | null = null;
  let teardown: (() => void) | null = null;
  let ends: readonly PresenterTransport[] = [];

  function close() {
    if (transport) options.host?.detach();
    const done = teardown;
    teardown = null;
    done?.();
    for (const end of ends) end.close();
    ends = [];
    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch {
        // Already gone.
      }
    }
    popup = null;
    transport = null;
    status = 'closed';
  }

  function fallback(why: DeckPresenterFallbackReason): false {
    close();
    reason = why;
    return false;
  }

  async function open(input: DeckPresenterOpenInput): Promise<boolean> {
    if (status !== 'closed') {
      try {
        popup?.focus();
      } catch {
        // A window that cannot take focus is still open.
      }
      return status === 'open';
    }
    const opener = options.opener === undefined ? globalThis.window : options.opener;
    if (!opener || typeof opener.open !== 'function') return fallback('no-window');

    // Everything up to window.open runs synchronously inside the click.
    const namespace = input.stage.namespace;
    const pair =
      options.channel === null
        ? null
        : options.transports
          ? options.transports(namespace)
          : channelPair(namespace, options.channel);
    if (!pair) return fallback('no-broadcast');
    ends = pair;

    const openWindow: DeckPresenterOpenWindow =
      options.openWindow ?? ((url, target, features) => opener.open(url, target, features));
    let opened: Window | null = null;
    try {
      opened = openWindow('', presenterWindowName(namespace), DECK_PRESENTER_WINDOW_FEATURES);
    } catch {
      opened = null;
    }
    if (!opened) return fallback('popup-blocked');
    try {
      // noopener-safe: the presenter window can never reach or navigate this page.
      opened.opener = null;
    } catch {
      // Some hosts make `opener` read-only; the document is ours either way.
    }
    popup = opened;
    reason = null;
    status = 'opening';

    try {
      const load = options.load ?? (() => import('./popup.ts'));
      const { mountDeckPresenterWindow } = await load();
      if (popup !== opened) return false;
      teardown = mountDeckPresenterWindow(opened, {
        ...input,
        transport: pair[1],
        host: opener,
        onClose: close,
      });
    } catch {
      return fallback('load-error');
    }
    transport = pair[0];
    status = 'open';
    options.host?.attach(pair[0], close);
    return true;
  }

  return {
    get status() {
      return status;
    },
    get reason() {
      return reason;
    },
    get transport() {
      return transport;
    },
    open,
    close,
  };
}

const perStage = new WeakMap<object, DeckPresenterSession>();

/**
 * The presenter window session of one stage (`key` is its controller),
 * created on first use, so it outlives the split view that opened it.
 */
export function presenterSessionFor(
  key: object,
  host: DeckPresenterHost,
  options: Omit<DeckPresenterSessionOptions, 'host'> = {}
): DeckPresenterSession {
  let session = perStage.get(key);
  if (!session) {
    session = createDeckPresenterSession({ ...options, host });
    perStage.set(key, session);
  }
  return session;
}
