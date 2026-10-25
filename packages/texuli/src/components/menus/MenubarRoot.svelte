<script lang="ts">
import * as MenubarPrimitive from '@texuli/primitives/menubar';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { menubarRootClass } from './variants.ts';
import './menus.css';

type Props = ComponentProps<typeof MenubarPrimitive.Root> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, value = $bindable(''), ...rest }: Props = $props();

const classes = $derived(menubarRootClass({ class: className }));
</script>

<MenubarPrimitive.Root
  class={classes}
  data-tx-menubar
  bind:value
  {...rest}
>
  {@render children?.()}
</MenubarPrimitive.Root>
