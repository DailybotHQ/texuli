/** Dashboards landing copy, composed from the shared Solution landing sections. */
import { SOLUTION_SECTION_IDS } from '../../../components/solutions/shared/subnav/sections.ts';
import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const DASHBOARDS_ENTRY = getSolution('dashboards');

export const DASHBOARDS_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Explore a dashboard, then arrange it',
  label: 'Interactive dashboards demo',
  tryThis: [
    'Choose product analytics, support operations or a sales pipeline.',
    'Change the reporting period or clear the Region filter to update the sample KPIs.',
    'Use Move and Resize handles with the keyboard, or drag a widget by its handle.',
  ],
};

const quickstart = {
  title: 'Start with a widget grid',
  install: {
    label: 'Install',
    language: 'bash' as const,
    code: 'pnpm add @texuli/data',
  },
  samples: [
    {
      label: 'Compose a dashboard',
      language: 'svelte' as const,
      code: `<script lang="ts">
  import { Dashboard, DashboardWidget } from '@texuli/data/dashboard';
</script>

<Dashboard label="Operations" editable>
  <DashboardWidget id="revenue" title="Revenue" x={0} y={0} w={6} h={2}>
    <p>$48,290</p>
  </DashboardWidget>
</Dashboard>`,
    },
  ],
  verifiedBy: 'the @texuli/data/dashboard API and the dashboard behavior suite',
};

export const DASHBOARDS_LANDING: SolutionLandingContent = {
  hero: {
    eyebrow: 'Solution · Dashboards',
    title: 'A dashboard that fits the way you work.',
    lede: 'Arrange KPI widgets, compare a reporting period and explore the data with filters. The live board runs on fictional data, entirely in your browser. The metric-card and filter-bar components shown here were released in @texuli/data 0.18.0.',
    ctas: [
      { kind: 'primary', label: 'Explore the dashboard', href: `#${SOLUTION_SECTION_IDS.demo}` },
      { kind: 'secondary', label: 'Start building', href: `#${SOLUTION_SECTION_IDS.quickstart}` },
    ],
  },
  demo: DASHBOARDS_DEMO,
  stories: {
    title: 'One board, several ways to see the work',
    stories: [
      {
        id: 'product-analytics',
        title: 'See product signals together.',
        body: 'Compare active users, activation and retention in one board. The sample responds to the selected date range and region filter.',
        capabilities: ['metrics', 'filters'],
      },
      {
        id: 'support-operations',
        title: 'Spot support pressure early.',
        body: 'Review incoming tickets, first response time and customer satisfaction, then rearrange the widgets to put the urgent signals first.',
        capabilities: ['layout', 'metrics'],
      },
      {
        id: 'sales-pipeline',
        title: 'Keep the pipeline in view.',
        body: 'Read pipeline value, win rate and deal volume together. Move or resize cards using pointer gestures or the keyboard handles.',
        capabilities: ['layout', 'filters'],
      },
    ],
  },
  how: {
    title: 'From sample rows to a board you can arrange.',
    steps: [
      {
        title: 'Choose a view',
        body: 'Select product analytics, support operations or a sales pipeline.',
      },
      {
        title: 'Set the period',
        body: 'Pick a reporting range; the preview scales the fictional sample to that window.',
      },
      {
        title: 'Filter the rows',
        body: 'Apply a Region condition, inspect its chip, or clear filters to restore all sample rows.',
      },
      {
        title: 'Arrange the board',
        body: 'Move and resize each widget with a pointer or the keyboard.',
        package: '@texuli/data',
      },
    ],
  },
  quickstart,
  recipes: {
    title: 'Keep building',
    recipes: [
      {
        title: 'Build a dashboard grid',
        summary: 'Use the widget grid and keyboard handles in your own Svelte view.',
        href: '/dashboards-page/',
      },
      {
        title: 'Read the widget API',
        summary:
          'Start with the released dashboard grid, then use the new controls when they ship to npm.',
        href: '/dashboards-page/',
      },
      {
        title: 'Explore data components',
        summary: 'Compose dashboard widgets with the data package and chart primitives.',
        href: '/dashboards-page/',
      },
    ],
  },
  agents: {
    title: 'For agents',
    body: 'The catalog can describe dashboard layouts as data. The interactive demo itself uses only local fictional rows and does not contact a service.',
    surfaces: [
      {
        label: 'data-dashboard',
        detail: 'Catalog component for a host-rendered dashboard layout.',
        status: 'in development',
      },
      {
        label: 'data-dashboard-widget',
        detail: 'Catalog component for a dashboard widget in a validated blueprint.',
        status: 'in development',
      },
    ],
  },
  platforms: { title: 'Platforms' },
  next: {
    links: [
      { label: 'Build a dashboard', href: DASHBOARDS_ENTRY.docs },
      { label: 'Capability reference', href: '/dashboards-page/' },
      { label: '@texuli/data on npm', href: 'https://www.npmjs.com/package/@texuli/data' },
    ],
  },
};
