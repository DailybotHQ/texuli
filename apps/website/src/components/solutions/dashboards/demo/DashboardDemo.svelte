<script lang="ts">
import { Sparkline } from '@texuli/charts/sparkline-lite';
import {
  Dashboard,
  type DashboardLayout,
  DashboardWidget,
  MetricCard,
} from '@texuli/data/dashboard';
import { FilterBar } from '@texuli/data/filter-bar';
import { applyFilter, type FilterField, type FilterGroup } from '@texuli/data/filter-builder';
import { DateRangePicker } from 'texuli/date';

type ScenarioId = 'product-analytics' | 'support-ops' | 'sales-pipeline';
type MetricKey =
  | 'users'
  | 'activation'
  | 'retention'
  | 'tickets'
  | 'replyMinutes'
  | 'satisfaction'
  | 'pipeline'
  | 'winRate'
  | 'deals'
  | 'cycleDays';
type Format = 'integer' | 'percent' | 'currency' | 'minutes' | 'days';

interface RecordRow {
  id: string;
  region: string;
  channel: string;
  users: number;
  activation: number;
  retention: number;
  tickets: number;
  replyMinutes: number;
  satisfaction: number;
  pipeline: number;
  winRate: number;
  deals: number;
  cycleDays: number;
}

interface MetricDefinition {
  id: string;
  title: string;
  key: MetricKey;
  format: Format;
  aggregation: 'sum' | 'average';
  trend: 'up' | 'down' | 'flat';
  change: string;
}

interface Scenario {
  id: ScenarioId;
  label: string;
  description: string;
  rows: readonly RecordRow[];
  metrics: readonly MetricDefinition[];
}

