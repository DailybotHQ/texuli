# @texuli/player

The Svelte 5 paint runtime for agent-built interfaces in
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). Hand
`<Player>` a blueprint (catalog JSON, usually written by an agent) and it
validates the blueprint, then paints it with real Texuli layouts, content
blocks, charts and media. HTML sinks never touch the blueprint. Agent
output stays inside a labelled frame with a visible trust badge, and the
player never navigates, fetches or persists anything on its own.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.9.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.10.0`) may contain breaking
> changes, so pin the exact version or use `^0.9.0`, which accepts only 0.9.x.

> **New in `0.4.0`.** Spec 0.3.0 and 0.4.0 envelopes (`state`, `flow`,
> `bind`, `on` and the closed actions), the data view, chat display,
> sortable list and workflow graph painters, the shared drag scope, the
> `deckHost` seam and `chrome={false}` ship in `0.4.0`; the `0.3.0` release
> predates them
> ([RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

## Install

```bash
npm install @texuli/player svelte
```

Svelte 5 (`^5.57.2`) is a peer dependency. The validation core
(`@texuli/catalog`) and the blocks, charts and media painters are installed
as dependencies. Import the stylesheet once if your bundler does not keep
package CSS side effects:

```ts
import '@texuli/player/styles.css';
```

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

The root must be `layout-page`, `layout-doc` or `layout-deck`. The player
validates at the `untrusted` tier by default, shows the frame chrome (your
label, the lifecycle status and an **Untrusted content** badge), and loads
only the painters the blueprint uses.

Without Svelte, mount it from plain JavaScript:

```ts
import { mountPlayer } from '@texuli/player';

