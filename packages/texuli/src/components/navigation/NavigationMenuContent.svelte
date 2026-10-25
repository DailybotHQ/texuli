<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { navigationMenuContentClass } from './variants.ts';

type Props = ComponentProps<typeof Primitive.Content> & {
  children?: Snippet;
  class?: ClassValue;
};

let { children, class: className, ...rest }: Props = $props();

const classes = $derived(
  navigationMenuContentClass({
    class: className,
  })
);
</script>

<!-- Primitive Content only accepts class + children; wrap for host data hooks. -->
<div data-tx-nav-menu-content class="tx-nav-menu__content-host">
  <Primitive.Content class={classes} {...rest}>
    {@render children?.()}
  </Primitive.Content>
</div>