const scenarios: readonly Scenario[] = [
  {
    id: 'product-analytics',
    label: 'Product analytics',
    description: 'Activation and returning users across fictional product regions.',
    rows: [
      {
        id: 'pa-1',
        region: 'North',
        channel: 'Web',
        users: 1840,
        activation: 0.42,
        retention: 0.31,
        tickets: 34,
        replyMinutes: 18,
        satisfaction: 0.94,
        pipeline: 82000,
        winRate: 0.28,
        deals: 8,
        cycleDays: 24,
      },
      {
        id: 'pa-2',
        region: 'South',
        channel: 'Web',
        users: 1320,
        activation: 0.38,
        retention: 0.29,
        tickets: 27,
        replyMinutes: 22,
        satisfaction: 0.91,
        pipeline: 63000,
        winRate: 0.24,
        deals: 6,
        cycleDays: 29,
      },
      {
        id: 'pa-3',
        region: 'West',
        channel: 'Mobile',
        users: 2160,
        activation: 0.47,
        retention: 0.35,
        tickets: 41,
        replyMinutes: 16,
        satisfaction: 0.96,
        pipeline: 104000,
        winRate: 0.32,
        deals: 11,
        cycleDays: 21,
      },
      {
        id: 'pa-4',
        region: 'North',
        channel: 'Mobile',
        users: 1510,
        activation: 0.44,
        retention: 0.34,
        tickets: 30,
        replyMinutes: 20,
        satisfaction: 0.93,
        pipeline: 76000,
        winRate: 0.27,
        deals: 7,
        cycleDays: 26,
      },
      {
        id: 'pa-5',
        region: 'South',
        channel: 'Partner',
        users: 980,
        activation: 0.35,
        retention: 0.26,
        tickets: 23,
        replyMinutes: 25,
        satisfaction: 0.89,
        pipeline: 49000,
        winRate: 0.21,
        deals: 5,
        cycleDays: 32,
      },
      {
        id: 'pa-6',
        region: 'West',
        channel: 'Web',
        users: 1760,
        activation: 0.45,
        retention: 0.33,
        tickets: 36,
        replyMinutes: 17,
        satisfaction: 0.95,
        pipeline: 91000,
        winRate: 0.3,
        deals: 9,
        cycleDays: 23,
      },
    ],
    metrics: [
      {
        id: 'active-users',
        title: 'Active users',
        key: 'users',
        format: 'integer',
        aggregation: 'sum',
        trend: 'up',
        change: '8.4%',
      },
      {
        id: 'activation',
        title: 'Activation rate',
        key: 'activation',
        format: 'percent',
        aggregation: 'average',
        trend: 'up',
        change: '2.1 pts',
      },
      {
        id: 'retention',
        title: 'Returning users',
        key: 'retention',
        format: 'percent',
        aggregation: 'average',
        trend: 'flat',
        change: '0.3 pts',
      },
      {
        id: 'product-tickets',
        title: 'Support tickets',
        key: 'tickets',
        format: 'integer',
        aggregation: 'sum',
        trend: 'down',
        change: '5.2%',
      },
    ],
  },
  {
    id: 'support-ops',
    label: 'Support operations',
    description: 'Ticket load, response time and satisfaction by support region.',
    rows: [
      {
        id: 'so-1',
        region: 'North',
        channel: 'Web',
        users: 1840,
        activation: 0.42,
        retention: 0.31,
        tickets: 58,
        replyMinutes: 14,
        satisfaction: 0.96,
        pipeline: 82000,
        winRate: 0.28,
        deals: 8,
        cycleDays: 24,
      },
      {
        id: 'so-2',
        region: 'South',
        channel: 'Web',
        users: 1320,
        activation: 0.38,
        retention: 0.29,
        tickets: 74,
        replyMinutes: 23,
        satisfaction: 0.89,
        pipeline: 63000,
        winRate: 0.24,
        deals: 6,
        cycleDays: 29,
      },
      {
        id: 'so-3',
        region: 'West',
        channel: 'Mobile',
        users: 2160,
        activation: 0.47,
        retention: 0.35,
        tickets: 49,
        replyMinutes: 11,
        satisfaction: 0.97,
        pipeline: 104000,
        winRate: 0.32,
        deals: 11,
        cycleDays: 21,
      },
      {
        id: 'so-4',
        region: 'North',
        channel: 'Mobile',
        users: 1510,
        activation: 0.44,
        retention: 0.34,
        tickets: 63,
        replyMinutes: 17,
        satisfaction: 0.93,
        pipeline: 76000,
        winRate: 0.27,
        deals: 7,
        cycleDays: 26,
      },
      {
        id: 'so-5',
        region: 'South',
        channel: 'Partner',
        users: 980,
        activation: 0.35,
        retention: 0.26,
        tickets: 82,
        replyMinutes: 28,
        satisfaction: 0.86,
        pipeline: 49000,
        winRate: 0.21,
        deals: 5,
        cycleDays: 32,
      },
      {
        id: 'so-6',
        region: 'West',
        channel: 'Web',
        users: 1760,
        activation: 0.45,
        retention: 0.33,
        tickets: 44,
        replyMinutes: 12,
        satisfaction: 0.98,
        pipeline: 91000,
        winRate: 0.3,
        deals: 9,
        cycleDays: 23,
      },
    ],
    metrics: [
      {
        id: 'open-tickets',
        title: 'Open tickets',
        key: 'tickets',
        format: 'integer',
        aggregation: 'sum',
        trend: 'down',
        change: '11.2%',
      },
      {
        id: 'first-reply',
        title: 'First reply',
        key: 'replyMinutes',
        format: 'minutes',
        aggregation: 'average',
        trend: 'down',
        change: '3 min',
      },
      {
        id: 'satisfaction',
        title: 'Customer satisfaction',
        key: 'satisfaction',
        format: 'percent',
        aggregation: 'average',
        trend: 'up',
        change: '1.6 pts',
      },
      {
        id: 'support-users',
        title: 'Customers helped',
        key: 'users',
        format: 'integer',
        aggregation: 'sum',
        trend: 'up',
        change: '6.3%',
      },
    ],
  },
  {
    id: 'sales-pipeline',
    label: 'Sales pipeline',
    description: 'Pipeline value, win rate and deal cycle across fictional regions.',
    rows: [
      {
        id: 'sp-1',
        region: 'North',
        channel: 'Web',
        users: 1840,
        activation: 0.42,
        retention: 0.31,
        tickets: 34,
        replyMinutes: 18,
        satisfaction: 0.94,
        pipeline: 182000,
        winRate: 0.31,
        deals: 13,
        cycleDays: 22,
      },
      {
        id: 'sp-2',
        region: 'South',
        channel: 'Web',
        users: 1320,
        activation: 0.38,
        retention: 0.29,
        tickets: 27,
        replyMinutes: 22,
        satisfaction: 0.91,
        pipeline: 137000,
        winRate: 0.24,
        deals: 9,
        cycleDays: 31,
      },
      {
        id: 'sp-3',
        region: 'West',
        channel: 'Mobile',
        users: 2160,
        activation: 0.47,
        retention: 0.35,
        tickets: 41,
        replyMinutes: 16,
        satisfaction: 0.96,
        pipeline: 226000,
        winRate: 0.35,
        deals: 17,
        cycleDays: 19,
      },
      {
        id: 'sp-4',
        region: 'North',
        channel: 'Mobile',
        users: 1510,
        activation: 0.44,
        retention: 0.34,
        tickets: 30,
        replyMinutes: 20,
        satisfaction: 0.93,
        pipeline: 164000,
        winRate: 0.29,
        deals: 12,
        cycleDays: 24,
      },
      {
        id: 'sp-5',
        region: 'South',
        channel: 'Partner',
        users: 980,
        activation: 0.35,
        retention: 0.26,
        tickets: 23,
        replyMinutes: 25,
        satisfaction: 0.89,
        pipeline: 118000,
        winRate: 0.2,
        deals: 7,
        cycleDays: 35,
      },
      {
        id: 'sp-6',
        region: 'West',
        channel: 'Web',
        users: 1760,
        activation: 0.45,
        retention: 0.33,
        tickets: 36,
        replyMinutes: 17,
        satisfaction: 0.95,
        pipeline: 203000,
        winRate: 0.33,
        deals: 15,
        cycleDays: 21,
      },
    ],
    metrics: [
      {
        id: 'pipeline-value',
        title: 'Pipeline value',
        key: 'pipeline',
        format: 'currency',
        aggregation: 'sum',
        trend: 'up',
        change: '14.8%',
      },
      {
        id: 'win-rate',
        title: 'Win rate',
        key: 'winRate',
        format: 'percent',
        aggregation: 'average',
        trend: 'up',
        change: '2.4 pts',
      },
      {
        id: 'deals-created',
        title: 'Deals created',
        key: 'deals',
        format: 'integer',
        aggregation: 'sum',
        trend: 'up',
        change: '9.1%',
      },
      {
        id: 'sales-cycle',
        title: 'Sales cycle',
        key: 'cycleDays',
        format: 'days',
        aggregation: 'average',
        trend: 'down',
        change: '2 days',
      },
    ],
  },
];

