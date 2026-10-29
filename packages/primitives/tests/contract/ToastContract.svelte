<script lang="ts">
import { createToastManager, Toast, type ToastRecord } from '../../src/toast/index.ts';
import type { HarnessProps } from '../support/contract.ts';

let { p, refs, variant = 'parts' }: HarnessProps = $props();
const manager = createToastManager();
let toasts = $state<readonly ToastRecord[]>([]);
$effect(() =>
  manager.subscribe((next) => {
    toasts = next;
  })
);
manager.publish({
  id: 'saved',
  title: 'Saved',
  description: 'Undo is available.',
  duration: 60_000,
});
</script>

{#if variant === 'toaster'}
  <Toast.Toaster {manager} {...p('toast/Toaster')} bind:ref={refs['toast/Toaster']} />
{:else}
  <Toast.Provider {manager} label="Notifications">
    <Toast.Viewport {...p('toast/Viewport')} bind:ref={refs['toast/Viewport']}>
      <ol>
        {#each toasts as toast (toast.id)}
          <Toast.Root {toast} {...p('toast/Root')} bind:ref={refs['toast/Root']}>
            <Toast.Title {...p('toast/Title')} bind:ref={refs['toast/Title']} />
            <Toast.Description {...p('toast/Description')} bind:ref={refs['toast/Description']} />
            <Toast.Action {...p('toast/Action')} bind:ref={refs['toast/Action']}>Undo</Toast.Action>
            <Toast.Close {...p('toast/Close')} bind:ref={refs['toast/Close']} />
          </Toast.Root>
        {/each}
      </ol>
    </Toast.Viewport>
  </Toast.Provider>
{/if}
