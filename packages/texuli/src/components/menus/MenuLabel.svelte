<script lang="ts">
import { GroupHeading as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { menuLabelClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ref = $bindable(null), ...rest }: Props = $props();
const classes = $derived(menuLabelClass({ class: className }));
</script>

<Primitive bind:ref class={classes} data-tx-menu-label {...rest}>{@render children?.()}</Primitive>
