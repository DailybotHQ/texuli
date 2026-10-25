<script lang="ts">
import { SubTrigger as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { menuIconClass, menuItemClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
  icon?: Snippet;
};

let { children, class: className, icon, disabled = false, ...rest }: Props = $props();

const classes = $derived(
  menuItemClass({
    class: className,
    disabled: Boolean(disabled),
  })
);
</script>

<Primitive class={classes} data-tx-menu-sub-trigger {disabled} {...rest}>
  {#if icon}
    <span class={menuIconClass()} aria-hidden="true">{@render icon()}</span>
  {/if}
  <span class="tx-menu-item__label">{@render children?.()}</span>
  <span class="tx-menu-sub-chevron" aria-hidden="true">›</span>
</Primitive>
