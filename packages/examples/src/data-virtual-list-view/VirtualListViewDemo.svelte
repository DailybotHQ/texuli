<script lang="ts">
import { VirtualListView } from '@texuli/data/virtual-list';

interface Update {
  id: string;
  label: string;
  team: string;
  long: boolean;
}

const TEAMS = ['Docs', 'Design', 'Platform', 'Support'] as const;

// Fictional updates; every fifth one has a longer body, so row heights vary.
const items: Update[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: `update-${index + 1}`,
  label: `Update ${index + 1}`,
  team: TEAMS[index % TEAMS.length] ?? 'Docs',
  long: index % 5 === 0,
}));

let selected = $state<string | number | undefined>();
const chosen = $derived(items.find((item) => item.id === selected));
</script>

<section data-example="data-virtual-list-view" aria-labelledby="data-virtual-list-view-title">
  <h2 id="data-virtual-list-view-title">Team feed</h2>
  <p>
    10,000 updates, about 15 in the page at a time. Tab into the list, then use the arrow keys,
    Home, End, Page Up and Page Down; Enter selects.
  </p>
  <VirtualListView {items} label="Team feed" bind:selected estimateSize={56} size="md">
    {#snippet row({ item })}
      <strong>{item.label}</strong>
      <span class="feed-team">{item.team} · example.com</span>
      {#if item.long}
        <span class="feed-body">
          A longer note: the list measures this row as it renders, so the scroll position stays
          steady.
        </span>
      {/if}
    {/snippet}
  </VirtualListView>
  <p aria-live="polite">{chosen ? `Selected: ${chosen.label}` : 'Nothing selected yet.'}</p>
</section>

<style>
  section[data-example='data-virtual-list-view'] {
    display: grid;
    gap: var(--tx-space-3);
    max-inline-size: 40rem;
  }

  .feed-team,
  .feed-body {
    color: var(--tx-muted-foreground, GrayText);
  }

  :global([aria-selected='true']) .feed-team,
  :global([aria-selected='true']) .feed-body {
    color: inherit;
  }
</style>
