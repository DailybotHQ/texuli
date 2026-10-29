<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getDialogContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> & {
  children?: import('svelte').Snippet;
} & RefProp;
let { children, id, ref = $bindable(null), ...rest }: Props = $props();
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

<h2 bind:this={ref} {...rest} id={context.titleId}>
  {@render children?.()}
</h2>
