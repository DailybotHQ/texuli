# Blueprint builder (texuli.com)

**App:** `apps/website`  
**Surface:** `src/components/builder/`, `src/pages/builder/`  
**Tests:** `scripts/tests/site-builder.test.ts`, `scripts/tests/site-builder-dom.test.ts`, `scripts/tests/site-builder-roundtrip.property.test.ts`, `tests/e2e/site-builder.spec.ts`

## Goal

Compose an untrusted catalog blueprint from manifests: insert components from
the palette, arrange them in the structure outline, edit manifest-defined
props in the inspector, and keep the JSON payload and the
[player](../../../packages/player/README.md) preview in sync. Drafts stay in
the browser; nothing is activated or persisted by the builder. It does not
write drafts to `localStorage` or `sessionStorage`. **Copy JSON** is an
explicit user action that copies the canonical draft JSON to the system
clipboard.

Hosts that want the same flow in their own app (validate, edit with undo,
digest, paint) should read the
[blueprint flow guide](../../../packages/player/docs/blueprint-flow.md). It
covers the public `@texuli/player` and `@texuli/catalog` exports this
builder uses; the builder's own code is website code, not a package.

## Shell

| File | Role |
| --- | --- |
| `src/pages/builder/index.astro` | The page; mounts `BuilderApp` as a `client:load` island |
| `BuilderApp.svelte` | Owns the draft and the selection, wires the panes below, and routes every write through one history |
| `manifest.ts` | `BUILDER_MANIFESTS`: the Tier U content manifests and the page, doc, card and grid layouts that `PLAYER_LOADERS` paints (39 ids). This is the closed id set the history and the payload panel accept |
| `model.ts` | `EMPTY_BLUEPRINT` (an empty `layout-page`), `canonicalJson`, `MAX_BLUEPRINT_BYTES`, `duplicateJsonKeys`, `validateBuilderTree` and `createBuilderHistory`. The history's commit gate is the tree limits plus one closed rule (only `id`, `props` and `children`; palette ids; manifest prop names; never `class`, `style` or `on*`). It is not the full `validateDraft`, so a draft with a wrong prop value or a grammar error can still be built step by step, and the preview lists those errors |

## Palette

`src/components/builder/palette/` is a self-contained unit. It imports only
`@texuli/catalog` and `@texuli/player`, never website code, so it can move
into a future `@texuli/builder/palette` package as a file move. That package
is a **draft** in the builder design (open decision 1); nothing has been
extracted yet.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: manifests → entries (`createPaletteEntries`), search (`searchPalette`), grouping, the live count text and arrow movement |
| `sources.ts` | The default manifests (every Tier U manifest in the player's catalog), `playerPaints` (the player's loader map) and `unavailableReason` (why a painted id is not insertable here) |
| `Palette.svelte` | The searchable, keyboard-navigable list |

**Contents: Tier U only.** An entry is any manifest with
`agentEmittable: true`. Each shows its label, summary, a **Tier U** badge with
the manifest's catalog tier (`content`), and how many props the manifest marks
required. Entries are grouped as Layouts, Content blocks, Charts, Media,
Interaction and Chat display.

**What can be inserted.** Every Tier U id that the player paints and whose
props all have a working inspector field is insertable (`manifest.ts`): the
content block, chart and media families, the page, doc, card and grid
layouts, the stack, row, split and grid tile layouts, and the host region.
Every other Tier U id in the player's catalog is listed too, as a disabled
option that says why it is not available, so nothing is silently missing:
- `layout-deck`: a deck is a whole draft, so it is edited as the draft
  root, started from the **Planning deck** starter (`BUILDER_ROOT_ONLY` in
  `manifest.ts`); the palette never inserts one inside a draft. Its card
  slides are edited like any card; its `masters`, `settings`, `slides` and
  `themeRef` props are JSON fields with the renderer's kind check only;
- `deck-slide`: slide editing is planned (builder phase B2);
- the state-only controls (`control-toggle`, `control-choice`,
  `control-slider`, `control-filter`), the flow ids (`flow-view`,
  `flow-action`) and the action form ids (`action-form`, `form-field`,
  `form-submit`): each needs a state, flow or action declaration in the
  blueprint envelope, and this builder edits the tree only;
- `chat-thread` and `chat-message`: the player has no painter for them.

The catalog's own form controls are not Tier U (`agentEmittable: false`), so
the palette does not show them. The developer palette (the larger
developer-tier set) is **planned**, pending the tier decision.

**Search** matches every term, case-insensitively, against the label, id,
group name, summary and `useWhen` hints. It finds unavailable entries too,
and they keep their reason.

**Keyboard and screen readers.** The search box is an APG editable combobox
with list autocomplete and automatic selection. Its listbox is always shown,
with one `role="group"` per family.

| Key | Action |
| --- | --- |
| Type | Filters the list; the first insertable match becomes the active option |
| ↓ / ↑ | Move the active option (`aria-activedescendant`), wrapping |
| Enter | Insert the active option into the selected outline row; focus moves to the new row |
| Escape | Clear the search |

Home and End stay with the text box, as the pattern expects. A polite live
region announces the result count and insert results. Choosing a disabled
entry announces why it cannot be inserted. Pointer users click an option.

## Outline

`src/components/builder/outline/` is self-contained in the same way: it
imports only `@texuli/catalog`, `@texuli/player` and Svelte.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: tree → rows (`outlineRows`, with level, position and sibling count), and keyboard or drag intents → `move` edit ops (`keyboardMove`, `dropMove`). Ops use the edit core's addressing: the node is removed first, and `parent`/`index` address the tree after removal |
| `group.ts` | Framework-free group operations: multi-select (`toggleKey`, `rangeKeys`, `groupRoots`), group moves and drops (`groupKeyboardMove`, `groupDropMove`), group delete (`groupRemoveOps`), duplicate (`duplicateOps`), copy and paste (`copySubtrees`, `pasteOps`), and path bookkeeping (`pathAfterOp`, `placedPaths`) |
| `guard.ts` | Refuses a change that adds structural errors, using the same `validateDraft` check the player runs |
| `Outline.svelte` | The tree |

