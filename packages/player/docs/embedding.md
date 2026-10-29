# Embedding the player

**Package:** `@texuli/player` (on npm as `0.7.0`, a pre-1.0 release; no
stable 1.0.0 yet)

How to put a validated catalog blueprint on a page: quick start, the props a
host controls, the trust badge and frame contract, localization, inactive
frames, and the four ways to embed. The [player reference](reference.md)
covers loaders, error placeholders, layouts, keyboard, local state and the
iframe protocol; [paint-proof.md](paint-proof.md) argues the security
property. To validate, edit, digest and activate blueprints around the
player, as the texuli.com builder does, read
[blueprint-flow.md](blueprint-flow.md).

## Quick start

```svelte
<script lang="ts">
  import { Player } from '@texuli/player';
  import '@texuli/player/styles.css';

  // A blueprint is catalog JSON: text or data, usually from an agent.
  const blueprint = {
    id: 'layout-page',
    props: { title: 'Weekly summary' },
    children: [
      {
        id: 'blocks-text',
        props: { block: { type: 'text', markdown: 'Fictional: **38 of 44** items closed.' } },
      },
    ],
  };
</script>

<Player {blueprint} label="Report preview" />
```

The root must be `layout-page`, `layout-doc` or `layout-deck`; any other
root is refused (`frame-root`). The player validates the blueprint at the
`untrusted` tier, shows the frame
chrome (label, lifecycle status and the **Untrusted content** badge), and
lazily loads only the painters the blueprint uses. Import
`@texuli/player/styles.css` when your bundler does not keep package CSS side
effects.

## Surface props

Every option belongs to the host. A blueprint can set none of them.

