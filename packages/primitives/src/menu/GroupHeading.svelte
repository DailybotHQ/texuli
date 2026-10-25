<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { menuGroupContext, tryContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };

let { children, id, ...rest }: Props = $props();
const uid = $props.id();
const headingId = $derived(id ?? `${uid}-heading`);
const group = tryContext(menuGroupContext.get);

$effect(() => {
  group?.setHeadingId(headingId);
  return () => group?.setHeadingId(undefined);
});
</script>

<!-- Names its group (aria-labelledby); not an item, so arrows and typeahead skip it. -->
<div {...rest} id={headingId}>{@render children?.()}</div>
