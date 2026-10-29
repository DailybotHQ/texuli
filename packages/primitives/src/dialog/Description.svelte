<script lang="ts">
import { untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { getDialogContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLParagraphElement>, 'children'> & {
  children?: import('svelte').Snippet;
} & RefProp;
let { children, id, ref = $bindable(null), ...rest }: Props = $props();
const context = getDialogContext();
// A consumer id wins: the context records it, so every reference follows.
context.claimId(
  'description',
  untrack(() => id)
);
$effect(() => {
  context.claimId('description', id);
  return () => context.claimId('description', undefined);
});
// Content points `aria-describedby` here only while this part is mounted.
context.setHasDescription(true);
$effect(() => () => context.setHasDescription(false));
</script>

<p bind:this={ref} {...rest} id={context.descriptionId}>
  {@render children?.()}
</p>
