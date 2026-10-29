/**
 * The in-page host of /dashboards-page/: fictional operations data served
 * by sources declared with `@texuli/core/data-source`. Nothing leaves the
 * page: each adapter answers from memory after a short delay, and every
 * call is reported to the demo's request log. The live dashboard reads
 * through a loader (validated queries, retries, a cache); the agent
 * dashboard hands the same registry to the player, so a blueprint can only
 * name these sources, never a URL. Fictional data only (example.com).
 */
import {
  createSourceLoader,
  createSourceRegistry,
  defineSource,
  type SourceLoader,
  type SourceRegistry,
} from '@texuli/core/data-source';

export interface SourceCall {
  readonly id: number;
  readonly source: string;
  readonly outcome: string;
}

/** A type alias, not an interface, so a row is assignable to a source row record. */
export type Ticket = {
  readonly id: string;
  readonly title: string;
  readonly status: 'open' | 'doing' | 'done';
  readonly points: number;
};

export const TICKETS: readonly Ticket[] = Object.freeze([
  { id: 't1', title: 'Checkout latency on eu.example.com', status: 'doing', points: 8 },
  { id: 't2', title: 'Webhook retries for partner.example.com', status: 'open', points: 5 },
  { id: 't3', title: 'Rotate the staging certificates', status: 'open', points: 3 },
  { id: 't4', title: 'Invoice PDF misses the tax line', status: 'doing', points: 5 },
  { id: 't5', title: 'Search index rebuild', status: 'done', points: 2 },
  { id: 't6', title: 'Dark mode contrast on the billing page', status: 'open', points: 1 },
]);

export type Metric = {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly delta: number;
};

/** The metrics; `tick` moves them so a refresh visibly changes the widgets. */
export function metrics(tick: number): Metric[] {
  return [
    { id: 'signups', label: 'Signups this week', value: 1284 + tick * 17, unit: '', delta: 12 },
    {
      id: 'revenue',
      label: 'Revenue, month to date',
      value: 48_200 + tick * 640,
      unit: 'USD',
      delta: 4,
    },
    { id: 'uptime', label: 'Uptime, 30 days', value: 99.98, unit: '%', delta: 0 },
    { id: 'deploys', label: 'Deploys this week', value: 23 + tick, unit: '', delta: -3 },
  ];
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((done, fail) => {
    if (signal.aborted) {
      fail(signal.reason);
      return;
    }
    const timer = setTimeout(done, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        fail(signal.reason);
      },
      { once: true }
    );
  });
}

export interface DashboardHost {
  readonly registry: SourceRegistry;
  readonly loader: SourceLoader;
  /** Moves the metrics on, so the next read returns new numbers. */
  advance(): void;
}

/** Declares `ops.metrics` and `ops.tickets`; `report` hears every adapter call. */
export function createDashboardHost(
  report: (call: Omit<SourceCall, 'id'>) => void,
  latencyMs = 300
): DashboardHost {
  let tick = 0;
  const metricSource = defineSource(
    'ops.metrics',
    {
      key: 'id',
      fields: [
        { name: 'id', type: 'text' },
        { name: 'label', type: 'text' },
        { name: 'value', type: 'number' },
        { name: 'unit', type: 'text' },
        { name: 'delta', type: 'number' },
      ],
      operations: ['list'],
      pagination: 'none',
      maxPageSize: 20,
    },
    {
      async list({ signal }) {
        await wait(latencyMs, signal);
        const rows = metrics(tick);
        report({ source: 'ops.metrics', outcome: `${rows.length} rows` });
        return { rows, total: rows.length };
      },
    }
  );
  const ticketSource = defineSource(
    'tickets',
    {
      key: 'id',
      fields: [
        { name: 'id', type: 'text' },
        { name: 'title', type: 'text', sort: true },
        {
          name: 'status',
          type: 'enum',
          options: ['open', 'doing', 'done'],
          filter: ['eq', 'neq', 'in'],
          sort: true,
        },
        { name: 'points', type: 'number', sort: true },
      ],
      operations: ['list'],
      pagination: 'none',
      maxPageSize: 50,
    },
    {
      async list({ query, signal }) {
        await wait(latencyMs, signal);
        let rows = [...TICKETS];
        const filter = query.filter;
        if (filter && 'children' in filter) {
          for (const child of filter.children) {
            if ('field' in child && child.field === 'status' && child.operator === 'in') {
              const allowed = new Set(child.value as readonly string[]);
              rows = rows.filter((row) => allowed.has(row.status));
            }
          }
        }
        const sort = query.sort?.[0];
        if (sort?.field === 'points') {
          rows.sort((a, b) =>
            sort.direction === 'desc' ? b.points - a.points : a.points - b.points
          );
        }
        report({ source: 'tickets', outcome: `${rows.length} rows` });
        return { rows, total: rows.length };
      },
    }
  );
  const registry = createSourceRegistry([metricSource, ticketSource]);
  const loader = createSourceLoader({
    registry,
    retry: { retries: 1, baseDelayMs: 300, maxDelayMs: 1000 },
    timeoutMs: 8000,
    cache: false,
  });
  return {
    registry,
    loader,
    advance() {
      tick += 1;
    },
  };
}