| Prop | Default | What it does |
| --- | --- | --- |
| `blueprint` | — | Catalog JSON as text or data. Re-validated on every change |
| `label` | `'Blueprint preview'` | Host name for the frame, shown in the chrome and used as its accessible name |
| `tier` | `'untrusted'` | Validation tier. Anything but exactly `'developer'` is `untrusted`. The untrusted URL policy applies at paint time either way |
| `status` | `'draft'` | Lifecycle badge you set: `draft`, `active` or `superseded`. The player shows `invalid` itself when validation fails |
| `invalidPolicy` | `'refuse'` | `refuse` shows a notice instead of an invalid tree. `preview` paints the validated placeholders under a warning and never activates |
| `catalog`, `catalogHash` | `createPlayerCatalog()` | The catalog to validate against, and the catalog build hash you pinned (an envelope built for another catalog fails) |
| `loaders` | `PLAYER_LOADERS` | Lazy painters per catalog id |
| `loadTimeoutMs` | `15000` | A loader that has not settled by then becomes a `node-error` placeholder. `0` turns the limit off |
| `dir`, `lang` | — | Direction and language of the player root. A `lang` that is not shaped like a BCP 47 tag is dropped |
| `labels` | English defaults | Chrome copy, merged per key (see [Labels](#labels-and-localization)) |
| `density` | `'comfortable'` | `compact` tightens chrome and spacing for chat surfaces |
| `active` | `true` | `false` makes the painted surface `inert` (see [Inactive frames](#inactive-frames)) |
| `composer` | — | A host snippet painted under the surface, outside the validated tree |
| `hostRegions` | — | Host snippets by region name, mounted where a `host-region` node names them, with no blueprint data (see [Host regions](reference.md#host-regions-r21)) |
| `initialState`, `onStateChange` | — | Local state seeds and snapshots for blueprints that declare state |
| `onDiagnostics` | — | Called after each validation with `{ status, surface, error?, diagnostics, receipt, stateIssues }`. `surface` is `'tree'` when the blueprint painted and `'notice'` when it was refused |
| `onResize` | — | Called with the root's border-box `{ blockSize, inlineSize }` |
| `onNodeError` | — | Called once per node that cannot paint, with `{ code, id, path, phase, error? }` |
| `landmarks` | `true` | `false` stops layout painters from emitting `<main>`; pass it when the player sits inside your own landmark |
| `motion` | `'auto'` | `auto` follows `prefers-reduced-motion`; `reduce` stops motion inside the player |
| `chrome` | `true` | `false` paints no frame chrome: no label heading, status, trust badge, skip link or end anchor (`data-tx-player-chrome="off"`). For a host that already frames the content and states its trust itself, such as a slide (see [Frameless and deck hosts](#frameless-and-deck-hosts)) |
| `print` | `false` | Print mode (ADR-016; unreleased, planned for 0.8.0): a static paint (`data-tx-player-print`) with an inert surface, motion off, and no skip link, retry button or composer; the print styles (no page break inside frames, tables, figures and code, headings kept with what follows) also preview on screen. The player enters print mode on its own between the browser's `beforeprint` and `afterprint` events, so the browser's "Save as PDF" prints the static form. For a headless PDF see `@texuli/tools/print` |
| `deckHost` | `null` | A `DeckPlayerHost` that presents a validated `layout-deck` blueprint on a stage instead of the document flow (see [Frameless and deck hosts](#frameless-and-deck-hosts)) |
| `documentHost` | `null` | A `DocumentPlayerHost` (spec 0.7.0): its `checkDocument` validates `document` nodes, and its `present` paints a valid `document` root. Without one a document blueprint is refused (see [Document hosts](#document-hosts)) |
| `canvasHost` | `null` | A `CanvasPlayerHost` (spec 0.8.0): its `checkCanvas` validates `canvas` nodes, and its `present` paints a valid `canvas` root. Without one a canvas blueprint is refused (see [Canvas hosts](#canvas-hosts)) |
| `formHost` | `null` | A `FormPlayerHost` (spec 0.8.0): its `checkForm` validates `schema-form` nodes (with its `validators` names), and its `present` paints each valid one. Without one a form blueprint is refused (see [Forms](#forms)) |
| `sheetHost` | `null` | A `SheetPlayerHost` (spec 0.8.0; 0.8.0, unreleased): its `checkSheet` validates `spreadsheet` nodes (every formula parsed), and its `present` paints each valid one in place. Without one a spreadsheet blueprint is refused (see [Sheet hosts](#sheet-hosts)) |
| `selectable`, `selection`, `onSelectionChange` | `false`, —, — | Frame selection for a builder-style preview ([Selection](reference.md#selection-builder-preview)) |
| `view`, `onFlowChange` | — | The flow view and its transitions ([Views and flows](reference.md#views-and-flows-g09)) |
| `onAction` | — | Answers action-form intents with `confirmed` or `rejected`; without it, actions are unavailable ([Action surface](reference.md#action-surface-and-receipts-g17)) |
| `dataSources` | — | Plain scalars for host-bound state variables ([Host data binding](reference.md#host-data-binding-host-g01)) |

## Trust badge and frame contract

The player is an **artifact frame**: agent output stays distinguishable from
your app's own UI.

- **Chrome.** The frame always shows your `label` and the lifecycle `status`.
  The blueprint cannot change or hide either.
- **Trust badge.** At the `untrusted` tier the chrome always shows
  **Untrusted content** (`labels.trustBadge`) next to the status, also while
  the frame is inactive. You can reword it but not remove it. The `developer`
  tier shows no badge. The one exception is `chrome={false}`, where the
  embedding host shows the trust signal instead
  ([Frameless and deck hosts](#frameless-and-deck-hosts)).
- **Validation.** Every value that paints has passed `validateDraft` and the
  untrusted URL policy, on every entry path (blueprint object or JSON text,
  envelopes, local state and `setState`, `mountPlayer` updates and frame
  messages); see [paint-proof.md](paint-proof.md).
- **No side effects.** The player never activates, navigates, fetches or
  persists a blueprint. An action form only proposes an intent to your
  `onAction`; the catalog core's closed intents (`navigate`, `copy`,
  `export` and the rest) are not painted yet (planned).
- **Containment.** A node that cannot paint becomes its own placeholder; it
  never blanks the frame or throws into your page.

### Skip link

The first Tab stop is a skip link, "Skip past" plus your label
(`labels.skip`). It stays visually hidden until it receives keyboard focus,
and it moves focus to an end marker after the frame.

Unfocused, it is clipped to a 1 × 1 px box (`clip-path: inset(50%)`), so it
never shows over host content above the player. It expands in place when
focused. The full key map
(F6 between frames, arrows between frames, Escape walking outward) is in the
reference's [Keyboard and focus](reference.md#keyboard-and-focus) section.

## Labels and localization

Pass `labels` to translate the chrome. Only non-empty strings replace a
default, so a bad override never blanks the chrome. Labels paint as text,
never as HTML.

| Key | Default |
| --- | --- |
| `status.draft` / `.active` / `.superseded` / `.invalid` | `Draft`, `Active`, `Superseded`, `Invalid draft` |
| `trustBadge` | `Untrusted content` |
| `skip` | `Skip past` |
| `loading` | `Loading` (prefix of each skeleton's announcement) |
| `invalidNotice` | `This blueprint could not be validated.` |
| `previewWarning` | `Preview only. This invalid blueprint cannot be activated.` |
| `placeholders.<code>` | Fixed copy per placeholder code |
| `position` | `Position` |
| `contents` | `Contents` (a document's table of contents) |
| `speakerNotes` | `Speaker notes` |
| `hostRegionMissing` | `Provided by the app; not available here.` (under the label of a host region the host does not provide) |
| `hostRegionDuplicate` | `Already shown above.` (under a second host region with the same name) |

```svelte
<Player
  {blueprint}
  label="Informe semanal"
  lang="es"
  labels={{ trustBadge: 'Contenido no verificado', skip: 'Saltar', status: { draft: 'Borrador' } }}
/>
```

`dir="rtl"` mirrors the chrome and the painted layouts. Some copy is English
only for now: placeholder names that come from the catalog core ("Unknown
component …") and the untitled card and slide names.

## Inactive frames

`active={false}` makes the painted surface `inert`: focus and pointer input
cannot reach it, which suits a background chat message or an off-stage
slide. The chrome, including the trust badge, stays visible. Loading
skeletons are always inert.

## Embedding

### 1. Svelte component

`<Player>` as in the quick start.

### 2. ES module, without Svelte

`mountPlayer(target, props)` mounts the same component into any element.

```ts
import { mountPlayer } from '@texuli/player';
import '@texuli/player/styles.css';

const player = mountPlayer(document.querySelector('#report')!, {
  blueprint,
  label: 'Report preview',
});

player.update({ status: 'active' }); // re-validates in place (a live update)
player.setState('week', 'Week 42'); // false when the variable is missing or the value does not fit
player.dispose();
```

`update` changes the props in place: declared state that still fits, the
flow view, the selection and loaded painters are kept, even when the
blueprint changes (see
[Live updates](reference.md#live-updates-r20)). To start over, `dispose()`
and mount again.

### 3. Script on a plain page

Use a `<script type="module">` processed by your bundler (for example Vite).
The package exports TypeScript and Svelte source, so it needs a build step.
There is no standalone browser bundle or CDN build.

```html
<div id="report"></div>
<script type="module">
  import { mountPlayer } from '@texuli/player';
  import '@texuli/player/styles.css';

  mountPlayer(document.getElementById('report'), {
    blueprint: { id: 'layout-page', props: { title: 'Weekly summary' } },
    label: 'Report preview',
  });
</script>
```

### 4. Third-party iframe

For a host on another origin, use `<PlayerFrame>` (or `createPlayerFrameHost`)
on the host page and `mountPlayerFrame` on the frame page. The frame is
sandboxed without `allow-same-origin`, and only display data crosses the
`postMessage` boundary. See the reference's [Iframe frame](reference.md#iframe-frame)
section. A hosted frame page on a dedicated origin is planned, not built.

## Frameless and deck hosts

New in `0.4.0`: neither prop is in `0.3.0`.

**`chrome={false}`.** The `@texuli/slides` stage paints each catalog
component on a slide through a player with `chrome={false}`: the slide is
the frame, so the player adds no label heading, skip link or end anchor and
the component adds nothing to the slide's outline. That also removes the
status and the **Untrusted content** badge. This is the one exception to the
trust-badge contract above: with `chrome={false}` the embedding host must
show the trust signal itself. The slides stage does: at the `untrusted` tier
it shows one **Untrusted content** badge in its toolbar row for the whole
deck (`trustBadge`, `stage.untrustedBadge` in
[`@texuli/slides` stage docs](../../slides/docs/stage.md#trust-badge)). Use
`chrome={false}` only where your own surface does the same. Validation, the
URL policy at paint and containment are unchanged.

**`deckHost`.** The player (layer L7) cannot import `@texuli/slides` (L8), so
it paints a `layout-deck` blueprint as a document flow. A host that has both
packages can present it on the slides stage instead by passing a
`DeckPlayerHost`:

```ts
import type { DeckPlayerHost } from '@texuli/player';

const deckHost: DeckPlayerHost = {
  present({ tree, tier, label, active, root }) {
    // Map `tree` to a deck (validateDeckDraft from @texuli/catalog/validate,
    // then migrateDeck and parseDeck from @texuli/deck/model) and mount
    // DeckStage from @texuli/slides/stage with `tier`.
    return () => {
      // Unmount the stage.
    };
  },
};
// <Player {blueprint} {deckHost} label="Deck preview" />
```

When the validated tree's root is a deck (`isLayoutDeckTree`), the player
skips document paint, renders an empty `data-tx-player-deck-host-surface`
element (the root carries `data-tx-player-deck-host="pending"`) and calls
`present` with a `DeckPlayerHostRequest`: the validated `tree`, the
host-chosen `tier` (never one from the draft), the frame `label`, whether
the frame is `active`, and the player `root` element. `label`, `active` and
`root` are live getters: read them when you need them; changing them never
calls `present` again, so the stage keeps its position. `present` may return
a cleanup, which the player calls when the blueprint, tier or host changes
(then it presents again), and on destroy. Without a `deckHost`, or for any other root, the player
paints as before. `DECK_STAGE_HOST_PACKAGE` names the package that owns the
stage. `@texuli/slides` does not ship a ready-made `DeckPlayerHost` adapter
yet, so a host writes the few lines above itself.

Tests: `packages/player/tests/deck-host.test.ts` (deck detection,
`chrome={false}`, a mock host called for a deck and document paint without
one).

## Document hosts

New in `0.7.0`. A `document` blueprint
(spec 0.7.0, ADR-011) is one node whose `doc` is a Texuli document. The
player (L7) cannot import `@texuli/pages` (L8), and the document validator
is too large for its eager chunk, so both come from the host through
`documentHost` (`DocumentPlayerHost`):

```svelte
<script lang="ts">
  import { createDocumentPlayerHost } from '@texuli/pages/host';
  import { Player } from '@texuli/player';
  let { draft } = $props();
  const documentHost = createDocumentPlayerHost();
</script>

<Player blueprint={draft} label="Agent document" {documentHost} />
```

- **`checkDocument`** joins validation: the player passes it to
  `validateDraft` (and to the streaming node checks), which runs it at the
  player's `tier` and then checks the document's wrapped blocks and
  component embeds as catalog nodes. Without a `documentHost` every
  `document` node fails with `document-unchecked` and the player shows its
  invalid notice; nothing of the document paints.
- **`present`** receives a `DocumentPlayerHostRequest` once the draft is
  valid and its single root is a `document` (`documentRoot`): the node's
  `doc`, its `label` as `docLabel`, `outline`, its `key`, the host-chosen
  `tier`, and live getters for the frame `label`, `active` and the empty
  `target` element (`data-tx-player-document-host-surface`) to paint into.
  It may return a cleanup, called when the blueprint, tier or host changes,
  and on destroy; it is not called again for label or `active` changes.
  `createDocumentPlayerHost` validates the document again and mounts the
  read-only `PageReader`, loaded on first use.
- The host is read when the player mounts. `isDocumentTree` detects a
  document node, and `DOCUMENT_HOST_PACKAGE` names the package that owns the
  reader. Under `invalidPolicy="preview"` with no host, a `document` node
  paints a titled notice (`documentNeedsHost` in the labels), never its
  blocks.

Tests: `packages/player/tests/document-host.test.ts` (the seam, a hostile
document never presented, the preview notice, keyed streaming) and
`packages/pages/tests/host.test.ts` (the real reader in the player).


## Canvas hosts

On this branch, not yet published (spec 0.8.0, ADR-012). A `canvas`
blueprint is one node whose `canvas` prop is a Texuli canvas. The player
(L7) could import `@texuli/canvas` (L4), but the canvas validator stays out
of its first-load chunk, so, as for documents, the host supplies both
through `canvasHost` (`CanvasPlayerHost`):

```svelte
<script lang="ts">
  import { createCanvasPlayerHost } from '@texuli/canvas/host';
  import { Player } from '@texuli/player';
  let { draft } = $props();
  const canvasHost = createCanvasPlayerHost();
</script>

<Player blueprint={draft} label="Agent canvas" {canvasHost} />
```

- **`checkCanvas`** (a `DraftCanvasCheck`) joins validation at the
  player's `tier`, in `validateDraft` and the streaming node checks.
  Without a `canvasHost` every `canvas` node fails with `canvas-unchecked`
  and nothing of the canvas paints.
- **`present`** receives a `CanvasPlayerHostRequest` once the draft is
  valid and its single root is a `canvas` (`canvasRoot`): the node's
  `canvas`, its `label` as `canvasLabel`, its `key`, the host-chosen `tier`,
  and live getters for the frame `label`, `active` and the empty `target`
  (`data-tx-player-canvas-host-surface`). It may return a cleanup.
  `createCanvasPlayerHost` validates again and mounts the read-only
  `CanvasViewer`, loaded on first use.
- `isCanvasTree` detects a canvas node and `CANVAS_HOST_PACKAGE` names the
  package that owns the viewer. Under `invalidPolicy="preview"` with no
  host, a `canvas` node paints a titled notice (`canvasNeedsHost`), never
  its shapes.

## Forms

A `schema-form` node (spec 0.8.0, ADR-015) is a form as data. The player
does not depend on `@texuli/forms`: like documents and canvases, a form
paints through a host seam, `formHost` (`FormPlayerHost`), so the form
engine stays out of the player's first-load chunk and the player ships
without the forms package. `@texuli/forms/host` supplies the adapter:

```svelte
<script lang="ts">
  import { createFormPlayerHost } from '@texuli/forms/host';
  import { Player } from '@texuli/player';
  const formHost = createFormPlayerHost({ validators: { 'company-email': checkCompanyEmail } });
</script>

<Player blueprint={draft} label="Agent form" {formHost} onAction={answer} />
```

- **Validation.** The host's `checkForm` (`checkFormDraft`) joins
  `validateDraft` at the player's tier, with the host's `validators` names:
  a field may name only those. Without a `formHost` every `schema-form`
  node fails with `form-unchecked`, the invalid notice shows, and nothing
  of the form paints.
- **Painting.** Each valid `schema-form` node renders an element
  (`data-tx-player-schema-form="<action>"`) and hands it to the host's
  `present` (`FormPlayerHostRequest`: `schema`, `action`, `formLabel`,
  `tier`, the live `active`, `labels` and `target`, and `submit`). The
  adapter validates the schema again at that tier and mounts `SchemaForm`,
  loaded on first use; the cleanup unmounts it.
- **Submitting.** `submit(values)` proposes the node's `action` intent
  through `onAction`, like `action-form`, with the values of the visible,
  enabled fields; once confirmed the node's `submit` event runs its
  `on.submit` actions. Action values are scalars, so a list answer
  (multiselect, tags) travels as JSON array text (`'["a11y","forms"]'`)
  and a file answer as the JSON list of its file names: the player has no
  upload channel (uploads through a host seam are planned). A refused,
  failed or unavailable action resolves `{ ok: false, message }`, which the
  form shows in its error summary, keeping the answers.
- **Helpers.** `formActionValues(values)` is the value mapping above;
  `FORM_HOST_PACKAGE` names the package that owns the adapter.
- **Native.** The Kotlin twin validates the schema's shape and paints a
  visible placeholder (planned).

Tests: `packages/player/tests/schema-form.test.ts` (the golden paints
through the forms adapter, validation before painting, host validator
names, the action intent, refusals, no host) and the golden and streaming
suites.

## Sheet hosts

On this branch, not yet published (spec 0.8.0, ADR-015). A `spreadsheet`
node is a sheet as data: its `sheet` prop holds tabs of cells and formulas
in the closed sheet grammar (the id is `spreadsheet` because `sheet` is the
texuli `Sheet` drawer). The player (L7) does not import `@texuli/sheets`
(L5): the formula engine and the sheet view stay out of its first-load
chunk, so, as for canvases and forms, the host supplies both through
`sheetHost` (`SheetPlayerHost`):

```svelte
<script lang="ts">
  import { createSheetPlayerHost } from '@texuli/sheets/host';
  import { Player } from '@texuli/player';
  let { draft } = $props();
  const sheetHost = createSheetPlayerHost({ now: () => Date.now() });
</script>

<Player blueprint={draft} label="Agent sheet" {sheetHost} />
```

- **`checkSheet`** (a `DraftSheetCheck`) joins validation at the player's
  `tier`, in `validateDraft` and the streaming node checks; the adapter's
  check runs `validateSheet`, which parses every formula. Without a
  `sheetHost` every `spreadsheet` node fails with `sheet-unchecked`, the
  invalid notice shows, and nothing of the sheet paints; a bad formula
  fails with `sheet-schema`.
- **`present`** receives a `SheetPlayerHostRequest` for each valid
  `spreadsheet` node, wherever it sits in the tree: the node's `sheet`, its
  `label` as `sheetLabel`, the host-chosen `tier`, and live getters for the
  frame `label`, `active` and the empty `target`
  (`data-tx-player-spreadsheet`). It may return a cleanup, which the player
  runs when the node, its sheet, the tier or the host changes, and on
  destroy. `createSheetPlayerHost` validates again and mounts a read-only
  `SheetView` (an APG grid), loaded on first use; `editable: true` lets
  people edit the painted copy (edits stay in the view).
- `SHEET_HOST_PACKAGE` names the package that owns the view. Under
  `invalidPolicy="preview"` with no host, a `spreadsheet` node paints a
  titled notice (`sheetNeedsHost`), never its cells.
- **Native.** Painting spreadsheets in the Kotlin twin is planned.

Tests: `packages/player/tests/sheet-host.test.ts` (a recording host, the
real `@texuli/sheets/host` adapter with computed totals, refusal without a
host and of bad formulas, the preview notice) and
`packages/player/tests/examples-paint.test.ts`.

## Limits

- **Fidelity is structural, not pixel-level.** The golden fixture tests check
  the painted component tree, headings, frame stops and chrome, not pixels.
  Pixel baselines for the player examples (`player-blueprint-preview`,
  `player-dashboard`, `player-deck`) are committed in the visual suite
  (`tests/visual`); `pnpm visual -g player-` verifies them.
- **Provenance strip:** planned. The frame shows no provenance (who made the
  blueprint, from what) yet; the design's `provenance` frame option is not
  built.
- **Not built yet:** painting the core's closed intents, retrying a failed node, a
  ready-made deck host (decks paint as a document flow unless the host passes
  `deckHost`), a real-browser keyboard pass and a screen-reader pass.
- **Untrusted by default.** Choosing `tier="developer"` widens validation but
  never the paint-time URL policy.

## Testing

```bash
pnpm vitest run packages/player
pnpm --filter @texuli/player typecheck
pnpm vitest run packages/examples/tests/examples-render.test.ts
```
