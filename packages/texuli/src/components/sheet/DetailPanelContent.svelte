<script lang="ts">
import { Panel as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { detailPanelContentClass, type SheetSize } from './variants.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Content> & { size?: SheetSize; class?: ClassValue };
let { size = 'md', side = 'end', class: className, ...rest }: Props = $props();
const classes = $derived(cx(detailPanelContentClass({ size }), className));
</script>

<Primitive.Content {...rest} {side} class={classes} data-tx-detail-panel="" data-size={size} />
