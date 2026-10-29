<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { Loading as PrimitiveLoading } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxLoadingClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveLoading> & {
  children?: Snippet;
  class?: ClassValue;
  announce?: string;
};

let {
  children,
  class: className,
  announce = 'Loading options',
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  comboboxLoadingClass({
    class: className,
  })
);

let lastAnnounced = $state(false);

$effect(() => {
  if (typeof document === 'undefined') return;
  if (lastAnnounced) return;
  lastAnnounced = true;
  const message = announce.trim();
  if (!message) return;
  getAnnouncer(document).announce(message, 'polite');
});
</script>

<PrimitiveLoading bind:ref class={classes} data-tx-combobox-loading {...rest}>
  {#if children}
    {@render children()}
  {:else}
    {announce}
  {/if}
</PrimitiveLoading>
