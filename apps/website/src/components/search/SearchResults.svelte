<script lang="ts">
import { onMount } from 'svelte';
import { EVENTS } from '../../lib/analytics.ts';
import { track } from '../../lib/track.ts';
import { withBase } from '../foundation/site.ts';
import { SEARCH_KIND_LABEL } from './index-data.ts';
import { searchSiteIndex } from './search.ts';
import type { SearchHit } from './types.ts';

/** Client island: render `?q=` hits from the static index (static hosts ignore query at build). */

type Props = {
  base?: string;
};

let { base = '/' }: Props = $props();

let query = $state('');
let hits = $state<SearchHit[]>([]);

function readQuery(): void {
  if (typeof location === 'undefined') return;
  const q = new URL(location.href).searchParams.get('q') ?? '';
  query = q;
  hits = q.trim() ? searchSiteIndex(q, { limit: 48 }) : [];
  // A non-empty query is a submitted search, however it arrived here. The
  // query text never leaves the page: only its length and the hit count.
  if (q.trim()) track(EVENTS.SEARCH, { query_length: q.trim().length, results: hits.length });
}

onMount(() => {
  readQuery();
  const onPop = () => readQuery();
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
});
</script>

{#if query.trim()}
  <section class="search-results" aria-label="Results for query" data-tx-search-results="">
    <h2>
      Results for <span data-tx-search-query="">{query}</span>
    </h2>
    {#if hits.length === 0}
      <p role="status">No matches in the static index.</p>
    {:else}
      <ul class="search-results__list">
        {#each hits as hit (hit.id)}
          <li>
            <a href={withBase(base, hit.href)}>
              <span class="kind">{SEARCH_KIND_LABEL[hit.kind]}</span>
              <span class="title">{hit.title}</span>
              <span class="desc">{hit.description}</span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .search-results {
    display: grid;
    gap: 0.75rem;
  }
  .search-results h2 {
    margin: 0;
    color: var(--tx-foreground);
  }
  .search-results__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .search-results__list a {
    display: grid;
    gap: 0.15rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--tx-border);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background);
    color: var(--tx-foreground);
    text-decoration: none;
  }
  .search-results__list a:hover {
    background: var(--tx-muted);
  }
  .search-results__list a:focus-visible {
    outline: 2px solid var(--tx-ring);
    outline-offset: 2px;
  }
  .kind {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .title {
    font-weight: 600;
  }
  .desc {
    font-size: 0.875rem;
  }
</style>
