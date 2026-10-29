import { defineExample } from '../registry.ts';

export const dataCohortExample = defineExample({
  id: 'data-cohort',
  title: 'Cohort retention table',
  description:
    'Monthly retention by signup cohort as a real table: a caption, period column headers, cohort row headers, sizes, size-weighted averages, incomplete and missing cells read aloud, and contrast-safe heat steps. Fictional cohorts.',
  tags: ['data', 'table', 'analytics', 'cohort'],
  component: 'data/cohort',
  props: ['rows', 'periods', 'caption', 'valueKind', 'heat', 'average'],
  load: () => import('./CohortDemo.svelte'),
});
