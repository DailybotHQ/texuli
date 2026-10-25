<script lang="ts">
import { Card, CardDescription, CardGrid, CardHeader, CardTitle } from 'texuli/card';

/**
 * Features: a responsive grid of cards, one per capability.
 * Copy-ready: `texuli add card`, then replace the list.
 */
const features = [
  { title: 'Shift handovers', text: 'A checklist each crew signs before leaving the dock.' },
  { title: 'Incident log', text: 'Timestamped entries with photos, kept in order.' },
  { title: 'Offline first', text: 'Write on the pier without signal; it syncs later.' },
  { title: 'Shared notebooks', text: 'One notebook per vessel, open to the whole crew.' },
  { title: 'Search', text: 'Find any note by vessel, crew member or date.' },
  { title: 'Exports', text: 'Hand a month of logs to the harbor master as a PDF.' },
];
</script>

<section class="features" aria-labelledby="features-title">
  <h3 id="features-title" class="features__title">Everything a crew writes down</h3>
  <CardGrid minItemWidth="14rem">
    {#each features as feature (feature.title)}
      <Card>
        <CardHeader>
          <CardTitle level={4}>{feature.title}</CardTitle>
          <CardDescription>{feature.text}</CardDescription>
        </CardHeader>
      </Card>
    {/each}
  </CardGrid>
</section>

<style>
  .features {
    display: grid;
    gap: 1.25rem;
  }
  .features__title {
    margin: 0;
    font-size: 1.5rem;
  }
</style>
