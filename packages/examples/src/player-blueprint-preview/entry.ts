import { defineExample } from '../registry.ts';

export const playerBlueprintPreviewExample = defineExample({
  id: 'player-blueprint-preview',
  title: 'Player: blueprint preview',
  description:
    'The Player paints a fictional weekly report blueprint (document layout, KPIs, a chart and a callout) at the untrusted tier, with its trust badge.',
  tags: ['player', 'blueprint', 'catalog'],
  component: 'player/Player',
  props: ['blueprint', 'label'],
  load: () => import('./BlueprintPreviewDemo.svelte'),
});
