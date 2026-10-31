/**
 * The player seam (G123): how an embed reaches `@texuli/player`. This module
 * never names the player package, so an entry that only reaches it (the
 * core entries: `editor-core`, `reader-core`, `paged-core`, `collab-core`,
 * `host-core`) has no player reference in its graph, static or dynamic. The
 * default entries hand the views `loadDefaultPlayer` from `./player.ts`;
 * a host on the core entries passes its own `loadPlayer`, so the dynamic
 * import lives in host code: `() => import('@texuli/player')` (the host
 * loads `@texuli/player/styles.css` too, with its own styles or in the
 * loader).
 */
import type { Component } from 'svelte';

/** What a player loader resolves to: the `@texuli/player` module, or any object with its `Player`. */
export interface PagesPlayerModule {
  // biome-ignore lint/suspicious/noExplicitAny: the player's props are checked where it is defined.
  Player: Component<any>;
}

/**
 * Loads the player on first use. `null` (or no loader on a core entry)
 * turns live embeds off: an embed that needs the player shows the
 * accessible notice, or goes to the host block renderer when it claims the
 * fallback (G111).
 */
export type PagesPlayerLoader = () => Promise<PagesPlayerModule>;

// biome-ignore lint/suspicious/noExplicitAny: see above.
const cache = new WeakMap<PagesPlayerLoader, Promise<Component<any>>>();

/** The `Player` from `load`, once per loader; a failed load is tried again next time. */
// biome-ignore lint/suspicious/noExplicitAny: see above.
export function resolvePlayer(load: PagesPlayerLoader): Promise<Component<any>> {
  let pending = cache.get(load);
  if (!pending) {
    pending = Promise.resolve()
      .then(load)
      .then((module) => {
        if (typeof module?.Player !== 'function') throw new TypeError('The loader has no Player.');
        return module.Player;
      });
    cache.set(load, pending);
    pending.catch(() => {
      if (cache.get(load) === pending) cache.delete(load);
    });
  }
  return pending;
}
