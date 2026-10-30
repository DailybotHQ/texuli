<script lang="ts">
import { NavigationMenu as Primitive } from '@texuli/primitives/navigation-menu';
import type { ComponentProps, Snippet } from 'svelte';
import { type ClassValue } from '../../internal/cx.ts';
import { type NavSize, navigationMenuClass } from './variants.ts';
import './navigation.css';
import { designDefaults, withDefault } from '../../internal/design-defaults.ts';

type Props = ComponentProps<typeof Primitive.Root> & {
  children?: Snippet;
  class?: ClassValue;
  size?: NavSize;
  value?: string;
};

let {
  children,
  class: className,
  size: sizeProp,
  value = $bindable(''),
  onValueChange,
  ref = $bindable(null),
  ...rest
}: Props = $props();
const txDefaults = designDefaults('navigation');
const size = $derived(withDefault(sizeProp, txDefaults().size, 'md'));

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
