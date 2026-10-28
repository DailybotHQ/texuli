# Public import map (build-ui)

Prefer these entries. Never import package `src/internal` paths from apps.
Every package and its layer: [`../../router/packages.md`](../../router/packages.md)
(derived from the real `exports`).

## texuli (styled)

| Need | Import |
| --- | --- |
| Classes | `texuli/cx` — `cx`, `variants` |
| Button | `texuli/button` |
| Input / textarea | `texuli/input` |
| Card | `texuli/card` |
| Badge | `texuli/badge` |
| Select | `texuli/select` |
| Toggle | `texuli/toggle` |
| Dialog / sheet | `texuli/dialog`, `texuli/sheet` |
| Layout hosts | layout subpaths under `texuli` (see package exports) |

## @texuli/core (texels)

| Need | Import |
| --- | --- |
| Roving tab | `@texuli/core/roving` |
| URL policy | `@texuli/core/url-policy` |
| Focus scope | `@texuli/core/focus-scope` |
| Editor model and Markdown | `@texuli/core/editor-model`, `@texuli/core/editor-markdown` (not in the root barrel) |

Never `@texuli/core` root barrel for app code.

## @texuli/tokens

| Need | Import |
| --- | --- |
| Library themes | `@texuli/tokens/library` / `library-expand` |
| Modes | `@texuli/tokens/modes` |
| CSS compile | `@texuli/tokens` (`compileThemeCss`, `applyTheme`) |
| No-flash | `@texuli/tokens/no-flash` |
| AA gate | `@texuli/tokens/aa-gate` |

## @texuli/catalog

| Need | Import |
| --- | --- |
| Build | `@texuli/catalog/build`, `@texuli/catalog/build/node` |
| Manifest groups | `@texuli/catalog/manifests/display` (and forms, content, layouts, …) |
| Render | `@texuli/catalog/render/renderer` |
| Limits | `@texuli/catalog/render/limits` |
| Grammar | `@texuli/catalog/render/grammar` |
| Rich text nodes | `@texuli/catalog/render/richtext` |
| Artifact frame | `@texuli/catalog/render/frame` |
| Validate untrusted blueprints | `@texuli/catalog/validate` (`validateDraft`) |
| Envelope and lifecycle | `@texuli/catalog/envelope` |
| Edit ops and undo | `@texuli/catalog/edit` |
| Player core (framework-free) | `@texuli/catalog/player` |

## Layers above texuli

| Area | Import style |
| --- | --- |
| Data views | `@texuli/data/<view>` |
| Charts | `@texuli/charts/<family>` (`cartesian`, `compact`, `flow`, `geo`, `matrix`, `part-whole`, …) |
| Media | `@texuli/media/<area>` |
| Chat | `@texuli/chat` (`ChatThread`, `Composer`, `parseMessageText`) |
| Content blocks | `@texuli/blocks/<family>` (lazy) or `@texuli/blocks/<family>/renderers` |
| Decks (v2 engine) | `@texuli/deck/model` (`parseDeck`, `loadUntrustedDeck`, `DECK_LAYOUTS`), `@texuli/deck/markdown` (`parseDeckMarkdown`, `deckToMarkdown`), `@texuli/deck/authoring`, `@texuli/deck/templates`, `@texuli/deck/engine`, `@texuli/deck/math`; in development, on npm from `0.4.0`. See [`decks.md`](decks.md) |
| Decks (stage and v1) | `@texuli/slides/stage` (`DeckStage`, `prepareDeck`), `@texuli/slides/export` (`DeckPrintView`, print plan, PDF seam, PPTX), `@texuli/slides/model`, `@texuli/slides/grammar`, `@texuli/slides/templates` (report, pitch, review; v1) |
| Rich text editor | `@texuli/editor/editor` (`RichTextEditor`), `@texuli/editor/toolbar`, `@texuli/editor/controller`, `@texuli/editor/markdown` (`markdownToDocument`, `documentToMarkdown`); in development, workspace only (not on npm yet; publishable from `0.5.0`) |
| Astro sites | `@texuli/astro` (`texuli()` integration), `@texuli/astro/styles.css`, `@texuli/astro/site` (`defineSite`, `sitePageMeta`, `siteSitemap`), `@texuli/astro/layouts/ContentLayout`, `@texuli/astro/appearance` (`AppearanceSwitcher`; repository only) |
| Paint a validated blueprint | `@texuli/player` (+ `@texuli/player/styles.css`) |
| Drag and drop (Svelte) | `@texuli/primitives/sortable` (`Sortable`); views: `@texuli/data/board`, `@texuli/data/tree-view` |
| Drag engine (framework-free) | `@texuli/drag/sortable`, `@texuli/drag/gesture`, `@texuli/drag/spatial`, `@texuli/drag/graph`, `@texuli/drag/messages`; in development, on npm as `0.4.0` |
| Workflows | `@texuli/workflows/editor`, `@texuli/workflows/viewer`, `@texuli/workflows/inspector`, `@texuli/workflows/model`, `@texuli/workflows/layout`, `@texuli/workflows/spec-adapter`; in development, on npm as `0.4.0` |
| Dates | `@texuli/date` (`CalendarDate`, Gregorian only) |
| Class helpers from those packages | `texuli/cx` only |

