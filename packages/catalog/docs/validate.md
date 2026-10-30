# Draft validation

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/validate`  
**Tests:** `packages/catalog/tests/validate-draft.test.ts` (drafts and block family checks)

## Goal

`validateDraft` is the single validation entry a host calls on untrusted
blueprint JSON (an agent's output, a pasted tree, an imported file). The
golden scorer, the edit history's commit gate and the planned player and
agent service call it, so there is one pipeline, not one per host.

It is runtime-neutral: no DOM and no Node APIs, so it runs in a browser, a
Node service or an edge worker. It never throws: anything unexpected fails
closed with an `internal-error` diagnostic.

## Pipeline

| Check | What it does | Stops the run |
| --- | --- | --- |
| `input` | Text: a byte cap before `JSON.parse` (`maxBytes` + 8 KiB), then parse. The value must be an object or an array | yes |
| `envelope` | For a [blueprint envelope](./envelope.md): strict field rules, the catalog binding (`catalogHash`), and trust warnings for a declared status, activation or tier; then the tree runs the checks below. `skipped` for a bare tree | on an unsupported version or a missing tree |
| `spec` | For an envelope, after `migrateBlueprint` (`@texuli/spec/migrate`) brings an older envelope (undeclared or `"spec": "0.2.0"`) to the current spec version: the host's `checkSpec` (for example `@texuli/spec`'s `validateBlueprint` with the spec documents); `skipped` without one | no |
| `structure` | One iterative pass: prototype keys (`__proto__`, `constructor`, `prototype`) anywhere, values nested deeper than 128 levels, node fields other than `key`, `id`, `props`, `children`, `slot`, `when`, `bind`, `on`, `motion`; from spec 0.7.0 a malformed node `key` (`invalid-key`, not `^[A-Za-z0-9._:-]{1,64}$`) or one used twice in the tree (`duplicate-key`) | only on a depth bomb |
| `interaction` | Spec 0.3.0 interaction, catalog-local: `$state` and `$data` bindings name declared variables (and are replaced by their first-paint values for the checks below), `bind` only on `bindable` props, `on` only for events the component fires, closed action ops and fields; from spec 0.8.0, `$source` data-source bindings on `sourceable` props, checked against the host's `sources` (see Data-source bindings below) and replaced by an empty list; list item text follows `SPEC_PATTERNS.listText`; and, for an envelope, the state surface rules from `@texuli/spec/surface` (form nodes inside an `action-form`, controls and fields bound to declared variables of their type, flow nodes matching the flow, no writes to host-bound variables), as `@texuli/player` refuses them | no |
| `sinks` | The raw sink scan (`scanSinks`): executable strings, HTML strings, `class` / `style` / `innerHTML` / `srcdoc` keys, `on…` keys, functions, bidi controls, and URLs the host tier's policy refuses for their kind of key (links through the link policy, `src` and `poster` through the image or media policy, and every `srcset` candidate through the image-set policy) | no |
| `limits` | `validateCatalogTreeLimits` (depth, nodes, bytes, branching, roots) | yes |
| `render` | `renderCatalogTree` at the host's tier: closed ids, tiers, prop schemas, the block family check, named slots and `when` conditions (with the host's `conditions` and `conditionInputs`; a `when` without a runtime is an error); from spec 0.8.0 the dashboard composition rules (`dashboard-child`, `dashboard-parent`, `dashboard-widgets`, `dashboard-widget-id`; see Dashboards below) | no |
| `blocks` | The host's `checkBlock` on every `blocks-*` block (assemble one with `createFamilyBlockCheck` from `@texuli/catalog/validate/blocks`; see the Block families section); `skipped` without one | no |
| `documents` | Spec 0.7.0: every `document` node (see Documents below). Without the host's `checkDocument` each one fails with `document-unchecked`; `skipped` only when the host passed none (it still fails the draft that holds a document) | no |
| `forms` | Spec 0.8.0: every `schema-form` node's schema (see Forms below). Without the host's `checkForm` each one fails with `form-unchecked`; `skipped` only when the host passed none (it still fails the draft that holds a form) | no |
| `canvases` | Spec 0.8.0: every `canvas` node's `canvas` through the host's `checkCanvas` (`checkCanvasDraft` from `@texuli/canvas/host`). Without it each one fails with `canvas-unchecked`; issues report as `canvas-schema`; `skipped` only when the host passed none | no |
| `sheets` | Spec 0.8.0: every `spreadsheet` node's `sheet` (see Sheets below). Without the host's `checkSheet` each one fails with `sheet-unchecked`; issues report as `sheet-schema`. Always `pass` or `fail`: a draft with no spreadsheet passes | no |
| `grammar` | `checkCompositionGrammar` with `defaultGrammarRoles` (or `roles`); warnings do not fail | no |
| `root` | One component root whose id is a frame (`DRAFT_FRAME_IDS`: `layout-page`, `layout-doc`, `layout-deck` and, from spec 0.7.0, `document`); `frameRoots: false` turns it off | no |

A draft is `ok` only with zero error diagnostics. `status` is `valid`,
`invalid`, `parse` or `over-limits`. For envelope input, `envelope` carries
the status validation earned (`validated` or `draft`). `draft` is the tree
with only node fields (`null` when it could not be read), `roots` is the
sink-free render tree to paint, and `checks` says which checks passed,
failed or were skipped, for a validation receipt.

The tier is chosen by the host, never by the draft: `untrusted` (the
default) for agent output, `developer` for trees a person authored in a
trusted tool.

## Usage

```ts
import { buildCatalog } from '@texuli/catalog/build';
import { renderCatalogFromBuild } from '@texuli/catalog/render/renderer';
import { validateDraft } from '@texuli/catalog/validate';
import { createFamilyBlockCheck } from '@texuli/catalog/validate/blocks';

