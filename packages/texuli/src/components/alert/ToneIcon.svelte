<script lang="ts">
import type { AlertTone } from './tones.ts';

/** Simple built-in glyphs so the package stays free of icon libraries. */
let { tone = 'info' }: { tone?: AlertTone } = $props();
</script>

{#if tone === 'success'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
{:else if tone === 'warning'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path d="M12 3 2 21h20L12 3Z" stroke-linejoin="round" />
    <path d="M12 10v5" stroke-linecap="round" />
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
  </svg>
{:else if tone === 'error'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" stroke-linecap="round" />
    <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
  </svg>
{:else if tone === 'brand'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <path
      d="m12 3 2.1 5.1L20 9l-4 3.6L17.2 18 12 15.2 6.8 18 8 12.6 4 9l5.9-.9L12 3Z"
      stroke-linejoin="round"
    />
  </svg>
{:else if tone === 'neutral'}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" stroke-linecap="round" />
  </svg>
{:else}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6" stroke-linecap="round" />
    <circle cx="12" cy="8" r="1" fill="currentColor" stroke="none" />
  </svg>
{/if}
