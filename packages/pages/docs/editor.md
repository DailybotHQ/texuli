# `@texuli/pages/editor`

The block document editor (ADR-011). It edits a `@texuli/document` document
and never mutates it: every edit (typing, a slash insert, a move, a resize,
an undo) is a transaction of `@texuli/document/ops` operations applied
through one op log.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```svelte
<script lang="ts">
  import { PageEditor, type PagesEditor } from '@texuli/pages/editor';

  let { initial } = $props();
  let doc = $state.raw(initial); // a validated TexuliDocument
  let editor = $state<PagesEditor>();
</script>

<PageEditor
  document={doc}
  bind:editor
  onChange={(next, entry) => {
    doc = next;
    save(entry); // the op log entry: operations and their inverse
  }}
  trail={[{ ref: 'pages/home', title: 'Home' }]}
  onNavigate={(ref) => open(ref)}
  createPage={() => ({ ref: `pages/${crypto.randomUUID()}`, title: 'Untitled' })}
/>
```

## `PageEditor`

| Prop | Default | Meaning |
| --- | --- | --- |
| `document` | — | The document, validated (`loadUntrustedDocument` from `@texuli/document/schema`). A new value from outside restarts history |
| `onChange` | — | `(doc, entry)` after every accepted change, with the `OpLogEntry` that made it (edits, undos and redos) |
| `label` | the title | The editor region's accessible name |
| `labels` | English | Partial `PagesLabels` |
| `readonly` | `false` | No editing: the surfaces are `aria-readonly`, no drag, no menu |
| `trail` | `[]` | Ancestor pages (`PageRef`), outermost first; the breadcrumb ends with the document title |
| `onNavigate` | — | `(ref)` when a page link or a breadcrumb entry is activated |
| `pageHref` | — | `(ref) => href` for page links and the breadcrumb (app code: `safeHref` at the `developer` tier); without it they are buttons |
| `createPage` | — | Creates a nested page for the menu's page item (`PageRef`, or a promise of one); without it the item is hidden |
| `resolveEmbed` | — | An `EmbedResolver` for embeds that hold a `ref` |
| `resolveMedia` | — | A `MediaResolver`; the source passes `safeImageSrc` at the untrusted tier, otherwise the alt text shows |
| `deckHost` | `null` | The player's `DeckPlayerHost`, to present deck embeds on a stage (`@texuli/slides` is also L8, so the host brings it) |
| `components` | `DEFAULT_COMPONENT_EMBEDS` | The catalog components (`ComponentEmbedOption`) the menu offers |
| `motion` | layout on | The `texuli/motion` prop for inserts, removes and reorders; `false` is instant |
| `editor` | created | Bindable `PagesEditor`, for hosts that drive it |
| `announce` | the core announcer | Where polite announcements go |
| `class` | — | Extra classes on the root |

The root is a `section` named by `label`. Each block is a row: an insert
button, a drag handle and the block.

### Keyboard

| Where | Keys | Effect |
| --- | --- | --- |
| Text | the `@texuli/editor` keymap | Marks, headings, lists, Markdown shortcuts, paste |
| Text | `/` in an empty paragraph | Opens the slash menu in place of the paragraph |
| Text | Enter / Backspace at the start / Delete at the end | Split into a new row / join the row before / pull the next row in |
| Text | Arrow keys at the first or last line or offset | Move the caret to the previous or next row (reading order, into columns and containers) |
| Text or handle | Alt+Up, Alt+Down | Move the block among its siblings, announced ("… moved to position 3 of 7.") |
| Text | Escape | Select the block (focus its handle) |
| Handle | Space or Enter, arrows, Space or Enter, Escape | Pick up, move (across lists), drop, cancel (`@texuli/drag` contract) |
| Handle | Delete or Backspace | Remove the block (a list it empties keeps an empty paragraph) |
| Handle | Up, Down / Escape | Previous or next row / back to the text |
| Slash menu | type, Up, Down, Enter, Escape, Backspace on empty | Filter, move, insert the active item, close |
| Column separator | Left, Right (flipped in right-to-left), Home, End | One twelfth narrower or wider, the limits |
| Anywhere | Mod+Z, Mod+Shift+Z | Undo, redo (through the op log) |

Text rows hold their handle at `tabindex="-1"` (Escape reaches it), so Tab
walks the text; other blocks' handles are in the Tab order.

## State: `PagesEditor`

`new PagesEditor(options)` (`PagesEditorOptions`: `document`, `idPrefix`,
`labels`, `announce`, `onChange`, `tier`, `groupMs`, `limit`, `now`) wraps
`createDocumentHistory` from `@texuli/document/ops`. Reactive fields: `doc`,
`selected` (block selection), `focus` (a `PagesFocusRequest` a row takes),
`slash` (a `PagesSlashRequest`), `revision`, `canUndo`, `canRedo`.

