<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type NavSize, navigationMenuClass } from './variants.ts';
import './navigation.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof Primitive.Root> & {
  children?: Snippet;
  class?: ClassValue;
  size?: NavSize;
  value?: string;
};

const txDefaults = designDefaults('navigation');
let {
  children,
  class: className,
  size = txDefaults().size ?? 'md',
  value = $bindable(''),
  onValueChange,
  ref = $bindable(null),
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

<Primitive.Root bind:ref
  class={classes}
  data-size={size}
  bind:value
  onValueChange={handleValueChange}
  {...rest}
>
  {@render children?.()}
</Primitive.Root>
