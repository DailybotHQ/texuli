/**
 * Test doubles for @texuli/core/data-source: a manual clock (time moves
 * only when a test advances it) and an in-memory source whose calls the
 * test can hold, fail or inspect.
 */
import {
  createSourceRegistry,
  defineSource,
  type SourceClock,
  type SourceListRequest,
  type SourcePage,
  type SourceRow,
  type SourceSchemaDeclaration,
  sourceError,
} from '../src/data-source/index.ts';

/** Let queued promise callbacks run. */
export async function flush(rounds = 30): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
}

export interface ManualClock extends SourceClock {
  advance(ms: number): Promise<void>;
  timers(): number;
}

export function manualClock(): ManualClock {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    now: () => now,
    setTimeout(callback, ms) {
      id += 1;
      timers.set(id, { at: now + ms, callback });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        await flush();
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].callback();
      }
      now = target;
      await flush();
    },
    timers: () => timers.size,
  };
}

export const TICKET_SCHEMA: SourceSchemaDeclaration = {
  key: 'id',
  fields: [
    { name: 'id', type: 'text', sort: true },
    { name: 'title', type: 'text', filter: true, sort: true, editable: true, required: true },
    {
      name: 'status',
      type: 'enum',
      options: ['open', 'doing', 'done'],
      filter: ['eq', 'neq', 'in'],
      editable: true,
    },
    { name: 'points', type: 'number', filter: true, sort: true, editable: true },
    { name: 'due', type: 'date', filter: ['before', 'after', 'between'] },
    { name: 'urgent', type: 'boolean', filter: true },
  ],
  operations: ['list', 'get', 'create', 'update', 'delete', 'search'],
  pagination: 'cursor',
  maxPageSize: 50,
  defaultPageSize: 2,
};

export function tickets(count: number): SourceRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    title: `Ticket ${i + 1}`,
    status: (['open', 'doing', 'done'] as const)[i % 3] ?? 'open',
    points: i + 1,
    due: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    urgent: i % 2 === 0,
  }));
}

/** A call the test resolves or rejects by hand. */
export interface HeldCall<T> {
  readonly request: T;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

/**
 * An in-memory ticket source. `hold` makes every call wait for the test;
 * otherwise `list` pages `rows` by cursor (the cursor is the next index).
 */
export function memorySource(
  options: { rows?: SourceRow[]; hold?: boolean; schema?: SourceSchemaDeclaration } = {}
) {
  const rows = options.rows ?? tickets(5);
  const lists: HeldCall<SourceListRequest>[] = [];
  const writes: HeldCall<{ op: string; request: unknown }>[] = [];
  const calls: string[] = [];
  let failNext: unknown[] = [];

  function held<T, R>(log: HeldCall<T>[], request: T, auto: () => R): Promise<R> {
    if (failNext.length > 0) {
      const error = failNext.shift();
      return Promise.reject(error);
    }
    if (!options.hold) return Promise.resolve(auto());
    return new Promise((resolve, reject) => {
      log.push({ request, resolve: resolve as (value: unknown) => void, reject });
    });
  }

  const source = defineSource('tickets', options.schema ?? TICKET_SCHEMA, {
    list(request) {
      calls.push(`list:${request.page.cursor ?? request.page.offset ?? 0}`);
      return held(lists, request, (): SourcePage => {
        const start = Number(request.page.cursor ?? request.page.offset ?? 0);
        const page = rows.slice(start, start + request.page.size);
        const next = start + page.length;
        return {
          rows: page,
          nextCursor: next < rows.length ? String(next) : null,
          total: rows.length,
        };
      });
    },
    get(request) {
      calls.push(`get:${request.id}`);
      return held(
        writes,
        { op: 'get', request },
        () => rows.find((row) => row.id === request.id) ?? null
      );
    },
    create(request) {
      calls.push('create');
      return held(writes, { op: 'create', request }, () => {
        const row = { ...request.values, id: `t${rows.length + 1}` } as SourceRow;
        rows.push(row);
        return row;
      });
    },
    update(request) {
      calls.push(`update:${request.id}`);
      return held(writes, { op: 'update', request }, () => {
        const index = rows.findIndex((row) => row.id === request.id);
        if (index < 0) throw sourceError('not-found');
        const row = { ...rows[index], ...request.changes } as SourceRow;
        rows[index] = row;
        return row;
      });
    },
    delete(request) {
      calls.push(`delete:${request.id}`);
      return held(writes, { op: 'delete', request }, () => {
        const index = rows.findIndex((row) => row.id === request.id);
        if (index >= 0) rows.splice(index, 1);
      });
    },
  });
  return {
    source,
    registry: createSourceRegistry([source]),
    rows,
    lists,
    writes,
    calls,
    /** The next calls reject with these, in order. */
    failWith(...errors: unknown[]) {
      failNext = errors;
    },
  };
}
