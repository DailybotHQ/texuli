<script lang="ts">
import type { RefProp } from '../internal/ref.ts';

let {
  children,
  class: className,
  ref = $bindable(null),
  ...rest
}: RefProp & {
  children?: import('svelte').Snippet;
  class?: string;
  [key: string]: unknown;
} = $props();
</script>

<div bind:this={ref} data-tx-select-viewport="" class={className} {...rest}>
  {@render children?.()}
</div>
