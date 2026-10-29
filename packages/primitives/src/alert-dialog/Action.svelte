<script lang="ts">
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/child.ts';
import type { RefProp } from '../internal/ref.ts';
import { getAlertDialogContext } from './context.ts';

type Props = Omit<HTMLButtonAttributes, 'children'> & {
  children?: import('svelte').Snippet;
  child?: ChildSnippet<Record<string, unknown>>;
} & RefProp;
type ButtonClickEvent = Parameters<NonNullable<HTMLButtonAttributes['onclick']>>[0];

let { children, child, onclick, type = 'button', ref = $bindable(null), ...rest }: Props = $props();
const context = getAlertDialogContext();

function handleClick(event: ButtonClickEvent): void {
  onclick?.(event);
  if (event.defaultPrevented) return;
  context.setOpen(false, event);
}

const actionProps = $derived({
  ...rest,
  type,
  'data-alert-dialog-action': '',
  onclick: handleClick,
});
</script>

{#if child}
  {@render child({ props: actionProps })}
{:else}
  <button bind:this={ref} {...actionProps}>
    {@render children?.()}
  </button>
{/if}
