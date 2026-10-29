<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { menuGroupContext } from './context.ts';

type Props = RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };

let { children, ref = $bindable(null), ...rest }: Props = $props();
let headingId = $state<string | undefined>();
menuGroupContext.set({
  setHeadingId(id) {
    headingId = id;
  },
});
</script>

<div bind:this={ref} {...rest} role="group" aria-labelledby={headingId}>{@render children?.()}</div>
