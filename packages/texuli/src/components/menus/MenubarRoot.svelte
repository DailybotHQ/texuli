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

let {
  children,
  class: className,
  value = $bindable(''),
  ref = $bindable(null),
  ...rest
}: Props = $props();

const classes = $derived(menubarRootClass({ class: className }));
</script>

<MenubarPrimitive.Root bind:ref
  class={classes}
  data-tx-menubar
  bind:value
  {...rest}
>
  {@render children?.()}
</MenubarPrimitive.Root>
