<script lang="ts">
import { Separator as Primitive } from '@texuli/primitives/menu';
import type { ComponentProps } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { menuSeparatorClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof Primitive> & { class?: ClassValue };

let { class: className, ...rest }: Props = $props();
const classes = $derived(menuSeparatorClass({ class: className }));
</script>

<Primitive class={classes} data-tx-menu-separator {...rest} />
