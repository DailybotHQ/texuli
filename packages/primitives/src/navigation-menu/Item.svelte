<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLLiAttributes } from 'svelte/elements';
import { navigationMenuContext, navigationMenuItemContext } from './context.ts';

type ItemProps = HTMLLiAttributes & {
  /** Identifies the item; generated when omitted. */
  value?: string;
  children?: Snippet;
};

let { value, children, ...rest }: ItemProps = $props();
const generated = $props.id();
const context = navigationMenuContext.get();
const itemValue = $derived(value ?? generated);
navigationMenuItemContext.set({
  get value() {
    return itemValue;
  },
});

$effect(() => context.register(itemValue));
</script>

<li data-state={context.value === itemValue ? 'open' : 'closed'} {...rest}>
  {@render children?.()}
</li>
