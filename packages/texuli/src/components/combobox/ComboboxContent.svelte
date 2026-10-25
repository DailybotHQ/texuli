<script lang="ts">
import { Content as PrimitiveContent } from '@texuli/primitives/combobox';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type ComboboxSize, comboboxContentClass } from './variants.ts';
import './combobox.css';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  size?: ComboboxSize;
  class?: ClassValue;
};

let { children, class: className, size = 'md', ...rest }: Props = $props();

const classes = $derived(
  comboboxContentClass({
    size,
    class: className,
  })
);
</script>

<PrimitiveContent class={classes} data-tx-combobox-content data-size={size} {...rest}>
  {@render children?.()}
</PrimitiveContent>