Every move, by keyboard or by drag, for one row or a whole selection,
becomes `move` ops that the builder applies as one step of its undoable
edit history. **Undo** reverses the step. The edit core refuses impossible
moves (into the node's own subtree), and the guard refuses moves,
duplicates and pastes that would break the page structure. A component can hold
children only when its manifest declares a `children` slot: the page, doc,
deck, card and grid layouts and the deck slide.

**Keyboard and screen readers.** The outline is an APG multi-select tree
(`aria-multiselectable`, one Tab stop). Plain arrows move focus and
selection together; Shift and Ctrl/Cmd extend the selection. Rows expose
`aria-level`, `aria-setsize`, `aria-posinset`, `aria-selected` and, on
parents, `aria-expanded`. The inspector shows the focused row.

| Key | Action |
| --- | --- |
| ↓ / ↑ | Next or previous row |
| Home / End | First or last row |
| → / ← | First child, or the parent |
| Alt+↑ / Alt+↓ | Move the component up or down among its siblings |
| Alt+→ | Move it into the component above, as its last child |
| Alt+← | Move it out of its group, just after its parent |
| Delete / Backspace | Remove the selected components; focus moves to the first one's parent |
| Space | Add the row to the selection, or take it out |
| Shift+Space / Shift+↓ / Shift+↑ | Select every row from the anchor (the last row toggled or reached with a plain key) |
| Ctrl/Cmd+A | Select every row |
| Escape | Keep only the focused row selected (during a drag, cancel the drag) |
| Ctrl/Cmd+C | Copy the selected subtrees |
| Ctrl/Cmd+V | Paste inside the focused row when it holds children (as its last children), otherwise right after it |
| Ctrl/Cmd+D | Duplicate each selected subtree right after itself |

The pointer follows the same rules: a click selects one row, Ctrl/Cmd+click
toggles a row, and Shift+click selects the range from the anchor. Space and
Shift+Space follow the data grid's selection keys.

In a right-to-left page the horizontal keys swap, as the tree pattern
expects: ← enters the first child, → returns to the parent, and Alt+→ moves
the component out of its group.

After a move, focus follows the moved row, and after a group move the whole
group stays selected. A polite status announces each move, and explains
each refused one ("Already first in its group.", "That component cannot
hold other components.", …). Rows render manifest
labels as text; they are never HTML sinks.

**Removing.** The tree holds only treeitems, as the pattern requires. The
**Remove**, **Duplicate**, **Copy** and **Paste** buttons below it act on
the selection (the page root is never removed, duplicated or copied), and
the keys above do the same from the keyboard.

**Selections.** A group action acts on the selected rows; a row whose
ancestor is also selected travels with that ancestor. Group moves are all
or nothing: when one selected component cannot take the step (already
first, no container above), none moves and the status says why. Each group
action is one history step with its own label ("Move Text blocks and 1
more", "Remove Text blocks and 2 more", "Duplicate 2 components"). Undo and
redo bring the whole group back selected. Structural steps do not coalesce;
each one undoes on its own.

**Duplicate, copy and paste.** A duplicate or a paste is a deep copy of
the subtree. Each content block `id` in it (a block's `id` becomes an HTML
id, such as a heading anchor) is renamed deterministically, `intro` to
`intro-copy` and then `intro-copy-2`, so no id repeats in the draft. Copied
subtrees stay in the builder's own state: the system clipboard is never
read or written, and **Copy JSON** in the toolbar is still the way to take
the whole draft out. A paste goes through the same structure guard as a
move, so a paste the composition grammar refuses changes nothing, adds no
history step, and says why.

**Drag and drop.** Rows other than the root can be dragged with pointer
events, so mouse, pen and touch use one path. A touch drag starts on the
row's grip handle (the rows themselves keep scrolling); the handle is
hidden from assistive technology because Alt+Arrow keys do the same moves.
A press becomes a drag after it travels 4 pixels. Dropping in the top or
bottom quarter of a container row places the component before or after it;
dropping in the middle places it inside, as the last child. Leaf rows take
before or after. Dragging a row that is part of a multi-selection drags the
whole selection, which lands together in reading order. The drop line
appears where the outline model accepts a drop. A refused target is
outlined as refused and its reason shows under the tree; dropping there, or
outside the outline, moves nothing and announces why. The structure guard
can still refuse a drop it accepts, with a message.

## Accessibility

Builder actions and form controls use accessible names, including media source
fields and contextual record-key fields. Outline moves announce the moved
component, its destination and position; refused moves announce why, and
Escape cancels an in-progress drag. The editor has no modal overlays, so it
does not inert page content or lock page scrolling. The preview's issue
actions are keyboard-operable buttons that select and focus the matching
outline row. For pane order, keyboard operation and focus restoration, see
the Keyboard navigation section.

Automated browser checks run on Chromium (the website suite's project),
including axe in light, dark and forced-colors modes on the bare page (the
page sweep) and on edited inspector states (the builder spec). WebKit,
Firefox and a recorded screen-reader transcript are not covered.

## Inspector: text blocks

A `blocks-text` node's `block` prop is edited with structured fields, not
JSON (`src/components/builder/inspector/text/`). This closes the G16 gap for
the text family: `@texuli/blocks` already has its schema. Chart props with a
chart schema and `blocks-media` blocks have their own structured editors
(below); the remaining deep props stay JSON boxes until they get item
schemas.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: fields per type with the parser's limits, presets, type switching, list-item edits, validation and link verdicts. Imports only `@texuli/blocks` |
| `TextBlockEditor.svelte` | The form |
| `MarkdownField.svelte` | One Markdown field (text, quote, callout body) edited through the rich text editor, with a Markdown source toggle |
| `richtext.ts` | Framework-free interchange: stored Markdown into the editor model (with notes for what it could not keep) and back |

| Type | Fields |
| --- | --- |
| Heading | Level (H1–H4), heading (200 characters, one line), eyebrow, subtitle |
| Text | Text (4,000 characters of inline markdown) |
| List | Numbered list, 1–12 items (600 characters of inline markdown each), each with move up, move down and remove |
| Quote | Quote (600 characters of inline markdown), attribution |
| Callout | Title, body (600 characters of inline markdown) |

Every type also has a **Tone** (`neutral`, `accent`, `info`, `success`,
`warning`, `danger`, or the default).

- **Validation is the block parser itself** (`safeParseBlock`), so the editor
  never accepts what the block would refuse. Each problem shows under its
  field (`aria-invalid` and `aria-describedby`), and a counter shows the
  characters left.
- **Optional fields are removed when cleared**, so the payload stays minimal.
- **Switching type keeps the text and tone.** A heading takes the first line;
  a list takes one item per line, up to 12.
- **Markdown fields edit as rich text.** Text, quote and callout body use
  `RichTextEditor` from `@texuli/editor/editor`, loaded lazily by
  `inspector/text/MarkdownField.svelte` (the website declares the package). The
  field still stores Markdown: the editor reads it at the `untrusted` tier,
  lists what it could not keep (a refused link keeps its text only) under
  **Editor notes**, and writes the Markdown back on each edit. A pressed
  **Markdown source** button swaps in the plain textarea for exact text.
  List items stay plain text fields (planned: the editor there too). The
  toolbar's heading and numbered-list names carry their visible glyph text
  (`Heading 1, H1`, `Numbered list, 1.`), and its undo buttons are named
  `Undo text` and `Redo text`.
- **Links in markdown fields show their verdict** before they paint, from the
  same parse the renderer uses: kept links show their address, and refused
  ones say they will show as plain text. At the untrusted tier, relative
  links (`/docs`) are refused too.

Changes go through the builder's undoable edit history. Rich-text inline nodes
(G21) are planned for builder phase B2.

## Inspector: enum and boolean props

Enum and boolean props (27 enums and 6 booleans across the builder's
manifests) are edited with closed choices
(`src/components/builder/inspector/choice/`), never free text.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: reads a value as unset, accepted or refused, picks the control, checks inputs against the closed set, and lists issues. Imports only `@texuli/catalog` |
| `ChoiceField.svelte` | The field |

- **Controls.** An enum with up to four values is a group of radios; a
  larger one is a select. A boolean is a switch (`role="switch"`) that shows
  On or Off, and its default when unset. **Not set** is offered only for
  optional props; **Reset to default** removes a boolean the person set.
- **Refused values are visible.** A value pasted or imported through the JSON
  panel is read the way the renderer will read it (`sanitizeProps`, the check
  the player runs at paint). A refused value (`"evil"` for an enum, `"yes"`
  for a boolean, an HTML-looking string, a number) selects nothing, shows the
  renderer's reason with the value as text, and has a **Clear invalid**
  button. A required enum left unset says so.
- **Host-pinned props.** The media `trust` prop is always painted as
  `untrusted` (`TRUST_PINNED_IDS` from `@texuli/player`); choosing anything
  else shows a warning that a blueprint cannot change it.
- **Defaults are placeholders.** A schema default is shown, never written to
  the payload.

## Inspector: number props

Number props (46 across the builder's manifests) are edited in
`src/components/builder/inspector/number/`.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: reads a value as unset, accepted or refused, checks typed input, lists issues and picks the control. Imports only `@texuli/catalog` |
| `sources.ts` | Ranges and defaults from the chart prop schemas (`@texuli/charts/schemas`), then from the clamps in the painting code (`paintNumberHints`) |
| `NumberField.svelte` | The field |

**Where ranges come from.** Catalog manifests declare no range for number
props: only `kind`, and a `default` for `layout-grid` `columns`. The renderer
accepts any finite number. Ranges come from two sources, and the inspector
invents none:
- the chart prop schemas: a `charts-*` prop with a chart schema gets its
  documented minimum and default from there (29 props, all one-sided, such
  as "greater than 0" for sizes);
- the painting code, where it clamps or ignores a value: `layout-grid`
  `columns` (1 to 4) and the grid tile's `span` (1 to 4) and `rowSpan` (1 or
  2) in the player's layouts, `blocks-map` `headingLevel` (1 to 6, the title
  is painted as `h1` to `h6`), `blocks-code` `step` and `hostStep` (whole
  numbers from 0), `media-composition-canvas` `pixelRatio` (above 0, capped
  at 4) and `media-image` `width` and `height` (1 to `IMAGE_LIMITS.dimension`,
  16,384). A test checks each against the code that applies it.

Only `charts-canvas-renderer` `width` and `height` have no range: the
renderer passes them straight to the canvas element.

- **Controls.** A number input (`type="number"`, any step). A slider
  appears next to it when the range has both ends: grid columns, tile spans,
  the map heading level and the image size.
- **Refused values.** A value that is not a finite number (a string such as
  `"12"`, `null`, or `1e400`, which JSON reads as infinity) is read the way
  the renderer will read it (`sanitizeProps`). It shows the reason and the
  value as text, with **Clear invalid**. Typing an unreadable entry stores
  nothing and is reported when you leave the box.
- **Out of range is a warning, not a refusal.** A value outside a chart
  documented range (a size of `-5`, five grid columns) still reaches the
  component, so the inspector warns that it may not paint as intended
  instead of calling it refused.
- **Defaults are placeholders.** The manifest default, else the chart
  schema's, shows as the placeholder and is never written. **Reset to
  default** removes a set optional value.

## Inspector: structured props

Object and array props with a sub-field schema are edited in
`src/components/builder/inspector/struct/`.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: validates a value against a chart schema (path per issue), builds valid samples, unknown keys, union variants, immutable list and key edits, and the renderer's top-level verdict. Imports only `@texuli/catalog` and chart schema types |
| `sources.ts` | The sub-field schema for a `charts-*` prop, from `@texuli/charts/schemas` (developer-only and event props are never offered) |
| `StructProp.svelte` | The prop: the renderer's verdict, **Add**, **Reset** or **Clear invalid** |
| `StructNode.svelte` | One value, recursively: text, number, switch and select leaves; fieldsets for objects, lists, tuples, records, nullable values and unions |

**Where sub-fields come from.** Catalog manifests describe object and array
props by `kind` only, with no item schema (G16), and the renderer checks only
that the value is a plain object or a list. The one schema that describes
sub-fields today is the chart prop schemas. Of the 71 object and array props
in the builder's manifests:

- **44 `charts-*` props** have a chart sub-field schema and get the closed
  editor (data lists, label objects, the `format` union, `geo-map` `data`
  records, the recursive `sunburst` and `treemap` `root`).
- **9 `blocks-*` `block` props** are described by the blocks parsers.
  `blocks-text` and `blocks-media` have structured editors (see *Inspector:
  text blocks* and *Inspector: media props*); the other 7 are JSON fields
  checked against their family's own check (see *Inspector: text and JSON
  props*).
- **2 composition props** (`media-composition-svg` and
  `media-composition-canvas` `composition`) are JSON fields checked by the
  composition validator.
- **16 props have no sub-field schema anywhere** (blocks and media `labels`,
  `blocks-code` `highlights`, `charts-cartesian` and `charts-canvas-renderer`
  `series`, `media-image` `widths`, `focalPoint` and `placeholder`). They are
  JSON fields that the renderer checks for kind only, and the hint says so.

There are no layout spacing records in the manifests today.

- **No free JSON inside the field.** Every leaf is a closed control: text,
  number (finite only), switch, or a select of the schema's values. Lists add,
  move and remove items (a new item in a list with unique ids gets a free
  `item-N` id; **Add** is disabled at the schema's maximum). Records rename,
  add and remove keys. A union picks its shape from a select named by its tag
  (`number`, `date`); switching shape starts a valid value of that shape.
- **Two verdicts, named apart.** The renderer's own check (`sanitizeProps`)
  decides whether the prop is kept: a wrong container or a required prop
  that is missing is shown as **refused by the renderer**. Sub-field breaks
  come from the chart schema, which no renderer applies, so they are shown
  as warnings (the chart may not draw the value), next to the field they
  belong to.
- **Unknown keys are refused visibly.** A key the schema does not declare is
  listed with its value as text and a **Remove unknown key** button.
- **Defaults are placeholders.** Schema and manifest defaults show as
  placeholders or hint text and are never written. A recursive tree deeper
  than 12 levels is left to the payload panel.

## Inspector: media props

Media props are edited in `src/components/builder/inspector/media/`.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: reads each media value with the function the paint calls (`sanitizeProps`, the core URL policy, the player's media policy, the media block parser), explains refusals, edits media blocks. Imports only `@texuli/*` packages |
| `MediaUrlField.svelte` | `media-image` `src`, `srcset` and `href` |
| `AltField.svelte` | `media-image` `alt` |
| `SourcePicker.svelte` | One `blocks-media` source: avatar, embedded file or relative path |
| `MediaBlockEditor.svelte` | The `blocks-media` `block`: type, fields, gallery images |

**What the manifests declare.** Two props carry media sources, under two
different rules, and no manifest field describes either (no URL kind, no
source kinds):

- **`media-image` `src`, `srcset`, `href`** are plain strings. The renderer
  checks only that each is a string with no markup. The image component then
  runs the core URL policy at paint, at the tier its `trust` prop names. The
  player pins that prop to `untrusted` for every blueprint
  (`TRUST_PINNED_IDS`), and `href` is checked untrusted whatever `trust`
  says. So although the builder author is the host, **every blueprint image
  URL is judged at the untrusted tier**: HTTPS URLs (a host, no
  credentials) and relative paths for images; `https:`, `mailto:` and
  `#fragment` for the link.
- **`blocks-media` `block`** sources are not URLs. The media block parser
  accepts an avatar id (`avatar:av-001` to `av-175`), a base64 data URI of
  at most 192 KB (png, jpeg, webp, gif; mp4 or webm for video) or a relative
  path, and refuses every remote URL.

Behavior:

- **Two verdicts, named apart.** *Refused by the renderer* means
  `sanitizeProps` drops the prop (not a string, or markup); for the required
  `src` the image is dropped. *Blocked by the URL policy* means the renderer
  keeps the string but the image component will not use it. A blocked
  source that only the developer tier allows (HTTP, blob, a data image) says
  so: a host app can pass `trust="developer"` to the component directly, a
  blueprint cannot. A script URL or protocol-relative URL is blocked at
  every tier. The verdicts call `safeImageSrc`, `safeImageSrcset` and
  `safeHref` exactly as the component does.
- **`alt`.** Required, but a blank string is legal; the player's media
  policy then paints its "no description" label, and the field says so.
- **The source picker** offers the three kinds the block parser accepts.
  An avatar is a select of the 175 ids. An embedded file is read in the
  browser into a data URI (nothing is uploaded); a file of the wrong type or
  over 192 KB is refused before it is stored. A relative path is typed.
  Each value is judged by `classifyMediaSource`, the parser's own check.
  Remote URLs are not offered.
- **Preview limits, stated in the field.** The player supplies no
  `resolveAvatar`, so avatars paint as unavailable in the preview. Relative
  paths resolve against the host page, which has no such files. Only an
  embedded file paints in the preview. The site's CSP allows images from the
  same origin, `data:`, `blob:` and the fictional example origins, so an
  HTTPS image from elsewhere is blocked by the page, not by Texuli.
- **The block editor** shows one control per field the media family parser
  reads (image, figure, video, gallery; a test checks that a block with
  every field set parses back unchanged). The parser stops at its first
  problem, shown at the field it names. Galleries hold 1 to 12 images.

**Not covered:** `media-image` `widths`, `focalPoint` and `placeholder` have
no sub-field schema and stay JSON; a placeholder image source is judged only
at paint. Composition image sources are judged as you type, by the
composition validator at the untrusted tier.

## Inspector: text and JSON props

Every prop the inspector offers lands on a working field, and one it cannot
offer says why. `src/components/builder/inspector/coverage.ts` holds the one
rule that picks a prop's editor (`fieldFamily`), which BuilderApp and the
tests both use.

| File | Role |
| --- | --- |
| `string/model.ts` | Framework-free text props: the renderer's verdict, a required check, and the prop's own rule (`stringRule`) where the painting code or a schema has one |
| `string/StringField.svelte` | The text box, with the rule and its source in the hint and issues as you type |
| `json/model.ts` | Object and list props without a sub-field editor: draft parsing, the renderer's kind rule, the component's own schema check (`schemaCheck`) and the manifest's examples |
| `json/JsonField.svelte` | The JSON box: saves on leaving the box only when the text parses, lists issues by path, and offers **Use example** buttons |
| `coverage.ts` | `fieldFamily` and `unsupportedReason` |

**Text rules.** Text props get the renderer's verdict (anything that is not
text is refused at paint), plus a rule only where one is applied:
- `layout-grid` `gap`: the player's bounded length rule (`1rem`, `0.5em`,
  `12px`, up to 99rem or 999px, or `0`). Anything else is a warning, because
  the player ignores it and keeps the default gap;
- `host-region` `name`: the player's `HOST_REGION_NAME`. A name no host can
  claim is a warning, because the region then always paints its label;
- `blocks-map` `locale`: a BCP 47 language tag, checked with
  `Intl.getCanonicalLocales`, because the map's number formatting cannot use
  anything else;
- chart titles, labels and descriptions whose chart schema marks them
  `nonEmpty`: blank text is an error.

**JSON fields.** The seven remaining `blocks-*` `block` props (code, data,
diagram, embed, interactive, map, structure) are checked with the same check
each family runs before painting (`checkCodeBlock`, `parseDiagram`, …). The
composition props are checked with `validateComposition` at the untrusted
tier, the tier the player always paints compositions with, so an unsafe
image source is reported while you type. Each manifest example for the prop
is offered as **Use example**, a valid start. Text that does not parse is
never stored; a value that parses is stored with its issues shown.
Structured editors for these families are **planned**.

**Props the inspector leaves out.** The renderer forbids `class`,
`className`, `style` and the other names in `FORBIDDEN_PROP_NAMES`, and every
`on*` handler, so the closed rule refuses them and the inspector never offers
them. The inspector also leaves out 36 chart props that the catalog types as
text while the chart schema expects another kind: `interactive` (a boolean),
`fullDomain` and `visibleDomain` (a range), `annotations` (a list), and pie,
donut and sunburst `innerRatio` and `padAngle` (numbers). The renderer
accepts only text for them, and text is not what the chart reads, so no
blueprint value can work. They are listed under **Not editable here** with
that reason. Typing them correctly is a catalog change, outside the builder.

## Payload panel: JSON with a round-trip guarantee

`src/components/builder/payload/` holds the JSON pane (builder design §6).
`model.ts` is framework-free; `PayloadPanel.svelte` is the pane.

- **Tree to JSON.** The pane shows the draft as **canonical JSON with a
  2-space indent**: keys sorted at every depth (the catalog build's rule),
  defaults never injected. Every structured edit (palette insert, outline
  move or removal, inspector write, undo) updates the text.
- **Typed work is never overwritten.** When the text has uncommitted edits
  and the draft changes underneath, the text is kept and a notice says so.
  **Reload draft** replaces it with the current draft.
- **JSON to tree, all or nothing.** **Commit JSON** (or Ctrl/Cmd+Enter) runs
  the byte cap, a duplicate-key scan (`JSON.parse` would keep the last key
  silently), `JSON.parse`, then the same closed rules the builder history
  applies to inspector writes: palette ids, manifest prop names, no `class`,
  `style` or `on*`, and the tree limits. Any issue refuses the whole text,
  so the draft keeps its last valid state. An accepted text is one
  `replaceAll` entry, which one undo reverts.
- **Line-precise issues.** Each refusal is listed as "Line L, column C:
  message", and choosing it puts the caret there. A parse error is placed
  from the engine's message, or where the locating scan stopped when the
  engine names no position.
- **Round trip.** Committed text reads back to the same canonical JSON, so
  the digest equals the player's (`blueprintDigest`). Only key order,
  whitespace, absent fields, number formatting and string escapes
  normalize. `site-builder.test.ts` checks idempotence, the digest,
  inspector and JSON edits through the same history, and that refused text
  leaves the history untouched.

**Planned, not built:** the loss check's **Commit without them** choice (today
refused props are fixed in the JSON), a line-number gutter, selection sync
between the text and the outline, and highlighting the selected node's JSON
range. Prop values the player refuses at paint (a wrong enum value) are still
committed, and the inspector flags them, as before.

## Preview

`src/components/builder/preview/` mounts the real `<Player>` from
`@texuli/player` on the working draft. It imports only `@texuli/player`,
`@texuli/catalog` types and Svelte.

| File | Role |
| --- | --- |
| `model.ts` | Framework-free: player node paths → builder paths (`builderPathOf`), the issues list (`previewIssues`) and its summary line, and the preview view (width and mode: `stageClass`, `stageInlineSize`, `viewText`, `parseView`) |
| `PreviewPane.svelte` | The width and mode switchers, the player and the **Draft issues** area |

- **The player is the one hosts get.** It runs at the untrusted tier with
  status `draft` and `invalidPolicy="preview"`, so an invalid draft still
  paints its valid parts, with visible placeholders for the rest.
  `landmarks={false}` keeps the page layout from adding a second `main`.
- **Live updates.** Each edit passes the new tree through the `blueprint`
  prop. The player updates its handle in place (R20): the mounted root and
  loaded painters stay.
- **Lazy painters.** Painters load on demand from `PLAYER_LOADERS`. A painter
  that takes longer than 8 seconds, or fails, shows the player's error
  placeholder inside the pane and is listed as an issue.
- **Draft issues.** Every `onDiagnostics` event replaces the list: the
  validation diagnostics, then state issues, then painter errors
  (`onNodeError`) reported since. Messages are text. An issue tied to a node
  has a **Select** button that selects its structure row and moves focus to
  it. A polite status summarizes the count.
- **Widths.** **Mobile** (390px), **Tablet** (768px) and **Desktop** (the
  pane's width) set the stage's real inline size; a stage wider than the
  pane scrolls instead of shrinking. Nothing is scaled. The stage is a size
  container (`container-type: inline-size`), so components that size from
  their container respond; viewport media queries still read the browser
  window, so they do not change with the switcher.
- **Light and dark.** The mode switch re-themes the preview only. The stage
  carries the host page's theme id with its own `data-tx-mode`, and applies
  that theme's tokens for its mode (`applyTheme` from `@texuli/tokens`, with
  the theme loaded from the library when the pane mounts), so it works
  whether the host scoped both modes in CSS or applied one mode inline. The
  preview starts in the page's mode and follows it until a mode is picked.

## Share links and starters

`src/components/builder/share/model.ts` and
`src/components/builder/starters/model.ts`.

- **Share link** (toolbar) writes the draft and the preview view into the
  URL hash, `#draft=1.<base64url>`: a view line (`dark mobile`) and the
  canonical JSON, compressed with the browser's `CompressionStream` (raw
  deflate). Nothing is uploaded and no server is involved. The same draft
  gives the same link from the same compressor, and key order never changes
  it. The page shows the link in a read-only field and copies it when the
  clipboard is available. A link carries the whole draft, so it is as long
  as the draft needs; links over 262,144 characters are refused.
- **Opening a link** runs the exact check a JSON commit runs
  (`checkPayloadText`: size, duplicate keys, the closed rules) before
  anything paints. Inflating stops past the draft size limit, so a
  compressed bomb is refused early. A link that fails when the page loads
  leaves the empty draft and the status says why; a link pasted later, in
  the same tab, never replaces the current draft unless it passes. Opening
  is one history step (**Undo: Open shared draft**).
- **Starters** (**Start from**): **Empty page**, **Weekly report** (a
  document), **Operations dashboard** (a page with a grid of chart cards)
  and **Planning deck** (a deck of card slides). The three blueprints are the
  player fixture blueprints from the examples registry (`@texuli/examples`,
  fictional data), loaded only when one is picked. Each passes the JSON
  commit check before it replaces the draft as one history step (**Undo:
  Start from Operations dashboard**). The page opens on the empty draft.

## History: undo and redo

`src/components/builder/history/model.ts` (framework-free) wraps the catalog
edit history (`createEditHistory`, through `createBuilderHistory`) with a
plain-language label per step. Every pane that writes goes through it: palette
inserts, outline moves and removals, inspector writes, payload commits and
**New draft**. The preview only reads.

| Step | Label |
| --- | --- |
| Insert, remove, move | `Insert Text blocks`, `Remove Card layout`, `Move Text blocks` |
| Inspector write | `Set title on Card layout`, `Clear title on Card layout` (typing in one field is one step) |
| Payload commit, new draft | `Commit JSON`, `New draft` |

- **Controls.** **Undo** and **Redo** buttons in the toolbar. Each is disabled
  when its stack is empty, and its tooltip names the step (`Undo: Remove Text
  blocks`). Shortcuts: Cmd/Ctrl+Z undoes; Shift+Cmd/Ctrl+Z (or Ctrl+Y) redoes.
  The shortcuts work while focus is inside the builder (`aria-keyshortcuts`
  on both buttons).
- **Text fields keep their own undo.** In the JSON textarea and in text or
  number inputs, Cmd/Ctrl+Z is the browser's text undo, never a draft move.
  In a rich text field, Cmd/Ctrl+Z is the editor's own undo (`ownsTextUndo`
  is true for editable content). Each text edit is one prop change with the
  block's coalesce key, so a run of typing joins one labeled builder step;
  the builder's **Undo** takes it back whole and the editor reloads the
  restored Markdown with a fresh text history.
