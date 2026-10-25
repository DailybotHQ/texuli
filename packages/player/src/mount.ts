import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { type ActionIntent } from './actions.ts';
import { createPlayerFrameClient, type PlayerFrameClient } from './embed/client.ts';
import { frameDiagnostics, type PlayerFrameOptions } from './embed/protocol.ts';
import type { PlayerDiagnosticsEvent, PlayerSize } from './embed/types.ts';
import type Player from './Player.svelte';
import PlayerHost from './PlayerHost.svelte';
import type { StateSnapshot } from './state/schema.ts';

/** Every prop `<Player>` accepts. */
export type PlayerProps = ComponentProps<typeof Player>;

export interface MountedPlayer {
  /**
   * Merge new props in place (a live update, R20). The player re-validates
   * the whole blueprint; declared state that still fits, the flow view while
   * it is still declared, the selection of nodes still at their path, and
   * loaded painters are kept. `initialState` only seeds variables that are
   * new. To start over, `dispose()` and mount again.
   */
  update(next: Partial<PlayerProps>): void;
  /** Set one declared state variable; `false` when it does not exist or the value does not fit. */
  setState(name: string, value: unknown): boolean;
  /** The current state snapshot. */
  getState(): StateSnapshot;
  /** Fire a declared flow event (G09); `false` when no transition applies. */
  dispatchFlow(event: string): boolean;
  /** The current flow view, or `null` without a declared flow. */
  getView(): string | null;
  dispose(): void;
}

type PlayerHostExports = {
  setProps(next: PlayerProps): void;
  setState(name: string, value: unknown): boolean;
  getState(): StateSnapshot | null;
  dispatchFlow(event: string): boolean;
  getView(): string | null;
};

const NO_STATE: StateSnapshot = Object.freeze({});

/** Mount `<Player>` into `target` for hosts without Svelte. */
export function mountPlayer(target: Element, props: PlayerProps): MountedPlayer {
  let current: PlayerProps = { ...props };
  // The svelte-check gate knows PlayerHost's real exports; plain `tsc` sees
  // only the ambient `.svelte` declaration, so bridge the two views here.
  let instance: PlayerHostExports | null = mount(PlayerHost, {
    target,
    props: { initial: current },
  }) as PlayerHostExports;
  return {
    update(next) {
      if (!instance) return;
      current = { ...current, ...next };
      instance.setProps(current);
      // Hosts read the DOM right after an update, as they did when it remounted.
      flushSync();
    },
    setState(name, value) {
      return instance?.setState(name, value) ?? false;
    },
    getState() {
      return instance?.getState() ?? NO_STATE;
    },
    dispatchFlow(event) {
      return instance?.dispatchFlow(event) ?? false;
    },
    getView() {
      return instance?.getView() ?? null;
    },
    dispose() {
      if (!instance) return;
      void unmount(instance);
      instance = null;
    },
  };
}

export interface MountPlayerFrameOptions
  extends Partial<Pick<PlayerProps, 'catalog' | 'catalogHash' | 'loaders' | 'loadTimeoutMs'>> {
  /** Exact host origins allowed to drive this frame (see `createPlayerFrameClient`). */
  parentOrigins: readonly string[];
  window?: Window;
}

export interface MountedPlayerFrame {
  readonly client: PlayerFrameClient;
  dispose(): void;
}

/**
 * The frame page's half: wait for the host's `init`, mount the player with
 * the host's options, and report size and validation back. The catalog and
 * loaders are the frame page's own; they never cross the boundary.
 */
export function mountPlayerFrame(
  target: Element,
  options: MountPlayerFrameOptions
): MountedPlayerFrame {
  const { parentOrigins, window: win, ...pinned } = options;
  let mounted: MountedPlayer | null = null;
  let frameOptions: PlayerFrameOptions = {};

  const client = createPlayerFrameClient({
    parentOrigins,
    ...(win ? { window: win } : {}),
    onInit(message) {
      mounted?.dispose();
      frameOptions = message.options;
      mounted = mountPlayer(target, {
        ...pinned,
        ...frameOptions,
        blueprint: message.blueprint,
        onResize: (size: PlayerSize) => client.resize(size),
        onDiagnostics: (event: PlayerDiagnosticsEvent) =>
          client.diagnostics(frameDiagnostics(event)),
        onFlowChange: (change: { from: string; to: string; event: string }) => client.flow(change),
        onAction: (intent: ActionIntent) => client.action(intent),
      });
    },
    onUpdate(message) {
      if (!mounted) return;
      const next: Partial<PlayerProps> = {};
      if (Object.hasOwn(message, 'blueprint')) next.blueprint = message.blueprint;
      if (message.status) next.status = message.status;
      if (message.view) next.view = message.view;
      mounted.update(next);
    },
    // Host data rides the in-place update path (R20): state and the reader's place are kept.
    onData(sources) {
      mounted?.update({ dataSources: sources });
    },
  });

  return {
    client,
    dispose() {
      client.dispose();
      mounted?.dispose();
      mounted = null;
    },
  };
}
