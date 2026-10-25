import { defineExample } from '../registry.ts';

export const playerDeckExample = defineExample({
  id: 'player-deck',
  title: 'Player: deck fixture view',
  description:
    'The Player paints a fictional four-slide planning deck blueprint (agenda, progress stats, a burn-down chart and a decision callout).',
  tags: ['player', 'deck', 'slides', 'catalog'],
  component: 'player/Player',
  props: ['blueprint', 'label'],
  load: () => import('./DeckDemo.svelte'),
});
