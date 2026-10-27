<script lang="ts">
import Banner from '../src/components/alert/Banner.svelte';

let el = $state<HTMLElement | null>(null);
</script>

<Banner
  bind:ref={el}
  tone="warning"
  title="Maintenance"
  text="Read-only window begins Friday 02:00 UTC."
/>

<span data-testid="banner-ref-tag">{el?.tagName ?? 'none'}</span>
