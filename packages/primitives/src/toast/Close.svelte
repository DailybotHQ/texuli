<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { getToastItemContext } from './context.ts';

type Props = HTMLButtonAttributes & {
  children?: Snippet;
};

let { class: className, children, onclick, type = 'button', ...rest }: Props = $props();

const item = getToastItemContext();

function onClick(event: MouseEvent): void {
  onclick?.(event as never);
  if (!event.defaultPrevented) item.dismiss();
}
</script>

<button
  {...rest}
  {type}
  class={typeof className === 'string' ? className : undefined}
  data-tx-toast-close
  aria-label={rest['aria-label'] ?? 'Dismiss notification'}
  onclick={onClick}
>
  {#if children}
    {@render children()}
  {:else}
    ×
  {/if}
</button>