- **Announced.** The toolbar's polite status names what came back:
  `Undid: Remove Text blocks.` or `Redid: Remove Text blocks.`
- **Redo is cleared by a new edit**, as in the edit core.
- **Selection follows the move**, so the inspector shows what came back: the
  node a prop change touched, a reinserted or moved node, or the parent of a
  node that went away. Undoing or redoing a JSON commit keeps the selection
  when that node still exists. A path that no longer exists falls back to its
  nearest existing ancestor.
- **Uncommitted JSON is kept.** An undo with uncommitted text in the payload
  panel changes the draft and keeps the text, with the panel's notice ("Your
  text is kept"); **Reload draft** brings the text back in line.

## Round-trip property

`scripts/tests/site-builder-roundtrip.property.test.ts` (Task 72) drives the
builder's own models with seeded, deterministic sequences: 32 seeds of 24
steps each, with a small in-file mulberry32 generator and no new
dependency. The steps are:
- palette inserts with valid props;
- outline Alt+Arrow moves, under the outline's structural guard;
- outline node operations (PLAN_005 task 4): group Alt+Arrow moves, group
  drops, group delete, duplicate and paste, through the same guard, each
  one history step that a single undo restores;
- removals;
- inspector writes through the choice, number and text field models;
- undo;
- JSON commits, valid and hostile.

