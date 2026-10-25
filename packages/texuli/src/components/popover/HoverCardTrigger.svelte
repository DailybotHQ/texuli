<script lang="ts">
import { HoverCardTrigger as PrimitiveTrigger } from '@texuli/primitives/hover-card';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { hoverCardTriggerClass } from './variants.ts';

type Props = ComponentProps<typeof PrimitiveTrigger> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(hoverCardTriggerClass({ class: className }));
</script>

<PrimitiveTrigger class={classes} data-tx-hover-card-trigger {...rest}>
  {@render children?.()}
</PrimitiveTrigger>
