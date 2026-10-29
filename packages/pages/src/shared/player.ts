/** The player loads on first use: a page without embeds never downloads it. */
import type { Component } from 'svelte';

// biome-ignore lint/suspicious/noExplicitAny: the player's props are checked where it is defined.
let pending: Promise<Component<any>> | null = null;

// biome-ignore lint/suspicious/noExplicitAny: see above.
export function loadPlayer(): Promise<Component<any>> {
  pending ??= Promise.all([import('@texuli/player'), import('@texuli/player/styles.css')]).then(
    ([module]) => module.Player,
    (error: unknown) => {
      pending = null;
      throw error;
    }
  );
  return pending;
}
