// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createSourceCollection,
  createSourceLoader,
  createSourceRegistry,
  defineSource,
  PENDING_ROW_PREFIX,
  type SourceListResult,
  type SourceResult,
  sourceError,
} from '../src/data-source/index.ts';
import { flush, manualClock, memorySource, TICKET_SCHEMA, tickets } from './data-source-fakes.ts';

function loaderFor(
  memory: ReturnType<typeof memorySource>,
  options: { timeoutMs?: number; staleMs?: number } = {}
) {
  const clock = manualClock();
  const loader = createSourceLoader({
    registry: memory.registry,
    clock,
    timeoutMs: options.timeoutMs ?? 0,
    cache: { staleMs: options.staleMs ?? 1000 },
  });
  return { clock, loader };
}

function rowsOf(result: SourceResult<SourceListResult>) {
  if (!result.ok) throw new Error(`expected rows, got ${result.error.code}`);
  return result.value.rows.map((row) => row.id);
}

describe('core/data-source loader: requests', () => {
  it('fails closed on an unknown source, an unsupported operation and a refused query', async () => {
    const memory = memorySource({
      schema: { ...TICKET_SCHEMA, operations: ['list'] },
    });
    const { loader } = loaderFor(memory);
    const cases: [Promise<SourceResult<unknown>>, string][] = [
      [loader.list('users', {}), 'unknown-source'],
      [loader.list('constructor', {}), 'unknown-source'],
      [loader.list('tickets', { fields: ['password'] }), 'invalid-query'],
      [loader.list('tickets', { pageSize: 10_000 }), 'invalid-query'],
      [loader.list('tickets', {}, { offset: 2 }), 'invalid-query'],
      [loader.update('tickets', 't1', { title: 'x' }), 'unsupported'],
      [loader.get('tickets', 't1'), 'unsupported'],
    ];
    for (const [pending, code] of cases) {
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe(code);
    }
    // Nothing reached the adapter.
    expect(memory.calls).toEqual([]);
  });

  it('deduplicates identical reads in flight and caches the page by query', async () => {
    const memory = memorySource({ hold: true });
    const { clock, loader } = loaderFor(memory, { staleMs: 1000 });
    const a = loader.list('tickets', { sort: [{ field: 'title' }], pageSize: 2 });
    const b = loader.list('tickets', { pageSize: 2, sort: [{ field: 'title', direction: 'asc' }] });
    await flush();
    expect(memory.lists).toHaveLength(1);
    expect(loader.inFlight()).toBe(1);
    memory.lists[0]?.resolve({ rows: tickets(2), nextCursor: '2' });
    expect(rowsOf(await a)).toEqual(['t1', 't2']);
    expect(rowsOf(await b)).toEqual(['t1', 't2']);
    // Cached: no new call while fresh, and peek reads it synchronously.
    expect(loader.peek('tickets', { pageSize: 2, sort: [{ field: 'title' }] })?.rows).toHaveLength(
      2
    );
    const c = loader.list('tickets', { pageSize: 2, sort: [{ field: 'title' }] });
    expect(rowsOf(await c)).toEqual(['t1', 't2']);
    expect(memory.lists).toHaveLength(1);
    // Stale after staleMs: asked again.
    await clock.advance(1000);
    void loader.list('tickets', { pageSize: 2, sort: [{ field: 'title' }] });
    await flush();
    expect(memory.lists).toHaveLength(2);
  });

  it('cancels one caller without cancelling the shared read, and the read when every caller left', async () => {
    const memory = memorySource({ hold: true });
    const { loader } = loaderFor(memory);
    const first = new AbortController();
    const second = new AbortController();
    const a = loader.list('tickets', {}, { signal: first.signal });
    const b = loader.list('tickets', {}, { signal: second.signal });
    await flush();
    first.abort();
    const left = await a;
    expect(left.ok === false && left.error.code).toBe('aborted');
    expect(memory.lists[0]?.request.signal.aborted).toBe(false);
    second.abort();
    const alsoLeft = await b;
    expect(alsoLeft.ok === false && alsoLeft.error.code).toBe('aborted');
    await flush();
    expect(memory.lists[0]?.request.signal.aborted).toBe(true);
    expect(loader.inFlight()).toBe(0);
    // An already aborted signal never reaches the adapter.
    const gone = new AbortController();
    gone.abort();
    const never = await loader.list('tickets', { pageSize: 3 }, { signal: gone.signal });
    expect(never.ok).toBe(false);
    expect(memory.lists).toHaveLength(1);
  });

  it('retries retryable failures with exponential backoff on the injected clock', async () => {
    const memory = memorySource();
    const { clock, loader } = loaderFor(memory);
    memory.failWith(sourceError('network'), sourceError('unavailable'));
    const pending = loader.list('tickets', {});
    await flush();
    expect(memory.calls).toHaveLength(1);
    await clock.advance(299);
    expect(memory.calls).toHaveLength(1);
    await clock.advance(1); // 300 ms: the first retry
    expect(memory.calls).toHaveLength(2);
    await clock.advance(599);
    expect(memory.calls).toHaveLength(2);
    await clock.advance(1); // 600 ms more: the second retry
    expect(rowsOf(await pending)).toEqual(['t1', 't2']);
    expect(memory.calls).toHaveLength(3);
  });

  it('stops at the retry limit, never retries a final error, and honors a retry hint', async () => {
    const memory = memorySource();
    const { clock, loader } = loaderFor(memory);
    memory.failWith(sourceError('timeout'), sourceError('timeout'), sourceError('timeout'));
    const exhausted = loader.list('tickets', {});
    await clock.advance(10_000);
    const out = await exhausted;
    expect(out.ok === false && out.error.code).toBe('timeout');
    expect(memory.calls).toHaveLength(3);

    memory.calls.length = 0;
    memory.failWith(sourceError('forbidden'));
    const forbidden = await loader.list('tickets', { pageSize: 3 });
    expect(forbidden.ok === false && forbidden.error.retryable).toBe(false);
    expect(memory.calls).toHaveLength(1);

    memory.calls.length = 0;
    memory.failWith(sourceError('rate-limited', { retryAfterMs: 2000 }));
    const limited = loader.list('tickets', { pageSize: 4 });
    await clock.advance(1999);
    expect(memory.calls).toHaveLength(1);
    await clock.advance(1);
    expect((await limited).ok).toBe(true);
  });

  it('turns a slow attempt into a retryable timeout', async () => {
    const memory = memorySource({ hold: true });
    const { clock, loader } = loaderFor(memory, { timeoutMs: 1000 });
    const pending = loader.list('tickets', {});
    await clock.advance(1000);
    expect(memory.lists[0]?.request.signal.aborted).toBe(true);
    // The retry is held too; answer it.
    await clock.advance(300);
    memory.lists[1]?.resolve({ rows: tickets(1) });
    expect(rowsOf(await pending)).toEqual(['t1']);
  });

  it('checks every response: size, keys, duplicates, types and projection', async () => {
    const memory = memorySource({ hold: true });
    const { loader } = loaderFor(memory);
    const answer = async (page: unknown, query: object = {}) => {
      const pending = loader.list('tickets', query, { fresh: true });
      await flush();
      memory.lists[memory.lists.length - 1]?.resolve(page);
      return pending;
    };
    const refusals: unknown[] = [
      null,
      { rows: 'nope' },
      { rows: tickets(3) }, // the default page holds 2
      { rows: [{ title: 'no key' }] },
      { rows: [{ id: { $ne: null } }] },
      { rows: [{ id: 't1' }, { id: 't1' }] },
      { rows: [], nextCursor: 'x'.repeat(513) },
    ];
    for (const page of refusals) {
      const result = await answer(page);
      expect(result.ok === false && result.error.code, JSON.stringify(page)).toBe(
        'invalid-response'
      );
    }
    const result = await answer(
      {
        rows: [
          { id: 't1', title: 42, status: 'lost', points: 3, secret: 'hunter2', urgent: 'yes' },
        ],
      },
      { fields: ['title', 'status', 'points'] }
    );
    expect(result.ok && result.value.rows[0]).toEqual({
      id: 't1',
      title: null,
      status: null,
      points: 3,
    });
  });

  it('pages by cursor and by offset', async () => {
    const memory = memorySource();
    const { loader } = loaderFor(memory);
    const first = await loader.list('tickets', {});
    expect(first.ok && first.value).toMatchObject({ hasMore: true, nextCursor: '2', total: 5 });
    const second = await loader.list('tickets', {}, { cursor: '2' });
    expect(rowsOf(second)).toEqual(['t3', 't4']);

    const rows = tickets(3);
    const offsetSource = defineSource(
      'people',
      {
        fields: [{ name: 'id', type: 'text' }],
        operations: ['list'],
        pagination: 'offset',
        defaultPageSize: 2,
      },
      {
        list: async ({ page }) => ({
          rows: rows
            .slice(page.offset ?? 0, (page.offset ?? 0) + page.size)
            .map((r) => ({ id: r.id as string })),
        }),
      }
    );
    const offsets = createSourceLoader({
      registry: createSourceRegistry([offsetSource]),
      retry: false,
    });
    const a = await offsets.list('people', {});
    expect(a.ok && a.value).toMatchObject({ hasMore: true, nextOffset: 2 });
    const b = await offsets.list('people', {}, { offset: 2 });
    expect(b.ok && b.value).toMatchObject({ hasMore: false, nextOffset: null });
    const wrong = await offsets.list('people', {}, { cursor: 'abc' });
    expect(wrong.ok === false && wrong.error.code).toBe('invalid-query');
  });

  it('invalidates cached pages, tells subscribers, and never caches a page that started before', async () => {
    const memory = memorySource({ hold: true });
    const { loader } = loaderFor(memory);
    const heard: unknown[] = [];
    const stop = loader.subscribe('tickets', (event) => heard.push(event.origin ?? 'none'));
    const early = loader.list('tickets', {});
    await flush();
    loader.invalidate('tickets', 'mine');
    memory.lists[0]?.resolve({ rows: tickets(2) });
    await early;
    expect(loader.peek('tickets', {})).toBeUndefined();
    expect(heard).toEqual(['mine']);
    stop();
    loader.invalidate('tickets');
    expect(heard).toEqual(['mine']);
  });

  it('validates writes, never retries them, and invalidates the source after one lands', async () => {
    const memory = memorySource();
    const { loader } = loaderFor(memory);
    const heard: unknown[] = [];
    loader.subscribe('tickets', (event) => heard.push(event.origin));
    const refused: [Promise<SourceResult<unknown>>, string][] = [
      [loader.update('tickets', 't1', { id: 'other' }), '$.id'],
      [loader.update('tickets', 't1', { due: '2026-12-01' }), '$.due'],
      [loader.update('tickets', 't1', { points: 'many' }), '$.points'],
      [loader.update('tickets', 't1', { owner: 'x' }), '$.owner'],
      [loader.create('tickets', { points: 1 }), '$.title'],
      [loader.update('tickets', { id: 't1' } as never, { title: 'x' }), ''],
    ];
    for (const [pending, path] of refused) {
      const result = await pending;
      expect(result.ok === false && result.error.code).toBe('invalid-input');
      if (!result.ok && path) expect(result.error.issues?.[0]?.path).toBe(path);
    }
    expect(memory.calls).toEqual([]);
    memory.failWith(sourceError('network'));
    const failed = await loader.update('tickets', 't1', { title: 'Renamed' });
    expect(failed.ok === false && failed.error.code).toBe('network');
    expect(memory.calls).toEqual(['update:t1']);
    const updated = await loader.update('tickets', 't1', { title: 'Renamed' }, { origin: 'grid' });
    expect(updated.ok && updated.value.title).toBe('Renamed');
    expect(heard).toEqual(['grid']);
    const removed = await loader.remove('tickets', 't2');
    expect(removed).toEqual({ ok: true, value: null });
  });

  it('reads one row by id', async () => {
    const memory = memorySource();
    const { loader } = loaderFor(memory);
    const found = await loader.get('tickets', 't3');
    expect(found.ok && found.value?.title).toBe('Ticket 3');
    const missing = await loader.get('tickets', 'nope');
    expect(missing).toEqual({ ok: true, value: null });
  });
});

