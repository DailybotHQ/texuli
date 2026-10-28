<script lang="ts">
import { Item as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { Kbd } from '../kbd-code/index.ts';
import { menuIconClass, menuItemClass, menuShortcutClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet;
  class?: ClassValue;
  icon?: Snippet;
  shortcut?: string;
  /** Extra start padding when no icon/indicator. */
  inset?: boolean;
  /** A destructive action (delete, remove): the danger tone, marked `data-tone="destructive"`. */
  destructive?: boolean;
};

let {
  children,
  class: className,
  icon,
  shortcut,
  inset = false,
  destructive = false,
  disabled = false,
  ...rest
}: Props = $props();

const classes = $derived(
  menuItemClass({
    class: className,
    disabled: Boolean(disabled),
    inset: inset && !icon,
    destructive,
  })
);
</script>

<Primitive
  class={classes}
  data-tx-menu-item
  data-tone={destructive ? 'destructive' : undefined}
  {disabled}
  {...rest}
>
  {#if icon}
    <span class={menuIconClass()} data-tx-menu-icon aria-hidden="true">{@render icon()}</span>
  {/if}
  <span class="tx-menu-item__label">{@render children?.()}</span>
  {#if shortcut}
    <Kbd class={menuShortcutClass()} data-tx-menu-shortcut>{shortcut}</Kbd>
  {/if}
</Primitive>
