<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLLabelAttributes } from 'svelte/elements';
import { type ChildSnippet, composeChildProps } from '../internal/child.ts';
import { shouldPreventLabelSelection } from './attributes.ts';

/**
 * Label: a native `<label>` (or the `child` snippet's element). `for` names
 * the control, or the control sits inside. Clicking or tapping it focuses or
 * activates the control natively; a double-click does not select its text.
 */
type LabelRootProps = HTMLLabelAttributes & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
};

let { child, children, ...rest }: LabelRootProps = $props();

const baseProps = {
  onmousedown: (event: MouseEvent) => {
    if (shouldPreventLabelSelection(event)) event.preventDefault();
  },
};
const labelProps = $derived(composeChildProps(baseProps, rest as Partial<typeof baseProps>));
</script>

{#if child}
  {@render child({ props: labelProps })}
{:else}
  <label {...labelProps}>{@render children?.()}</label>
{/if}
