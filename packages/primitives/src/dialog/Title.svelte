<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { getDialogContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> & {
  children?: import('svelte').Snippet;
};
let { children, id, ...rest }: Props = $props();
const context = getDialogContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'title',
  untrack(() => id)
);
$effect(() => {
  context.claimId('title', id);
  return () => context.claimId('title', undefined);
});
</script>

<h2 {...rest} id={context.titleId}>
  {@render children?.()}
</h2>
