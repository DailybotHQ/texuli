<script lang="ts">
import { CheckboxItem as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { Kbd } from '../kbd-code/index.ts';
import { menuIconClass, menuIndicatorClass, menuItemClass, menuShortcutClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & {
  children?: Snippet<[{ checked: boolean; indeterminate: boolean }]>;
  class?: ClassValue;
  icon?: Snippet;
  shortcut?: string;
};

let {
  children,
  class: className,
  icon,
  shortcut,
  disabled = false,
  checked = $bindable(false),
  indeterminate = $bindable(false),
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  menuItemClass({
    class: className,
    disabled: Boolean(disabled),
  })
);
</script>

<Primitive bind:ref
  class={classes}
  data-tx-menu-checkbox-item
  bind:checked
  bind:indeterminate
  {disabled}
  {...rest}
>
  {#snippet children({ checked: isChecked, indeterminate: isIndeterminate })}
    <span class={menuIndicatorClass()} data-tx-menu-indicator aria-hidden="true">
      {#if isIndeterminate}
        −
      {:else if isChecked}
        ✓
      {/if}
    </span>
    {#if icon}
      <span class={menuIconClass()} aria-hidden="true">{@render icon()}</span>
    {/if}
    <span class="tx-menu-item__label">{@render children?.({ checked: isChecked, indeterminate: isIndeterminate })}</span>
    {#if shortcut}
      <Kbd class={menuShortcutClass()}>{shortcut}</Kbd>
    {/if}
  {/snippet}
</Primitive>
