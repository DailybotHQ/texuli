<script lang="ts">
import { Sheet as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Overlay> & { class?: ClassValue };
let { class: className, ref = $bindable(null), ...rest }: Props = $props();
</script>

<Primitive.Overlay bind:ref {...rest} class={cx('tx-sheet-overlay', className)} data-tx-sheet-overlay="" />
