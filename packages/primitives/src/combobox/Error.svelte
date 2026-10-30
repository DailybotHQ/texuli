<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { useMessages } from '../i18n/use-messages.ts';
import type { RefProp } from '../internal/ref.ts';
import { getComboboxContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  /** Show a retry control that re-runs `loadOptions`. Default `true`. */
  showRetry?: boolean;
  retryLabel?: string;
} & RefProp;

let {
  children,
  showRetry = true,
  retryLabel: retryLabelProp,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const retryLabel = $derived(
  retryLabelProp ?? msg('primitives.combobox.error.retry-label', 'Retry')
);
const context = getComboboxContext();
const visible = $derived(context.open && context.status === 'error');

function handleRetry(): void {
  context.retry();
}
</script>

{#if visible}
  <div bind:this={ref}
    {...rest}
    role="alert"
    data-tx-combobox-error=""
    data-status="error"
  >
    {#if children}
      {@render children()}
    {:else}
      <p data-tx-combobox-error-message="">{context.errorMessage ?? msg('primitives.combobox.error.failed-to-load-options', 'Failed to load options')}</p>
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
