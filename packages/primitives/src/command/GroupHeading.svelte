<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import { commandGroupContext } from './context.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, ...rest }: Props = $props();
const group = commandGroupContext.get();
</script>

<div
  {...rest}
  id={rest.id ?? group.headingId}
  aria-hidden="true"
  data-command-group-heading=""
>
  {@render children?.()}
</div>
