import { describe, expect, it } from 'vitest';
import {
  checkSourceQuery,
  describeSource,
  SOURCE_FIELD_PATTERN,
  SOURCE_FILTER_OPERATORS,
  SOURCE_LIMITS,
  SOURCE_NAME_PATTERN,
} from '../../core/src/data-source/index.ts';
import type { SpecCatalog } from '../src/catalog.ts';
import { contractRoot } from '../src/contract.ts';
import { type Schema, validateInstance } from '../src/dialect.ts';
import * as root from '../src/index.ts';
import { migrateBlueprint } from '../src/migrations/index.ts';
import {
  checkSourceBinding,
  SOURCE_BINDING_KEY,
  SPEC_SOURCE_FILTER_OPERATORS,
  SPEC_SOURCE_LIMITS,
  SPEC_SOURCE_PATTERNS,
  type SpecSourceDescriptor,
} from '../src/source.ts';
import { validateBlueprint } from '../src/validate.ts';
import { SPEC_VERSION } from '../src/version.ts';
import { json } from './helpers.ts';

/**
 * Spec 0.8.0 (ADR-012, ADR-015): data-source bindings. The closed shape is
 * the schema's; the meaning is checked against the host's descriptors, and
 * a blueprint is refused when the host passes none.
 */

const blueprintSchema = json<Schema>('schemas/blueprint.schema.json');
const catalog = json<SpecCatalog>('catalog/components.json');
const sources = json<{ sources: SpecSourceDescriptor[] }>('fixtures/sources.json').sources;
const golden = json<Record<string, unknown>>('fixtures/golden/source-tickets.json');
const defs = blueprintSchema.$defs as Record<string, Schema>;

const withRows = (rows: unknown) => ({
  ...golden,
  tree: {
    id: 'data-grid',
    props: { caption: 'Tickets', columns: [{ id: 'title', header: 'Title' }], rows },
  },
});
const codes = (blueprint: unknown, withSources = true) =>
  validateBlueprint(blueprint, {
    blueprintSchema,
    catalog,
    ...(withSources ? { sources } : {}),
  }).diagnostics.map((d) => d.code);