describe('core/data-source collection: paging and optimistic writes', () => {
  async function loaded(options: { hold?: boolean } = {}) {
    const memory = memorySource(options);
    const { clock, loader } = loaderFor(memory);
    const collection = createSourceCollection(loader, 'tickets', { pageSize: 2 });
    const states: string[] = [];
    collection.subscribe((state) => states.push(state.status));
    const loading = collection.load();
    if (options.hold) {
      await flush();
      memory.lists[0]?.resolve({ rows: tickets(2), nextCursor: '2' });
    }
    await loading;
    return { memory, loader, clock, collection, states };
  }

  it('loads, then loads more until the source is out of rows', async () => {
    const { collection, states } = await loaded();
    expect(states).toEqual(['loading', 'ready']);
    expect(collection.state).toMatchObject({ status: 'ready', hasMore: true, total: 5 });
    await collection.loadMore();
    await collection.loadMore();
    expect(collection.state.rows.map((row) => row.id)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(collection.state.hasMore).toBe(false);
    await collection.loadMore(); // nothing left: a no-op
    expect(collection.state.rows).toHaveLength(5);
  });

  it('shows an update at once, then keeps the source row', async () => {
    const { memory, collection } = await loaded({ hold: true });
    const pending = collection.update('t1', { title: 'Renamed' });
    expect(collection.state.rows[0]?.title).toBe('Renamed');
    expect(collection.state.pending).toBe(1);
    await flush();
    memory.writes[0]?.resolve({ ...tickets(1)[0], title: 'Renamed by server' });
    const result = await pending;
    expect(result.ok).toBe(true);
    expect(collection.state.rows[0]?.title).toBe('Renamed by server');
    expect(collection.state.pending).toBe(0);
  });

  it('rolls back exactly the failed write while another is still pending', async () => {
    const { memory, collection } = await loaded({ hold: true });
    const a = collection.update('t1', { title: 'First' });
    const b = collection.update('t2', { status: 'done' });
    expect(collection.state.rows.map((row) => [row.title, row.status])).toEqual([
      ['First', 'open'],
      ['Ticket 2', 'done'],
    ]);
    await flush();
    memory.writes[0]?.reject(sourceError('conflict'));
    const failed = await a;
    expect(failed.ok === false && failed.error.code).toBe('conflict');
    // t1 is back; t2's pending change still shows.
    expect(collection.state.rows.map((row) => [row.title, row.status])).toEqual([
      ['Ticket 1', 'open'],
      ['Ticket 2', 'done'],
    ]);
    expect(collection.state.writeError?.messageKey).toBe('dataSource.error.conflict');
    memory.writes[1]?.resolve({ ...tickets(2)[1], status: 'done' });
    await b;
    expect(collection.state.rows[1]?.status).toBe('done');
  });

  it('creates with a temporary key and removes optimistically, rolling back on failure', async () => {
    const { memory, collection } = await loaded({ hold: true });
    const created = collection.create({ title: 'New' });
    expect(collection.state.rows.at(-1)).toMatchObject({
      title: 'New',
      id: `${PENDING_ROW_PREFIX}1`,
    });
    await flush();
    memory.writes[0]?.resolve({ id: 't9', title: 'New', status: 'open', points: 1 });
    await created;
    expect(collection.state.rows.at(-1)?.id).toBe('t9');

    const removal = collection.remove('t1');
    expect(collection.state.rows.map((row) => row.id)).toEqual(['t2', 't9']);
    await flush();
    memory.writes[1]?.reject(new Error('socket hang up'));
    const failed = await removal;
    expect(failed.ok === false && failed.error.code).toBe('failed');
    expect(collection.state.rows.map((row) => row.id)).toEqual(['t1', 't2', 't9']);
  });

  it('reloads when another view writes to the source, not after its own writes', async () => {
    const { memory, loader, collection } = await loaded();
    const before = memory.calls.filter((call) => call.startsWith('list')).length;
    await collection.update('t1', { title: 'Mine' });
    await flush();
    expect(memory.calls.filter((call) => call.startsWith('list')).length).toBe(before);
    await loader.update('tickets', 't2', { title: 'Theirs' });
    await flush();
    expect(memory.calls.filter((call) => call.startsWith('list')).length).toBe(before + 1);
    expect(collection.state.rows[1]?.title).toBe('Theirs');
  });

  it('reports a refused source or query as an error state without loading', async () => {
    const memory = memorySource();
    const { loader } = loaderFor(memory);
    for (const [name, query, code] of [
      ['payments', {}, 'unknown-source'],
      [
        'tickets',
        { filter: { type: 'condition', field: 'ssn', operator: 'eq', value: '1' } },
        'invalid-query',
      ],
    ] as const) {
      const collection = createSourceCollection(loader, name, query);
      await collection.load();
      expect(collection.state.status).toBe('error');
      expect(collection.state.error?.code).toBe(code);
      expect(collection.descriptor === null || collection.query === null).toBe(true);
    }
    expect(memory.calls).toEqual([]);
  });

  it('keeps rows when a page fails, retries it, and recovers a failed load', async () => {
    const { memory, clock, collection } = await loaded();
    memory.failWith(sourceError('forbidden'));
    await collection.loadMore();
    expect(collection.state.moreError?.code).toBe('forbidden');
    expect(collection.state.rows).toHaveLength(2);
    await collection.retry();
    expect(collection.state.rows).toHaveLength(4);

    const fresh = memorySource();
    const loader = createSourceLoader({ registry: fresh.registry, clock, retry: false });
    const other = createSourceCollection(loader, 'tickets', {});
    fresh.failWith(sourceError('unavailable'));
    await other.load();
    expect(other.state).toMatchObject({ status: 'error', rows: [] });
    expect(other.state.error?.retryable).toBe(true);
    await other.retry();
    expect(other.state.status).toBe('ready');
  });

  it('cancels its reads and writes when destroyed', async () => {
    const memory = memorySource({ hold: true });
    const { loader } = loaderFor(memory);
    const collection = createSourceCollection(loader, 'tickets', {});
    void collection.load();
    await flush();
    collection.destroy();
    await flush();
    expect(memory.lists[0]?.request.signal.aborted).toBe(true);
    expect(collection.state.status).toBe('loading');
  });
});