After every step it asserts:
- the closed rules accept the tree;
- the payload text reads back to the same canonical JSON, idempotently;
- the player re-reads the same tree, and `handle.digest()` equals the
  builder's `blueprintDigest` whenever the draft validates;
- the outline rows rebuild the same structure;
- every inspector field reads and writes back its value unchanged;
- a refused step changes nothing;
- no content block id repeats (duplicates and pastes always take fresh
  ones).

Hostile commits cover unknown props, `on*` and `class`, unknown ids,
truncated text, duplicate keys, extra node fields, a props array and a
children object. The suite also checks that the history refuses whatever
parses when the panel is bypassed.

A failure names the seed and the steps, so it replays exactly. Set
`TEXULI_PROPERTY_TALLY=1` to print how often each step kind ran.

The property found one real gap, now fixed: the builder history accepted
node shapes the payload panel refused (an extra field such as `when` or
`slot`, `props: []`, an object as `children`). `createBuilderHistory` and
`validateBuilderTree` now apply the same node rule as the panel. A pinned
regression keeps the counterexample.

## Performance at scale

`tests/perf/builder-large-blueprints.test.ts` (`pnpm test:perf`) measures
every per-edit path on blueprints of 100, 500 and 512 nodes (the catalog
limit) and a chain at the depth limit: flatten, outline rows, a history
apply, a coalesced typing burst, canonical and pretty JSON, digest, the
payload commit check, the move guard and the preview's live update.
Results and the one fix (placing payload issues was quadratic) are in
[docs/quality/perf-builder.md](../../../docs/quality/perf-builder.md). The
largest per-keystroke cost is the player's live update (about 69 ms at 512
nodes in happy-dom); it is reported there, not changed.
## Keyboard navigation

