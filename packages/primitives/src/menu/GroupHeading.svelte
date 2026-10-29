<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { menuGroupContext, tryContext } from './context.ts';

type Props = RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };

let { children, id, ref = $bindable(null), ...rest }: Props = $props();
const uid = $props.id();
const headingId = $derived(id ?? `${uid}-heading`);
const group = tryContext(menuGroupContext.get);

$effect(() => {
  group?.setHeadingId(headingId);
  return () => group?.setHeadingId(undefined);
});
</script>

<!-- Names its group (aria-labelledby); not an item, so arrows and typeahead skip it. -->
<div bind:this={ref} {...rest} id={headingId}>{@render children?.()}</div>
