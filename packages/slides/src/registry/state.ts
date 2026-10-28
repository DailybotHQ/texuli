/**
 * The slide state host seam: where an interactive component's local state
 * lives between mounts (a reordered list, a slider, a poll answer). The
 * library keeps it in memory; a host may persist it. The key is built by the
 * stage from the slide id and the item's path, never chosen by content.
 */

export type SlideStateSnapshot = Readonly<Record<string, unknown>>;

export interface SlideStateHost {
  /** The last snapshot written under `key`, or `undefined`. */
  read(key: string): SlideStateSnapshot | undefined;
  /** Called after every accepted state change of the component at `key`. */
  write(key: string, snapshot: SlideStateSnapshot): void;
}

/** The default host: a Map in memory, gone with the page. */
export function createMemoryStateHost(): SlideStateHost & { readonly size: number; clear(): void } {
  const store = new Map<string, SlideStateSnapshot>();
  return {
    read: (key) => store.get(key),
    write: (key, snapshot) => {
      store.set(key, { ...snapshot });
    },
    get size() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
  };
}

/** The state key of a component: `<slide id>/<path>` (`intro/blocks.3`, `chart/component`). */
export function slideStateKey(slideId: string, path: readonly (string | number)[]): string {
  return `${slideId}/${path.length > 0 ? path.join('.') : 'component'}`;
}
