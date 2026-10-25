<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { menuGroupContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };

let { children, ...rest }: Props = $props();
let headingId = $state<string | undefined>();
menuGroupContext.set({
  setHeadingId(id) {
    headingId = id;
  },
});
</script>

<div {...rest} role="group" aria-labelledby={headingId}>{@render children?.()}</div>
