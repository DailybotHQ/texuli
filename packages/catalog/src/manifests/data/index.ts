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
  sourceable: ['items'],
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
  sourceable: ['items'],
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
  sourceable: ['events'],
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
  sourceable: ['rows'],
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
  sourceable: ['entries'],
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
  sourceable: ['tasks'],
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

export const dataCohortTableManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-cohort-table',
  package: PKG,
  label: 'Cohort table',
  summary:
    'A retention table: one row per cohort, one column per period after it started, as rates or counts, with optional heat tints and an averages row.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Show how groups that started at different times keep going, period by period'],
  dontUseWhen: [
    'One trend over time: use a line chart',
    'Records people sort and search: use data-grid',
  ],
  a11y: [
    'A real table: a caption, period column headers and cohort row headers with scope',
    'Heat tints are decorative and contrast-safe; the number stays the cell content',
  ],
  props: [
    {
      name: 'caption',
      kind: 'string',
      required: true,
      trust: 'untrusted',
      description: 'The table caption and accessible name: what is measured and how.',
    },
    {
      name: 'rows',
      kind: 'array',
      required: true,
      description:
        'Cohorts, one row each: a label, an optional size and one value per period reached (rates from 0 to 1, or counts). incomplete marks the last value as a period still in progress.',
      schema: list(
        {
          id,
          label: text(120),
          size: { type: 'integer', minimum: 0 },
          cells: { type: 'array', maxItems: 60, items: { type: 'number' } },
          incomplete: { type: 'boolean' },
        },
        ['label', 'cells'],
        120
      ),
    },
    {
      name: 'periods',
      kind: 'array',
      description: 'Period column headers ("Month 0", "Month 1"…); missing ones are numbered.',
      schema: { type: 'array', maxItems: 60, items: text(60) },
    },
    { name: 'captionHidden', kind: 'boolean', default: false },
    { name: 'valueKind', kind: 'enum', enumValues: ['rate', 'count'], default: 'rate' },
    { name: 'heat', kind: 'boolean', default: false },
    {
      name: 'max',
      kind: 'number',
      description: 'Top of the heat scale (default: 1 for rates, the largest cell for counts).',
    },
    {
      name: 'average',
      kind: 'boolean',
      default: false,
      description: 'Adds an averages row, weighted by cohort size when every cohort has one.',
    },
    { ...densityProp(['compact', 'default', 'comfortable']), default: 'compact' },
    { name: 'locale', kind: 'string', default: 'en-US' },
  ],
  examples: [
    {
      id: 'monthly-retention',
      title: 'Monthly retention',
      props: {
        caption: 'Share of accounts active each month after signup',
        periods: ['Month 0', 'Month 1', 'Month 2'],
        heat: true,
        average: true,
        rows: [
          { label: 'Aug 2026', size: 420, cells: [1, 0.62, 0.48] },
          { label: 'Sep 2026', size: 380, cells: [1, 0.58, 0.51], incomplete: true },
          { label: 'Oct 2026', size: 455, cells: [1, 0.66], incomplete: true },
        ],
      },
    },
  ],
  related: ['data-grid', 'charts-heatmap'],
});

export const dataNotificationInboxManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-notification-inbox',
  package: PKG,
  label: 'Notification inbox',
  summary:
    'Notifications, newest first, with unread state, mark read and unread, mark all read and an unread view.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['List updates someone should catch up on, such as mentions or review requests'],
  dontUseWhen: [
    'A short-lived confirmation: that is a host toast',
    'A history of changes without read state: use timeline',
  ],
  a11y: [
    'A section named by its heading; the unread count is read after it',
    'Every item has a read toggle named with its title; new unread items are announced politely',
  ],
  props: [
    {
      name: 'items',
      kind: 'array',
      required: true,
      trust: 'untrusted',
      description:
        'Notifications, newest first. href passes the untrusted URL policy (https, mailto and #fragments); read changes stay in view.',
      schema: list(
        {
          id,
          title: text(),
          body: text(500),
          at: isoTime,
          read: { type: 'boolean' },
          href: { type: 'string', maxLength: 2048 },
        },
        ['id', 'title', 'at', 'read'],
        200
      ),
    },
    { name: 'filter', kind: 'enum', enumValues: ['all', 'unread'], default: 'all' },
    {
      name: 'now',
      kind: 'string',
      description: 'The ISO instant the time labels count from (default: when it paints).',
    },
    { name: 'timeZone', kind: 'string', default: 'UTC' },
    { name: 'locale', kind: 'string', default: 'en-US' },
    {
      name: 'markReadOnOpen',
      kind: 'boolean',
      default: true,
      description: 'Opening an unread item marks it read.',
    },
    {
      name: 'headingLevel',
      kind: 'number',
      default: 2,
      description: 'Level of the inbox heading, 2 to 6.',
    },
  ],
  events: ['select', 'change'],
  bindable: ['filter'],
  sourceable: ['items'],
  examples: [
    {
      id: 'mentions',
      title: 'Mentions',
      props: {
        now: '2026-10-27T12:00:00Z',
        items: [
          {
            id: 'n1',
            title: 'Ana Example mentioned you in Launch plan',
            body: 'Can you check the timeline before Friday?',
            at: '2026-10-27T11:40:00Z',
            read: false,
            href: 'https://example.com/docs/launch-plan',
          },
          {
            id: 'n2',
            title: 'Weekly report is ready',
            at: '2026-10-26T09:00:00Z',
            read: true,
          },
        ],
      },
    },
  ],
  related: ['timeline', 'chat-thread'],
});

