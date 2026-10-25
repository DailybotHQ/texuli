<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { getComboboxContext, Error as PrimitiveErrorPart } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxErrorClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveErrorPart> & {
  children?: Snippet;
  class?: ClassValue;
  /** Override the announced failure message. */
  announce?: string;
};

let {
  children,
  class: className,
  announce,
  retryLabel = 'Retry',
  showRetry = true,
  ...rest
}: Props = $props();

const context = getComboboxContext();
const message = $derived((announce ?? context.errorMessage ?? 'Failed to load options').trim());

const classes = $derived(
  comboboxErrorClass({
    class: className,
  })
);

let announcedFor = $state<string | undefined>(undefined);

$effect(() => {
  if (typeof document === 'undefined') return;
  if (!message || announcedFor === message) return;
  announcedFor = message;
  getAnnouncer(document).announce(message, 'assertive');
});
</script>

<PrimitiveErrorPart
  class={classes}
  data-tx-combobox-error
  {showRetry}
  {retryLabel}
  {...rest}
>
  {#if children}
    {@render children()}
  {:else}
    <p data-tx-combobox-error-message="">{message}</p>
  {/if}
</PrimitiveErrorPart>

<style>
  :global([data-tx-combobox-error] [data-tx-combobox-retry]) {
    justify-self: start;
    min-block-size: 2rem;
    padding-inline: 0.65rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: calc(var(--tx-radius, 0.375rem) * 0.7);
    background: var(--tx-background, Canvas);
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }
</style>
