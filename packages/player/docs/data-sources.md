# Player data sources (blueprint spec 0.8.0)

**Status:** unreleased, planned for `0.8.0` (ADR-012, ADR-015).
**Source:** `packages/player/src/sources/`, `packages/player/src/state/bind.ts`
**Tests:** `packages/player/tests/data-sources.test.ts`, the `source-tickets`
golden in `packages/player/tests/golden.test.ts` and
`packages/player/tests/stream-session.test.ts`

A generated view can show the host's data without the blueprint carrying
it. A component's **sourceable** prop (its rows) names a source the host
registered and sends a closed query; the player checks the binding, loads
the rows through the host's adapter, and writes edits back through the same
adapter. The blueprint never carries a URL, SQL, a request or code, and the
player never fetches: only the host's adapters reach data.

```svelte
<script lang="ts">
  import { Player } from '@texuli/player';
  import { createSourceRegistry, defineSource } from '@texuli/core/data-source';

  const tickets = defineSource('tickets', ticketSchema, ticketAdapter); // see core-data-source.md
  const sourceRegistry = createSourceRegistry([tickets]);
</script>

<Player blueprint={draft} {sourceRegistry} />
```

The blueprint side:

```json
{
  "id": "data-grid",
  "props": {
    "caption": "Open tickets by points",
    "columns": [{ "id": "title", "header": "Title" }, { "id": "points", "header": "Points", "kind": "number" }],
    "rows": {
      "$source": "tickets",
      "query": {
        "fields": ["title", "points"],
        "filter": { "type": "condition", "field": "status", "operator": "in", "value": ["open", "doing"] },
        "sort": [{ "field": "points", "direction": "desc" }],
        "pageSize": 25
      }
    }
  }
}
```

## Props

- `sourceRegistry` (`SourceRegistry | null`): the host's registry from
  `@texuli/core/data-source`. Its descriptors (`registry.describe()`)
  check every binding; the player makes its own loader over it.
- `sourceLoader` (`SourceLoader | null`): a shared loader instead (its
  cache and in-flight reads then span players); its registry is used.

Both work with `<Player>` and `mountPlayer`. The iframe frame protocol
(`PlayerFrame`) cannot carry a registry (adapters are code and stay in the
host's page), so a framed player refuses source bindings; a frame-side
source bridge is planned.

Without either, **every source binding is refused** (state issue `source`,
the notice paints instead of the tree). The loader, collections and views
load lazily, only when one of these props is set.

## Which props read sources

The catalog's `sourceable` list (spec 0.8.0): `data-grid.rows`,
`data-board.items`, `data-tree-view.items`, `data-calendar.events`,
`data-files.entries`, `data-timeline.tasks`,
`data-notification-inbox.items` and, from spec 0.8.0 (0.8.0, unreleased),
`data-dashboard.layout` (a host source that persists a dashboard's layout:
one record per widget, `id` the `widgetId`, with `x`, `y`, `w`, `h`, the
`min`/`max` sizes and `locked` in grid units, at most 200). A `$source` binding anywhere else (another
prop, a value nested inside a prop, or next to `$state`) is refused.
Charts and the cohort table do not read sources yet (planned).

Rows become items by the prop's shape (`src/sources/shapes.ts`):

- **Records** (every sourceable prop except the grid): each item field reads
  the source field of the same name, or the one the binding's `map` names
  (`"map": { "column": "status" }` puts a ticket's status in a board
  column). The item `id` is the row key as text; `null` values are left out.
- **Cells** (`data-grid.rows`): the grid's column ids name source fields,
  and each cell is the field's value as display text.

At most the prop's `maxItems` rows are shown (200 for the inbox and the
dashboard layout, 500 for the others); load-more stops there. The items then meet the same validation and
paint-time URL policy (untrusted tier) as literal props: a row's `href` that
the policy refuses is removed.

## Checks

Before anything loads, the resolver checks each binding with
`checkSourceBinding` from `@texuli/spec/source` against the host's
descriptors: the closed shape (`$source`, `query`, `map`), a registered
name, declared fields, the operators each field allows and values of its
type, sortable fields, `search` only on sources that declare it, a page size
within the source's `maxPageSize`, and `map` keys that are item fields of
the prop. A refusal is a state issue (`source` or `unknown-source`) and the
blueprint is refused, as `validateDraft` and the spec refuse it. A streamed
draft is checked the same way, and its bound props stream as empty lists;
nothing loads until the complete draft is painted.

## What a bound node shows

The node paints inside a source frame (`data-tx-player-source` is
`loading`, `ready` or `error`):

| State | What shows | Assistive technology |
| --- | --- | --- |
| First load | A skeleton with "Loading {caption}…" | The frame is `aria-busy`; the text is a `status` region |
| Loaded, rows | The component, then a **Load more** button while the source has more | "{count} more shown." is announced politely after a page |
| Loaded, no rows | "Nothing to show yet." (`role="note"`) | |
| Failed | "{caption} could not be loaded. {reason}" and **Try again** when asking again can help | The failure is announced politely |
| A refresh or page failed | The rows stay, with the reason and **Try again** | Announced politely |
| An edit was refused | The rows roll back, with "The change was not saved and has been undone. {reason}" | Announced politely |

The reason is the source error's user-facing message
(`sourceErrorMessage`), never what an adapter threw. **Try again** is
offered unless the error is final (`unknown-source`, `unsupported`,
`invalid-query`, `invalid-input`, `aborted`). A load-more or retry button
that goes away hands focus to the frame (`tabindex="-1"`), never to the
document; **Load more** stays focusable and `aria-disabled` while a page
loads. Another view's write to the same source reloads the node.

Labels (`labels` prop): `sourceLoading`, `sourceEmpty`, `sourceFailed`,
`sourceRetry`, `sourceLoadMore`, `sourceLoadingMore`, `sourceLoadedMore`,
`sourceSaveFailed`, and `sourceErrors` (translations of the error reasons
by message key, `dataSource.error.<code>`).

## Edits

A painter that edits its rows writes them back through the player's
interaction access. For a source-bound prop the player diffs the edited
items against the rows, maps changed item fields back to source fields
(through `map`), keeps only fields the source declares `editable` with
values of their type, and sends each changed row as an optimistic
`update`. The change shows at once; when the source refuses it, the rows
roll back exactly (other pending edits stay) and the refusal is announced.
An edit with nothing the source can store snaps back.

- **Board moves** (`data-board`): the board shows the move at once, waits
  for the source through `PlayerInteraction.save`, and puts the card back
  (announcing it, as the board does for any failed move) when the source
  refuses. In the `source-tickets` golden a move writes the ticket's
  `status`.
- **Grid editing** is planned: the player's `data-grid` painter is
  read-only today.

## Native

The Kotlin twin validates bindings with the same rules
(`checkSourceBinding` in `texuli-spec`, the host's descriptors passed to
`loadBlueprint(sources = …)`, refused without them). The Compose renderer
does not load sources yet: a bound node paints an `unsupported-source`
placeholder (planned).
