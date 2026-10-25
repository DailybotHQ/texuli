<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Alert, Banner, Callout, EmptyState and ErrorState: the panel-driven
 * instance, then the other tones and states.
 */
import { ALERT_TONES, Alert, Banner, Callout } from 'texuli/alert';
import { Button } from 'texuli/button';
import { EmptyState, ErrorState } from 'texuli/empty';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, bool, pick } = readers(() => values);

let dismissed = $state(false);
let failed = $state(true);
let retries = $state(0);

async function retry(): Promise<void> {
  await new Promise((done) => setTimeout(done, 400));
  retries += 1;
  failed = false;
}

const tone = $derived(pick('tone', ALERT_TONES, 'info'));
const others = $derived(ALERT_TONES.filter((t) => t !== tone).slice(0, 3));
</script>

<div class="stage" data-tx-feedback-stage={componentId}>
  {#if componentId === 'alert' || componentId === 'banner' || componentId === 'callout'}
    {@const View = componentId === 'alert' ? Alert : componentId === 'banner' ? Banner : Callout}
    {#if dismissed}
      <p class="row">
        Dismissed.
        <Button size="sm" variant="outline" onclick={() => (dismissed = false)}>Show again</Button>
      </p>
    {:else}
      <View
        {tone}
        title={str('title', 'Check inventory')}
        text={str('text', 'Three SKUs are low.')}
        hideIcon={bool('hideIcon')}
        actionLabel={str('actionLabel') || undefined}
        onAction={() => undefined}
        dismissible={bool('dismissible')}
        dismissLabel={str('dismissLabel', 'Dismiss')}
        onDismiss={() => (dismissed = true)}
      />
    {/if}
    {#each others as other (other)}
      <View tone={other} title={other} text={`The ${other} tone.`} />
    {/each}
  {:else if componentId === 'empty-state'}
    <EmptyState
      title={str('title', 'No orders yet')}
      description={str('description', 'Create an order to get started.')}
      size={pick('size', ['sm', 'md'] as const, 'md')}
    >
      {#snippet action()}
        <Button size="sm">Create order</Button>
      {/snippet}
    </EmptyState>
  {:else}
    {#if failed}
      <ErrorState
        title={str('title', 'Could not load orders')}
        message={str('message', 'Check your connection.')}
        retryLabel={str('retryLabel', 'Retry')}
        onRetry={retry}
      />
    {:else}
      <p class="row" role="status">
        Loaded after {retries} {retries === 1 ? 'retry' : 'retries'}.
        <Button size="sm" variant="outline" onclick={() => (failed = true)}>Fail again</Button>
      </p>
    {/if}
  {/if}
</div>

<style>
  .stage {
    display: grid;
    gap: 0.75rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
</style>
