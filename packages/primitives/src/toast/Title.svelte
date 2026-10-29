<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getToastItemContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  children?: Snippet;
} & RefProp;

let { class: className, children, ref = $bindable(null), ...rest }: Props = $props();
const item = getToastItemContext();
</script>

<div bind:this={ref}
  {...rest}
  class={typeof className === 'string' ? className : undefined}
  data-tx-toast-title
>
  {#if children}
    {@render children()}
  {:else}
    {item.toast.title}
  {/if}
</div>
