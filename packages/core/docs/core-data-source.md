# Core data sources: host-registered data for generated views

**Package:** `@texuli/core`
**Subpath:** `@texuli/core/data-source` (subpath only; new in 0.8.0)
**Source:** `packages/core/src/data-source/`
**Tests:** `packages/core/tests/data-source.test.ts`,
`packages/core/tests/data-source-loader.test.ts`
**Decision:** [ADR-015](../../../docs/DECISIONS.md#adr-015-one-bounded-expression-language-and-closed-vocabularies-for-agent-logic)

Generated views read and write the host's data through sources the host
registers. A blueprint names a source and sends a closed query; it never
carries a URL, SQL, a query string or code. The host's adapter receives the
validated query and decides how to run it.

```ts
import {
  createSourceCollection,
  createSourceLoader,
  createSourceRegistry,
  defineSource,
  sourceError,
} from '@texuli/core/data-source';

const tickets = defineSource(
  'tickets',
  {
    key: 'id',
    fields: [
      { name: 'id', type: 'text' },
      { name: 'title', type: 'text', filter: true, sort: true, editable: true, required: true },
      { name: 'status', type: 'enum', options: ['open', 'doing', 'done'], filter: ['eq', 'in'], editable: true },
      { name: 'points', type: 'number', filter: true, sort: true },
    ],
    operations: ['list', 'update', 'search'],
    pagination: 'cursor',
    maxPageSize: 100,
  },
  {
    async list({ query, page, signal }) {
      // The host's own client: Texuli never builds this request.
      const response = await api.tickets.list({ query, page }, { signal });
      if (response.status === 429) throw sourceError('rate-limited', { retryAfterMs: 2000 });
      return { rows: response.items, nextCursor: response.next };
    },
    async update({ id, changes, signal }) {
      return api.tickets.update(id, changes, { signal });
    },
  }
);

const registry = createSourceRegistry([tickets]);
const loader = createSourceLoader({ registry });
const view = createSourceCollection(loader, 'tickets', { sort: [{ field: 'points', direction: 'desc' }] });
view.subscribe((state) => render(state.rows));
await view.load();
```

## Declarations

- `defineSource(name, schema, adapter)` checks the declaration and throws a
  `TypeError` for a mistake: a name outside `SOURCE_NAME_PATTERN`
  (`tickets`, `crm.contacts`), a duplicate or malformed field name, an
  unknown type, an operator the type does not take, an enum without
  options, a key that is not a text or number field (or is editable), an
  operation without its adapter method, or a page size over
  `SOURCE_LIMITS.pageSize` (500).
- Field types (`SOURCE_FIELD_TYPES`) are the `@texuli/data` grid's: `text`,
  `enum`, `number`, `date`, `boolean`. `filter: true` allows every operator
  of the type (`SOURCE_OPERATORS_BY_TYPE`, the grid's `OPERATORS_BY_TYPE`),
  a list allows those, and the default allows none. `sort`, `editable` and
  `required` default to `false`.
- Operations (`SOURCE_OPERATIONS`): `list`, `get`, `create`, `update`,
  `delete`, and `search` (free search text on `list`). Pagination
  (`SOURCE_PAGINATION_STYLES`): `cursor` (opaque, at most 512 characters),
  `offset` or `none`.
- `describeSource` returns the plain, frozen `SourceDescriptor`: what the
  catalog and the spec validators and agents read. It never carries the
  adapter.
- `createSourceRegistry(sources)` holds at most 256 sources. `has`, `get`,
  `names`, `describe(name)`, `describe()` and `register` (which returns the
  removal); lookups use a `Map`, so `constructor` or `__proto__` never
  resolve.

## Queries

`checkSourceQuery(descriptor, input)` validates an untrusted query and
returns a frozen copy holding only checked members, or every issue (at
most 32) with a code and a JSON path. The closed members
(`SOURCE_QUERY_KEYS`):

| Member | Shape | Limits |
| --- | --- | --- |
| `fields` | field names to return (the key always comes back) | 1 to 32, declared fields |
| `filter` | the grid filter model: `{ type: 'group', op: 'and' \| 'or', children }` and `{ type: 'condition', field, operator, value }` | 6 levels, 64 nodes; operators the field allows; values fit the field's type; `in` at most 100 values; text at most 500 characters |
| `sort` | `{ field, direction: 'asc' \| 'desc' }` | 1 to 4 keys, sortable fields, each once |
| `search` | text | at most 200 characters; only when the source declares `search` |
| `pageSize` | a positive integer | at most the source's `maxPageSize` |

Issue codes: `shape`, `limit`, `unknown-field`, `operator`, `value`, `sort`,
`search`, `page-size` and `operation` (a source that cannot list). The
filter's size is measured without recursion before anything recurses into
it, so a tree nested 100,000 levels deep or 100,000 nodes wide is refused in
linear time. Strings are data: the adapter receives them exactly as they
came, inside the validated copy, and nothing concatenates them into
anything. `sourceQueryKey(source, query, page)` is the canonical cache key
(member order and projection order do not matter); `stableJson` is the
canonical JSON it uses.

## The loader

`createSourceLoader({ registry, clock?, retry?, timeoutMs?, cache? })`
returns a `SourceLoader`. Its methods never throw or reject; each resolves a
`SourceResult` (`{ ok: true, value }` or `{ ok: false, error }`).

- **`checkQuery(name, query)`** resolves the name and validates the query
  without loading.
- **`list(name, query, { cursor?, offset?, signal?, fresh? })`** loads one
  page. Identical reads in flight share one adapter call; a caller's abort
  leaves the shared read, and the read is aborted when its last caller
  leaves. An already aborted signal starts nothing.
- **Retries:** reads that fail with a retryable code (`RETRYABLE_SOURCE_ERRORS`:
  `rate-limited`, `timeout`, `network`, `unavailable`) are retried
  `retry.retries` times (default 2) after `baseDelayMs * 2^attempt`
  (default 300 ms, capped at `maxDelayMs`, 5 s), or after the error's
  `retryAfterMs` (capped at 60 s). Writes are never retried: a write that
  may have landed must not land twice.
- **Timeouts:** each attempt has `timeoutMs` (default 15,000; `0` disables
  it); a slow attempt is aborted and fails as a retryable `timeout`.
- **Responses are checked** before anything sees them: a page with more rows
  than asked, a row without a usable key (a string up to 256 characters or
  a finite number), two rows with the same key, or a malformed cursor is
  `invalid-response`. A value that does not fit its field's type becomes
  `null`, and undeclared or unprojected fields are dropped
  (`readSourceRow`).
- **Cache:** pages are cached by query key (default 64 entries, fresh for
  30 seconds; `cache: false` disables it). `peek` reads a fresh page
  synchronously. `invalidate(name?, origin?)` drops a source's pages and
  tells its `subscribe` listeners; a page that started loading before an
  invalidation is not cached, and new calls no longer join it (they start a
  fresh read, so a list after a write sees post-write rows). The detached
  read is not aborted: the callers already waiting on it still settle.
  `inFlight()` counts only the reads a new call can join.
- **Writes:** `create`, `update` and `remove` check their values against the
  declaration first (declared, `editable`, fitting the type; `required`
  fields on create; never the key) and fail as `invalid-input` with issues
  otherwise. A write that lands invalidates its source with the caller's
  `origin`. `get` reads one row.
- **Time** comes from the `clock` option (`SourceClock`: `now`,
  `setTimeout`, `clearTimeout`; default `SYSTEM_SOURCE_CLOCK`), so tests
  advance a manual clock instead of waiting.

## Collections

`createSourceCollection(loader, name, query, options?)` holds what one view
shows. Its `state` (`SourceCollectionState`) has `status` (`idle`,
`loading`, `ready`, `error`), `rows`, `error`, `refreshing`, `hasMore`,
`loadingMore`, `moreError`, `total`, `pending`, `writeError` and `version`.

- `load()` loads the first page (rows already shown stay until it lands);
  `loadMore()` appends the next page by cursor or offset, showing a row that
  shifted between pages once; `retry()` reloads after a failed load or asks
  for a failed page again.
- `update`, `create` and `remove` are optimistic: the change shows at once,
  and confirmed rows and pending writes are kept apart. The source's row
  replaces the optimistic one when the write lands; a failed write is
  dropped, which rolls back exactly that write even while others are
  pending, and sets `writeError`. A created row has a temporary key
  (`PENDING_ROW_PREFIX`) until the source answers.
- A write from another view to the same source reloads the collection
  (`autoRefresh`, default `true`); its own writes do not.
- An unknown source or a refused query puts the collection in `error` at
  once, and nothing loads. `destroy()` aborts every read and write in
  flight.

## Errors

Every failure is a `SourceError` (`sourceError(code, init)`): an `Error`
with a closed `code` (`SOURCE_ERROR_CODES`), a `retryable` flag, a
`messageKey` (`dataSource.error.<code>`) and optional `source`, `issues` and
`retryAfterMs`. Its `message` is for developers and never shown to people;
`sourceErrorMessage(error, messages?)` gives the user-facing text (English
defaults in `SOURCE_ERROR_MESSAGES`, translated by key). Adapters throw
`sourceError(code)`; anything else they throw becomes `failed` (not
retryable) with the original in `cause`, and an `AbortError` becomes
`aborted`. A look-alike object is never trusted (`isSourceError`).
`canRetrySourceError` says whether a retry button can help: not for
`FINAL_SOURCE_ERRORS` (`unknown-source`, `unsupported`, `invalid-query`,
`invalid-input`, `aborted`).

## Reference

- **Declarations** (`schema.ts`): `SourceSchemaDeclaration` and
  `SourceFieldDeclaration` (what the host writes), `SourceDescriptor` and
  `SourceFieldDescriptor` (what validators read), `SourceFieldType`,
  `SourceOperation`, `SourcePaginationStyle`, `SourceFilterOperator`,
  `SOURCE_FILTER_OPERATORS`, `SOURCE_FIELD_PATTERN`, `isSourceName`,
  `isSourceFieldName` and `sourceField(descriptor, name)` (an own lookup).
- **Adapters and rows** (`registry.ts`): `DataSource`, `SourceAdapter`,
  `SourceListRequest` (`query`, `page`, `signal`), `SourcePageRequest`
  (`size`, `cursor`, `offset`), `SourcePage` (`rows`, `nextCursor`,
  `hasMore`, `total`), `SourceRegistry`, `SourceRow`, `SourceRowId` and
  `SourceValue` (a string, number, boolean or `null`).
- **Queries** (`query.ts`): `SourceQuery`, `SourceFilterNode`
  (`SourceFilterGroup` or `SourceFilterCondition`), `SourceSort`,
  `SourceQueryCheck`, `SourceQueryIssue`, `SourceQueryIssueCode`,
  `fitsSourceField(field, value)` and `isSourceDate(value)` (an ISO 8601
  date or date-time, or epoch milliseconds).
- **Loader** (`loader.ts`): `SourceLoaderOptions`, `SourceRetryPolicy`
  (`DEFAULT_SOURCE_RETRY`), `MAX_RETRY_AFTER_MS`, `SourceCallOptions`,
  `SourceListOptions`, `SourceMutationOptions`, `SourceListResult`,
  `SourceInvalidation`, `SourceQueryResolution` and `isSourceRowId`.
- **Collections** (`collection.ts`): `SourceCollection`,
  `SourceCollectionOptions` (`autoRefresh`, `createAt`) and
  `SourceCollectionStatus`.
- **Errors** (`errors.ts`): `SourceErrorCode`, `SourceErrorMessageKey`,
  `SourceErrorInit` and `toSourceError(thrown, source?)` (how the loader
  reads what an adapter threw).

## Where it is used

`@texuli/player` resolves blueprint data-source bindings
(`{"$source": name, "query": {…}}`, blueprint spec 0.8.0) through a host
registry, and `@texuli/catalog`'s `validateDraft` checks them against
`registry.describe()`; see the player's
[data sources guide](../../player/docs/data-sources.md).
