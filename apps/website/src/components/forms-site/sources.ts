/**
 * The in-page host of the data-source demo on /forms-page/: two fictional
 * sources declared with `@texuli/core/data-source` and a loader over them.
 * Nothing leaves the page: each adapter answers from an array after a short
 * delay, and every call is reported to the demo's request log. The form
 * reads the team choices from `example.teams` and checks a handle against
 * `example.handles` through the same loader (validated queries, retries,
 * a cache and abortable reads). Fictional data only.
 */
import {
  createSourceLoader,
  createSourceRegistry,
  defineSource,
  type SourceLoader,
  type SourceQuery,
  sourceError,
} from '@texuli/core/data-source';
import type { FormSchema } from '@texuli/forms/model';

export interface SourceLogEntry {
  readonly id: number;
  readonly source: string;
  /** The validated query the adapter received, as JSON. */
  readonly query: string;
  readonly outcome: string;
}

export interface FormSourcesHost {
  readonly loader: SourceLoader;
  /** The next read answers `rate-limited` once; the loader retries it. */
  failNextRead(): void;
  /** Delay of every adapter answer, in ms. */
  latencyMs: number;
}

export const TEAMS = [
  { id: 'design', name: 'Design', lead: 'Ada Example', members: 6 },
  { id: 'platform', name: 'Platform', lead: 'Lin Example', members: 9 },
  { id: 'support', name: 'Support', lead: 'Sam Example', members: 4 },
  { id: 'research', name: 'Research', lead: 'Noor Example', members: 3 },
] as const;

export const HANDLES = [
  'harbor',
  'harbor-notes',
  'lumen',
  'lumen-atlas',
  'quill',
  'admin',
] as const;

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

/** Declares the sources and returns a loader; `report` hears every adapter call. */
export function createFormSourcesHost(
  report: (entry: Omit<SourceLogEntry, 'id'>) => void
): FormSourcesHost {
  let failNext = false;
  const host = {
    latencyMs: 350,
    failNextRead() {
      failNext = true;
    },
  };
  const answer = async (source: string, query: SourceQuery, signal: AbortSignal) => {
    await wait(host.latencyMs, signal);
    if (failNext) {
      failNext = false;
      report({
        source,
        query: JSON.stringify(query),
        outcome: 'rate-limited (the loader retries)',
      });
      throw sourceError('rate-limited', { retryAfterMs: 400 });
    }
  };

  const teams = defineSource(
    'example.teams',
    {
      key: 'id',
      fields: [
        { name: 'id', type: 'text' },
        { name: 'name', type: 'text', sort: true },
        { name: 'lead', type: 'text' },
        { name: 'members', type: 'number', sort: true },
      ],
      operations: ['list'],
      pagination: 'none',
      maxPageSize: 50,
    },
    {
      async list({ query, signal }) {
        await answer('example.teams', query, signal);
        const rows = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name));
        report({
          source: 'example.teams',
          query: JSON.stringify(query),
          outcome: `${rows.length} rows`,
        });
        return { rows, total: rows.length };
      },
    }
  );

  const handles = defineSource(
    'example.handles',
    {
      key: 'handle',
      fields: [{ name: 'handle', type: 'text', filter: ['eq'] }],
      operations: ['list', 'search'],
      pagination: 'none',
      maxPageSize: 20,
    },
    {
      async list({ query, signal }) {
        await answer('example.handles', query, signal);
        const needle = (query.search ?? '').toLowerCase();
        const rows = HANDLES.filter((handle) => handle.includes(needle)).map((handle) => ({
          handle,
        }));
        report({
          source: 'example.handles',
          query: JSON.stringify(query),
          outcome: `${rows.length} rows`,
        });
        return { rows };
      },
    }
  );

  const loader = createSourceLoader({
    registry: createSourceRegistry([teams, handles]),
    retry: { retries: 2, baseDelayMs: 300, maxDelayMs: 2000 },
    timeoutMs: 8000,
  });
  return Object.assign(host, { loader });
}

/** The form whose team choices come from `example.teams` (passed in as options). */
export function sourceFormSchema(teams: readonly { value: string; label: string }[]): FormSchema {
  return {
    title: 'Join a team',
    description: 'The team choices come from the host source; the handle is checked against it.',
    submitLabel: 'Join team',
    fields: [
      {
        name: 'team',
        type: 'select',
        label: 'Team',
        required: true,
        options: teams.map((team) => ({ value: team.value, label: team.label })),
      },
      {
        name: 'handle',
        type: 'text',
        label: 'Your handle',
        description: 'Checked as you leave the field. harbor and lumen are taken.',
        required: true,
        format: 'slug',
        minLength: 3,
        validator: 'handle-free',
      },
    ],
  };
}
