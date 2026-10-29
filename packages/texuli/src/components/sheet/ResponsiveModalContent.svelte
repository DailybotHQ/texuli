<script lang="ts">
import { ResponsiveModal as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { responsiveModalContentClass, type SheetSize } from './variants.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Content> & { size?: SheetSize; class?: ClassValue };
let { size = 'md', class: className, ref = $bindable(null), ...rest }: Props = $props();
const classes = $derived(cx(responsiveModalContentClass({ size }), className));
</script>

<Primitive.Content bind:ref {...rest} class={classes} data-tx-responsive-modal="" data-size={size} />
