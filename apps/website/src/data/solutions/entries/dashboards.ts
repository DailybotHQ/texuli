import type { SolutionEntry } from '../schema.ts';

/** Dashboards: widget grids from @texuli/data (ADR-036). In development. */
export const dashboards: SolutionEntry = {
  slug: 'dashboards',
  name: 'Dashboards',
  status: 'in development',
  tagline: 'KPI boards people arrange, from the keyboard too.',
  summary:
    'A widget grid with pointer and keyboard moves and resizes, filters and a date range, on @texuli/data/dashboard. Pre-1.0: the date-range, filter-bar and metric-card pieces the landing needs are still landing.',
  route: '/solutions/dashboards/',
  docs: '/guides/solutions/dashboards/',
  packages: [
    {
      name: '@texuli/data',
      subpaths: ['./dashboard', './dashboard/engine', './filter-builder'],
      role: 'Dashboard grid, layout engine and filter builder',
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
      summary: 'Filter the board and pick a date range. The dedicated controls are still landing.',
      status: 'in development',
    },
    {
      id: 'metrics',
      title: 'KPI widgets',
      summary: 'Show metrics on the grid. A shared metric-card component is still landing.',
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
    scenarios: ['kpi-board'],
    limits: ['Placeholder until the Dashboards landing demo ships. Nothing is saved.'],
  },
  art: { hero: { slot: 'solution-dashboards-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'The date-range, filter-bar and metric-card components the Solution needs are not complete yet.',
    '/dashboards-page/ stays as the capability reference; it is not redirected (ADR-036).',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/dashboards/' },
    { label: 'Capability page (reference)', href: '/dashboards-page/' },
    { label: '@texuli/data on npm', href: 'https://www.npmjs.com/package/@texuli/data' },
  ],
};
