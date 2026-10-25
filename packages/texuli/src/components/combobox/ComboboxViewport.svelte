<script lang="ts">
import { type ComboboxItemData, Viewport as PrimitiveViewport } from '@texuli/primitives/combobox';
import type { Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import './combobox.css';

type Props = {
  children?: Snippet<[item: ComboboxItemData]>;
  itemSize?: number;
  windowSize?: number;
  class?: ClassValue;
};

let { children: renderItem, itemSize, windowSize, class: className, ...rest }: Props = $props();
</script>

<PrimitiveViewport
  class={className}
  data-tx-combobox-viewport
  {itemSize}
  {windowSize}
  {...rest}
>
  {#snippet children(item)}
    {@render renderItem?.(item)}
  {/snippet}
</PrimitiveViewport>
