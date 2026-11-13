import type { SolutionEntry } from '../schema.ts';

/** Dashboards: widget grids from @texuli/data (ADR-036). In development. */
export const dashboards: SolutionEntry = {
  slug: 'dashboards',
  name: 'Dashboards',
  status: 'in development',
  tagline: 'KPI boards people arrange, from the keyboard too.',
  summary:
    'A responsive widget grid with pointer and keyboard layout controls. The dashboard grid, FilterBar and MetricCard are in @texuli/data@0.18.0 (FilterBar and MetricCard since 0.18.0), in development.',
  route: '/solutions/dashboards/',
  docs: '/guides/solutions/dashboards/',
  packages: [
    {
      name: '@texuli/data',
      subpaths: ['./dashboard', './dashboard/engine', './filter-builder', './filter-bar'],
      role: 'Dashboard grid, layout engine, filter builder and filter bar',
    },
  ],
  capabilities: [
    {
      id: 'layout',
      title: 'Arrange widgets',
      summary: 'Move and resize widgets with pointer or keyboard, with announced steps.',
      status: 'in development',
    },
    {
      id: 'filters',
      title: 'Filters and date range',
      summary:
        'Filter controls are in development; the FilterBar addition needs a later @texuli/data release.',
      status: 'in development',
    },
    {
      id: 'metrics',
      title: 'KPI widgets',
      summary:
        'The dashboard grid is published; the shared MetricCard addition is in development and needs a later @texuli/data release.',
      status: 'in development',
    },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'compose-desktop', status: 'planned', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'dashboards',
    title: 'Arrange a KPI board',
    scenarios: ['product-analytics', 'support-ops', 'sales-pipeline'],
    limits: [
      'Uses fictional browser-local sample data; it makes no network requests and saves no layout or filters.',
      'FilterBar and MetricCard were released in @texuli/data 0.18.0; earlier releases do not have them.',
    ],
  },
  art: { hero: { slot: 'solution-dashboards-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'FilterBar and MetricCard were released in 0.18.0 and are in development.',
    '/dashboards-page/ stays as the capability reference; it is not redirected (ADR-036).',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/dashboards/' },
    { label: 'Capability page (reference)', href: '/dashboards-page/' },
    { label: '@texuli/data on npm', href: 'https://www.npmjs.com/package/@texuli/data' },
  ],
};
