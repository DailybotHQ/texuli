// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FILTER_OPERATORS, OPERATORS_BY_TYPE } from '../../data/src/engines/grid/filter.ts';
import {
  checkSourceQuery,
  createSourceLoader,
  createSourceRegistry,
  defineSource,
  describeSource,
  isSourceError,
  SOURCE_ERROR_CODES,
  SOURCE_ERROR_MESSAGES,
  SOURCE_FILTER_OPERATORS,
  SOURCE_LIMITS,
  SOURCE_OPERATORS_BY_TYPE,
  type SourceDescriptor,
  type SourceListRequest,
  type SourceSchemaDeclaration,
  sourceError,
  sourceErrorMessage,
  sourceQueryKey,
  toSourceError,
} from '../src/data-source/index.ts';
import { memorySource, TICKET_SCHEMA } from './data-source-fakes.ts';

const tickets: SourceDescriptor = describeSource('tickets', TICKET_SCHEMA);

describe('core/data-source: declarations', () => {
  it('normalizes a declaration into a frozen, adapter-free descriptor', () => {
    expect(Object.isFrozen(tickets)).toBe(true);
    expect(tickets.key).toBe('id');
    expect(tickets.pagination).toBe('cursor');
    expect(tickets.maxPageSize).toBe(50);
    expect(tickets.defaultPageSize).toBe(2);
    const title = tickets.fields.find((field) => field.name === 'title');
    // filter: true allows every operator of the type.
    expect(title?.filter).toEqual(SOURCE_OPERATORS_BY_TYPE.text);
    expect(tickets.fields.find((field) => field.name === 'urgent')?.sort).toBe(false);
    expect(JSON.parse(JSON.stringify(tickets))).toEqual(tickets);
  });

  it('mirrors the @texuli/data grid filter model operators', () => {
    expect([...SOURCE_FILTER_OPERATORS]).toEqual([...FILTER_OPERATORS]);
    for (const [type, ops] of Object.entries(OPERATORS_BY_TYPE)) {
      expect([...SOURCE_OPERATORS_BY_TYPE[type as keyof typeof OPERATORS_BY_TYPE]]).toEqual([
        ...ops,
      ]);
    }
  });

  it('throws for every declaration mistake', () => {
    const base: SourceSchemaDeclaration = {
      fields: [{ name: 'id', type: 'text' }],
      operations: ['list'],
    };
    const mistakes: [string, string, SourceSchemaDeclaration][] = [
      ['Bad Name', 'not a source name', base],
      ['ok', 'declare 1 to', { ...base, fields: [] }],
      ['ok', 'declared twice', { ...base, fields: [base.fields[0]!, base.fields[0]!] }],
      ['ok', 'malformed', { ...base, fields: [{ name: '__proto__', type: 'text' }] }],
      ['ok', 'unknown type', { ...base, fields: [{ name: 'id', type: 'blob' as 'text' }] }],
      [
        'ok',
        'cannot filter by "contains"',
        { ...base, fields: [base.fields[0]!, { name: 'n', type: 'number', filter: ['contains'] }] },
      ],
      ['ok', 'string options', { ...base, fields: [base.fields[0]!, { name: 'e', type: 'enum' }] }],
      [
        'ok',
        'takes no options',
        { ...base, fields: [base.fields[0]!, { name: 'n', type: 'number', options: ['a'] }] },
      ],
      ['ok', 'the key "uid"', { ...base, key: 'uid' }],
      ['ok', 'text or number', { ...base, fields: [{ name: 'id', type: 'boolean' }] }],
      [
        'ok',
        'cannot be editable',
        { ...base, fields: [{ name: 'id', type: 'text', editable: true }] },
      ],
      ['ok', 'operations must', { ...base, operations: ['drop' as 'list'] }],
      ['ok', 'maxPageSize', { ...base, maxPageSize: SOURCE_LIMITS.pageSize + 1 }],
      ['ok', 'defaultPageSize', { ...base, maxPageSize: 10, defaultPageSize: 11 }],
    ];
    for (const [name, message, declaration] of mistakes) {
      expect(() => describeSource(name, declaration), message).toThrow(message);
    }
  });

  it('needs an adapter method for every declared operation', () => {
    expect(() =>
      defineSource(
        'a',
        { fields: [{ name: 'id', type: 'text' }], operations: ['list', 'update'] },
        {
          list: async () => ({ rows: [] }),
        }
      )
    ).toThrow('adapter.update()');
    expect(() =>
      defineSource('a', { fields: [{ name: 'id', type: 'text' }], operations: ['search'] }, {})
    ).toThrow('adapter.list()');
  });
});