The whole builder works from the keyboard (Task 75). Its parts:
- **Tab order:**
  - Tab follows the panes in reading order: toolbar (disabled Undo and Redo
    are skipped), palette search, structure outline, preview, inspector,
    payload.
  - Shift+Tab walks back the same way, and both directions leave the builder
    (no trap).
  - The palette's scrolling option list is not a Tab stop of its own
    (`tabindex="-1"`): the search combobox moves through it with
    `aria-activedescendant`.
- **F6 and Shift+F6** cycle the same six panes (builder design §9), through
  `keyboard/panes.ts` (panes are marked `data-builder-pane`):
  - each pane restores the element last focused in it, else its first
    enabled control, else the pane itself (an empty inspector);
  - inside the preview, the player's own F6 (between its frames) wins when
    it moves focus.
- **Inside panes:**
  - **Outline:** one Tab stop (roving `tabindex`): arrows move between rows,
    Alt+Arrows move nodes, Delete removes them, Space and Shift extend the
    selection, and Ctrl/Cmd+C, V and D copy, paste and duplicate.
  - **Palette:** arrows choose an option, Enter inserts it, Escape clears the
    search (nothing else to close, so nothing traps).
  - **Preview:** the player has its own "Skip past" link and keyboard (charts,
    tables).
  - **Payload:** Ctrl/Cmd+Enter commits it, and a commit issue puts the caret
    on its line.
  - **Enter and Space:** native buttons, switches (checkboxes with
    `role="switch"`, Space) and selects keep their native behavior.