/** Field types a filter builder condition can test. */
export const FILTER_FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'enum'] as const;

export const dataFilterBuilderManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: 'data-filter-builder',
  package: PKG,
  label: 'Filter builder',
  summary:
    'Nested and/or groups of conditions (field, operator by field type, value) that people add, edit and remove.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['Let people compose a structured filter, such as "status is open and total over 100"'],
  dontUseWhen: [
    'One text filter that other nodes read: use control-filter',
    'A fixed choice between a few views: use control-choice',
  ],
  a11y: [
    'Native selects and inputs, every one labelled; each group is a labelled fieldset',
    'Adding and removing conditions moves focus to the next control and is announced politely',
  ],
  props: [
    labelProp,
    {
      name: 'fields',
      kind: 'array',
      required: true,
      description:
        'The fields a condition can test; options list the values of an enum field, and optionLabels maps a value to the text its menus show (the value otherwise).',
      schema: list(
        {
          key: id,
          header: text(120),
          type: { type: 'string', enum: [...FILTER_FIELD_TYPES] },
          options: { type: 'array', maxItems: 100, items: text(120) },
          optionLabels: { type: 'object', additionalProperties: text(120) },
        },
        ['key', 'header', 'type'],
        48
      ),
    },
    {
      name: 'value',
      kind: 'object',
      description:
        'The starting filter: {type:"group", op:"and"|"or", children:[{type:"condition", field, operator, value}…]}. It is checked against fields (at most 6 levels and 200 nodes); one that does not fit starts empty.',
    },
    {
      name: 'maxDepth',
      kind: 'number',
      default: 3,
      description: 'Deepest group level offered (the root is 1), capped at 5.',
    },
    {
      name: 'issues',
      kind: 'array',
      description:
        'Problems to show on conditions: each message appears under the condition at path (child indexes from the root) and marks its value control invalid. Paths that are not a condition are ignored.',
      schema: list(
        {
          path: {
            type: 'array',
            maxItems: 6,
            items: { type: 'integer', minimum: 0, maximum: 199 },
          },
          message: text(200),
        },
        ['path', 'message'],
        200
      ),
    },
    { name: 'disabled', kind: 'boolean', default: false },
  ],
  events: ['change'],
  examples: [
    {
      id: 'open-orders',
      title: 'Open orders',
      props: {
        label: 'Order filter',
        fields: [
          { key: 'status', header: 'Status', type: 'enum', options: ['open', 'closed'] },
          { key: 'total', header: 'Total', type: 'number' },
        ],
        value: {
          type: 'group',
          op: 'and',
          children: [{ type: 'condition', field: 'status', operator: 'eq', value: 'open' }],
        },
      },
    },
  ],
  related: ['data-grid', 'control-filter'],
});

/** Catalog id of a dashboard (spec 0.8.0, PLAN_010 T-dashboard). */
export const DASHBOARD_CATALOG_ID = 'data-dashboard' as const;
/** Catalog id of one dashboard widget; it belongs inside a `data-dashboard`. */
export const DASHBOARD_WIDGET_CATALOG_ID = 'data-dashboard-widget' as const;

/** Grid units of a widget's place (the caps of `@texuli/data/dashboard/engine`). */
const gridInt = (maximum: number, minimum = 0): CatalogValueSchema => ({
  type: 'integer',
  minimum,
  maximum,
});
const placeProperties: Record<string, CatalogValueSchema> = {
  x: { ...gridInt(23), description: 'First column, from 0 (the inline start).' },
  y: { ...gridInt(4096), description: 'First row, from 0.' },
  w: { ...gridInt(24, 1), description: 'Width in columns.' },
  h: { ...gridInt(48, 1), description: 'Height in rows.' },
  minW: gridInt(24, 1),
  minH: gridInt(48, 1),
  maxW: gridInt(24, 1),
  maxH: gridInt(48, 1),
  locked: { type: 'boolean', description: 'A locked widget never moves or resizes.' },
};