describe('core/data-source: registry', () => {
  it('registers, describes and removes sources; names never reach the prototype', () => {
    const { source } = memorySource();
    const registry = createSourceRegistry();
    const remove = registry.register(source);
    expect(registry.has('tickets')).toBe(true);
    expect(registry.names()).toEqual(['tickets']);
    expect(registry.describe('tickets')).toBe(source.descriptor);
    expect(registry.describe()).toEqual([source.descriptor]);
    expect(() => registry.register(source)).toThrow('already registered');
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(registry.has(name)).toBe(false);
      expect(registry.get(name)).toBeUndefined();
    }
    remove();
    expect(registry.has('tickets')).toBe(false);
    expect(() => registry.register({} as never)).toThrow('defineSource');
  });
});

describe('core/data-source: the closed query', () => {
  it('accepts a full query and returns a frozen copy holding only checked members', () => {
    const input = {
      fields: ['title', 'status', 'title'],
      filter: {
        type: 'group',
        op: 'and',
        children: [
          { type: 'condition', field: 'status', operator: 'in', value: ['open', 'doing'] },
          { type: 'condition', field: 'points', operator: 'between', value: [1, 8] },
          { type: 'condition', field: 'due', operator: 'before', value: '2026-12-01' },
          { type: 'condition', field: 'urgent', operator: 'isNotEmpty' },
        ],
      },
      sort: [{ field: 'points', direction: 'desc' }, { field: 'title' }],
      search: 'printer',
      pageSize: 10,
    };
    const checked = checkSourceQuery(tickets, input);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    expect(Object.isFrozen(checked.query)).toBe(true);
    expect(checked.query.fields).toEqual(['title', 'status']);
    expect(checked.query.sort).toEqual([
      { field: 'points', direction: 'desc' },
      { field: 'title', direction: 'asc' },
    ]);
    expect(checked.query).not.toBe(input);
    expect(checkSourceQuery(tickets, undefined)).toEqual({ ok: true, query: {} });
  });

  it('refuses each kind of bad query with a code and a path', () => {
    const cases: [string, unknown, string, string][] = [
      ['not an object', [], 'shape', '$'],
      ['an unknown member', { limit: 5 }, 'shape', '$.limit'],
      ['an unknown field', { fields: ['secret'] }, 'unknown-field', '$.fields[0]'],
      ['a malformed field', { fields: ['a b'] }, 'shape', '$.fields[0]'],
      [
        'too many fields',
        { fields: Array(SOURCE_LIMITS.projection + 1).fill('title') },
        'shape',
        '$.fields',
      ],
      [
        'an operator the field does not allow',
        { filter: { type: 'condition', field: 'status', operator: 'isEmpty' } },
        'operator',
        '$.filter.operator',
      ],
      [
        'an operator outside the vocabulary',
        { filter: { type: 'condition', field: 'title', operator: 'regex', value: '.*' } },
        'operator',
        '$.filter.operator',
      ],
      [
        'a value of the wrong type',
        { filter: { type: 'condition', field: 'points', operator: 'eq', value: '3' } },
        'value',
        '$.filter.value',
      ],
      [
        'an enum value outside the options',
        { filter: { type: 'condition', field: 'status', operator: 'eq', value: 'lost' } },
        'value',
        '$.filter.value',
      ],
      [
        'a value on isEmpty',
        { filter: { type: 'condition', field: 'title', operator: 'isEmpty', value: 'x' } },
        'value',
        '$.filter.value',
      ],
      [
        'between without two values',
        { filter: { type: 'condition', field: 'points', operator: 'between', value: [1] } },
        'value',
        '$.filter.value',
      ],
      [
        'a non-date for before',
        { filter: { type: 'condition', field: 'due', operator: 'before', value: 'soon' } },
        'value',
        '$.filter.value',
      ],
      [
        'an empty group',
        { filter: { type: 'group', op: 'and', children: [] } },
        'shape',
        '$.filter.children',
      ],
      [
        'a group op outside and/or',
        { filter: { type: 'group', op: 'xor', children: [{}] } },
        'shape',
        '$.filter.op',
      ],
      ['an unsortable field', { sort: [{ field: 'urgent' }] }, 'sort', '$.sort[0].field'],
      [
        'a field sorted twice',
        { sort: [{ field: 'title' }, { field: 'title' }] },
        'sort',
        '$.sort[1].field',
      ],
      [
        'a bad direction',
        { sort: [{ field: 'title', direction: 'up' }] },
        'shape',
        '$.sort[0].direction',
      ],
      ['too many sort keys', { sort: Array(5).fill({ field: 'title' }) }, 'shape', '$.sort'],
      ['an oversize page', { pageSize: 51 }, 'page-size', '$.pageSize'],
      ['a fractional page', { pageSize: 2.5 }, 'page-size', '$.pageSize'],
      ['long search text', { search: 'x'.repeat(201) }, 'shape', '$.search'],
    ];
    for (const [title, query, code, path] of cases) {
      const checked = checkSourceQuery(tickets, query);
      expect(checked.ok, title).toBe(false);
      if (checked.ok) continue;
      expect(checked.issues[0], title).toMatchObject({ code, path });
    }
  });

  it('refuses search on a source that does not declare it, and any query on one that cannot list', () => {
    const plain = describeSource('plain', {
      fields: [{ name: 'id', type: 'text' }],
      operations: ['list'],
    });
    expect(checkSourceQuery(plain, { search: 'x' })).toMatchObject({
      ok: false,
      issues: [{ code: 'search' }],
    });
    const writeOnly = describeSource('w', {
      fields: [{ name: 'id', type: 'text' }],
      operations: ['create'],
    });
    expect(checkSourceQuery(writeOnly, {})).toMatchObject({
      ok: false,
      issues: [{ code: 'operation' }],
    });
  });

  it('keys equal queries alike whatever their member and projection order', () => {
    const a = checkSourceQuery(tickets, {
      fields: ['title', 'status'],
      pageSize: 5,
      sort: [{ field: 'title' }],
    });
    const b = checkSourceQuery(tickets, {
      sort: [{ direction: 'asc', field: 'title' }],
      pageSize: 5,
      fields: ['status', 'title'],
    });
    if (!a.ok || !b.ok) throw new Error('both queries are valid');
    expect(sourceQueryKey('tickets', a.query)).toBe(sourceQueryKey('tickets', b.query));
    expect(sourceQueryKey('tickets', a.query, { cursor: '2' })).not.toBe(
      sourceQueryKey('tickets', a.query)
    );
    expect(sourceQueryKey('other', a.query)).not.toBe(sourceQueryKey('tickets', a.query));
  });
});

