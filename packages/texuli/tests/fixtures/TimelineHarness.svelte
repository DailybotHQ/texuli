<script lang="ts">
import type { TimelineItemData } from '../../src/components/timeline/index.ts';
import { Timeline, TimelineItem } from '../../src/components/timeline/index.ts';

/** Composition and snippets, which a plain `render(Timeline, …)` cannot express. */
let { mode = 'compose' }: { mode?: 'compose' | 'snippet' } = $props();

const items: TimelineItemData[] = [
  { id: 'kickoff', time: 'Mar 4', title: 'Kickoff', status: 'complete' },
  { id: 'review', time: 'Mar 18', title: 'Design review', status: 'current' },
];
</script>

{#if mode === 'compose'}
  <Timeline label="Release plan" orientation="horizontal">
    <TimelineItem title="Draft" time="Week 1" tone="info" status="complete">
      {#snippet icon()}<span data-testid="custom-icon">★</span>{/snippet}
      <p data-testid="extra">Owner: Ada Example</p>
    </TimelineItem>
    <TimelineItem title="Ship" time="Week 3" status="upcoming" />
  </Timeline>
{:else}
  <Timeline {items}>
    {#snippet item(entry, index)}<small data-testid="meta">#{index + 1} {entry.id}</small>{/snippet}
  </Timeline>
{/if}
