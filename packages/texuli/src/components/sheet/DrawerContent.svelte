<script lang="ts">
import { Drawer as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { drawerContentClass, type SheetSize } from './variants.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Content> & { size?: SheetSize; class?: ClassValue };
let {
  size = 'md',
  side = 'end',
  class: className,
  activeSnapPoint = $bindable(),
  ref = $bindable(null),
  ...rest
}: Props = $props();
const classes = $derived(cx(drawerContentClass({ size }), className));
</script>

<Primitive.Content bind:ref {...rest} {side} bind:activeSnapPoint class={classes} data-tx-drawer="" data-size={size} />