// The nine `@texuli/blocks/*/engine` parsers, injected so the entry stays
// under its 8 KiB budget - the full recipe is in "Block families" below.
const checkFamilyBlock = createFamilyBlockCheck(familyEngines);

const catalog = renderCatalogFromBuild((await buildCatalog(groups)).catalog);
const result = validateDraft(text, { catalog, checkBlock: checkFamilyBlock });
if (!result.ok) {
  // result.diagnostics: check, code, severity, path, message, id
}
```

The block schema is an option, not a dependency: the block parsers are
larger than this whole module.

### Block families (`@texuli/catalog/validate/blocks`)

`createFamilyBlockCheck(engines)` builds the `checkBlock` that checks each
`blocks-*` node with the parser of the family that renders it (audit G05),
the same parser the family component runs before it paints, so a draft it
accepts does not paint an "invalid" notice. The check fails closed: a block
another family renders, a block with no `type`, an id with no known block
family or no injected engine (prototype names included) and a parser that
throws are all refused. The returned checker never throws.

The nine family parsers live in `@texuli/blocks/*/engine` and are injected,
so the `validate/blocks` entry stays under its 8 KiB budget instead of
bundling all nine engines:

```ts
import { checkCodeBlock } from '@texuli/blocks/code/engine';
import { checkDataBlock } from '@texuli/blocks/data/engine';
import { checkEmbedBlock } from '@texuli/blocks/embed/engine';
import { checkInteractiveBlock } from '@texuli/blocks/interactive/engine';
import { checkMapBlock } from '@texuli/blocks/map/engine';
import { checkMediaBlock } from '@texuli/blocks/media/engine';
import { checkStructureBlock } from '@texuli/blocks/structure/engine';
import { checkTextBlock } from '@texuli/blocks/text/engine';
import { createFamilyBlockCheck, diagramFamilyCheck } from '@texuli/catalog/validate/blocks';

const checkFamilyBlock = createFamilyBlockCheck({
  'blocks-code': checkCodeBlock,
  'blocks-data': checkDataBlock,
  'blocks-diagram': diagramFamilyCheck,
  'blocks-embed': checkEmbedBlock,
  'blocks-interactive': checkInteractiveBlock,
  'blocks-map': checkMapBlock,
  'blocks-media': checkMediaBlock,
  'blocks-structure': checkStructureBlock,
  'blocks-text': checkTextBlock,
});
```

`diagramFamilyCheck` adapts the diagram engine's JSON paths to the prop
paths the draft checks use. A host may inject fewer engines: every block id
without one is refused, and a test keeps the golden scorer's assembly equal
to the renderer's family table (`BLOCK_FAMILY_TYPES`) and the catalog's
`blocks-*` ids.

Prefer it to the core parser (`safeParseBlock` from `@texuli/blocks/core`).
The core parser knows only the core block types: it refuses valid `flow`,
`tree`, `board`, `terminal`, `link-preview`, `embed-app` and `map` blocks,
and its rules for some shared types differ from the family that renders
them.

The renderer's own family check (`blockFamilyMismatch`, in the `render`
check) also reads only its own keys, and refuses a `blocks-*` id with no
known family instead of skipping it.

## Deck drafts (model v2)

**Tests:** `packages/catalog/tests/validate-deck-draft.test.ts`

> **New in `0.4.0`.** Deck model v2 trees, spec `0.4.0` and the functions
> below ship in `@texuli/catalog` `0.4.0`, with the first release of
> `@texuli/deck`, which owns the model.

`validateDeckDraft(input, options)` is the entry for a deck an agent writes
as a catalog tree. It runs `validateDraft` at the host's tier (`untrusted`
by default) with `layout-deck` as the only frame root
(`DECK_ROOT_CATALOG_ID`; its slides are `deck-slide`,
`DECK_SLIDE_CATALOG_ID`), then maps the tree to a plain deck model v2 object
(`DeckV2Plain`, `formatVersion: 2`). It never throws.

`@texuli/catalog` does not depend on `@texuli/deck`, so the mapped deck is
**not** validated against the model. A host that has `@texuli/deck` runs
`migrateDeck` and `parseDeck` on it, or passes them as `loadDeck`, which this
call runs on the mapped object (a loader that throws becomes a `deck-loader`
error):

```ts
import { validateDeckDraft } from '@texuli/catalog/validate';
import { migrateDeck, parseDeck } from '@texuli/deck/model';

const result = validateDeckDraft(agentJson, {
  catalog,
  loadDeck: ({ mapped }) => {
    const parsed = parseDeck(migrateDeck(mapped).deck);
    return parsed.ok
      ? { deck: mapped } // or the validated `parsed.deck`, which has the same shape
      : {
          deck: null,
          issues: parsed.issues.map((issue) => ({
            check: 'deck' as const,
            code: 'deck-schema' as const,
            severity: 'error' as const,
            path: issue.jsonPath,
            message: issue.message,
          })),
        };
  },
});
```

The mapping (`layoutDeckToV2`, pure) reads:

- the `layout-deck` props into `meta` (title, description, locale, `dir`;
  a missing title becomes “Untitled deck”), `style` (`aspect`, `themeRef`
  as `theme`, `transition`, `motion`, `background` and a `style` object),
  `navigation` (from v1 `settings` or a `navigation` object) and `outline`;
- each `deck-slide` child into a slide: `id` from `slideId`, `title`,
  `notes`, `master`, `themeRef`, `transition`, `background` and `steps`; a
  slide with a catalog `layout` keeps it and its `props`, and
  `layout: 'component'` keeps its component. An id that is not a lowercase
  slug is rewritten and a duplicate gets a suffix, each with a warning.
  Known gap: a slide `themeRef` is copied under that name, which the v2
  `parseDeck` refuses (`unknown-key`; the v2 slide field is `theme`);
- the children of a free slide into blocks: a block node's `block` prop as
  the block, a `charts-*` node as a chart block, any other node as a
  component item (`{ type: 'component', component, props }`);
- a structured `slides[]` prop the same way;
- legacy `layout-card` children as free slides, with a `deck-legacy-cards`
  warning (`legacyCards: true` on the result).

`deckV2ToLayoutTree(deck)` encodes a v2 deck back as a `layout-deck` tree
with `deck-slide` children; the test round-trips the golden mapping.

The result (`DeckDraftResult`) carries `ok`, `status`, the catalog `draft`,
the mapped `deck` (only when `ok`), `diagnostics` (catalog findings, then
`DeckDraftIssue`s with `check: 'deck'` and a `DeckDraftIssueCode`:
`deck-schema`, `deck-legacy-cards`, `deck-empty` or `deck-loader`) and
`legacyCards`. A non-deck root and a deck without slides fail.
`ValidateDeckDraftOptions` are the draft options without `frameRoots`, plus
`loadDeck`.

This function is not the model v1 `validateDeckDraft` of
`@texuli/slides/grammar`, which validates `0.3.0` decks and returns a v1
deck.

## Documents (spec 0.7.0)

A `document` node (ADR-011) carries a Texuli document in its `doc` prop:
`{ format: "texuli-document", formatVersion: 1, meta, blocks, … }`. The
`documents` check judges it in two steps, at the draft's tier:

1. **The document itself**, with the host's `checkDocument`
   (`DraftDocumentCheck`): the closed block vocabulary, text safety, the URL
   policy and the caps. It is injected like `checkBlock`, so
   `@texuli/catalog/validate` never bundles the document engine; pass
   `checkDocumentDraft` from `@texuli/pages/host`, or adapt
   `validateDocument` from `@texuli/document/schema` (the JSDoc of
   `DraftDocumentCheck` shows the four lines). Errors become
   `document-schema`; warnings (orphaned comment anchors) do not fail. A
   throwing check fails closed. **Without `checkDocument` every `document`
   node fails with `document-unchecked`**: a document never passes on
   structure alone.
2. **What it borrows from the catalog**, on the validated copy: a `block`
   node (`family`, `block`, `props`) is rendered as the `blocks-<family>`
   catalog node at the tier and checked by `checkBlock` when the host passes
   one (`document-block`); an `embed` of kind `component` with an `inline`
   payload is rendered as that one catalog node at the tier, so app chrome,
   unknown ids and refused props fail (`document-embed`); an embed of a
   `document` fails (`document-nested`). The raw sink scan already covers
   every string of the `doc` (HTML strings, script URLs in `href` keys,
   `on…` keys).

At most `MAX_DOCUMENT_FINDINGS` (20) findings are reported per document.
`checkDocuments(roots, options)` runs step 2 alone on a render tree, and
`documentNodes(roots)` lists the `document` nodes with their paths
(`DOCUMENT_ID`, `DocumentCheckOptions`, `DocumentFinding` and
`DraftDocumentIssue` are its types).

```ts
import { validateDraft } from '@texuli/catalog/validate';
import { checkDocumentDraft } from '@texuli/pages/host';

const result = validateDraft(agentOutput, { catalog, checkBlock, checkDocument: checkDocumentDraft });
```

## Forms

A `schema-form` node (spec 0.8.0, ADR-015) carries a closed form schema in
its `schema` prop (`$defs.formSchema`): typed fields in sections or steps,
conditions and cross-field rules as expressions of the closed language in
`@texuli/core/expression`, named formats and host validator names, never a
pattern or code. The `forms` check runs the host's `checkForm`
(`DraftFormCheck`) at the draft's tier, usually `checkFormDraft` from
`@texuli/forms/model`, which runs `validateFormSchema`: closed members per
field type, unique names and ids, options and defaults, ranges, help links
through the URL policy, and conditions that read only earlier fields. With
`formValidators` (the names of the validators the host registered) a
field's `validator` must name one of them. Injected like `checkDocument`,
so `@texuli/catalog/validate` never bundles the forms runtime. **Without
`checkForm` every `schema-form` node fails with `form-unchecked`**; a
throwing check fails closed (`form-schema`). Issues report as
`form-schema` with the node path and the JSON path into the schema
(`0.children.0.props.schema.fields[0].pattern`), at most
`MAX_FORM_FINDINGS` (50) per form (`DraftFormIssue` is one issue).
`checkForms(roots, options)` runs the check alone on a render tree
(`FormCheckOptions`, `FormFinding`), and `schemaFormNodes(roots)` lists
the `schema-form` nodes (`SCHEMA_FORM_ID`) with their paths.

```ts
import { validateDraft } from '@texuli/catalog/validate';
import { checkFormDraft } from '@texuli/forms/model';

const result = validateDraft(agentOutput, { catalog, checkForm: checkFormDraft, formValidators: ['uniqueEmail'] });
```

## Sheets

A `spreadsheet` node (spec 0.8.0, ADR-015; new in 0.8.0) carries a
Texuli sheet in its `sheet` prop (`$defs.sheet`): tabs of A1-addressed
inputs, where text that starts with `=` is a formula in the closed sheet
grammar. The catalog id is `spreadsheet` (`SPREADSHEET_ID`), not `sheet`,
which is the texuli `Sheet` drawer in the overlays group. The `sheets`
check runs the host's `checkSheet` (`DraftSheetCheck`), usually
`checkSheetDraft` from `@texuli/sheets/model`, which runs `validateSheet`:
closed members, the caps (16 sheets, 10,000 rows, 256 columns, 100,000
cells), text safety, and every formula parsed with the sheet grammar, so an
agent formula that names an unknown function or does not parse is refused
at draft time. Sheets are data at every tier. Injected like
`checkCanvas`, so `@texuli/catalog/validate` never bundles the formula
engine. **Without `checkSheet` every `spreadsheet` node fails with
`sheet-unchecked`**; a throwing check fails closed (`sheet-schema`). Issues
report as `sheet-schema` with the node path and the sheet path, at most
`MAX_SHEET_FINDINGS` (20) per sheet (`DraftSheetIssue` is one issue,
`SheetFinding` one finding). `checkSheets(roots, options)` runs the check
alone on a render tree, and `sheetNodes(roots)` lists the `spreadsheet`
nodes with their paths.

```ts
import { validateDraft } from '@texuli/catalog/validate';
import { checkSheetDraft } from '@texuli/sheets/model';

const result = validateDraft(agentOutput, { catalog, checkSheet: checkSheetDraft });
```

## Dashboards

A `data-dashboard` node (spec 0.8.0; new in 0.8.0) lays out
`data-dashboard-widget` children on a grid (`layout`: each widget's place
by `widgetId`). The prop schemas cannot say how the nodes compose, so the
`render` check runs `checkDashboards(roots)` on the render tree
(`DashboardFinding`), linear in the tree and never throwing:

| Code | Refused when |
| --- | --- |
| `dashboard-child` | A `data-dashboard` holds a child that is not a `data-dashboard-widget` |
| `dashboard-parent` | A `data-dashboard-widget` sits anywhere but directly inside a `data-dashboard` |
| `dashboard-widgets` | A dashboard holds more than `MAX_DASHBOARD_WIDGETS` (200) widgets, the cap of `@texuli/data/dashboard/engine` |
| `dashboard-widget-id` | A widget's `widgetId` is not an id (letters, digits, `-` and `_`, at most 64 characters, starting with a letter or digit) or is used twice in its dashboard |

At most `MAX_DASHBOARD_FINDINGS` (20) findings are reported per draft.
Widget content stays ordinary catalog nodes, so data reaches a widget only
through host-registered sources (`$source`), never URLs or code.

## Data-source bindings (spec 0.8.0)

A component's `sourceable` props (the catalog manifest field; today
`data-grid.rows`, `data-board.items`, `data-tree-view.items`,
`data-calendar.events`, `data-files.entries`, `data-timeline.tasks` and
`data-notification-inbox.items`) may read rows from a source the host
registered (ADR-015):
`{"$source": name, "query": {...}, "map": {...}}`. The `interaction` check
runs `checkSourceBinding` from `@texuli/spec/source`, the same rules as the
spec validator and the Kotlin twin, against `options.sources` (usually
`registry.describe()` from `@texuli/core/data-source`):

- the closed shape: `$source` is a source name (never a URL), the query
  holds only `fields`, `filter` (the `@texuli/data` grid filter model, at
  most 6 levels and 64 nodes), `sort`, `search` and `pageSize`, and `map`
  pairs item fields with source field names;
- the meaning: a registered source (`unknown-source` otherwise), declared
  fields, the operators each field allows and values of its type, sortable
  fields, `search` only where the source declares it, a page size within its
  `maxPageSize`, and `map` keys that are item fields of the prop.

Every other problem is `source`, as is a binding on a prop that is not
sourceable, nested inside a prop value, or mixed with `$state`. **Without
`sources` every binding fails with `source`**: a binding never passes on
structure alone. The prop is replaced by an empty list for the `render`
check; `@texuli/player` fills it with the source's rows at paint time
([data sources](../../player/docs/data-sources.md)).

```ts
const result = validateDraft(agentOutput, { catalog, sources: registry.describe() });
```

## Streamed nodes

A host that paints a blueprint while an agent writes it (ADR-014;
`<Player stream>` in `@texuli/player`) checks each node as its shell
arrives: every member but `children`, read by `@texuli/spec/stream`. These
functions are new in `0.6.0`.

| Export | What it does |
| --- | --- |
| `validateStreamNode(input, options)` | `checkStreamTotals`, a key already admitted, then `validateStreamChain` on the node's chain. `input` (`StreamNodeInput`) is the envelope `header` (or `null`), its `treeMember`, the admitted `ancestors`' shells, the node's `shell`, its `index`, `root` for a root of an array, how many nodes were `admitted` so far and, from spec 0.7.0, the `admittedKeys` (a node repeating one is refused with `duplicate-key`). Returns a `StreamNodeValidation` (`ok`, `diagnostics`, `validation`) |
| `validateStreamChain(chain, options)` | The real `validateDraft` on a prepared chain with the host's options and `frameRoots: false`; any error outside `STREAM_WHOLE_TREE_CHECKS` (`grammar`, `root`) refuses the node. The player calls it after resolving `$state` bindings itself |
| `streamNodeChain(input)` | The header, each ancestor's shell and the node as one draft whose only leaf is the node |
| `checkStreamTotals(input, limits)` | The totals measured so far against the limits: `nodes-exceeded`, `branching-exceeded`, `roots-exceeded` |

The chain carries the context a node rule needs (the header's state and
flow, the form an action field sits in), and every rule `validateDraft`
applies to a node applies unchanged: nothing is weakened. Only grammar and
the root rule wait for the complete draft, and the complete draft goes
through `validateDraft` itself, which stays the only path to a valid draft.
A node whose member arrives after `children` is the host's to hold (the
`stream-order` event of `@texuli/spec/stream`).

## Edit history

`draftCommitGate(options)` adapts `validateDraft` to the commit gate of
`createEditHistory` (`@texuli/catalog/edit`). An edit that would leave the
draft invalid is refused with `validation-failed` and the tree is unchanged.
The history's default gate stays the tree limits; hosts opt in:

```ts
import { createEditHistory } from '@texuli/catalog/edit';
import { draftCommitGate } from '@texuli/catalog/validate';

const history = createEditHistory(tree, { validate: draftCommitGate({ catalog }) });
```

## Not covered

- The golden `dontUseWhen` guidance detectors and `axe` stay in
  `@texuli/tools/golden` (axe needs a DOM).
- The website playground keeps its own preview pipeline for now; it renders
  trees that fail validation on purpose, to show the diagnostics.
- The envelope's JSON schema in the planned `spec/` (ADR-004).
