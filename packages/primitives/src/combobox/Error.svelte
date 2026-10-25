<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  /** Show a retry control that re-runs `loadOptions`. Default `true`. */
  showRetry?: boolean;
  retryLabel?: string;
};

let { children, showRetry = true, retryLabel = 'Retry', ...rest }: Props = $props();
const context = getComboboxContext();
const visible = $derived(context.open && context.status === 'error');

function handleRetry(): void {
  context.retry();
}
</script>

{#if visible}
  <div
    {...rest}
    role="alert"
    data-tx-combobox-error=""
    data-status="error"
  >
    {#if children}
      {@render children()}
    {:else}
      <p data-tx-combobox-error-message="">{context.errorMessage ?? 'Failed to load options'}</p>
    {/if}
    {#if showRetry}
      <button
        type="button"
        data-tx-combobox-retry=""
        disabled={context.disabled || undefined}
        onclick={handleRetry}
      >
        {retryLabel}
      </button>
    {/if}
  </div>
{/if}
