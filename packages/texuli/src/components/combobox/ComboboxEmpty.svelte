<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { Empty as PrimitiveEmpty } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { useMessages } from '../../i18n/use-messages.ts';
import { type ClassValue } from '../../internal/cx.ts';
import { comboboxEmptyClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveEmpty> & {
  children?: Snippet;
  class?: ClassValue;
  /** Announced when the empty state appears. */
  announce?: string;
};

let {
  children,
  class: className,
  announce: announceProp,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const msg = useMessages();
const announce = $derived(announceProp ?? msg('texuli.combobox-empty.announce', 'No results'));

const classes = $derived(
  comboboxEmptyClass({
    class: className,
  })
);

let lastAnnounced = $state(false);

$effect(() => {
  // Primitive Empty only mounts when visible; announce once per mount cycle.
  if (typeof document === 'undefined') return;
  if (lastAnnounced) return;
  lastAnnounced = true;
  const message = announce.trim();
  if (!message) return;
  getAnnouncer(document).announce(message, 'polite');
});
</script>

<PrimitiveEmpty bind:ref class={classes} data-tx-combobox-empty {...rest}>
  {#if children}
    {@render children()}
  {:else}
    {announce}
  {/if}
</PrimitiveEmpty>