describe('core/data-source: hostile queries', () => {
  it('refuses a filter nested 100,000 levels deep without recursing, in bounded time', () => {
    let deep: unknown = { type: 'condition', field: 'title', operator: 'eq', value: 'x' };
    for (let i = 0; i < 100_000; i += 1) deep = { type: 'group', op: 'and', children: [deep] };
    const started = performance.now();
    const checked = checkSourceQuery(tickets, { filter: deep });
    expect(performance.now() - started).toBeLessThan(500);
    expect(checked).toMatchObject({ ok: false, issues: [{ code: 'limit', path: '$.filter' }] });
  });

  it('refuses a filter 100,000 nodes wide in bounded time', () => {
    const children = Array.from({ length: 100_000 }, () => ({
      type: 'condition',
      field: 'title',
      operator: 'eq',
      value: 'x',
    }));
    const started = performance.now();
    const checked = checkSourceQuery(tickets, { filter: { type: 'group', op: 'or', children } });
    expect(performance.now() - started).toBeLessThan(500);
    expect(checked).toMatchObject({ ok: false, issues: [{ code: 'limit' }] });
  });

  it('refuses prototype keys and prototype-named fields', () => {
    const polluted = JSON.parse(
      '{"__proto__": {"admin": true}, "filter": {"type": "condition", "field": "constructor", "operator": "eq", "value": "x"}}'
    );
    const checked = checkSourceQuery(tickets, polluted);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.issues.map((issue) => issue.code).sort()).toEqual(['shape', 'unknown-field']);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    const field = checkSourceQuery(tickets, { fields: ['__proto__'] });
    expect(field).toMatchObject({ ok: false, issues: [{ code: 'shape' }] });
  });

  it('caps the issues it reports for a query full of mistakes', () => {
    const checked = checkSourceQuery(
      tickets,
      Object.fromEntries(Array.from({ length: 1000 }, (_, i) => [`k${i}`, i]))
    );
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.issues).toHaveLength(32);
  });

  it('passes injection-looking strings to the adapter as inert data, unchanged', async () => {
    const strings = [
      "'; DROP TABLE tickets; --",
      '" OR 1=1 --',
      '{"$where": "sleep(1000)"}',
      `\${process.env.SECRET}`,
      '../../etc/passwd',
      'https://attacker.example/?q=1',
      '<script>alert(1)</script>',
      'ticket\u0000‮evil',
    ];
    const received: SourceListRequest[] = [];
    const source = defineSource('tickets', TICKET_SCHEMA, {
      list: async (request) => {
        received.push(request);
        return { rows: [] };
      },
      get: async () => null,
      create: async () => ({ id: 'x' }),
      update: async () => ({ id: 'x' }),
      delete: async () => {},
    });
    const loader = createSourceLoader({
      registry: createSourceRegistry([source]),
      retry: false,
      cache: false,
    });
    for (const text of strings) {
      const query = {
        search: text,
        filter: { type: 'condition', field: 'title', operator: 'contains', value: text },
      };
      const result = await loader.list('tickets', query);
      expect(result.ok, text).toBe(true);
    }
    // The adapter got each string exactly, as a value inside a frozen, validated query.
    expect(received.map((request) => request.query.search)).toEqual(strings);
    expect(received.map((request) => (request.query.filter as { value: string }).value)).toEqual(
      strings
    );
    for (const request of received) expect(Object.isFrozen(request.query)).toBe(true);
  });
});