- **Item lists in the inspector** (text list items, gallery images,
  structured list items such as chart points), through `keyboard/list.ts`, a
  shared Svelte action:
  - Alt+ArrowUp and Alt+ArrowDown move the item the focus is in, by pressing
    that item's own Move control, so keys and buttons share one path.
  - After any move or removal, focus follows the item: the same field after
    a key move, the same control after a button. If that control is now
    disabled, focus goes to another live control of the item; after the last
    item is removed, to the add button. Before, focus stayed on a control
    that then belonged to another item, or fell to the page.
  - A polite status says what happened ("Image moved to position 1 of 2",
    "Item removed. 2 left.").
  - Nested lists handle their own keys.

`site-builder-dom.test.ts` covers the focus rules, the list action on
a DOM list and the pane cycle. It also mounts the builder (happy-dom) for
the outline's node operations: Shift, Space, Ctrl/Cmd+click, Shift+click,
Ctrl/Cmd+A and Escape selection; group Alt+Arrow moves and Delete with
their labels, undo and restored group selection; Ctrl/Cmd+D, C and V with
fresh block ids; and a paste and a duplicate the structure guard refuses.
Pointer drags are not asserted there (happy-dom has no layout); the browser
spec drags. The browser spec:
- walks Tab and Shift+Tab across the panes;
- cycles them with F6 and Shift+F6, including restoring the last focus;
- moves list items, gallery images and chart points from the keyboard.

