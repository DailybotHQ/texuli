<script lang="ts">
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
// The site's builder island, captured standalone (Task 77): the fixture app is
// tests, not a shipped package, so it may mount website code directly.
import BuilderApp from '../../../../apps/website/src/components/builder/BuilderApp.svelte';

let { seeded = false }: { seeded?: boolean } = $props();

/** A fictional weekly report: heading, a list (selected, so the inspector shows it), a card and a gauge. */
const draft: CatalogTreeInput = {
  id: 'layout-page',
  props: { title: 'Harbor weekly report' },
  children: [
    { id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'This week' } } },
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'list',
          items: [{ text: 'Three fictional deliveries' }, { text: 'North pier repainted' }],
        },
      },
    },
    {
      id: 'layout-card',
      props: { title: 'Summary' },
      children: [
        {
          id: 'blocks-text',
          props: { block: { type: 'text', markdown: 'All **38** items closed.' } },
        },
      ],
    },
    { id: 'charts-gauge', props: { label: 'Berths in use', value: 72 } },
  ],
};
</script>

{#if seeded}
  <BuilderApp initial={draft} initialSelection={[1]} />
{:else}
  <BuilderApp />
{/if}
