import { defineExample } from '../registry.ts';

export const geoChartsExample = defineExample({
  id: 'charts-geo',
  title: 'Geo charts',
  description:
    'Offline choropleth and point maps using bundled schematic regions, token colors and accessible data tables.',
  tags: ['charts', 'maps', 'choropleth', 'geo'],
  component: 'charts/geo',
  props: ['data', 'points', 'shape'],
  load: () => import('./GeoChartsDemo.svelte'),
});