const fields: readonly FilterField<RecordRow>[] = [
  { key: 'region', header: 'Region', type: 'enum', options: ['North', 'South', 'West'] },
  { key: 'channel', header: 'Channel', type: 'enum', options: ['Web', 'Mobile', 'Partner'] },
];

const initialPeriod = { start: '2026-03-01', end: '2026-03-10' };
const initialFilter = (): FilterGroup => ({
  type: 'group',
  op: 'and',
  children: [{ type: 'condition', field: 'region', operator: 'eq', value: 'North' }],
});

let scenarioId = $state<ScenarioId>('product-analytics');
let period = $state<{ start: string | null; end: string | null }>({ ...initialPeriod });
let filters = $state<FilterGroup>(initialFilter());
let filterSaved = $state(false);
let layouts = $state<Record<string, DashboardLayout>>({});
let layoutNotice = $state('Layout changes stay in this preview and are not saved.');
let announcement = $state('Product analytics loaded with the North region filter.');
let sourceVisible = $state(false);

const scenarioById = Object.fromEntries(scenarios.map((item) => [item.id, item])) as Record<
  ScenarioId,
  Scenario
>;
const selectedScenario = $derived(scenarioById[scenarioId]);
const filteredRows = $derived(applyFilter(selectedScenario.rows, filters, fields));
const periodDays = $derived.by(() => {
  if (!period.start || !period.end) return 10;
  const start = Date.parse(`${period.start}T00:00:00Z`);
  const end = Date.parse(`${period.end}T00:00:00Z`);
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
});
const periodScale = $derived(periodDays / 10);
const metricValues = $derived(
  selectedScenario.metrics.map((metric) => {
    const values = filteredRows.map((row) => row[metric.key] * periodScale);
    const aggregate = values.length
      ? metric.aggregation === 'sum'
        ? values.reduce((total, value) => total + value, 0)
        : values.reduce((total, value) => total + value, 0) / values.length
      : undefined;
    return {
      metric,
      values,
      value: aggregate === undefined ? undefined : formatValue(aggregate, metric.format),
    };
  })
);
const source = $derived(JSON.stringify({ scenario: scenarioId, period, filters }, null, 2));

