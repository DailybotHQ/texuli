/**
 * Catalog manifests for the `@texuli/data` views as data (spec 0.3.0).
 * Each manifest is the JSON surface a blueprint sets: plain item lists with
 * property schemas (no accessor functions or snippets). `@texuli/player`
 * maps it onto the Svelte view. Lists stay within the spec list limit (500
 * items, at most 16 scalar fields each), so a list prop can be bound to a
 * `list` state variable. Build-time only; a subpath group the catalog root
 * does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest, CatalogValueSchema } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

const PKG = '@texuli/data';

const id: CatalogValueSchema = { type: 'string', minLength: 1, maxLength: 64 };
const text = (maxLength = 200): CatalogValueSchema => ({ type: 'string', maxLength });
const isoTime: CatalogValueSchema = {
  type: 'string',
  minLength: 10,
  maxLength: 35,
  description: 'An ISO 8601 date (2026-10-27) or time (2026-10-27T09:00:00Z).',
};
const list = (
  properties: Record<string, CatalogValueSchema>,
  required: string[],
  maxItems = 500
): CatalogValueSchema => ({
  type: 'array',
  maxItems,
  items: { type: 'object', properties, required },
});
const labelProp = {
  name: 'label',
  kind: 'string' as const,
  required: true,
  trust: 'untrusted' as const,
  description: 'Accessible name of the view.',
};
const densityProp = (values: readonly string[]) => ({
  name: 'density',
  kind: 'enum' as const,
  enumValues: values,
});

/** Tones the data views use for markers and events. */
export const DATA_TONES = ['primary', 'info', 'success', 'warning', 'danger', 'neutral'] as const;

export const dataBoardManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-board',
  package: PKG,
  label: 'Board',
  summary:
    'A kanban board: cards in columns (and optional swimlanes), moved by drag, keyboard or a move menu, with work-in-progress limits.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show work items by status and let people move them between columns'],
  dontUseWhen: [
    'One ordered list: use sortable-list',
    'Read-only status counts: use kpi or a chart',
  ],
  a11y: [
    'Columns are labelled lists; each card has a drag handle button and a "Move to…" menu (the non-drag path)',
    'Moves are announced politely with column and position; locked cards refuse moves with a reason',
  ],
  props: [
    labelProp,
    {
      name: 'columns',
      kind: 'array',
      required: true,
      schema: list(
        {
          id,
          title: text(120),
          wipSoft: { type: 'integer', minimum: 0, maximum: 500 },
          wipHard: { type: 'integer', minimum: 0, maximum: 500 },
        },
        ['id', 'title'],
        24
      ),
    },
    {
      name: 'items',
      kind: 'array',
      required: true,
      description: 'Cards: each names its column (and lane); rank orders cards within a cell.',
      schema: list(
        {
          id,
          title: text(),
          column: id,
          lane: id,
          rank: text(64),
          detail: text(),
          locked: { type: 'boolean' },
        },
        ['id', 'title', 'column']
      ),
    },
    { name: 'lanes', kind: 'array', schema: list({ id, title: text(120) }, ['id', 'title'], 24) },
    densityProp(['comfortable', 'compact']),
  ],
  events: ['move'],
  bindable: ['items'],
  examples: [
    {
      id: 'sprint',
      title: 'Sprint board',
      props: {
        label: 'Sprint 12',
        columns: [
          { id: 'todo', title: 'To do' },
          { id: 'doing', title: 'In progress', wipSoft: 2 },
          { id: 'done', title: 'Done' },
        ],
        items: [
          { id: 't1', title: 'Draft the release notes', column: 'todo', rank: 'a0' },
          { id: 't2', title: 'Review the onboarding flow', column: 'doing', rank: 'a0' },
        ],
      },
    },
  ],
  related: ['sortable-list', 'data-tree-view'],
});

export const dataTreeViewManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-tree-view',
  package: PKG,
  label: 'Tree view',
  summary:
    'A hierarchy of items people expand, select and reorder or re-parent by drag or keyboard.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show nested items such as folders, outlines or org charts'],
  dontUseWhen: ['A flat list: use list or sortable-list', 'Files with previews: use data-files'],
  a11y: [
    'A WAI-ARIA tree with roving focus, typeahead and expand/collapse on arrows',
    'Moves have a keyboard path and are announced; selection uses checkboxes when enabled',
  ],
  props: [
    labelProp,
    {
      name: 'items',
      kind: 'array',
      required: true,
      description: 'Flat items; parent names the parent item (none for a root).',
      schema: list({ id, label: text(), parent: id, rank: text(64) }, ['id', 'label']),
    },
    { name: 'checkboxes', kind: 'boolean', default: true },
    densityProp(['comfortable', 'compact']),
  ],
  events: ['move', 'select'],
  bindable: ['items'],
  examples: [
    {
      id: 'outline',
      title: 'Project outline',
      props: {
        label: 'Launch plan',
        items: [
          { id: 'plan', label: 'Plan' },
          { id: 'scope', label: 'Scope', parent: 'plan' },
          { id: 'ship', label: 'Ship' },
        ],
      },
    },
  ],
  related: ['data-files', 'data-board'],
});

