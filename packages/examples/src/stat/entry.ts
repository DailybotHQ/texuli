import { defineExample } from '../registry.ts';

export const texuliStatExample = defineExample({
  id: 'texuli-stat',
  title: 'Stat and KPI',
  description:
    'Stat tiles with delta tone and sparkline slot; KPI with unit formatting, previous-period comparison, loading and empty. Fictional Harbor Notes metrics.',
  tags: ['texuli', 'stat', 'kpi', 'a11y'],
  component: 'texuli/Stat',
  props: ['label', 'value', 'delta', 'trend', 'positive', 'unit', 'previous', 'href'],
  load: () => import('./StatDemo.svelte'),
});
