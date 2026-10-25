import type { ActionIntent, ActionResult } from '../actions.ts';
import type { DataSources } from '../host-data.ts';
import {
  PLAYER_FRAME_PROTOCOL,
  type PlayerFrameDiagnostics,
  type PlayerFrameFlowChange,
  type PlayerFrameHostMessage,
  parseHostMessage,
} from './protocol.ts';
import type { PlayerSize } from './types.ts';

export interface PlayerFrameClientOptions {
  /**
   * Exact host origins allowed to drive this frame, such as
   * `https://app.example.com`. HTTPS only, plus `http://localhost` and
   * `http://127.0.0.1` for local development. `*` and `null` are refused.
   */
  parentOrigins: readonly string[];
  /** The frame's own window. Default: `globalThis.window`. */
  window?: Window;
  /** How long an action intent waits for the host's answer. Default 30 s. */
  actionTimeoutMs?: number;
  onInit?: (message: Extract<PlayerFrameHostMessage, { type: 'init' }>) => void;
  onUpdate?: (message: Extract<PlayerFrameHostMessage, { type: 'update' }>) => void;
  /** Host data for host-bound state (host G01), already sanitized. */
  onData?: (sources: DataSources) => void;
}

export interface PlayerFrameClient {
  /** The host origin that sent the first accepted message, or `null` before it. */
  readonly parentOrigin: string | null;
  resize(size: PlayerSize): void;
  diagnostics(diagnostics: PlayerFrameDiagnostics): void;
  /** Tell the host a flow action moved the view (G09). */
  flow(change: PlayerFrameFlowChange): void;
  /**
   * Send an action intent to the host (G17) and settle with its answer:
   * rejects when the host reports a failure or does not answer in time.
   */
  action(intent: ActionIntent): Promise<ActionResult>;
  dispose(): void;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Normalize an allowlist entry to an exact origin, or `null` when it is refused. */
export function normalizeParentOrigin(entry: unknown): string | null {
  if (typeof entry !== 'string') return null;
  let url: URL;
  try {
    url = new URL(entry.trim());
  } catch {
    return null;
  }
  if (url.username !== '' || url.password !== '') return null;
  if (url.protocol === 'https:') return url.origin;
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) return url.origin;
  return null;
}

/**
 * The frame side of the player-frame protocol.
 *
 * It accepts messages only from its parent window (`event.source`) and only
 * from an origin on `parentOrigins`. The first accepted message pins the
 * host origin; later messages from any other origin are ignored. Every
 * outgoing message names that exact origin as `targetOrigin`, never `"*"`.
 * `ready` is posted once to each allowed origin; the browser drops it for
 * every origin the parent is not on.
 */
export function createPlayerFrameClient(options: PlayerFrameClientOptions): PlayerFrameClient {
  const win = options.window ?? globalThis.window;
  const allowed = new Set<string>();
  for (const entry of options.parentOrigins) {
    const origin = normalizeParentOrigin(entry);
    if (origin) allowed.add(origin);
  }
  let parentOrigin: string | null = null;
  const pendingActions = new Map<string, (status: 'confirmed' | 'rejected' | 'failed') => void>();
  const actionTimeoutMs = options.actionTimeoutMs ?? 30_000;
  let disposed = false;

  function onMessage(event: MessageEvent): void {
    if (disposed || event.source === null || event.source !== win.parent) return;
    if (!allowed.has(event.origin)) return;
    if (parentOrigin !== null && event.origin !== parentOrigin) return;
    const message = parseHostMessage(event.data);
    if (!message) return;
    parentOrigin = event.origin;
    if (message.type === 'init') options.onInit?.(message);
    else if (message.type === 'action-result') {
      const settle = pendingActions.get(message.id);
      pendingActions.delete(message.id);
      settle?.(message.status);
    } else if (message.type === 'data') options.onData?.(message.sources);
    else options.onUpdate?.(message);
  }

  function post(message: unknown): void {
    if (disposed || parentOrigin === null || win.parent === win) return;
    win.parent.postMessage(message, parentOrigin);
  }

  win.addEventListener('message', onMessage);
  if (win.parent !== win) {
    for (const origin of allowed) {
      win.parent.postMessage({ protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' }, origin);
    }
  }

  return {
    get parentOrigin() {
      return parentOrigin;
    },
    resize(size) {
      post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'resize', ...size });
    },
    diagnostics(diagnostics) {
      post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'diagnostics', ...diagnostics });
    },
    action(intent) {
      return new Promise<ActionResult>((resolve, reject) => {
        if (disposed || parentOrigin === null) {
          reject(new Error('No host to answer the action.'));
          return;
        }
        const timer = setTimeout(() => {
          pendingActions.delete(intent.id);
          reject(new Error('The host did not answer the action in time.'));
        }, actionTimeoutMs);
        pendingActions.set(intent.id, (status) => {
          clearTimeout(timer);
          if (status === 'failed') reject(new Error('The host could not complete the action.'));
          else resolve(status);
        });
        post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'action', ...intent });
      });
    },
    flow(change) {
      post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'flow', ...change });
    },
    dispose() {
      disposed = true;
      win.removeEventListener('message', onMessage);
    },
  };
}
