<script lang="ts">
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';
import { commandGroupContext } from './context.ts';

type Props = RefProp & Omit<HTMLAttributes<HTMLDivElement>, 'children'> & { children?: Snippet };
let { children, ref = $bindable(null), ...rest }: Props = $props();
const group = commandGroupContext.get();
</script>

<div bind:this={ref}
  {...rest}
  id={rest.id ?? group.headingId}
  aria-hidden="true"
  data-command-group-heading=""
>
  {@render children?.()}
</div>
