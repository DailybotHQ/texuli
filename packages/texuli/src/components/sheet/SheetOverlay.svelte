<script lang="ts">
import { Sheet as Primitive } from '@texuli/primitives/sheet';
import type { ComponentProps } from 'svelte';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './sheet.css';

type Props = ComponentProps<typeof Primitive.Overlay> & { class?: ClassValue };
let { class: className, ...rest }: Props = $props();
</script>

<Primitive.Overlay {...rest} class={cx('tx-sheet-overlay', className)} data-tx-sheet-overlay="" />
