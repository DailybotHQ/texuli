<script lang="ts">
import { type Snippet, untrack } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { commandContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, id, ...rest }: Props = $props();
const context = commandContext.get();
// A consumer id wins: the context records it, so the input's aria-controls follows.
context.claimId(
  'list',
  untrack(() => id)
);
$effect(() => {
  context.claimId('list', id);
  return () => context.claimId('list', undefined);
});
const resolvedId = $derived(context.listId);
</script>

<div
  {...rest}
  id={resolvedId}
  role="listbox"
  aria-label={rest['aria-label'] ?? context.label}
  aria-busy={context.loading ? 'true' : undefined}
  data-state={context.loading ? 'loading' : 'ready'}
  data-command-list=""
>
  {@render children?.()}
</div>
