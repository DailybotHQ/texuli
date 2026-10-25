<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Toaster with its own store (the page's toasts never mix with this demo):
 * each button pushes a real toast that announces itself and can be
 * dismissed. Every kind, an action and a promise; position from the panel.
 */
import { Button } from 'texuli/button';
import {
  createToastStore,
  TOAST_KINDS,
  TOASTER_POSITIONS,
  Toaster,
  type ToastKind,
} from 'texuli/toast';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, pick } = readers(() => values);

const store = createToastStore();

const COPY: Record<ToastKind, { title: string; description: string }> = {
  success: { title: 'Note saved', description: 'Stored in this browser.' },
  info: { title: 'Sync queued', description: 'Runs when online.' },
  warning: { title: 'Storage nearly full', description: 'Free up space soon.' },
  error: { title: 'Could not send invite', description: 'Check the example.com address.' },
};

function show(kind: ToastKind): void {
  store.show(kind, COPY[kind].title, { description: COPY[kind].description });
}

function withAction(): void {
  store.error('Could not send invite', {
    description: 'Check the example.com address.',
    action: {
      label: 'Retry',
      onClick: () => {
        store.info('Retrying…');
      },
    },
  });
}

function promise(): void {
  store.promise(new Promise<string>((done) => setTimeout(() => done('ok'), 900)), {
    loading: 'Publishing draft…',
    success: 'Draft published',
    error: 'Publish failed',
  });
}
</script>

<div class="stage" data-tx-toast-stage={componentId}>
  <div class="row">
    {#each TOAST_KINDS as kind (kind)}
      <Button size="sm" variant="outline" onclick={() => show(kind)}>Show {kind}</Button>
    {/each}
    <Button size="sm" variant="outline" onclick={withAction}>Error with action</Button>
    <Button size="sm" variant="outline" onclick={promise}>Promise</Button>
    <Button size="sm" variant="ghost" onclick={() => store.dismiss()}>Dismiss all</Button>
  </div>
  <Toaster
    {store}
    position={pick('position', TOASTER_POSITIONS, 'bottom-end')}
    label={str('label', 'Notifications')}
    dismissLabel={str('dismissLabel', 'Dismiss notification')}
  />
</div>

<style>
  .stage {
    display: grid;
    gap: 0.6rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