export const dataCalendarManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-calendar',
  package: PKG,
  label: 'Calendar',
  summary:
    'Events on a month, week, day or agenda view; people open, and when allowed move, events.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show scheduled events or availability over days and weeks'],
  dontUseWhen: ['Task durations and dependencies: use data-timeline', 'One date: use text'],
  a11y: [
    'A labelled grid with roving focus; every event is a button with its time and title',
    'Moving an event has a keyboard path; changes are announced politely',
  ],
  props: [
    labelProp,
    {
      name: 'events',
      kind: 'array',
      required: true,
      schema: list(
        {
          id,
          title: text(),
          start: isoTime,
          end: isoTime,
          allDay: { type: 'boolean' },
          tone: { type: 'string', enum: [...DATA_TONES] },
        },
        ['id', 'title', 'start', 'end']
      ),
    },
    { name: 'view', kind: 'enum', enumValues: ['month', 'week', 'day', 'agenda'], default: 'week' },
    { name: 'anchor', kind: 'string', description: 'The ISO date the view opens on.' },
    { name: 'timeZone', kind: 'string', default: 'UTC' },
    { name: 'locale', kind: 'string', default: 'en-US' },
    { name: 'readOnly', kind: 'boolean', default: false },
  ],
  events: ['select', 'move', 'change'],
  bindable: ['view'],
  examples: [
    {
      id: 'week',
      title: 'Team week',
      props: {
        label: 'Team calendar',
        view: 'week',
        anchor: '2026-10-26',
        events: [
          {
            id: 'e1',
            title: 'Planning',
            start: '2026-10-26T09:00:00Z',
            end: '2026-10-26T10:00:00Z',
          },
          { id: 'e2', title: 'Offsite', start: '2026-10-29', end: '2026-10-30', allDay: true },
        ],
      },
    },
  ],
  related: ['data-timeline'],
});

export const dataGridManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-grid',
  package: PKG,
  label: 'Data grid',
  summary: 'A sortable, searchable grid of rows and typed columns; virtualized for long lists.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show many records people sort, search and select'],
  dontUseWhen: ['A small static table in a document: use table or blocks-data'],
  a11y: [
    'A WAI-ARIA grid with a caption, sortable column headers and roving cell focus',
    'Sort and search changes are announced; selection is exposed per row',
  ],
  props: [
    {
      name: 'caption',
      kind: 'string',
      required: true,
      trust: 'untrusted',
      description: 'The grid caption and accessible name.',
    },
    {
      name: 'columns',
      kind: 'array',
      required: true,
      schema: list(
        {
          id,
          header: text(120),
          kind: { type: 'string', enum: ['text', 'number', 'date'] },
          align: { type: 'string', enum: ['start', 'center', 'end'] },
          sortable: { type: 'boolean' },
        },
        ['id', 'header'],
        48
      ),
    },
    {
      name: 'rows',
      kind: 'array',
      required: true,
      description: 'Rows: an id and one display string per column id (the column kind sorts it).',
      schema: list(
        { id, cells: { type: 'object', additionalProperties: { type: 'string', maxLength: 500 } } },
        ['id', 'cells']
      ),
    },
    { name: 'searchable', kind: 'boolean', default: false },
    { name: 'selectable', kind: 'boolean', default: false },
    densityProp(['compact', 'default', 'comfortable']),
  ],
  events: ['select', 'change'],
  examples: [
    {
      id: 'orders',
      title: 'Orders',
      props: {
        caption: 'Open orders',
        columns: [
          { id: 'customer', header: 'Customer' },
          { id: 'total', header: 'Total', kind: 'number', align: 'end', sortable: true },
        ],
        rows: [
          { id: 'o1', cells: { customer: 'Northwind Example', total: '1240' } },
          { id: 'o2', cells: { customer: 'Contoso Example', total: '310' } },
        ],
      },
    },
  ],
  related: ['table', 'blocks-data'],
});

export const dataFilesManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-files',
  package: PKG,
  label: 'File browser',
  summary: 'Folders and files in a grid or list with breadcrumbs, selection and type previews.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show a folder structure people browse and select from'],
  dontUseWhen: ['Uploading files: that is host chrome (file-upload)'],
  a11y: [
    'A labelled grid or list with roving focus; folders open with Enter, Backspace goes up',
    'Selection is exposed per item; previews are decorative',
  ],
  props: [
    labelProp,
    {
      name: 'entries',
      kind: 'array',
      required: true,
      description: 'Files and folders; parent names the folder (none for the root).',
      schema: list(
        {
          id,
          name: text(),
          kind: { type: 'string', enum: ['folder', 'file'] },
          parent: id,
          type: text(100),
          size: { type: 'number', minimum: 0 },
          updatedAt: isoTime,
        },
        ['id', 'name', 'kind']
      ),
    },
    { name: 'layout', kind: 'enum', enumValues: ['grid', 'list'], default: 'grid' },
    densityProp(['comfortable', 'compact']),
  ],
  events: ['select', 'change'],
  bindable: ['layout'],
  examples: [
    {
      id: 'shared',
      title: 'Shared drive',
      props: {
        label: 'Shared drive',
        entries: [
          { id: 'f1', name: 'Reports', kind: 'folder' },
          {
            id: 'f2',
            name: 'Q3 summary.pdf',
            kind: 'file',
            parent: 'f1',
            type: 'application/pdf',
            size: 48213,
          },
        ],
      },
    },
  ],
  related: ['data-tree-view'],
});

