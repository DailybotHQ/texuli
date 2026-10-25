<script lang="ts">
import { Content as PrimitiveContent } from '@texuli/primitives/select';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type SelectSize, selectContentClass } from './variants.ts';
import './select.css';

type Props = ComponentProps<typeof PrimitiveContent> & {
  children?: Snippet;
  class?: ClassValue;
  size?: SelectSize;
};

let { children, class: className, size = 'md', ...rest }: Props = $props();

const classes = $derived(
  selectContentClass({
    size,
    class: className,
  })
);
</script>

<PrimitiveContent class={classes} data-tx-select-content data-size={size} {...rest}>
  {@render children?.()}
</PrimitiveContent>
