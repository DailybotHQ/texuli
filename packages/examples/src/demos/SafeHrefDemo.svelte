<script lang="ts">
import { safeHref } from '@texuli/core';

/**
 * Seed example for the registry: proves `@texuli/core` `safeHref` in the
 * fixture app. Fictional links only (`example.com`).
 */
const samples = [
  { label: 'Documentation', href: 'https://example.com/docs' },
  { label: 'Support mail', href: 'mailto:support@example.com' },
  { label: 'Blocked script', href: 'javascript:alert(1)' },
] as const;
</script>

<section data-example="core-safe-href" aria-labelledby="safe-href-title">
  <h2 id="safe-href-title">safeHref</h2>
  <p>
    Developer and untrusted tiers both reject executable schemes. Safe links
    render as anchors; blocked ones stay plain text.
  </p>
  <ul>
    {#each samples as sample (sample.label)}
      <li>
        {#if safeHref(sample.href)}
          <a href={safeHref(sample.href)} data-safe-link>{sample.label}</a>
        {:else}
          <span data-blocked-link>{sample.label}</span>
        {/if}
      </li>
    {/each}
  </ul>
</section>
