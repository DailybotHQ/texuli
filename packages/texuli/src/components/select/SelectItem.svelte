<script lang="ts">
import { Item as PrimitiveItem } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { selectDescriptionClass, selectIconClass, selectItemClass } from './variants.ts';

type Props = ComponentProps<typeof PrimitiveItem> & {
  children?: Snippet;
  class?: ClassValue;
  /** Optional leading icon snippet. */
  icon?: Snippet;
  /** Secondary line under the label. */
  description?: string;
};

let {
  children,
  class: className,
  icon,
  description,
  disabled = false,
  label,
  value,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(
  selectItemClass({
    class: className,
    disabled: Boolean(disabled),
  })
);
</script>

<PrimitiveItem bind:ref
  class={classes}
  data-tx-select-item
  {value}
  {label}
  {disabled}
  {...rest}
>
  <span class="tx-select-item__check" aria-hidden="true">
    <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
      <path
        d="M3.5 8.25 6.75 11.5 12.5 4.75"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
  {#if icon}
    <span class={selectIconClass()}>
      {@render icon()}
    </span>
  {/if}
  <span class="tx-select-item__body">
    <span class="tx-select-item__label">
      {#if children}
        {@render children()}
      {:else}
        {label ?? value}
      {/if}
    </span>
    {#if description}
      <p class={selectDescriptionClass()}>{description}</p>
    {/if}
  </span>
</PrimitiveItem>
