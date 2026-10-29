<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getToastItemContext } from './context.ts';

type Props = HTMLButtonAttributes & {
  /** Dismiss the toast after the action (default true). */
  altText?: string;
  children?: Snippet;
} & RefProp;

let {
  class: className,
  altText,
  children,
  onclick,
  type = 'button',
  ref = $bindable(null),
  ...rest
}: Props = $props();

const item = getToastItemContext();

function onClick(event: MouseEvent): void {
  onclick?.(event as never);
  if (!event.defaultPrevented) item.dismiss();
}
</script>

<button bind:this={ref}
  {...rest}
  {type}
  class={typeof className === 'string' ? className : undefined}
  data-tx-toast-action
  aria-label={altText}
  onclick={onClick}
>
  {@render children?.()}
</button>
