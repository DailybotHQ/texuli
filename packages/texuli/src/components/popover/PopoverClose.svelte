<script lang="ts">
import { Close as PrimitiveClose } from '@texuli/primitives/popover';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { popoverCloseClass } from './variants.ts';

type Props = ComponentProps<typeof PrimitiveClose> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();

const classes = $derived(popoverCloseClass({ class: className }));
</script>

<PrimitiveClose bind:ref class={classes} data-tx-popover-close {...rest}>
  {@render children?.()}
</PrimitiveClose>
