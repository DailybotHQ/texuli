<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { createToastManager } from './manager.ts';
import Provider from './Provider.svelte';
import Root from './Root.svelte';
import type { ToastManager, ToastRecord } from './types.ts';
import Viewport from './Viewport.svelte';

/** Extra attributes (class, data-*) go to the Viewport region, for styling. */
type Props = Omit<HTMLAttributes<HTMLElement>, 'children'> & {
  label?: string;
  hotkey?: string;
  manager?: ToastManager;
  toast?: Snippet<[ToastRecord]>;
  children?: Snippet;
};

let {
  label = 'Notifications',
  hotkey = 'F6',
  manager: managerProp,
  toast: toastSnippet,
  children,
  ...viewportProps
}: Props = $props();

const manager = untrack(() => managerProp) ?? createToastManager();
let toasts = $state<readonly ToastRecord[]>([]);

$effect(() =>
  manager.subscribe((next) => {
    toasts = next;
  })
);
</script>

<Provider {label} {hotkey} {manager}>
  {@render children?.()}
  <Viewport {...viewportProps}>
    <ol data-tx-toast-list>
      {#each toasts as item (item.id)}
        {#if toastSnippet}
          {@render toastSnippet(item)}
        {:else}
          <Root toast={item}></Root>
        {/if}
      {/each}
    </ol>
  </Viewport>
</Provider>