## Prepared for 0.5.0 (repository only, not on npm yet)

These APIs exist in a Texuli workspace and ship with `0.5.0`; npm `0.4.0`
does not have them. Use them only when the project imports the workspace
(or after `0.5.0` is published), and keep `^0.4.0` code on the old API.

| Need | Use |
| --- | --- |
| Stop a streaming reply | `Composer` (and `ChatThread`) `streaming` + `onStop`: the send button becomes Stop, Escape stops; `onkeydown` runs before the built-in keys (`preventDefault()` takes a key over); an `actions` snippet gets `{ canSend, busy, streaming, submit, stop }` |
| Message actions and edit | `MessageList` / `ChatThread` `actions` snippet (`edit()`, `canEdit`) and `onEdit(message, body)`; return `false` to keep the editor open |
| Page a client-side table | `DataGrid` (`@texuli/data/grid-core`) `pageSize` + `bind:page`, `rowClass(row)`, `filters`, `toolbar` and `bulkActions` (`{ selected, rows, clear }`) snippets |
| Undo after a toast | `toast.info(msg, { action, onSettle(reason) })` from `texuli/toast`: `reason` is `timeout`, `action` or `dismiss`, called once; `pause()`, `resume()`, `announcement(id?)` on the store |
| A time of day | `TimeField` from `texuli/date` (`bind:value` as `"HH:mm"`, `hourCycle`, `minuteStep`) |
| Deterministic dates | `today="YYYY-MM-DD"` on `Calendar`, `DatePicker` and `DateRangePicker` (no clock reads), plus `weekStartsOn`, `maxDays` and `onInvalid` |
| A trend in a KPI tile | `Sparkline` from `@texuli/charts/sparkline-lite`: the compact props, no data table, lighter first screen; use `@texuli/charts/compact` when readers need the values table |
| Markdown in an editor | `markdownToDocument(source)` (untrusted tier by default, HTML stays text) and `documentToMarkdown(doc)` from `@texuli/editor/markdown` |
| Nested filters, inbox, cohorts | `FilterBuilder` (`bind:value` or `onValueChange`) + `applyFilter` (`@texuli/data/filter-builder`), `NotificationInbox` (`@texuli/data/activity/inbox`), `CohortTable` (`@texuli/data/cohort`) |
| A content page with its own TOC | `ContentLayout` from `texuli/layouts/content` (children, `toc` entries, `tocLevels`) |

Behavior changes to expect in `0.5.0`: `Input` with `type="number"` or
`range` binds a number or `null`; `type="file"` binds `files` as `null`
until a pick; a caller `oninput` (or `onclick`, `onkeydown` on primitives)
runs before the built-in handler instead of replacing it. Full list:
`docs/RELEASE.md` in the Texuli repository ("0.5.0 (unreleased,
prepared)").

## CSS layers

```css
@layer tx.base, tx.components;
```

Consumer utilities win over component defaults when ordered correctly.
