<script lang="ts">
import { getComboboxContext } from '@texuli/primitives/combobox';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue } from '../../internal/cx.ts';
import { type ComboboxSize, type ComboboxVariant, comboboxFieldClass } from './variants.ts';
import './combobox.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
  children?: Snippet;
  size?: ComboboxSize;
  variant?: ComboboxVariant;
  /** Override the open state; defaults to the combobox context. */
  open?: boolean | undefined;
  disabled?: boolean;
  class?: ClassValue;
};

const txDefaults = designDefaults('combobox');
let {
  children,
  size = txDefaults().size ?? 'md',
  variant = txDefaults().variant ?? 'outline',
  open = undefined,
  disabled = false,
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const context = getComboboxContext();

// Follow the combobox unless the consumer overrides: the docs pattern
// renders <Combobox.Field> bare and still gets the open chrome.
const isOpen = $derived(open ?? context.open);

const classes = $derived(
  comboboxFieldClass({
    size,
    variant,
    class: className,
  })
);
</script>

<div
  bind:this={ref}
  class={classes}
  data-tx-combobox-field
  data-size={size}
  data-variant={variant}
  data-state={isOpen ? 'open' : 'closed'}
  data-disabled={disabled ? '' : undefined}
  {...rest}
>
  {@render children?.()}
</div>
