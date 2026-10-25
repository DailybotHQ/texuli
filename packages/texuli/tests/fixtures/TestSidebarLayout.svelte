<script lang="ts">
import type { LayoutProps } from '../../src/layouts/host/registry.ts';

let { mountScreen }: LayoutProps = $props();
let target = $state<HTMLElement | undefined>();

$effect(() => {
  if (target) mountScreen(target);
});
</script>

<div data-test-layout="sidebar"><main bind:this={target}></main></div>
