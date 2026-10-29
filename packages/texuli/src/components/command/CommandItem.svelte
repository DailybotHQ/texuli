<script lang="ts">
import { Item as PrimitiveItem } from '@texuli/primitives/command';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import type { RefProp } from '../../internal/ref.ts';
import { commandItemClass } from './variants.ts';
import './command.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'value'> & {
  children?: Snippet;
  value: string;
  label?: string;
  description?: string;
  keywords?: readonly string[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
  /** Hide the leading icon. */
  hideIcon?: boolean;
  class?: ClassValue;
};

let {
  children,
  value,
  label,
  description,
  keywords = [],
  disabled = false,
  onSelect,
  hideIcon = false,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props & RefProp = $props();

const classes = $derived(
  commandItemClass({
    disabled,
    class: className,
  })
);
const text = $derived(label ?? value);
</script>

<PrimitiveItem bind:ref
  class={classes}
  data-tx-command-item
  {value}
  label={text}
  {keywords}
  {disabled}
  {onSelect}
  {...rest}
>
  {#if !hideIcon}
    <svg
      class="tx-command__item-icon"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
      />
      <path
        d="M5 8h6M8 5v6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
      />
    </svg>
  {/if}
  <span class="tx-command__item-body">
    {#if children}
      {@render children()}
    {:else}
      <span class="tx-command__item-label">{text}</span>
      {#if description}
        <span class="tx-command__item-description">{description}</span>
      {/if}
    {/if}
  </span>
</PrimitiveItem>
