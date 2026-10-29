<script lang="ts">
import { ContextMenu } from '@texuli/primitives/context-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { contextTriggerClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof ContextMenu.Trigger> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();
const classes = $derived(contextTriggerClass({ class: className }));
</script>

<ContextMenu.Trigger bind:ref class={classes} data-tx-context-menu-trigger {...rest}>
  {@render children?.()}
</ContextMenu.Trigger>
