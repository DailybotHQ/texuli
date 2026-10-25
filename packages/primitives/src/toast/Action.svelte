<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import { getToastItemContext } from './context.ts';

type Props = HTMLButtonAttributes & {
  /** Dismiss the toast after the action (default true). */
  altText?: string;
  children?: Snippet;
};

let { class: className, altText, children, onclick, type = 'button', ...rest }: Props = $props();

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
  data-tx-toast-action
  aria-label={altText}
  onclick={onClick}
>
  {@render children?.()}
</button>
