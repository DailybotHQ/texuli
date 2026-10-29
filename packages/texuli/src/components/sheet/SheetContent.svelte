<script lang="ts">
import { Sheet as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { type SheetSize, sheetContentClass } from './variants.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Content> & { size?: SheetSize; class?: ClassValue };
let {
  size = 'md',
  side = 'start',
  class: className,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const classes = $derived(cx(sheetContentClass({ size }), className));
</script>

<Primitive.Content bind:ref {...rest} {side} class={classes} data-tx-sheet="" data-size={size} />
