<script lang="ts">
/**
 * Filterable browser of every registered example. Demos lazy-mount on scroll.
 * Page title (h1) is owned by the Astro route — not duplicated here.
 */
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import type { ExampleCatalogItem } from './catalog.ts';
import ExampleCard from './ExampleCard.svelte';
import { filterExampleCatalog } from './filter.ts';

type Props = {
  items: readonly ExampleCatalogItem[];
  packages: readonly string[];
  kinds: readonly string[];
  /** Site base for detail links (with trailing slash handling). */
  base?: string;
  /** Listing cards keep overlays closed/inert (default true). */
  listing?: boolean;
};

let { items, packages, kinds, base = '/', listing = true }: Props = $props();

let query = $state('');
let packageId = $state<string | 'all'>('all');
let kind = $state<string | 'all'>('all');

const filtered = $derived(filterExampleCatalog(items, { query, packageId, kind }));

function detailHref(id: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}examples/${id}/`;
}

function onPackage(next: string | string[]): void {
  if (typeof next !== 'string') return;
  packageId = next === 'all' || packages.includes(next) ? next : 'all';
}

function onKind(next: string | string[]): void {
  if (typeof next !== 'string') return;
  kind = next === 'all' || kinds.includes(next) ? next : 'all';
}
</script>

<section class="browser" data-tx-examples-browser aria-label="Example catalog">
  <p class="summary" role="status">
    {items.length} registered · showing {filtered.length}
    {#if packageId !== 'all'} · package <strong>{packageId}</strong>{/if}
    {#if kind !== 'all'} · kind <strong>{kind}</strong>{/if}
  </p>

  <div class="browser__filters">
    <div class="field grow">
      <label class="label" for="examples-filter">Find an example</label>
      <Input
        id="examples-filter"
        type="search"
        placeholder="Id, title, component, tag…"
        bind:value={query}
        autocomplete="off"
        clearable
        clearLabel="Clear examples filter"
      />
    </div>
    <div class="field">
      <span class="label" id="pkg-filter-label">Package</span>
      <ToggleGroup
        type="single"
        value={packageId}
        onValueChange={onPackage}
        variant="outline"
        size="md"
        aria-labelledby="pkg-filter-label"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        {#each packages as pkg (pkg)}
          <ToggleGroupItem value={pkg}>{pkg}</ToggleGroupItem>
        {/each}
      </ToggleGroup>
    </div>
    <div class="field">
      <span class="label" id="kind-filter-label">Kind</span>
      <ToggleGroup
        type="single"
        value={kind}
        onValueChange={onKind}
        variant="outline"
        size="md"
        aria-labelledby="kind-filter-label"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        {#each kinds.slice(0, 12) as k (k)}
          <ToggleGroupItem value={k}>{k}</ToggleGroupItem>
        {/each}
      </ToggleGroup>
    </div>
  </div>

  <div class="browser__list" role="list">
    {#each filtered as item (item.id)}
      <div role="listitem">
        <ExampleCard {item} detailHref={detailHref(item.id)} {listing} {base} />
      </div>
    {:else}
      <p class="empty" role="status">No examples match the current filters.</p>
    {/each}
  </div>
</section>

<style>
  .browser {
    display: grid;
    gap: 1.25rem;
  }
  .summary {
    margin: 0;
    font-size: 0.95rem;
    color: var(--tx-foreground);
  }
  .browser__filters {
    display: grid;
    gap: 1rem;
    scroll-margin-block-start: 5.5rem;
  }
  .browser__filters :global(.tx-toggle-group) {
    flex-wrap: wrap;
    max-inline-size: 100%;
  }
  .field {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
  }
  .field.grow {
    width: 100%;
  }
  .label {
    font-weight: 600;
    font-size: 0.875rem;
  }
  .browser__list {
    display: grid;
    gap: 1.25rem;
  }
  .empty {
    margin: 1rem 0;
    color: var(--tx-foreground);
  }
  /* WCAG 2.5.8: filter toggles stay at least 24×24 CSS px. */
  .browser :global(.tx-toggle) {
    min-block-size: 1.5rem;
    min-inline-size: 1.5rem;
  }
</style>
