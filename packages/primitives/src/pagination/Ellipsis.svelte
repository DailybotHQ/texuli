<script lang="ts">
import type { HTMLAttributes } from 'svelte/elements';
import type { RefProp } from '../internal/ref.ts';

let {
  class: className,
  ref = $bindable(null),
  ...rest
}: Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & RefProp = $props();
</script>

<span bind:this={ref} {...rest} aria-hidden="true" data-state="inactive" class={className}>…</span>
