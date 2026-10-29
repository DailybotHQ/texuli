<script lang="ts">
import { Trigger as PrimitiveTrigger } from '@texuli/primitives/popover';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { popoverTriggerClass } from './variants.ts';

type Props = ComponentProps<typeof PrimitiveTrigger> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();

const classes = $derived(popoverTriggerClass({ class: className }));
</script>

<PrimitiveTrigger bind:ref class={classes} data-tx-popover-trigger {...rest}>
  {@render children?.()}
</PrimitiveTrigger>
