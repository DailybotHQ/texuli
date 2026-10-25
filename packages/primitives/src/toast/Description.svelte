<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getToastItemContext } from './context.ts';

type Props = HTMLAttributes<HTMLDivElement> & {
  children?: Snippet;
};

let { class: className, children, ...rest }: Props = $props();
const item = getToastItemContext();
</script>

<div
  {...rest}
  class={typeof className === 'string' ? className : undefined}
  data-tx-toast-description
>
  {#if children}
    {@render children()}
  {:else}
    {item.toast.description}
  {/if}
</div>
