/**
 * Dashboards as agent data on /dashboards-page/ (spec 0.8.0): a blueprint
 * whose `data-dashboard` holds three `data-dashboard-widget`s, two gauges
 * and a grid whose rows come from the host's `tickets` source; the
 * dashboard's layout is bound to a list state, so what people arrange
 * persists in the player's state. The hostile copy points the grid at a
 * URL instead of a source name, which validation refuses. Fictional data
 * only. Checked by apps/website/tests/site-dashboards.test.ts.
 */

/** The spec version that admits dashboards and source bindings. */
export const DASHBOARDS_SPEC = '0.8.0';

const CATALOG_PIN = '0'.repeat(64);

const gauge = (label: string, value: number) => ({
  id: 'charts-gauge',
  props: { label, value, min: 0, max: 100 },
});

function ticketsGrid(rows: unknown) {
  return {
    id: 'data-grid',
    props: {
      caption: 'Open tickets by points',
      columns: [
        { id: 'title', header: 'Title' },
        { id: 'status', header: 'Status' },
        { id: 'points', header: 'Points', kind: 'number', align: 'end' },
      ],
      rows,
    },
  };
}

const SOURCE_ROWS = {
  $source: 'tickets',
  query: {
    fields: ['title', 'status', 'points'],
    filter: {
      type: 'group',
      op: 'and',
      children: [{ type: 'condition', field: 'status', operator: 'in', value: ['open', 'doing'] }],
    },
    sort: [{ field: 'points', direction: 'desc' }],
    pageSize: 25,
  },
};

export function dashboardEnvelope(rows: unknown): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: DASHBOARDS_SPEC,
    id: 'ops-overview',
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-10-29T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tier: 'untrusted',
    profile: 'web',
    state: { arrangement: { type: 'list', maxItems: 200, initial: [] } },
    tree: {
      id: 'data-dashboard',
      props: { label: 'Operations overview', editable: true, density: 'compact' },
      bind: { layout: { $state: 'arrangement' } },
      children: [
        {
          id: 'data-dashboard-widget',
          props: { widgetId: 'errors', title: 'Error budget', place: { x: 0, y: 0, w: 6, h: 4 } },
          children: [gauge('Error budget used', 40)],
        },
        {
          id: 'data-dashboard-widget',
          props: { widgetId: 'uptime', title: 'Uptime', place: { x: 6, y: 0, w: 6, h: 4 } },
          children: [gauge('Uptime', 99)],
        },
        {
          id: 'data-dashboard-widget',
          props: { widgetId: 'tickets', title: 'Open tickets', place: { x: 0, y: 4, w: 12, h: 6 } },
          children: [ticketsGrid(rows)],
        },
      ],
    },
  };
}

export const AGENT_DASHBOARD_BLUEPRINT = dashboardEnvelope(SOURCE_ROWS);
/** The grid asks for a URL: a blueprint can only name a source the host registered. */
export const HOSTILE_DASHBOARD_BLUEPRINT = dashboardEnvelope({
  $source: 'https://attacker.example.com/rows',
});
export const AGENT_DASHBOARD_JSON = JSON.stringify(AGENT_DASHBOARD_BLUEPRINT, null, 2);
export const HOSTILE_ROWS_JSON = JSON.stringify(
  { rows: { $source: 'https://attacker.example.com/rows' } },
  null,
  2
);
