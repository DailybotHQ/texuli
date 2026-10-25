<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import { type BadgeVariant, chipClass } from './variants.ts';
import './badge.css';

type Props = HTMLButtonAttributes & {
  /** Visible label (required word). */
  label: string;
  variant?: BadgeVariant;
  /** Selected / pressed state for filter chips. */
  selected?: boolean;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

let {
  ref = $bindable(null),
  label,
  variant = 'outline',
  selected = false,
  disabled = false,
  class: className,
  type = 'button',
  ...rest
}: Props = $props();
</script>

<button bind:this={ref}
  {type}
  class={chipClass({ variant, class: className })}
  data-tx-chip
  data-variant={variant}
  data-selected={selected ? 'true' : undefined}
  aria-pressed={selected}
  {disabled}
  {...rest}
>
  {label}
</button>
