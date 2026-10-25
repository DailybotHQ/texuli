<script lang="ts">
import type { Trend } from './trend.ts';

type Props = {
  trend: Trend;
};

let { trend }: Props = $props();
</script>

{#if trend === 'up'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M3 17l6-6 4 4 7-7" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14 8h6v6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{:else if trend === 'down'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M3 7l6 6 4-4 7 7" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M14 16h6v-6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{:else}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M5 12h14" stroke-linecap="round" />
  </svg>
{/if}
