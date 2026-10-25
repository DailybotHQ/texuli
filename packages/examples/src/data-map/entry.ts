import { defineExample } from '../registry.ts';

export const dataMapExample = defineExample({
  id: 'data-map',
  title: 'Offline map',
  description:
    'Fictional vector basemap with clustered locations, a synchronized list, keyboard controls and no network tiles.',
  tags: ['data', 'map', 'geo', 'offline', 'keyboard', 'rtl'],
  component: 'data/map',
  props: [
    'basemap',
    'markers',
    'routes',
    'fences',
    'selectedId',
    'direction',
    'cellPx',
    'listPlacement',
    'label',
    'onSelect',
    'onPick',
    'onViewChange',
    'shape',
    'glyph',
    'tone',
  ],
  load: () => import('./MapDemo.svelte'),
});
