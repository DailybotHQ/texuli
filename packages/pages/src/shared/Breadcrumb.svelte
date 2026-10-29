<script lang="ts">
// The trail to this page (nested pages): every ancestor is a link or a
// button that calls `onNavigate`; the current page is `aria-current="page"`.
import { pageLinkHref } from './media.ts';
import type { PageRef } from './types.ts';

let {
  trail,
  current,
  label,
  onNavigate,
  pageHref,
}: {
  trail: readonly PageRef[];
  current: string;
  label: string;
  onNavigate?: ((ref: string) => void) | undefined;
  pageHref?: ((ref: string) => string | null | undefined) | undefined;
} = $props();

function go(event: MouseEvent, ref: string): void {
  if (!onNavigate) return;
  event.preventDefault();
  onNavigate(ref);
}
</script>

<nav class="tx-pages-breadcrumb" aria-label={label}>
  <ol>
    {#each trail as crumb (crumb.ref)}
      {@const href = pageLinkHref(crumb.ref, pageHref)}
      <li>
        {#if href}
          <a {href} onclick={(event) => go(event, crumb.ref)}>{crumb.title}</a>
        {:else}
          <button type="button" onclick={(event) => go(event, crumb.ref)} disabled={!onNavigate}>{crumb.title}</button>
        {/if}
      </li>
    {/each}
    <li><span aria-current="page">{current}</span></li>
  </ol>
</nav>
