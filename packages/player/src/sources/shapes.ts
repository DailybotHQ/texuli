/**
 * How source rows become a component's items (spec 0.8.0, ADR-015). Each
 * sourceable prop of the catalog has one shape here: `records` copies the
 * item fields from the row (a binding's `map` renames source fields to item
 * fields), and `cells` turns a row into a data-grid row whose column ids
 * name source fields. `tests/data-sources.test.ts` keeps this table equal
 * to the catalog's sourceable props and their item schemas.
 */

import type { SpecSourceDescriptor } from '@texuli/spec/source';

export interface SourceShape {
  readonly kind: 'records' | 'cells';
  /** The item fields a row may fill (the prop's item schema properties). */
  readonly fields: readonly string[];
  /** The prop's `maxItems`: no more rows are loaded past it. */
  readonly maxItems: number;
}

/** `id.prop` → shape, for every sourceable prop of the catalog. */
export const SOURCE_SHAPES: Readonly<Record<string, SourceShape>> = Object.freeze({
  'data-board.items': {
    kind: 'records',
    fields: ['id', 'title', 'column', 'lane', 'rank', 'detail', 'locked'],
    maxItems: 500,
  },
  'data-calendar.events': {
    kind: 'records',
    fields: ['id', 'title', 'start', 'end', 'allDay', 'tone'],
    maxItems: 500,
  },
  'data-files.entries': {
    kind: 'records',
    fields: ['id', 'name', 'kind', 'parent', 'size', 'type', 'updatedAt'],
    maxItems: 500,
  },
  'data-grid.rows': { kind: 'cells', fields: ['id', 'cells'], maxItems: 500 },
  'data-notification-inbox.items': {
    kind: 'records',
    fields: ['id', 'title', 'body', 'at', 'read', 'href'],
    maxItems: 200,
  },
  'data-timeline.tasks': {
    kind: 'records',
    fields: ['id', 'title', 'start', 'end', 'group', 'progress', 'milestone'],
    maxItems: 500,
  },
  'data-tree-view.items': {
    kind: 'records',
    fields: ['id', 'label', 'parent', 'rank'],
    maxItems: 500,
  },
});

/** The shape of a catalog id's prop, or `undefined` when it is not sourceable. */
export function sourceShape(id: string, prop: string): SourceShape | undefined {
  const key = `${id}.${prop}`;
  return Object.hasOwn(SOURCE_SHAPES, key) ? SOURCE_SHAPES[key] : undefined;
}

type Row = Readonly<Record<string, unknown>>;
type Item = Readonly<Record<string, unknown>>;

/** The source field an item field reads: the binding's map, else the same name. */
function from(map: Readonly<Record<string, string>> | undefined, field: string): string {
  return map && Object.hasOwn(map, field) ? (map[field] as string) : field;
}

/** A grid cell's display text. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

/**
 * Rows as items. The item `id` is the row key as text; `null` values are
 * left out; nothing else is coerced, and the result is validated and passed
 * through the paint-time URL policy like any literal prop.
 */
export function itemsFromRows(
  shape: SourceShape,
  rows: readonly Row[],
  key: string,
  map?: Readonly<Record<string, string>>
): readonly Item[] {
  const out: Item[] = [];
  for (const row of rows.slice(0, shape.maxItems)) {
    const idField = from(map, 'id') === 'id' ? key : from(map, 'id');
    const id = Object.hasOwn(row, idField) ? row[idField] : undefined;
    if (id === null || id === undefined) continue;
    if (shape.kind === 'cells') {
      const cells: Record<string, string> = {};
      for (const [field, value] of Object.entries(row)) {
        Object.defineProperty(cells, field, { value: cellText(value), enumerable: true });
      }
      out.push(Object.freeze({ id: String(id), cells: Object.freeze(cells) }));
      continue;
    }
    const item: Record<string, unknown> = { id: String(id) };
    for (const field of shape.fields) {
      if (field === 'id') continue;
      const source = from(map, field);
      const value = Object.hasOwn(row, source) ? row[source] : undefined;
      if (value === null || value === undefined) continue;
      Object.defineProperty(item, field, { value, enumerable: true });
    }
    out.push(Object.freeze(item));
  }
  return Object.freeze(out);
}

/**
 * What a component's edit changes in the source: for one item, the editable
 * source fields whose mapped item field changed. Fields the source does not
 * declare editable (a board rank, say) are not written back.
 */
export function changesFromItem(
  shape: SourceShape,
  before: Item,
  after: Item,
  descriptor: Pick<SpecSourceDescriptor, 'fields' | 'key'>,
  map?: Readonly<Record<string, string>>
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  if (shape.kind !== 'records') return changes;
  for (const field of shape.fields) {
    if (field === 'id') continue;
    const next = Object.hasOwn(after, field) ? after[field] : null;
    const prev = Object.hasOwn(before, field) ? before[field] : null;
    if (next === prev) continue;
    const source = from(map, field);
    const declared = descriptor.fields.find((entry) => entry.name === source);
    if (!declared?.editable || source === descriptor.key) continue;
    Object.defineProperty(changes, source, { value: next, enumerable: true });
  }
  return changes;
}
