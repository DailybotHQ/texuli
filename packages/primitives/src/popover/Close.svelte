<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { getPopoverContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
} & RefProp;
type ButtonClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];

let { children, child, onclick, type = 'button', ref = $bindable(null), ...rest }: Props = $props();
const context = getPopoverContext();

function handleClick(event: ButtonClickEvent): void {
  onclick?.(event);
  if (event.defaultPrevented) return;
  context.setOpen(false, event);
}

const closeProps = $derived({ ...rest, type, onclick: handleClick });
</script>

{#if child}
  {@render child({ props: closeProps })}
{:else}
  <button bind:this={ref} {...closeProps}>
    {@render children?.()}
  </button>
{/if}
