<script lang="ts">
import {
  Root as PrimitiveRoot,
  type ComboboxRootProps as PrimitiveRootProps,
} from '@texuli/primitives/combobox';
import type { Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type ComboboxSize, type ComboboxVariant, comboboxRootClass } from './variants.ts';
import './combobox.css';

type Props = PrimitiveRootProps & {
  children?: Snippet;
  size?: ComboboxSize;
  variant?: ComboboxVariant;
  class?: ClassValue;
};

let {
  children,
  multiple = false,
  open = $bindable(false),
  value = $bindable(),
  inputValue = $bindable(),
  size = 'md',
  variant = 'outline',
  class: className,
  ...rest
}: Props = $props();

const classes = $derived(
  comboboxRootClass({
    multiple,
    class: className,
  })
);
</script>

<div
  class={classes}
  data-tx-combobox-root
  data-size={size}
  data-variant={variant}
  data-multiple={multiple ? 'true' : undefined}
>
  <PrimitiveRoot bind:open bind:value bind:inputValue {multiple} {...rest}>
    {@render children?.()}
  </PrimitiveRoot>
</div>