**Not covered yet:** Home/End in the palette list, and a screen-reader pass
of the announcements.

## Visual baselines

The builder island has visual baselines (Task 77): the `builder` and
`builder-draft` fixture pages, in light and dark, on desktop and the Pixel 7,
plus 360 px (see [tests/visual/README.md](../../../tests/visual/README.md)).
`BuilderApp` takes optional `initial` (a draft) and `initialSelection` (a
path) props for that fixture. The site page passes neither, so it still
opens an empty draft.

The baselines showed the inspector offering a `class` field, which the closed
rule always refuses, so typing in it could only fail. `inspectorFields` (in
`model.ts`) now hides slots, events and every name the rule refuses (`class`,
`style`, `on*`).

## Validation

```bash
pnpm vitest run scripts/tests/site-builder.test.ts scripts/tests/site-builder-dom.test.ts scripts/tests/site-builder-roundtrip.property.test.ts
pnpm --filter @texuli/website typecheck
pnpm build
TEXULI_E2E_PORT=4898 pnpm exec playwright test tests/e2e/site-builder.spec.ts
```

The browser spec (`tests/e2e/site-builder.spec.ts`, 3 tests since the
2026-10-27 trim, each a page session with a fresh load per segment) covers:
- **keyboard**: palette search, arrow selection and insert, and the disabled
  Tier U entries; Ctrl/Cmd+Enter committing canonical JSON to the player and
  a parse error that changes nothing; Alt+Arrow outline moves with their
  announcements and a refused move; Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z with
  their announcements and the restored selection; the swapped horizontal
  keys in a right-to-left page; the Tab order through the panes with no
  trap or dead stop; F6 and Shift+F6 cycling the panes and restoring the
  last focus; list items moved with Alt+Arrow, focus following the item;