describe('core/data-source: errors', () => {
  it('gives every code a retryable flag, a message key and an English message', () => {
    for (const code of SOURCE_ERROR_CODES) {
      const error = sourceError(code);
      expect(isSourceError(error)).toBe(true);
      expect(error.messageKey).toBe(`dataSource.error.${code}`);
      expect(SOURCE_ERROR_MESSAGES[error.messageKey]).toBeTruthy();
      expect(error.retryable).toBe(
        ['rate-limited', 'timeout', 'network', 'unavailable'].includes(code)
      );
    }
    expect(sourceError('failed', { retryable: true }).retryable).toBe(true);
    expect(sourceError('nonsense' as 'failed').code).toBe('failed');
  });

  it('never trusts a look-alike and never shows an adapter message', () => {
    const lookalike = { name: 'SourceError', code: 'network', retryable: true, messageKey: 'x' };
    expect(isSourceError(lookalike)).toBe(false);
    const converted = toSourceError(
      new Error('password=hunter2 at db.internal.example'),
      'tickets'
    );
    expect(converted.code).toBe('failed');
    expect(converted.retryable).toBe(false);
    expect(sourceErrorMessage(converted)).toBe(SOURCE_ERROR_MESSAGES['dataSource.error.failed']);
    expect(sourceErrorMessage(converted)).not.toContain('hunter2');
    const abort = toSourceError(Object.assign(new Error('x'), { name: 'AbortError' }));
    expect(abort.code).toBe('aborted');
    expect(
      sourceErrorMessage(sourceError('network'), { 'dataSource.error.network': 'Sin conexión.' })
    ).toBe('Sin conexión.');
  });
});

describe('core/data-source: packaging and docs', () => {
  it('is a subpath outside the root barrel, and its doc names every export', async () => {
    const { readFileSync } = await import('node:fs');
    const root = await import('../src/index.ts');
    expect('createSourceLoader' in root).toBe(false);
    const exportsMap = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).exports;
    expect(exportsMap['./data-source']).toBe('./src/data-source/index.ts');
    const doc = readFileSync('packages/core/docs/core-data-source.md', 'utf8');
    const source = readFileSync('packages/core/src/data-source/index.ts', 'utf8');
    const names = new Set<string>();
    for (const match of source.matchAll(/export\s+\{([^}]*)\}/g)) {
      for (const raw of (match[1] ?? '').split(',')) {
        const name = raw.trim().replace(/^type\s+/, '');
        if (name) names.add(name);
      }
    }
    expect(names.size).toBeGreaterThan(50);
    const missing = [...names].filter((name) => !new RegExp(`\`(type )?${name}\\b`).test(doc));
    expect(missing).toEqual([]);
  });
});