export const dataMapManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-map',
  package: PKG,
  label: 'Map',
  summary:
    'Places as markers on an offline vector basemap, clustered when close, with a place list beside it.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show where things are: stores, deliveries, sites'],
  dontUseWhen: ['Values per region: use charts-geo-map', 'One address: use text'],
  a11y: [
    'Every marker is also an item in a labelled place list (the non-map path)',
    'The map pans and zooms by keyboard; selection is announced',
  ],
  props: [
    labelProp,
    {
      name: 'markers',
      kind: 'array',
      required: true,
      schema: list(
        {
          id,
          label: text(120),
          lat: { type: 'number', minimum: -90, maximum: 90 },
          lng: { type: 'number', minimum: -180, maximum: 180 },
          detail: text(),
          tone: { type: 'string', enum: [...DATA_TONES] },
        },
        ['id', 'label', 'lat', 'lng']
      ),
    },
    { name: 'listPlacement', kind: 'enum', enumValues: ['side', 'below'], default: 'side' },
  ],
  events: ['select'],
  examples: [
    {
      id: 'sites',
      title: 'Sites',
      props: {
        label: 'Warehouses',
        markers: [
          { id: 'w1', label: 'North hub', lat: 59.33, lng: 18.07 },
          { id: 'w2', label: 'South hub', lat: 41.39, lng: 2.17, tone: 'warning' },
        ],
      },
    },
  ],
  related: ['charts-geo-point-map'],
});

export const dataTimelineManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-timeline',
  package: PKG,
  label: 'Project timeline',
  summary: 'Tasks as bars over days, weeks, months or quarters, with dependencies and progress.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show a schedule of tasks with durations and dependencies'],
  dontUseWhen: ['Point-in-time events: use timeline or data-calendar'],
  a11y: [
    'A labelled grid of rows; every bar is a button with its dates and progress',
    'Rescheduling has a keyboard path; dependencies are listed as text',
  ],
  props: [
    labelProp,
    {
      name: 'tasks',
      kind: 'array',
      required: true,
      schema: list(
        {
          id,
          title: text(),
          start: isoTime,
          end: isoTime,
          progress: { type: 'number', minimum: 0, maximum: 1 },
          group: text(120),
          milestone: { type: 'boolean' },
        },
        ['id', 'title']
      ),
    },
    {
      name: 'dependencies',
      kind: 'array',
      schema: list(
        { from: id, to: id, type: { type: 'string', enum: ['FS', 'SS', 'FF', 'SF'] } },
        ['from', 'to'],
        2000
      ),
    },
    {
      name: 'zoom',
      kind: 'enum',
      enumValues: ['day', 'week', 'month', 'quarter'],
      default: 'week',
    },
    { name: 'locale', kind: 'string', default: 'en' },
  ],
  events: ['select', 'move', 'change'],
  bindable: ['zoom'],
  examples: [
    {
      id: 'launch',
      title: 'Launch plan',
      props: {
        label: 'Launch',
        zoom: 'week',
        tasks: [
          { id: 'd', title: 'Design', start: '2026-11-02', end: '2026-11-13', progress: 0.5 },
          { id: 'b', title: 'Build', start: '2026-11-16', end: '2026-12-04' },
        ],
        dependencies: [{ from: 'd', to: 'b', type: 'FS' }],
      },
    },
  ],
  related: ['data-calendar', 'timeline'],
});

export const DATA_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  dataBoardManifest,
  dataTreeViewManifest,
  dataCalendarManifest,
  dataGridManifest,
  dataFilesManifest,
  dataMapManifest,
  dataTimelineManifest,
]);

/** Data views are interactive widgets. */
// A literal list (a test keeps it equal to DATA_MANIFESTS), so a runtime that
// needs only the roles does not pull the manifests in.
export const DATA_GRAMMAR_ROLES: readonly GrammarComponentMeta[] = Object.freeze([
  { id: 'data-board', role: 'interactive' },
  { id: 'data-tree-view', role: 'interactive' },
  { id: 'data-calendar', role: 'interactive' },
  { id: 'data-grid', role: 'interactive' },
  { id: 'data-files', role: 'interactive' },
  { id: 'data-map', role: 'interactive' },
  { id: 'data-timeline', role: 'interactive' },
]);