const player = mountPlayer(document.querySelector('#preview')!, {
  blueprint,
  label: 'Report preview',
});
player.update({ blueprint: nextBlueprint }); // re-validates in place
player.dispose();
```

## What's inside

Everything is exported from the root entry, `@texuli/player`.

| Area | Headline exports |
| --- | --- |
| Svelte component | `Player`, with host-owned props for tier, status, labels, density, motion, selection and callbacks |
| Plain JavaScript | `mountPlayer` (`update`, `setState`, `getState`, `dispatchFlow`, `getView`, `dispose`) |
| Catalog and loaders | `createPlayerCatalog`, `PLAYER_LOADERS`, `withLoadTimeout`, `skeletonFamily` |
| Error placeholders | `PLAYER_NODE_ERROR_CODES`, `placeholderMessage` |
| Labels and localization | `DEFAULT_PLAYER_LABELS`, `resolvePlayerLabels` |
| Local state and flows | `parseStateDeclarations`, `parseFlowDeclaration`, `resolveStateBindings` |
| Action forms | `runAction`, `actionValues`, `AUTOCOMPLETE_ALLOWLIST` |
| Host data and regions | `sanitizeDataSources`, `hostRegionManifest`, `HOST_CHROME_IDS` |
| Iframe embedding | `PlayerFrame`, `createPlayerFrameHost`, `mountPlayerFrame`, `createPlayerFrameClient` |
| Media policy | `applyMediaPolicy`, `TRUST_PINNED_IDS` |
| Streaming (new in `0.6.0`) | `<Player stream>`, `BlueprintStreamSource`, `PlayerStreamProgress`, `STREAM_PENDING_ID`; the push handle is `createBlueprintStream` from `@texuli/spec/stream` ([streaming.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/streaming.md)) |
| Data sources (new in `0.8.0`) | `<Player sourceRegistry>` or `sourceLoader`: blueprint props `{"$source": name, "query": {...}}` read host-registered sources from `@texuli/core/data-source`, with loading, empty and error states, paging and optimistic edits ([data-sources.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/data-sources.md)) |
| Design systems (in development for `0.10.0`, not on npm) | `<Player designSystems={{ resolve, mode }}>` and `onDesignSystem`: a blueprint's `designSystem` (spec 0.10.0) is resolved by the host (never fetched), compiled lazily and applied to the player root; a refused one keeps the default theme with a notice, and its component defaults reach the painted components (props still win); `PlayerDesignSystems`, `PlayerDesignSystemEvent`. The step is also the `@texuli/player/design-system` subpath (`resolvePlayerDesignSystem`, `applyPlayerDesignSystem`, `playerDesignDefaults`), which the `@texuli/slides` stage loads lazily for a deck's own `designSystem` ([reference.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/reference.md#design-systems-spec-0100)) |
| Stylesheet | `@texuli/player/styles.css` |

The TypeScript declarations list the full surface.

## Key guarantees

- **Validated before it paints.** Every blueprint value that paints has
  passed `validateDraft` from `@texuli/catalog` and the untrusted URL
  policy, on every entry path: the prop, `mountPlayer` updates, local
  state, host data and iframe messages. Choosing `tier="developer"` widens
  validation but never the paint-time URL policy.
- **No HTML sinks.** The player paints through components and never uses
  `{@html}` or `innerHTML`. Layout props are closed enums, clamped numbers
  or bounded lengths.
- **Visible trust boundary.** At the `untrusted` tier the frame always
  shows the trust badge. A host can reword it but not remove it.
- **Fails per node.** Invalid drafts are refused with a notice by default.
  A node that cannot load or paint becomes its own labelled placeholder
  and never blanks the page or throws into it.
- **No side effects.** Controls write local state only. An action form
  proposes an intent to your `onAction` handler, and the player sends
  nothing itself.
- **Every emittable id paints from JSON (new in `0.4.0`).** All 66
  agent-emittable ids of the 158-id catalog have a painter (the other ids
  are app tier, refused at the untrusted tier), including data views (grid, tree, board,
  calendar, timeline, map, files), chat display, `sortable-list` and
  `workflow-graph` (the `@texuli/workflows` viewer or editor). Node `on`
  runs only the closed actions (`setState`, `toggleState`, `moveItem`,
  `flowGo`, `emit`, `submit`), and `bind` writes back only to declared
  variables. The chat composer stays host chrome. New in
  `0.5.0`, three more data views paint from JSON: `data-cohort-table`,
  `data-notification-inbox` (read changes stay in view, `filter` is
  bindable, links always pass the untrusted URL policy) and
  `data-filter-builder` (a starting filter is parsed against its fields;
  one that does not fit starts empty).
- **One drag scope (new in `0.4.0`).** `sortable-list` nodes share one drag
  scope, so an item moves between lists anywhere in the layout under the
  same group, `accepts`, `locked`, `pull` and `maxItems` rules that
  `moveItem` applies; the drag offers exactly what the data move does.
- **A blueprint that validates paints.** The spec and catalog validators
  refuse the same state surface errors the player refuses (form nodes
  outside an `action-form`, unbound controls, unmatched flow nodes, writes
  to host-bound variables).
- **Streams add speed, not trust (new in `0.6.0`).** With `stream`, a node
  paints only once its shell (everything but `children`) has arrived and
  passed every node-level check, under an `aria-busy`, `inert` surface with
  polite progress at most every few seconds. Nothing is armed until the
  complete draft passes `validateDraft`; a refused draft replaces the
  painted prefix with the notice, and an interrupted stream keeps its
  painted nodes with a recoverable error
  ([streaming](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/streaming.md)).
- **Motion as data (spec 0.6.0, new in `0.6.0`).** A node's closed `motion`
  (enter and exit presets, layout, stagger and duration in token steps)
  plays through `@texuli/core/motion`, loaded only when a node declares it:
  never on the server or for what the first paint shows, instant under
  reduced motion, and capped by the host's `motionLevel`
  ([reference](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/reference.md#node-motion-spec-060)).
- **Accessible frame.** A skip link, F6 between frames, Escape walking
  outward, `inert` for inactive frames, one polite live region, and reduced
  motion honored.
- **Strict CSP friendly.** No `unsafe-inline` or `unsafe-eval` is needed,
  and the player makes no network requests of its own.
- **Sandboxed iframes.** `PlayerFrame` renders only an HTTPS `src` on your
  allowlist, sandboxed without `allow-same-origin`. Every message is
  re-parsed and size-clamped on both sides.

Not built yet: painting the catalog core's closed intents (such as
`navigate` or `copy`), retrying a failed node, and a hosted player-frame
page. Decks paint as a document flow; the slide-by-slide presenter stage
lives in `@texuli/slides`. New in `0.4.0`: a
host that has both packages passes a `deckHost` to present a deck blueprint
on that stage instead, and `chrome={false}` paints a component with no frame
chrome, as the slides stage does for every component on a slide
([embedding](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md)).

## New in 0.8.0

Ships in `0.8.0`; the `0.7.0` release predates it: `schema-form` nodes (spec 0.8.0) paint
through the `formHost` seam (`createFormPlayerHost()` from
`@texuli/forms/host`, which also supplies the form check and the host
validators by name); submitting proposes the node's action intent, and
without a host a form blueprint is refused
([embedding](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md#forms)).
Also new in `0.8.0`: the `canvasHost` seam paints agent
`canvas` blueprints (spec 0.8.0) through `createCanvasPlayerHost()` from
`@texuli/canvas/host`, which also supplies the canvas check validation
runs; without one a canvas is refused
([embedding](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md#canvas-hosts)).
Also new in `0.8.0`: the `sheetHost` seam paints
`spreadsheet` nodes (spec 0.8.0) in place through
`createSheetPlayerHost()` from `@texuli/sheets/host`, which also supplies the
sheet check validation runs (every formula is parsed at draft time) and
mounts a read-only `SheetView`; without one a spreadsheet is refused
(`sheet-unchecked`), and a preview shows its title and `sheetNeedsHost`
([embedding](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md#sheet-hosts)).
`data-dashboard` and `data-dashboard-widget` nodes paint a dashboard grid,
and `data-dashboard.layout` may read a host source
([data sources](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/data-sources.md)).

## New in 0.7.0

Ships in `0.7.0`; the `0.6.0` release predates it: the `documentHost` seam paints agent
`document` blueprints (spec 0.7.0) through a host such as
`createDocumentPlayerHost()` from `@texuli/pages/host`, which also supplies
the document check validation runs; without one a document is refused
([embedding](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md#document-hosts)).
Node `key`s ride on the render tree, and a streamed node that repeats a key
already painted is held (`duplicate-key`).

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it: streaming mode
(`<Player stream>`), spec `0.6.0` node motion (`motionLevel`), and reduced
motion at `0s` durations and delays (G78)
([streaming](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/streaming.md),
[reference](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/reference.md#node-motion-spec-060)).

## Documentation

- Website: [texuli.com](https://texuli.com), the
  [blueprint builder](https://texuli.com/builder/) and the
  [agents overview](https://texuli.com/agents-page/)
- Embedding guide (start here): [embedding.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/embedding.md)
- Validate, edit and activate around the player: [blueprint-flow.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/blueprint-flow.md)
- Full reference (loaders, layouts, keyboard, state, flows, actions, iframe protocol): [reference.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/reference.md)
- Streaming mode (paint a blueprint while an agent writes it; new in `0.6.0`): [streaming.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/streaming.md)
- Data sources (blueprint spec 0.8.0; new in `0.8.0`): [data-sources.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/data-sources.md)
- Security property: [paint-proof.md](https://github.com/DailybotHQ/texuli/blob/main/packages/player/docs/paint-proof.md)
- Security model: [SECURITY.md](https://github.com/DailybotHQ/texuli/blob/main/docs/SECURITY.md)

## Related packages

- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the catalog, draft validation and the sink-free renderer the player is built on.
- [`@texuli/slides`](https://www.npmjs.com/package/@texuli/slides): presentation decks with a presenter stage.
- [`@texuli/tools`](https://www.npmjs.com/package/@texuli/tools): custom elements for hosts that do not use Svelte.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-player).
