<script lang="ts">
let {
  children,
  class: className,
  ...rest
}: {
  children?: import('svelte').Snippet;
  class?: string;
  [key: string]: unknown;
} = $props();
</script>

<div data-tx-select-viewport="" class={className} {...rest}>
  {@render children?.()}
</div>