| Method | Effect |
| --- | --- |
| `apply(operations, { group })` | Apply one transaction; a `group` run within `groupMs` (1,000) is one undo step; a refusal changes nothing and is announced |
| `undo()`, `redo()` | Replay the op log's inverses (new log entries); focus returns to the touched row |
| `log()` | The op log, oldest first |
| `load(doc)` | Replace the document (history restarts) |
| `locate(id)` | A `Located` node: `node`, `parent`, `index`, `siblings` |
| `rowOf(id)` | The row that holds a node |
| `commitText(rowId, blocks, selection)` | A text row's editor blocks became document operations (`textRowOperations`) |
| `mergeBackward(id)`, `mergeForward(id)` | Join text rows |
| `navigate(id, direction)` | Focus the previous or next row |
| `insertItem(item, request, createPage)`, `insertNode`, `insertParagraphAfter` | Insert blocks with fresh ids |
| `remove(id)`, `moveBy(id, delta)`, `moveTo(id, parent, index)` | Remove and move blocks |
| `setColumnWidths(id, widths)`, `setAttrs(id, attrs)` | Attribute changes |
| `openSlash`, `closeSlash`, `select`, `requestFocus`, `focused`, `say`, `typeLabel`, `nameOf` | UI state and names |
| `connectSync(sync)` | Put the editor on a synced session (a `PagesEditorSync`: `commit`, `undo`, `redo`, `canUndo`, `canRedo`): accepted transactions go to `commit`, undo and redo become the session's; `null` disconnects. `synced` tells whether one is connected |
| `applyExternal(operations, origin)` | Apply a merged remote change, a session undo or a restore as a `sync` entry of the op log, never on the local undo stack |
| `setIdPrefix(prefix)` | New block ids start with `prefix` (a synced editor uses one per replica, so concurrent inserts never share an id) |
| `lastSeq()`, `mapPoint(point, since)` | The newest log sequence number, and a text point moved through the external entries after `since` (text rows keep the caret where it was when a peer types before it) |

## Text rows

A top-level text block (paragraph, heading, code, list or quote made only of
editor vocabulary: `isTextRow`, `isEditorBlock`, `TEXT_ROW_TYPES`) is edited
by its own `@texuli/editor` surface over `rowEditorDocument(block)`. The
controller is a `RowController` (an `EditorController` with
`RowControllerHooks`: undo and redo go to the op log, `/` opens the menu,
Backspace and Delete join rows, Enter leaves a one-line field such as a
toggle summary). `textRowOperations(parent, index, previous, next)` turns
what the editor produced into operations by id (`updateOperations` for a
block that kept its id: `replace-text` and `set-attrs`, or a replace).
Helpers: `inlineLength`, `textLeaves`, `leafLength`, `containsId`,
`blockExcerpt`.

## Slash menu

`coreSlashItems(labels, { components, pages })` lists the built-in
`SlashItem`s (`value`, `label`, `group` as a `SlashGroup`, `keywords`,
`create(newId, page)`, `needsPage`): text, layout, a page (with
`createPage`), component embeds (`DEFAULT_COMPONENT_EMBEDS`: a line chart, a
donut chart and a table with fictional data) and a deck (`SAMPLE_DECK`).
`loadBlockItems()` adds one item per `@texuli/blocks` block type (the blocks
catalog loads on first use) through `blockSlashItems(catalog)`, which reads
`BlockCatalogLike` entries and adds `EXTRA_BLOCK_SAMPLES` for the families
the catalog metadata does not list yet (diagram, interactive, map, embed).
`filterSlashItems(items, query)` keeps the items whose label or keywords
hold every word (folded by `foldText`: case and accents ignored), label
prefixes first; it is linear in the items. A `PageRef` is `{ ref, title }`.

## Block lists, moves and columns

`blockContainers(doc)` lists every block list (the top level is
`ROOT_LIST`; callouts, toggles, quotes and columns hold the others, with
`parentId`) as sortable containers in one `BLOCK_GROUP`, so blocks drag
between lists. `childList(block)` is a row's own list; `listOfParent` and
`parentOfList` convert ids. `rowOrder(doc)` and `adjacentRow(doc, id, dir)`
give the reading order arrow keys walk; `moveTarget(index, delta, count)` is
where a keyboard move lands.

Columns split `COLUMN_UNITS` (12): `columnWidths(columns)` reads the stored
widths (even shares when absent), `resizeColumns(widths, index, steps)`
moves share across a separator down to `MIN_COLUMN_WIDTH` (2), and
`pointerSteps(delta, size)` converts pointer travel.

## Embeds and media

`planEmbed(embed, payload)` returns an `EmbedPlan`: a `player` blueprint, a
`reference` (sheets and canvases, planned) or `refused`.
`componentBlueprint(payload)` wraps one catalog component in `layout-page`;
`deckBlueprint(deck)` maps a deck model v2 to `layout-deck` (structured
slides for a deck host, `deck-slide` children for the document flow). A
`BlueprintNode` is plain JSON. `EmbedResolver` resolves `ref` embeds.
`wrappedBlockInput(node)` is what the `@texuli/blocks` family renderer of a
wrapped block reads. `MediaResolver` and `mediaSource` resolve images through
`safeImageSrc`; `pageLinkHref` passes the host's `pageHref` through
`safeHref`.

## Labels

`DEFAULT_PAGES_LABELS` holds every string (`PagesLabels`);
`resolvePagesLabels(overrides)` merges partial overrides (empty strings never
replace a default).

## Not done yet

- Text selection across rows, multi-block selection and copy of blocks.
- Comments, suggestions, history and presence ship in `@texuli/pages/collab`
  (`CollabEditor`); the paged view and export are `paged` and `export`.
- Sheet and canvas embeds show their typed reference; painting them through
  `@texuli/sheets` and `@texuli/canvas` is planned. Embedded players get no
  `formHost`, `canvasHost` or sheet host, so a component embed holding a
  `schema-form`, `canvas` or `spreadsheet` node is refused rather than painted.
- Editing a callout's tone, a code block's language and an embed's payload
  from the UI.
