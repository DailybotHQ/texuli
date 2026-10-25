<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { type ComboboxSize, type ComboboxVariant, comboboxFieldClass } from './variants.ts';
import './combobox.css';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  children?: Snippet;
  size?: ComboboxSize;
  variant?: ComboboxVariant;
  open?: boolean;
  disabled?: boolean;
  class?: ClassValue;
};

let {
  children,
  size = 'md',
  variant = 'outline',
  open = false,
  disabled = false,
  class: className,
  ...rest
}: Props = $props();

const classes = $derived(
  comboboxFieldClass({
    size,
    variant,
    class: className,
  })
);
</script>

<div
  class={classes}
  data-tx-combobox-field
  data-size={size}
  data-variant={variant}
  data-state={open ? 'open' : 'closed'}
  data-disabled={disabled ? '' : undefined}
  {...rest}
>
  {@render children?.()}
</div>