describe('spec 0.8.0: data-source bindings', () => {
  it('stamps 0.8.0 and migrates a 0.7.0 envelope by stamping spec only', () => {
    // Spec 0.8.0 introduced data-source bindings; later minors keep them.
    expect(['0.8.0', '0.9.0', '0.10.0']).toContain(SPEC_VERSION);
    const input = { ...golden, spec: '0.7.0' };
    const result = migrateBlueprint(input, '0.8.0');
    expect(result.applied).toEqual(['0.7.0->0.8.0']);
    expect(result.blueprint).toEqual({ ...input, spec: '0.8.0' });
  });

  it('accepts the golden against the host, and refuses every binding without one (fail closed)', () => {
    expect(codes(golden)).toEqual([]);
    expect(codes(golden, false)).toEqual(['source', 'source']);
    const message = validateBlueprint(golden, { blueprintSchema, catalog }).diagnostics[0]?.message;
    expect(message).toContain('No data sources were supplied');
  });

  it('marks the data views that take rows as sourceable, and only array props', () => {
    const sourceable = Object.fromEntries(
      catalog.components
        .filter((c) => c.sourceable)
        .map((c) => [c.id, c.sourceable as readonly string[]])
    );
    expect(sourceable).toEqual({
      'data-board': ['items'],
      'data-calendar': ['events'],
      // Spec 0.8.0 (T-dashboard): a host source can persist a dashboard's layout.
      'data-dashboard': ['layout'],
      'data-files': ['entries'],
      'data-grid': ['rows'],
      'data-notification-inbox': ['items'],
      'data-timeline': ['tasks'],
      'data-tree-view': ['items'],
    });
    for (const component of catalog.components) {
      for (const name of component.sourceable ?? []) {
        expect(component.props.find((p) => p.name === name)?.kind, component.id).toBe('array');
      }
    }
  });

  it('refuses a binding where it cannot read: a non-sourceable prop, nested in a value, mixed with $state', () => {
    expect(
      codes({
        ...golden,
        tree: {
          id: 'data-grid',
          props: { caption: 'x', columns: { $source: 'tickets' }, rows: [] },
        },
      })
    ).toEqual(['source']);
    expect(codes(withRows([{ id: 'a', cells: { $source: 'tickets' } }]))).toEqual(['source']);
    expect(codes(withRows({ $source: 'tickets', $state: 'rows' }))).toEqual(['source']);
    expect(
      codes({
        ...golden,
        tree: { id: 'blocks-text', props: { block: { $source: 'tickets' } } },
      })
    ).toEqual(['source']);
  });

  it('checks the map against the source fields and the prop item fields', () => {
    expect(codes(withRows({ $source: 'tickets', map: { cells: 'title' } }))).toEqual([]);
    expect(codes(withRows({ $source: 'tickets', map: { cells: 'secret' } }))).toEqual(['source']);
    expect(codes(withRows({ $source: 'tickets', map: { avatarUrl: 'title' } }))).toEqual([
      'source',
    ]);
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [`f${i}`, 'title']));
    expect(codes(withRows({ $source: 'tickets', map: many }))[0]).toBe('source');
  });

  it('mirrors its constants in the schema', () => {
    expect(Object.keys(defs.sourceBinding?.properties ?? {}).sort()).toEqual(
      [SOURCE_BINDING_KEY, 'map', 'query'].sort()
    );
    expect(defs.sourceName?.pattern).toBe(SPEC_SOURCE_PATTERNS.sourceName);
    expect(defs.sourceName?.maxLength).toBe(SPEC_SOURCE_LIMITS.nameLength);
    expect(defs.sourceFieldName?.pattern).toBe(SPEC_SOURCE_PATTERNS.sourceFieldName);
    expect(defs.sourceFilter?.properties?.operator?.enum).toEqual([
      ...SPEC_SOURCE_FILTER_OPERATORS,
    ]);
    expect(defs.sourceFilter?.properties?.children?.maxItems).toBe(SPEC_SOURCE_LIMITS.filterNodes);
    const query = defs.sourceQuery?.properties ?? {};
    expect(query.fields?.maxItems).toBe(SPEC_SOURCE_LIMITS.projection);
    expect(query.sort?.maxItems).toBe(SPEC_SOURCE_LIMITS.sort);
    expect(query.search?.maxLength).toBe(SPEC_SOURCE_LIMITS.searchLength);
    expect(query.pageSize?.maximum).toBe(SPEC_SOURCE_LIMITS.pageSize);
    expect(Object.keys(root)).toContain('checkSourceBinding');
  });

  it('agrees with @texuli/core/data-source on the vocabulary and the descriptors', () => {
    expect([...SPEC_SOURCE_FILTER_OPERATORS]).toEqual([...SOURCE_FILTER_OPERATORS]);
    expect(SPEC_SOURCE_PATTERNS.sourceName).toBe(SOURCE_NAME_PATTERN);
    expect(SPEC_SOURCE_PATTERNS.sourceFieldName).toBe(SOURCE_FIELD_PATTERN);
    for (const key of [
      'projection',
      'sort',
      'searchLength',
      'filterDepth',
      'filterNodes',
    ] as const) {
      expect(SPEC_SOURCE_LIMITS[key], key).toBe(SOURCE_LIMITS[key]);
    }
    expect(SPEC_SOURCE_LIMITS.pageSize).toBe(SOURCE_LIMITS.pageSize);
    // The fixture host is exactly what core's describeSource produces.
    const [tickets] = sources;
    if (!tickets) throw new Error('the fixture host declares tickets');
    const described = describeSource(tickets.name, {
      key: tickets.key,
      fields: tickets.fields.map((field) => ({ ...field, filter: [...field.filter] })),
      operations: tickets.operations,
      pagination: tickets.pagination ?? 'none',
      maxPageSize: tickets.maxPageSize,
      ...(tickets.defaultPageSize ? { defaultPageSize: tickets.defaultPageSize } : {}),
    });
    expect(JSON.parse(JSON.stringify(described))).toEqual(tickets);
  });

  it('accepts and refuses the same queries as the core loader (parity corpus)', () => {
    const [tickets] = sources as [SpecSourceDescriptor];
    const condition = (field: string, operator: string, value?: unknown) => ({
      type: 'condition',
      field,
      operator,
      ...(value === undefined ? {} : { value }),
    });
    const corpus: unknown[] = [
      {},
      { fields: ['title', 'status'] },
      { fields: ['nope'] },
      { fields: [] },
      { pageSize: 100 },
      { pageSize: 101 },
      { pageSize: 0 },
      { pageSize: 2.5 },
      { search: 'printer' },
      { search: 'x'.repeat(201) },
      { sort: [{ field: 'title' }, { field: 'points', direction: 'desc' }] },
      { sort: [{ field: 'assignee' }] },
      { sort: [{ field: 'title' }, { field: 'title' }] },
      { sort: [{ field: 'title', direction: 'up' }] },
      { filter: condition('status', 'in', ['open', 'done']) },
      { filter: condition('status', 'in', ['lost']) },
      { filter: condition('status', 'in', []) },
      { filter: condition('status', 'contains', 'o') },
      { filter: condition('points', 'between', [1, 5]) },
      { filter: condition('points', 'between', [1]) },
      { filter: condition('points', 'between', [null, 3]) },
      { filter: condition('points', 'eq', '3') },
      { filter: condition('points', 'isEmpty') },
      { filter: condition('points', 'isEmpty', 1) },
      { filter: condition('title', 'contains', '') },
      { filter: condition('title', 'contains', "'; DROP TABLE tickets; --") },
      { filter: condition('title', 'eq', 'x'.repeat(501)) },
      { filter: condition('title', 'eq', null) },
      { filter: condition('due', 'before', '2026-11-01') },
      { filter: condition('due', 'before', 'tomorrow') },
      { filter: condition('due', 'between', ['2026-11-01', '2026-11-30T12:00:00Z']) },
      { filter: condition('assignee', 'eq', 'ada@example.com') },
      { filter: condition('assignee', 'neq', 'ada@example.com') },
      { filter: condition('secret', 'eq', 'x') },
      { filter: condition('title', 'regex', '.*') },
      { filter: { type: 'group', op: 'or', children: [condition('title', 'eq', 'a')] } },
      { filter: { type: 'group', op: 'xor', children: [condition('title', 'eq', 'a')] } },
      { filter: { type: 'group', op: 'and', children: [] } },
      {
        filter: { type: 'group', op: 'and', children: [condition('title', 'eq', 'a')], field: 'x' },
      },
      { filter: { ...condition('title', 'eq', 'a'), children: [] } },
      {
        filter: {
          type: 'group',
          op: 'and',
          children: Array.from({ length: 64 }, () => condition('title', 'eq', 'a')),
        },
      },
      { url: 'https://attacker.example' },
      JSON.parse('{"__proto__": {"admin": true}}'),
    ];
    let deep: unknown = condition('title', 'eq', 'a');
    for (let i = 0; i < 6; i += 1) deep = { type: 'group', op: 'and', children: [deep] };
    corpus.push({ filter: deep });
    const rootSchema = contractRoot(blueprintSchema);
    for (const query of corpus) {
      const binding = { $source: 'tickets', query };
      const shape = validateInstance(defs.sourceBinding as Schema, binding, rootSchema);
      const alone = checkSourceBinding(binding, { sources }).length === 0;
      const core = checkSourceQuery(tickets as never, query).ok;
      const label = JSON.stringify(query).slice(0, 120);
      // The binding check alone (what @texuli/catalog runs) agrees with core and with the schema.
      expect(alone, label).toBe(core);
      if (shape.length > 0) expect(alone, label).toBe(false);
    }
    // The closed shape alone, without a schema document.
    for (const binding of [
      { $source: 'tickets', endpoint: '/api' },
      { $source: 'https://attacker.example/api' },
      { $source: 'tickets', map: { title: 42 } },
      { $source: 'tickets', query: [] },
    ]) {
      expect(checkSourceBinding(binding, { sources })[0]?.code).toBe('source');
    }
  });

  it('refuses a binding filter nested 100,000 levels deep in bounded time', () => {
    let deep: unknown = { type: 'condition', field: 'title', operator: 'eq', value: 'x' };
    for (let i = 0; i < 100_000; i += 1) deep = { type: 'group', op: 'and', children: [deep] };
    const started = performance.now();
    const found = codes(withRows({ $source: 'tickets', query: { filter: deep } }));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(found).toEqual(['source']);
  });
});