- **inspector and payload**: a text block edited through the rich text
  editor (one coalesced undo step, a refused link explained), axe while it
  is open; a refused text that names its line and moves the caret there;
  uncommitted JSON surviving an outline edit; duplicate keys; player
  diagnostics selecting their node; a refused boolean cleared, a refused
  enum fixed, number fields with refused, out-of-range and non-finite values,
  a chart structure edited field by field, and media URL verdicts at the
  untrusted tier, with axe on the media inspector;
- **pointer, preview and share**: a drag into a card, a drag cancelled with
  Escape, a refused drop, duplicate, copy and paste, a multi-selection
  dragged together, the starters as undoable steps with the mounted player
  updated in place, the width switcher's real stage widths, the color mode
  scoped to the preview, a share link restoring the exact draft and view in
  a new page with no network request, a damaged link, and a touch drag from
  the grip handle.

The inspector rules for every field kind, the list focus rules, the F6
order and the outline operations are unit-tested
(`scripts/tests/site-builder*.test.ts`); axe on the bare page in light, dark
and forced colors runs in the page sweep (`a11y-site.spec.ts`).

**Not covered yet:** Home/End in the palette list, and a screen-reader pass
of the announcements.

## Visual baselines

The builder island has visual baselines (Task 77): the `builder` and
`builder-draft` fixture pages, in light and dark, on desktop and the Pixel 7,
plus 360 px (see [tests/visual/README.md](../../../tests/visual/README.md)).
`BuilderApp` takes optional `initial` (a draft) and `initialSelection` (a
path) props for that fixture. The site page passes neither, so it still
opens an empty draft.

The baselines showed the inspector offering a `class` field, which the closed
rule always refuses, so typing in it could only fail. `inspectorFields` (in
`model.ts`) now hides slots, events and every name the rule refuses (`class`,
`style`, `on*`).

## Validation

```bash
pnpm vitest run scripts/tests/site-builder.test.ts scripts/tests/site-builder-dom.test.ts scripts/tests/site-builder-roundtrip.property.test.ts
pnpm --filter @texuli/website typecheck
pnpm build
TEXULI_E2E_PORT=4898 pnpm exec playwright test tests/e2e/site-builder.spec.ts
```

The browser spec (`tests/e2e/site-builder.spec.ts`, 22 tests) covers:
- **the whole flow**: palette, structure, inspector, JSON and player stay
  connected;
- **palette**: keyboard-only search, arrow selection and insert, and the
  disabled Tier U entries with their reasons;
- **outline**: Alt+Arrow moves with their announcements, the swapped
  horizontal keys in a right-to-left page, a pointer drag into a card, a
  drag cancelled with Escape, a multi-selection dragged into a card
  together, a refused drop that changes nothing, a touch drag from the grip
  handle, duplicate, copy and paste, and removal by Delete and by the
  **Remove** button;
- **preview, share and starters**: the width switcher's real stage widths,
  the color mode re-theming the preview only, a share link that restores
  the exact draft and view in a new page with no network request, damaged
  and refused links, and the starters with their undo labels;
- **inspector**: a text block edited through its structured fields; refused
  enum and boolean values cleared and fixed; number fields with refused,
  out-of-range and unreadable values; structured props edited field by field
  (unknown keys removed, list items added, moved and removed, a
  renderer-refused container cleared, a union shape chosen); media props (an
  HTTP image blocked at the untrusted tier, a markup source refused by the
  renderer, a script link, a blank alt, and a `blocks-media` source picked as
  an avatar, an embedded file and a relative path before switching to a
  gallery). Each editor runs axe while open;
- **payload**: a refused text that names each issue's line and moves the
  caret there while the preview stays unchanged, a JSON import with
  duplicate keys that changes nothing, and uncommitted JSON that survives an
  outline edit until **Reload draft**;
- **preview**: player diagnostics reaching the issues area (and selecting
  their node), and edits updating the mounted player in place;
- **history**: Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z from the outline with their
  announcements and the restored selection, redo cleared by a new edit, and
  Cmd/Ctrl+Z inside the JSON text staying a text undo while **Undo** keeps
  the uncommitted buffer;
- axe in light, dark and forced-colors modes.

**Not covered yet:** collapsing outline branches, drag from the palette into
the outline (planned), a real touchscreen (the touch drag test sends
touch pointer events to the handle), a screen-reader pass, and Firefox. WebKit runs of the
builder spec are not verified on the current machine (the browser does not
launch).
