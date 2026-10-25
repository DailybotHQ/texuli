import { type ActionHandler, runAction } from '../actions.ts';
import {
  PLAYER_FRAME_PROTOCOL,
  type PlayerFrameDiagnostics,
  type PlayerFrameFlowChange,
  type PlayerFrameOptions,
  parseFrameMessage,
} from './protocol.ts';
import type { PlayerSize } from './types.ts';

export interface PlayerFrameHostOptions {
  /** The sandboxed player iframe. */
  frame: HTMLIFrameElement;
  /** The window that receives the frame's messages. Default: `frame.ownerDocument.defaultView`. */
  window?: Window;
  onReady?: () => void;
  onResize?: (size: PlayerSize) => void;
  onDiagnostics?: (diagnostics: PlayerFrameDiagnostics) => void;
  /** A flow action moved the frame's view (G09); the host may mirror it into its URL. */
  onFlow?: (change: PlayerFrameFlowChange) => void;
  /**
   * The host's answer to a frame's action intent (G17). Without it every
   * action is rejected. A throw or any other answer is reported as failed.
   */
  onAction?: ActionHandler;
}

export interface PlayerFrameHost {
  /** Send the blueprint and options. Returns `false` until the frame said `ready` for this load. */
  init(blueprint: unknown, options?: PlayerFrameOptions): boolean;
  /** Send a new blueprint or status. Returns `false` until the frame is ready. */
  update(next: {
    blueprint?: unknown;
    status?: Exclude<PlayerFrameOptions['status'], undefined>;
  }): boolean;
  /** Send host data for host-bound state (host G01). Returns `false` until the frame is ready. */
  data(sources: Readonly<Record<string, string | number | boolean>>): boolean;
  /** Whether the frame said `ready` since its last load. */
  readonly ready: boolean;
  dispose(): void;
}

/**
 * The host side of the player-frame protocol.
 *
 * A message is accepted only when it comes from this iframe's own window
 * (`event.source`) with the opaque origin (`"null"`) that the
 * `allow-scripts`-only sandbox gives it, and is a well-formed protocol
 * message. Because an opaque origin cannot be named as a `targetOrigin`, the
 * host posts to the frame's window with `"*"`, and only after the frame said
 * `ready` during its current load; a frame navigation clears that. Send
 * display data only: never credentials or tokens.
 */
export function createPlayerFrameHost(options: PlayerFrameHostOptions): PlayerFrameHost {
  const { frame } = options;
  const win = options.window ?? frame.ownerDocument.defaultView;
  let ready = false;
  let disposed = false;

  function onMessage(event: MessageEvent): void {
    if (disposed || event.source === null || event.source !== frame.contentWindow) return;
    if (event.origin !== 'null') return;
    const message = parseFrameMessage(event.data);
    if (!message) return;
    if (message.type === 'ready') {
      ready = true;
      options.onReady?.();
      return;
    }
    if (!ready) return;
    if (message.type === 'resize') {
      options.onResize?.({ blockSize: message.blockSize, inlineSize: message.inlineSize });
    } else if (message.type === 'flow') {
      options.onFlow?.({ from: message.from, to: message.to, event: message.event });
    } else if (message.type === 'action') {
      const { protocol: _protocol, type: _type, ...intent } = message;
      void runAction(options.onAction, intent).then((status) => {
        post({
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'action-result',
          id: intent.id,
          status: status === 'unavailable' ? 'rejected' : status,
        });
      });
    } else {
      const { protocol: _protocol, type: _type, ...diagnostics } = message;
      options.onDiagnostics?.(diagnostics);
    }
  }

  // Every (re)load is a new document that must announce itself again.
  function onLoad(): void {
    ready = false;
  }

  function post(message: unknown): boolean {
    const target = frame.contentWindow;
    if (disposed || !ready || !target) return false;
    target.postMessage(message, '*');
    return true;
  }

  win?.addEventListener('message', onMessage);
  frame.addEventListener('load', onLoad);

  return {
    get ready() {
      return ready;
    },
    init(blueprint, frameOptions = {}) {
      return post({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'init',
        blueprint,
        options: frameOptions,
      });
    },
    update(next) {
      return post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'update', ...next });
    },
    data(sources) {
      return post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'data', sources });
    },
    dispose() {
      disposed = true;
      win?.removeEventListener('message', onMessage);
      frame.removeEventListener('load', onLoad);
    },
  };
}