function formatValue(value: number, format: Format): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${(value * 100).toFixed(1)}%`;
    case 'minutes':
      return `${value.toFixed(0)} min`;
    case 'days':
      return `${value.toFixed(0)} days`;
    default:
      return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
  }
}

function changeScenario(value: string): void {
  if (!scenarios.some((item) => item.id === value)) return;
  scenarioId = value as ScenarioId;
  filters = initialFilter();
  filterSaved = false;
  announcement = `${selectedScenario.label} loaded with the North region filter.`;
}

function changeFilters(next: FilterGroup): void {
  filters = next;
  filterSaved = false;
  announcement = `${applyFilter(selectedScenario.rows, next, fields).length} sample regions match the current filters.`;
}

function reset(): void {
  scenarioId = 'product-analytics';
  period = { ...initialPeriod };
  filters = initialFilter();
  filterSaved = false;
  layouts = {};
  sourceVisible = false;
  layoutNotice = 'Layout reset. Changes stay in this preview and are not saved.';
  announcement = 'Dashboard reset to product analytics.';
}

function layoutChanged(): void {
  layoutNotice = 'Layout changed. Changes stay in this preview and are not saved.';
}
</script>

<section class="dashboards-demo" data-tx-dashboards-demo data-demo-live aria-label="Interactive dashboard builder">
  <div class="dashboards-demo__controls" role="group" aria-label="Dashboard controls">
    <label>
      <span>Scenario</span>
      <select aria-label="Dashboard scenario" value={scenarioId} onchange={(event) => changeScenario(event.currentTarget.value)}>
        {#each scenarios as item (item.id)}<option value={item.id}>{item.label}</option>{/each}
      </select>
    </label>
    <DateRangePicker
      label="Reporting period"
      bind:value={period}
      presets
      today="2026-03-10"
      maxDays={90}
      labels={{ trigger: 'Choose reporting period', triggerWithValue: 'Change reporting period', dialog: 'Reporting period' }}
    />
    <button type="button" class="dashboards-demo__reset" onclick={reset}>Reset example</button>
    <button type="button" class="dashboards-demo__source-toggle" aria-expanded={sourceVisible} aria-controls="dashboards-demo-source" onclick={() => (sourceVisible = !sourceVisible)}>
      {sourceVisible ? 'Hide source' : 'View source'}
    </button>
  </div>

  <p class="dashboards-demo__description">{selectedScenario.description}</p>
  <FilterBar fields={fields} bind:value={filters} saved={filterSaved} onValueChange={changeFilters} />
  <p class="dashboards-demo__status" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>

  <Dashboard label={`${selectedScenario.label} dashboard`} editable rowHeight={76} gap="medium" bind:layouts onLayoutChange={layoutChanged}>
    {#each metricValues as item, index (item.metric.id)}
      <DashboardWidget id={item.metric.id} title={item.metric.title} x={(index % 3) * 4} y={Math.floor(index / 3) * 2} w={4} h={2} minW={3} minH={2}>
        <MetricCard title={item.metric.title} value={item.value} comparison={`vs. previous period · ${periodDays} days`} trend={item.metric.trend} trendLabel={item.metric.change}>
          {#snippet sparkline()}
            <Sparkline values={item.values} label={`${item.metric.title} trend for ${selectedScenario.label}`} period={`${periodDays}-day reporting period`} />
          {/snippet}
        </MetricCard>
      </DashboardWidget>
    {/each}
  </Dashboard>

  <p class="dashboards-demo__layout-note">{layoutNotice}</p>
  <div id="dashboards-demo-source" class="dashboards-demo__source" role="region" aria-label="Dashboard scenario source as JSON" hidden={!sourceVisible}>
    <pre tabindex="0"><code>{source}</code></pre>
  </div>
</section>

<style>
  .dashboards-demo { display: grid; gap: 1rem; min-inline-size: 0; color: var(--tx-foreground, CanvasText); }
  .dashboards-demo__controls { display: flex; flex-wrap: wrap; align-items: end; gap: 0.75rem; }
  .dashboards-demo__controls label { display: grid; gap: 0.35rem; min-inline-size: min(100%, 13rem); font-size: 0.875rem; font-weight: 600; }
  .dashboards-demo select, .dashboards-demo button { min-block-size: 2.75rem; padding-inline: 0.75rem; border: 1px solid var(--tx-border, ButtonBorder); border-radius: 0.5rem; background: var(--tx-background, ButtonFace); color: inherit; font: inherit; }
  .dashboards-demo button { cursor: pointer; touch-action: manipulation; }
  .dashboards-demo button:focus-visible, .dashboards-demo select:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 2px; }
  .dashboards-demo__description, .dashboards-demo__status, .dashboards-demo__layout-note { margin: 0; color: var(--tx-muted-foreground, GrayText); font-size: 0.875rem; }
  .dashboards-demo__status { min-block-size: 1.25em; }
  .dashboards-demo__source { max-inline-size: 100%; overflow: auto; border: 1px solid var(--tx-border, GrayText); border-radius: 0.6rem; background: var(--tx-background, Canvas); }
  .dashboards-demo__source pre { overflow: auto; max-block-size: 24rem; margin: 0; padding: 1rem; font: 0.875rem/1.5 var(--tx-font-mono, ui-monospace, monospace); }
  @media (forced-colors: active) { .dashboards-demo select, .dashboards-demo button, .dashboards-demo__source { border-color: CanvasText; } }
</style>
