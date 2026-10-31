/**
 * The lazy host slot: loaded with `import()` the first time a document with
 * a host block renderer shows a wrapped block or an embed, so a reader or
 * an editor without one never loads it.
 */
import type { Component } from 'svelte';

// biome-ignore lint/suspicious/noExplicitAny: the slot's props are checked where it is defined.
let pending: Promise<Component<any>> | undefined;

// biome-ignore lint/suspicious/noExplicitAny: see above.
export function loadHostSlot(): Promise<Component<any>> {
  if (!pending) {
    pending = import('./HostSlot.svelte').then((module) => module.default);
    pending.catch(() => {
      pending = undefined;
    });
  }
  return pending;
}
