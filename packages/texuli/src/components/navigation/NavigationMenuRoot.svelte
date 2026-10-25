<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type NavSize, navigationMenuClass } from './variants.ts';
import './navigation.css';

type Props = ComponentProps<typeof Primitive.Root> & {
  children?: Snippet;
  class?: ClassValue;
  size?: NavSize;
  value?: string;
};

let {
  children,
  class: className,
  size = 'md',
  value = $bindable(''),
  onValueChange,
  ...rest
}: Props = $props();

const classes = $derived(
  navigationMenuClass({
    size,
    class: className,
  })
);

function handleValueChange(next: string): void {
  value = next;
  onValueChange?.(next);
}
</script>

<Primitive.Root
  class={classes}
  data-size={size}
  bind:value
  onValueChange={handleValueChange}
  {...rest}
>
  {@render children?.()}
</Primitive.Root>
