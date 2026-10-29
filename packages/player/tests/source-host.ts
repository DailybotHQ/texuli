/**
 * A data-source host for player tests (spec 0.8.0): the fixture host's
 * `tickets` source (packages/spec/fixtures/sources.json) registered with an
 * in-memory adapter, as a host would register its real client. Calls can be
 * held, failed or inspected.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createSourceRegistry,
  defineSource,
  type SourceListRequest,
  type SourceRow,
  sourceError,
} from '@texuli/core/data-source';
import type { SpecSourceDescriptor } from '@texuli/spec/source';

/** The fixture host's descriptors, as the spec goldens are validated against them. */
export const FIXTURE_SOURCES: readonly SpecSourceDescriptor[] = (
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../../spec/fixtures/sources.json'), 'utf8')
  ) as { sources: SpecSourceDescriptor[] }
).sources;

const tickets = FIXTURE_SOURCES[0] as SpecSourceDescriptor;

export function ticketRows(count: number): SourceRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `t${i + 1}`,
    title: `Ticket ${i + 1}`,
    status: (['open', 'doing', 'done'] as const)[i % 3] ?? 'open',
    points: (i % 13) + 1,
    due: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    assignee: `person${i % 4}@example.com`,
  }));
}

export interface HeldList {
  request: SourceListRequest;
  resolve(page: unknown): void;
  reject(error: unknown): void;
}

/**
 * The tickets source over `rows`. `hold: true` makes list and update calls
 * wait for the test; `failNext` rejects the next calls with these errors.
 */
export function testSourceHost(options: { rows?: SourceRow[]; hold?: boolean } = {}) {
  const rows = options.rows ?? ticketRows(5);
  const lists: HeldList[] = [];
  const updates: {
    id: unknown;
    changes: Record<string, unknown>;
    resolve(): void;
    reject(e: unknown): void;
  }[] = [];
  const failures: unknown[] = [];
  const page = (request: SourceListRequest) => {
    const start = Number(request.page.cursor ?? 0);
    const slice = rows.slice(start, start + request.page.size);
    const next = start + slice.length;
    return {
      rows: slice,
      nextCursor: next < rows.length ? String(next) : null,
      total: rows.length,
    };
  };
  const source = defineSource(
    tickets.name,
    {
      key: tickets.key,
      fields: tickets.fields.map((field) => ({ ...field, filter: [...field.filter] })),
      operations: tickets.operations,
      pagination: tickets.pagination ?? 'none',
      maxPageSize: tickets.maxPageSize,
      ...(tickets.defaultPageSize ? { defaultPageSize: tickets.defaultPageSize } : {}),
    },
    {
      list(request) {
        if (failures.length > 0) return Promise.reject(failures.shift());
        if (!options.hold) return Promise.resolve(page(request));
        return new Promise((resolve, reject) => {
          lists.push({ request, resolve: resolve as (page: unknown) => void, reject });
        });
      },
      update({ id, changes }) {
        if (failures.length > 0) return Promise.reject(failures.shift());
        const apply = () => {
          const index = rows.findIndex((row) => row.id === id);
          if (index < 0) throw sourceError('not-found');
          rows[index] = { ...rows[index], ...changes } as SourceRow;
          return rows[index] as SourceRow;
        };
        if (!options.hold) return Promise.resolve().then(apply);
        return new Promise((resolve, reject) => {
          updates.push({
            id,
            changes: { ...changes },
            resolve: () => resolve(apply()),
            reject,
          });
        });
      },
    }
  );
  return {
    registry: createSourceRegistry([source]),
    rows,
    lists,
    updates,
    page,
    /** The next calls reject with these, in order. */
    failNext(...errors: unknown[]) {
      failures.push(...errors);
    },
  };
}