export const dataDashboardManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: DASHBOARD_CATALOG_ID,
  package: PKG,
  label: 'Dashboard',
  summary:
    'A widget grid people can rearrange: data-dashboard-widget children on columns and rows, moved and resized by drag or keyboard, reflowing on narrow screens.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'An overview of several views (KPIs, charts, grids bound to host data sources) people arrange themselves',
    'A home or operations screen whose layout should persist per person',
  ],
  dontUseWhen: [
    'A fixed grid of cards: use layout-grid',
    'One chart or one table: paint it on its own',
  ],
  a11y: [
    'A named region whose widgets are a list in reading order (row, then column), whatever order they were written in',
    'Each widget has a move handle and a resize handle: Space or Enter picks up, arrows move or resize one column or row, Space or Enter drops, Escape cancels; every step is announced with its column, row and size',
    'A click on a handle opens an arrange toolbar, so nothing needs a drag (WCAG 2.5.7); handles are at least 24 by 24 px',
    'Widgets glide to their new cell only when motion is allowed; reduced motion commits at once',
  ],
  props: [
    labelProp,
    {
      name: 'columns',
      kind: 'number',
      default: 12,
      description:
        'Columns of the widest grid (1 to 24). Narrower screens reflow onto at most 6 columns from 640 px and one column below.',
    },
    densityProp(['compact', 'default', 'comfortable']),
    { name: 'gap', kind: 'enum', enumValues: ['none', 'small', 'medium', 'large'] },
    {
      name: 'editable',
      kind: 'boolean',
      default: false,
      description: 'Shows the move and resize handles.',
    },
    {
      name: 'compaction',
      kind: 'enum',
      enumValues: ['vertical', 'none'],
      default: 'vertical',
      description: '"vertical" floats widgets up to close gaps; "none" keeps gaps.',
    },
    {
      name: 'layout',
      kind: 'array',
      description:
        "The saved layout of the widest grid: one {id, x, y, w, h} per widget, id matching a widget's widgetId. Bind it to a list state, or read it from a host data source, to persist what people arrange; without it the widgets' own place props lay out the grid.",
      schema: list({ id, ...placeProperties }, ['id'], 200),
    },
    {
      name: 'children',
      kind: 'slot',
      description: 'data-dashboard-widget nodes only (at most 200).',
    },
  ],
  events: ['change'],
  bindable: ['layout'],
  sourceable: ['layout'],
  examples: [
    {
      id: 'operations',
      title: 'Operations overview',
      props: {
        label: 'Operations',
        columns: 12,
        editable: true,
      },
    },
  ],
  related: [DASHBOARD_WIDGET_CATALOG_ID, 'layout-grid', 'data-grid'],
});

export const dataDashboardWidgetManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: DASHBOARD_WIDGET_CATALOG_ID,
  package: PKG,
  label: 'Dashboard widget',
  summary:
    'One titled widget of a data-dashboard, placed on the grid; its child is any content node, such as a chart, a KPI or a grid bound to a host data source.',
  tier: 'content',
  agentEmittable: true,
  useWhen: ['A tile of a data-dashboard'],
  dontUseWhen: ['Anywhere outside a data-dashboard: use layout-card'],
  a11y: [
    "Its title is a heading, and it names the widget's move and resize handles",
    'Its content is ordinary catalog nodes: no HTML, and data only from host-registered sources',
  ],
  props: [
    {
      name: 'widgetId',
      kind: 'string',
      required: true,
      description:
        'Stable id, unique in the dashboard: letters, digits, "-" and "_", at most 64 characters. The key of this widget in every saved layout.',
    },
    {
      name: 'title',
      kind: 'string',
      required: true,
      trust: 'untrusted',
      description: 'Visible title; also names the handles.',
    },
    {
      name: 'place',
      kind: 'object',
      description:
        'Where the widget starts on the widest grid when the dashboard has no saved layout for it: {x, y, w, h} in columns and rows, with optional minW, minH, maxW, maxH and locked. Without x and y it takes the first free slot.',
      schema: { type: 'object', properties: placeProperties },
    },
    { name: 'children', kind: 'slot', description: 'The widget content.' },
  ],
  examples: [
    {
      id: 'revenue',
      title: 'Revenue tile',
      props: { widgetId: 'revenue', title: 'Revenue', place: { x: 0, y: 0, w: 4, h: 2 } },
    },
  ],
  related: [DASHBOARD_CATALOG_ID],
});

export const DATA_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  dataBoardManifest,
  dataTreeViewManifest,
  dataCalendarManifest,
  dataGridManifest,
  dataFilesManifest,
  dataMapManifest,
  dataTimelineManifest,
  dataCohortTableManifest,
  dataNotificationInboxManifest,
  dataFilterBuilderManifest,
  dataDashboardManifest,
  dataDashboardWidgetManifest,
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
  { id: 'data-cohort-table', role: 'static' },
  { id: 'data-notification-inbox', role: 'interactive' },
  { id: 'data-filter-builder', role: 'interactive' },
  { id: 'data-dashboard', role: 'container' },
  { id: 'data-dashboard-widget', role: 'container' },
]);
