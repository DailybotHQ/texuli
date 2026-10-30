# Player reference

**Package:** `@texuli/player` · **Import:** `@texuli/player`

The area-by-area reference for the player: what it paints, how it fails,
and every host-facing contract (loaders, placeholders, layouts, media,
motion, announcements, keyboard, local state, flows, action forms, host
data, selection, host regions, live updates and the iframe protocol). Start
with the [embedding guide](embedding.md); the
[blueprint flow guide](blueprint-flow.md) covers validation, edits and
activation around the player, and [paint-proof.md](paint-proof.md) argues
the security property.

## Overview

The player includes lazy block, chart and media loaders plus a painter for
every agent-emittable content layout in the catalog: `layout-page`,
`layout-doc`, `layout-card`, `layout-grid`, `layout-deck` and `deck-slide`
(see Document layouts). Other valid catalog ids remain visible as no-painter
placeholders until a loader is provided. State-only controls, flows and
action forms paint (see below), but the component never activates,
navigates, fetches or persists a blueprint: an action form only proposes an
intent that the host's `onAction` answers. The catalog core's closed intents
(`navigate`, `copy`, `export` and the rest) are not painted yet (planned). The core applies the untrusted URL policy at paint time, even when
the host chose the developer validation tier.

Each `blocks-*` node is checked by its own family's parser, the parser that
family runs before it paints. The player builds that check internally
(`src/block-check.ts`, not exported) with `createFamilyBlockCheck` from
`@texuli/catalog/validate/blocks` and the nine `@texuli/blocks/*/engine`
parsers. A host that calls `validateDraft` itself builds the same check to get
the same verdict (see [the blueprint flow guide](blueprint-flow.md)). Valid diagram, embed and map blocks pass, and a
block of another family's type is refused.

The security property (every blueprint value that paints has passed
`validateDraft` and the untrusted URL policy, on every entry path) is argued
path by path in [paint-proof.md](paint-proof.md) and checked by
`tests/untrusted-paint.test.ts`.

At the `untrusted` tier the chrome always shows a trust badge, "Untrusted
content" (`labels.trustBadge`), next to the status badge. This is the
artifact-frame contract from `@texuli/catalog/render/frame`: agent output
stays distinguishable from app chrome. A host can reword the badge but not
remove it; it stays visible when the player is inactive. The `developer`
tier shows no trust badge. The one exception is `chrome={false}`, which
paints no frame chrome and so no badge: the embedding host must then show
the trust signal itself. The `@texuli/slides` stage, which paints catalog
components through frameless players, shows one **Untrusted content** badge
in its toolbar row at the `untrusted` tier
([embedding.md](embedding.md#frameless-and-deck-hosts)).

Invalid drafts are refused by default. `invalidPolicy="preview"` displays the
validated placeholder tree with a visible warning; it does not enable
activation. Frame chrome always identifies the host label and lifecycle
status. A failing lazy node or component is contained in its own visible
placeholder (see below).

## Lazy loading and skeletons

`PLAYER_LOADERS` maps each catalog id to a dynamic import, so a blueprint only
loads the families it paints; ids it does not use are never imported. While a
node loads, it shows a static fallback skeleton shaped for its family
(`skeletonFamily(id)`: `layout`, `block`, `chart`, `media` or `generic`). The
skeleton is a `role="status"` region with `aria-busy="true"` and a visually
hidden "Loading <catalog label>…" text. Skeletons do not animate.

A loader that has not settled after `loadTimeoutMs` (default
`DEFAULT_LOAD_TIMEOUT_MS`, 15 000 ms; `0` turns the limit off) rejects, and its
node becomes the `node-error` placeholder instead of a skeleton that never
ends. `withLoadTimeout(loaders, ms)` is the same wrapper, exported for hosts
that build their own loader maps. A failed load is not retried while the
player is mounted.

## Per-node error placeholders

A node that cannot paint never blanks the page or throws. It becomes a
`role="note"` placeholder named by its label, with fixed copy for its stable
code (`PLAYER_NODE_ERROR_CODES`, `placeholderMessage(code)`) in
`data-tx-player-error`:

| Code | When |
| --- | --- |
| `unknown-id` | The id is not in the catalog (visible in `invalidPolicy="preview"`) |
| `tier-denied` | The id is not allowed for the host's tier (visible in preview) |
| `no-loader` | The id is valid but the loader map has no painter for it |
| `node-error` | The lazy load failed or timed out, the loader returned no component, or the component threw while mounting |

The thrown error is never rendered. Hosts that want it pass `onNodeError`,
called once per failing node with `{ code, id, path, phase, error? }`, where
`phase` is `load`, `render` or `invalid-component` and `error` is set for
`render` only. Retrying a failed node is not supported yet (planned).

## Embedding contract

The host owns every option; the blueprint can set none of them.

| Prop | What it does |
| --- | --- |
| `blueprint` | Text or data, re-validated on every change |
| `catalog`, `catalogHash`, `tier`, `status`, `invalidPolicy`, `label` | Validation and lifecycle chrome, as above |
| `loaders`, `loadTimeoutMs` | Lazy painters and their time limit |
| `landmarks` | Whether layout painters may emit document landmarks (`<main>`); `true` by default. A host embedding the player inline inside its own landmark passes `false`, and the page layout paints a plain section instead (no duplicate `main`) |
| `dir`, `lang` | Direction and language of the player root; a `lang` that is not BCP 47-shaped is dropped |
| `labels` | Host-localized chrome copy (`DEFAULT_PLAYER_LABELS` lists every key), merged per key; empty strings keep the default |
| `density` | `compact` tightens chrome and spacing for chat surfaces |
| `onDiagnostics` | Called after each validation with `{ status, surface, error?, diagnostics, receipt, stateIssues }`; `receipt` is `null` when declared state was refused before validation |
| `onResize` | Called with the root's border-box `{ blockSize, inlineSize }` (`ResizeObserver`) |
| `onNodeError` | Called once per failing node |
| `initialState`, `onStateChange` | Local state overrides and snapshots (see Local state) |
| `active` | `false` makes the painted surface `inert` for a background or off-stage frame (see Keyboard and focus) |
| `composer`, `hostRegions` | Host snippets painted outside the validated tree (see Composer host chrome and Host regions) |
| `selectable`, `selection`, `onSelectionChange` | Frame selection for a builder preview (see Selection) |
| `motion` | `auto` (default) follows `prefers-reduced-motion`; `reduce` stops motion whatever the user setting (see Motion) |
| `motionLevel` | `full`, `subtle` or `none`: the host's level for spec 0.6.0 node motion, over the blueprint's `motion.level`; default the blueprint's, else `full` (see Motion) |
| `view`, `onFlowChange` | The current flow view and its transitions (see Views and flows) |
| `onAction` | Answers action-form intents; without it, actions are unavailable (see Action surface and receipts) |
| `dataSources` | Host values for host-bound state variables (see Host data binding) |

Hosts without Svelte call `mountPlayer(target, props)`, which returns
`update(next)`, `setState(name, value)`, `getState()`, `dispatchFlow(event)`,
`getView()` and `dispose()`.
`update` changes the props in place and re-validates (a live update; see
Live updates below). To start from scratch, `dispose()` and mount again.

Placeholder labels that name a component ("Unknown component “x”",
"“x” could not be shown") come from the catalog core and stay in English for
now.

### Chat display ids (G10)

`createPlayerCatalog()` includes two agent-emittable display ids,
`chat-thread` and `chat-message` (`CHAT_DISPLAY_MANIFESTS`):
- `chat-thread` takes `label`, and its children are `chat-message` nodes.
- `chat-message` takes `author` (required), `role` (`user`, `agent` or
  `system`, required), `at` (ISO time) and `text` (the chat inline subset),
  and its children are validated `blocks-*` nodes.

They are display-only: no live region, no intents, no composer. The
manifests live in this package because the catalog's manifest groups are
owned elsewhere. They are plain `CatalogManifest` data and validate with
`validateCatalogManifests`; moving them into a catalog `chat` group is
planned.

`@texuli/player` does not depend on `@texuli/chat`, so `PLAYER_LOADERS` has
no chat painters, and the ids show no-painter placeholders by default. A host
that has `@texuli/chat` merges its painters:

```ts
import { CHAT_DISPLAY_LOADERS } from '@texuli/chat';
import { PLAYER_LOADERS } from '@texuli/player';

const loaders = { ...PLAYER_LOADERS, ...CHAT_DISPLAY_LOADERS };
```

### Golden fixtures 02, 06, 07 and 08

`tests/fixtures.test.ts` paints golden fixture 02, the operations
dashboard (`tests/fixtures/golden/02-dashboard.json`), through
`createPlayer` and the real painters (layouts, blocks, charts). It checks
against the numbers in `golden-expectations.json`, the file the golden
runner enforces:
- 13 input nodes painted as 13 components, with 0 placeholders, at the
  declared `untrusted` tier and at the `developer` tier, and no diagnostics
  or paint issues;
- the painted id tree equals the input tree;
- the pinned frame chrome: the label, and the "Untrusted content" badge.

In the `Player` it also checks:
- the heading outline the grammar checked (page h1, card titles h2, chart
  titles at their fixed ranks, no gauge heading);
- the 7 frame stops in reading order;
- the KPI and table blocks;
- no placeholders or node errors;
- inertness with `active={false}`.

`tests/fixtures.test.ts` does the same for golden fixture 06, the
presentation slide (`06-presentation-slide.json`). It is a `layout-deck`
holding one card with a stepped list and a bar chart. It checks:
- 4 nodes painted as 4 components, with 0 placeholders, at both tiers;
- the input id tree, and no pinned frame (the default chrome and the trust
  badge show);
- the outline: deck h1, card h2, bar chart at its fixed h2;
- the 2 frame stops;
- the deck painted as a document flow, with every list step visible
  (`step` and `reveal` are presenter fields and hide nothing here);
- inertness with `active={false}`.

`tests/fixtures.test.ts` covers golden fixture 08, the proactive deck
(`08-proactive-deck.json`), prepared before a meeting and shown in an
artifact frame. It checks:
- 12 nodes painted as 12 components, with 0 placeholders, at both tiers;
- the input id tree;
- the pinned frame chrome: the label "Prepared for the 15:00 planning
  meeting (draft, not shared)" and the trust badge;
- the outline: deck h1, five card titles at h2, the line chart at its fixed
  h2 (the callout title is emphasis, not a heading);
- the 6 frame stops;
- the blocks in order: an ordered agenda list, stats, a warning callout, a
  stepped risk list that stays visible, and decisions;
- inertness with `active={false}`.

`tests/fixtures.test.ts` covers golden fixture 07, the report on demand
(`07-report-on-demand.json`), and goes beyond paint to the interaction
contract. Paint checks:
- 13 nodes painted as 13 components, with 0 placeholders, at both tiers;
- the id tree and the pinned frame chrome;
- the outline and all 11 blocks;
- the declared contents: the four section heading blocks, whose links focus
  their section.

Interaction checks:
- the Tab sequence: skip link, contents links, chart legend buttons, chart
  explorers, data-table toggles, and the source link;
- chart keys stay with the chart (arrows move its point; its first Escape is
  its own);
- the source link walks outward with Escape, and F6 reaches the document
  frame;
- legend and table toggles change only local component state: no
  `onStateChange`, re-validation or network;
- an inactive frame takes no focus.

The fixture declares no state controls, so local state binding (G01) is not
exercised by it.

`tests/golden-helpers.ts` holds the shared loader and counters for the
fixture tests.

**Fidelity is structural, not pixel-level.** The fixture tests above check
the painted tree, not pixels. The examples registry has three player examples
(`player-blueprint-preview`, `player-dashboard`, `player-deck`), and their
pixel baselines are committed in the visual suite (`tests/visual`);
`pnpm visual -g player-` verifies them.

### Document layouts

| Id | Paints as | Notes |
| --- | --- | --- |
| `layout-page` | `<main>`, h1 title, description | |
| `layout-doc` | `<article>`, h1 title, description | `toc` (default `true`) lists the doc's titled frames **and its heading blocks** (`blocks-text` with `type: "heading"`, at their declared level) as a **Contents** `<nav>` when there are at least two. A link focuses its frame, or a generated anchor wrapping the heading block, without changing the URL hash |
| `layout-deck` | `<article>`, h1 title, description, `lang` from `locale` when it is a language tag | A **document flow**: every slide shows in order. The presenter stage (one slide at a time, `aspect`, `themeRef`, `masters`, `settings`, the structured `slides` prop and the spec 0.4.0 model v2 props) is `@texuli/slides`'s; a host that passes `deckHost` presents the validated deck there instead (new in `0.4.0`, [embedding](embedding.md#frameless-and-deck-hosts)) |
| `deck-slide` | `<section>` named by its title, speaker `notes` in a closed `<details>` | `slideId`, `master` and `transition` are not painted |
| `layout-card` | `<section>` named by its title | |
| `layout-grid` | Grid of 1–4 `columns` | `gap` applies only as a bounded length (`0`, `≤ 99.99rem/em`, `≤ 999px`); anything else is ignored |
| `layout-stack` (G20) | One column in reading order | `gap`: `none`, `small`, `medium` (default) or `large` |
| `layout-row` (G20) | Children side by side, wrapping | `gap`; `align`: `start`, `center`, `end` or `stretch`; `wrap: false` keeps one line and scrolls |
| `layout-split` (G20) | Two panes at a `ratio` (`1:1`, `1:2`, `2:1`, `1:3`, `3:1`) from 40rem, one column below | `gap`; extra children continue in the same two columns |
| `layout-tile` (G20) | A titled tile inside `layout-grid` | `span` (columns, clamped 1–4 and to the grid's columns) and `rowSpan` (1–2) apply from 48rem; outside a grid they have no effect |

The four G20 ids (audit G20, player design R16) are player-local manifests
(`G20_LAYOUT_MANIFESTS`), plain `CatalogManifest` data that
`validateCatalogManifests` accepts, until the catalog's layouts group adopts
them. Their grammar roles (`G20_GRAMMAR_ROLES`: containers, with a tile title
ranked like a card's) extend the defaults in `PLAYER_GRAMMAR_ROLES`. The
player passes these roles to `validateDraft`, so validation and painting rank
headings the same way. Every value is a closed enum or a clamped integer, so
no blueprint text reaches CSS.

**Title headings use the grammar's own rule.** `planFrames` walks the paint
plan with `resolveMeta`/`resolveNestedRole` from
`@texuli/catalog/render/grammar`, the lookup `checkCompositionGrammar` uses:
- page, doc and deck titles are h1;
- card and slide titles are one rank below the nearest titled frame around
  them (capped at h6);
- an untitled frame opens no section.

The painted rank is therefore the rank validation checked. Frame ids are
unique per player and never come from blueprint text.

`labels.contents` and `labels.speakerNotes` localize the new chrome. The
untitled card and slide names ("Content card", "Slide") are English for now
(planned). App shells (`content-layout`, `layout-blog`, `layout-docs` and the
other non-emittable layouts) are app chrome, not blueprint content, and are
not in the player catalog.

### Media nodes

Media paints through its own families (`blocks-media`: image, figure, video
and gallery; `media-image`; the media compositions). The player adds a
paint-time media policy (`applyMediaPolicy`; see
[paint-proof.md](paint-proof.md)) and keeps their contract:

| Contract | How |
| --- | --- |
| Trust is the host's | `trust` on `media-image` and the compositions is pinned to `untrusted`. A blueprint `trust: "developer"` cannot widen their image policy (`srcset`, data, blob or HTTP sources) or drop `referrerpolicy="no-referrer"` |
| No autoplay | A `blocks-media` video never starts on its own, even with muted autoplay requested |
| Keyboard activation | Video keeps its native controls (`controls` forced on), so it can always be played, paused and sought from the keyboard |
| Text alternatives | Block images must have `alt` or `decorative: true` (their schema refuses otherwise; decorative images get `alt=""`). A `media-image` with a blank `alt` gets `labels.mediaNoAlt` ("Image without a description"). Video keeps its required `label` as `aria-label` |
| Inert until resolved | A media node is an inert skeleton until its painter loads; an unresolvable source shows the family's labelled fallback, which is not a control |

**Not applicable yet:** a captions toggle. No media block declares caption
tracks today (video has only a figcaption `caption`), so there is nothing
to toggle; tracks would be a schema addition (planned). `blocks-media` has
no audio type.

### Motion

The player follows the tokens' motion contract, and carries it itself so a
host without the tokens' `base.css` still gets it:

| Rule | How |
| --- | --- |
| `motion="reduce"` (host) | Stops motion inside the player whatever the user setting. Also a frame-protocol option |
| `motion="auto"` (default) | Follows `prefers-reduced-motion`, live, through `matchMedia` |
| Root attribute | Under either, the root carries the tokens' `data-tx-motion="reduce"` |
| Scoped override | `player.css` zeroes `--tx-motion-fast`, `--tx-motion-base` and `--tx-motion-slow`, sets `--tx-motion-easing: linear`, and sets animation and transition durations and delays to `0s` (G78) for the player and everything painted inside it, under `data-tx-motion="reduce"` and the media query. The selectors are scoped to `.tx-player`, so host content outside is untouched |
| Player-owned motion | Every player transition is timed with `--tx-motion-*` tokens (a test checks the stylesheet), so the policy reaches it |
| Blueprint motion | A slide `transition` and a block `reveal` are presenter fields: the document flow paints them as nothing, so nothing animates or stays hidden |

#### Node motion (spec 0.6.0)

A node's checked `motion` ([the vocabulary](../../spec/docs/motion.md))
plays through `@texuli/core/motion`
(`src/motion/`, tests in `tests/motion.test.ts`):

| Rule | How |
| --- | --- |
| Wrapper | A node with motion paints inside `<div class="tx-player__motion" data-tx-player-motion="<path>">`, `display: contents`, so layouts see the node's own element; the animations play on its element children (at most 8) and leave no inline style (`fill: "none"`) |
| Names to tokens | Durations read the theme's `--tx-motion-fast`, `--tx-motion-base` and `--tx-motion-slow` (150, 200 and 300 ms by default); easings are the `enter`, `exit` and `standard` tokens; `rise` travels 8 px, the slides 16 px (mirrored right to left), `scale` grows from 96% |
| Enter | Plays when a node appears after the first paint: once its painter loads, after a `when` change, a flow view, a live update or a stream. Nothing plays on the server, and nothing for a node present at the first paint, so a hydrated page shows its end state |
| Stagger | A node's `stagger` delays its entering children by 30 ms (`fast`) or 40 ms (`base`) each; the spread is held to 1,000 ms |
| Exit | A node with `exit` that leaves the plan stays painted, `inert` and marked `data-tx-player-motion-leaving`, while the reversed preset plays (at most 64 at once, and at most 1,200 ms if the runtime never reports), then goes |
| Layout | Nodes with `layout: true` animate from where they were after each repaint (FLIP), measured before the repaint and played after it |
| Level | The host's `motionLevel`, else the blueprint's `motion.level`, else `full`; `subtle` shortens durations and keeps only the fade; `none`, `motion="reduce"` and `prefers-reduced-motion` paint at once and drop leaving nodes at once |
| Loading | The runtime (`src/motion/runtime.ts` with `@texuli/core/motion`) loads only once a painted node declares motion |
| Refused motion | A motion outside the vocabulary is an `invalid-motion` error in validation; in `preview` the node paints without it |

Not covered yet: the frame protocol has no `motionLevel` option, and a node
that gains or loses `motion` in a live update remounts its component.

### Announcements

One model (`src/announcements.ts`) decides what assistive technology hears:

| Channel | Region | Says |
| --- | --- | --- |
| Assertive (interrupts) | The visible notice, `role="alert"` | Only validation refusals: an invalid draft under `refuse`, or refused local state |
| Polite | One `aria-live="polite" aria-atomic="true"` region (`data-tx-player-announcer`), present from mount | The paint result once nothing is still loading ("Content ready: 3 sections."), unresolved placeholders, the preview warning, a host status other than draft, and user selection changes ("Revenue selected", "2 selected") |

- **No other live regions:** the status badge, loading skeletons and the
  preview warning are no longer live regions, so nothing is said twice.
- **Dedupe:** a message is spoken only when its text changes on its
  channel. A state update or repaint that leaves the result unchanged says
  nothing.
- **Reset:** a refusal clears the polite region, and so does clearing the
  selection, so the next result is spoken even if it repeats.
- **Selection:** announced only for user changes; host updates and pruning
  stay quiet.
- **Localizable templates in `labels`:**
  - `painted` (`{frames}`);
  - `placeholdersUnresolved` (`{count}`);
  - `statusChanged` (`{status}`);
  - `selectedOne` (`{name}`);
  - `selected` (`{count}`; a plain word like "seleccionados" is prefixed
    with the count).

  They also cross the frame protocol.

**Not verified yet (planned):** a screen-reader pass. The model and its DOM
are unit-tested in happy-dom.

### Keyboard and focus

The player owns frame-level keys only. Arrows, Enter and Space inside a
painted component stay with that component.

| Key or rule | Behavior |
| --- | --- |
| Tab order | DOM order, which is reading order. The player never reorders nodes, and a positive `tabindex` in painted content is reset to `0`, at paint and on later changes (the grammar already refuses visual-order props) |
| Skip link | The first Tab stop, "Skip past" + label (`labels.skip`), visible on focus. It moves focus to an end marker after the frame |
| F6 / Shift+F6 | Cycle focus through all layout frames in reading order (every content layout, including deck and slides, carries `data-tx-player-frame` and `tabindex="-1"`), wrapping around |
| Arrows on a frame | Rove the frame tree the grammar's containers form, only when a frame itself has focus. ArrowDown / ArrowUp / Home / End move among sibling frames, stopping at the ends. ArrowRight enters the first child frame and ArrowLeft returns to the parent frame; the two swap in right-to-left content (`dir="rtl"`). A key with no target is left to the browser |
| Containment | F6 and arrows never target a frame inside an `inert` subtree (a component's modal surface, an inactive player), and no player key moves focus out of the player |
| Escape | Walks outward: from a control to its frame, then from the frame to the player label. It never traps. An Escape inside an `aria-modal="true"` surface or `<dialog open>`, or one a component already handled (`defaultPrevented`), is left alone |
| `active={false}` | The surface becomes `inert`, so focus and pointer input cannot reach a background or off-stage frame. The frame protocol carries `active` too |
| Loading skeletons | Always `inert` |
| Focus rescue | If an update removes the focused node (a refused update, a failed node, a component re-rendering without it), focus moves to the nearest surviving frame around it, else to the notice, else to the player label, instead of falling to the page |

Player-owned focus targets (skip link, label, notice, frames) show a
`:focus-visible` outline using `--tx-ring`.

**Verified today** by unit tests in happy-dom (`tests/keyboard.test.ts`):
- the Tab sequence computed from the DOM;
- the key handling;
- `inert` attributes;
- the focus rescue.

**Not verified yet (planned):** a real-browser Playwright pass of Tab
traversal and `inert` enforcement, and a screen-reader pass.

### State-only controls (G06, D14)

Decision D14 allows agent controls that only write local state, with no
submits. Four player-local, agent-emittable ids implement it
(`CONTROL_MANIFESTS`). Each names one declared variable in `state` and
needs a `label`:

| Id | Writes | Paints |
| --- | --- | --- |
| `control-toggle` | a `boolean` | A `type="button"` with `role="switch"` and `aria-checked` |
| `control-choice` | an `enum`, one of its declared values | A `radiogroup` of radio buttons with a roving tabindex; arrows, Home and End move and select (left and right swap in RTL) |
| `control-slider` | a `number`, within its declared `min` and `max` | A labelled native range input (`step` optional) with its value shown |
| `control-filter` | a `string`, up to its declared `maxLength` | A labelled native search input |

- **Validation:** a control whose `state` is missing, undeclared, or of
  another type is refused with a visible notice. So is any control in a
  blueprint without the local-state wrapper.
- **One effect:** controls write through the player's `setState` (coerced,
  then re-validated), and the host hears `onStateChange`. They never
  navigate, fetch or call the host.
- **No submits:** control buttons are `type="button"`, and Enter in the
  filter is cancelled. A `submit` event bubbling from anywhere in the
  painted surface (a painted component's own form, or a host form wrapped
  around the player) is cancelled and stopped at the surface.
- **Grammar:** controls are interactive, so the grammar refuses one nested
  in another interactive node.

The manifests live in the player until the catalog adopts them.

### Views and flows (G09)

A local-state wrapper may declare a `flow` (player design Phase 4):

```json
{
  "format": "texuli-local-state",
  "version": 1,
  "state": { "agree": { "type": "boolean" } },
  "flow": {
    "views": ["details", "review", "done"],
    "initial": "details",
    "transitions": [
      { "from": "details", "to": "review", "on": "next",
        "when": { "op": "eq", "left": { "op": "var", "name": "agree" }, "right": { "op": "num", "value": 1 } } },
      { "from": "review", "to": "details", "on": "back" },
      { "from": "*", "to": "details", "on": "restart" }
    ]
  },
  "blueprint": { "id": "layout-page", "props": { "title": "Onboarding" }, "children": [] }
}
```

**The declaration:**
- 1–16 views and at most 64 transitions;
- names like `review`;
- `from` is a declared view or `*`;
- `when` is optional and uses the same condition AST as node `when`
  conditions, evaluated against local state; a guard that cannot be
  evaluated does not hold;
- unknown fields, undeclared views and invalid guards refuse the blueprint.

**Two player-local ids:**
- **`flow-view`** (`name`, optional `label`) paints its children only while
  its view is current. Other views are not in the DOM at all.
- **`flow-action`** (`event`, `label`) is a `type="button"` that fires one
  declared event. It is `aria-disabled` while no transition applies, for
  example when a guard does not hold.

A view that is not declared, an event no transition handles, or either node
without a flow refuses the blueprint.

**A transition:**
- moves the player's **local** view;
- moves focus into the new view;
- announces "Now showing {view}." (`labels.flowChanged`);
- calls `onFlowChange({ from, to, event })`.

The host can set `view`, for example to mirror its URL; an undeclared view
is ignored. `mountPlayer` exposes `dispatchFlow(event)` and `getView()`, and
keeps the view across `update()`.

**Through the frame protocol:**
- a `flow` message `{ from, to, event }` goes to the host (`onFlow` on
  `createPlayerFrameHost`);
- init `options.view` and `update.view` set the frame's view.

**The player never touches `location` or `history`.** Navigation stays the
host's.

### Action surface and receipts (G17)

An `action-form` (`action`, `label`) groups `form-field`s and one
`form-submit` (player design Phase 4). **Submitting proposes one action
intent to the host. It is never a native form submission.**

| Id | Props | Notes |
| --- | --- | --- |
| `action-form` | `action` (the name the host receives), `label` | A labelled `<form novalidate>` that cannot nest. Its receipt is shown below it and announced |
| `form-field` | `name`, `state` (a declared variable), `label`, `kind` (`text`, `email`, `tel`, `number`, `multiline`), `required`, `autocomplete`, `pattern`, `minLength`, `maxLength`, `min`, `max`, `placeholder` | Writes its declared variable (a `number` for number fields, a `string` otherwise). `autocomplete` is limited to `AUTOCOMPLETE_ALLOWLIST`, which excludes payment (`cc-*`), password and one-time-code tokens. `pattern` is a closed id (`email`, `phone`, `postal-code`, `digits`, `slug`), never a regular expression |
| `form-submit` | `label` | A submit button; Enter in a field submits too. Disabled while a receipt is pending |

**On submit:**
1. Every field is validated (required, pattern, length, range).
2. Errors appear under their fields (`aria-invalid`, linked with
   `aria-describedby`), and focus moves to the first invalid field.
3. When everything is valid, the host's `onAction(intent)` receives
   `{ id, action, values }`. The values are plain scalars: at most 32,
   strings up to 2048 characters (`actionValues`).
4. It answers `confirmed` or `rejected`, sync or async. A throw or any
   other answer becomes `failed`.
5. The receipt (sending, sent, not accepted, could not send) shows in the
   form and is announced politely.

A second submit while pending is ignored. **Without `onAction`, actions are
unavailable** (the submit is `aria-disabled` and the receipt says so); the
player never sends anything itself.

Fields outside a form, wrong-type or undeclared bindings, duplicate field
names and nested forms refuse the blueprint. The labels (`actionPending`,
`actionConfirmed`, `actionRejected`, `actionFailed`, `actionUnavailable`,
`fieldRequired`, `fieldPattern`, `fieldLength`, `fieldRange`) are
localizable.

**Through the frame protocol:**
- an `action` message `{ id, action, values }` goes to the host, under the
  same caps;
- `createPlayerFrameHost({ onAction })` answers with `action-result`
  `{ id, status }`;
- the frame shows that answer as the receipt, and a missing answer fails
  after 30 s (`actionTimeoutMs`).

### Host data binding (host G01)

A state variable may declare a `source`, a host data source name such as
`tickets.open`. That variable is **host-bound**: its value comes from the
host, never from the blueprint or the reader.

```json
"state": {
  "team": { "type": "string", "maxLength": 60, "initial": "Team", "source": "team.name" },
  "columns": { "type": "number", "min": 1, "max": 4, "initial": 2, "source": "layout.columns" }
}
```

- **Sending data:** the host passes `dataSources`, a map of source name to
  plain scalar. It can do this as a prop, with
  `mountPlayer().update({ dataSources })`, or with a frame-protocol `data`
  message (`createPlayerFrameHost().data(...)`).
- **Coercion:** each value is coerced to its variable's declaration (type,
  bounds, length). A value that does not fit, or no value, gives the
  declared initial value.
- **Validation:** values reach props through the ordinary `{ "$state": … }`
  bindings, so they meet the full validation a literal would; a hostile
  string from the host is refused like one from the blueprint.
- **In-place updates:** an update rides the live-update path (R20). The same
  player instance re-validates in place, and the reader's own state, flow
  view and selection are kept.
- **The host owns it:** `setState`, controls and form fields cannot write a
  host-bound variable. A control or field bound to one refuses the
  blueprint.
- **No fetching:** the player never fetches; source names are only keys into
  what the host hands it. Frame data is re-parsed to named plain scalars
  first (`sanitizeDataSources`).

**Planned:**
- binding arrays or objects (series, rows), which needs deep prop schemas
  (G16);
- the design's `{ "$data": … }` prop references.

Today only scalar state variables bind.

### Data-source bindings (spec 0.8.0)

Host data binding above carries scalars into state. Rows come from a data
source instead: a sourceable prop (`data-grid.rows`, `data-board.items` and
the other data views) reads `{"$source": name, "query": {...}, "map": {...}}`
from a source the host registered in `@texuli/core/data-source` and passed as
`sourceRegistry` (or `sourceLoader`). Without one every source binding is
refused. Loading, empty and error states, paging, announcements and
optimistic edits are in [data-sources.md](data-sources.md).

### Selection (builder preview)

`selectable` (default `false`) lets a host select painted frames, as the
builder design's preview does ("preview click selects the matching node";
the outline stays the keyboard source of truth). The unit is a layout frame,
identified by its tree path (`0.children.1`, also on the frame as
`data-tx-player-path`).

| Input | Selection |
| --- | --- |
| Click a frame | Selects it alone |
| Ctrl/Cmd+click | Toggles it |
| Shift+click | Selects the range from the anchor to it among **sibling** frames; a frame at another level starts a new selection |
| Space on a focused frame | Selects it alone (Ctrl/Cmd+Space toggles, Shift+Space ranges) |
| Shift+ArrowDown / Shift+ArrowUp on a frame | Moves to the next sibling frame and extends the range; plain arrows still only rove |
| Escape | Clears a non-empty selection first; the next Escape walks outward as usual |

- **Never hijacks component input:** a click on a link, button, field,
  chart explorer or other control inside a painted component is the
  component's.
- **Contained:** frames inside an `inert` subtree are never selected or
  ranged over, and an inactive player (`active={false}`) takes no selection.
- **State only:** selection changes no player state, runs no validation and
  proposes no intent. The host hears `onSelectionChange(paths)` after each
  user change. It may set `selection` (paths that are not painted frames
  are dropped and reported), and its values are not echoed back.
- **Visible:** selected frames carry `data-tx-player-selected`, a dashed
  `--tx-ring` outline plus a tint (`Highlight` in forced colors). User
  changes are announced through the player's polite region ("Revenue
  selected", "2 selected"; see Announcements).

**Planned:** selecting leaf nodes (blocks, charts) needs a per-node wrapper
and is not built. A real-browser pass is also still to do.

### Local state (G01)

A blueprint may declare typed, bounded variables and bind props to them.
From spec 0.3.0 the envelope carries them (`state`, and `flow` for views);
the player lifts both from the envelope:

```json
{
  "format": "texuli-blueprint",
  "version": 1,
  "spec": "0.3.0",
  "state": {
    "week": { "type": "enum", "values": ["Week 41", "Week 42"], "initial": "Week 42" },
    "details": { "type": "boolean" }
  },
  "tree": { "id": "layout-page", "props": { "title": { "$state": "week" } } }
}
```

The provisional local wrapper from before 0.3.0
(`{ "format": "texuli-local-state", "version": 1, "state", "flow"?, "blueprint" }`)
is still accepted.

- **Declarations** (`parseStateDeclarations`):
  - at most 64 variables, with names like `week` or `showDetails`;
  - types `boolean`, `number` (`min` ≤ `max`), `enum` (1–32 distinct strings
    of at most 64 characters), `string` (`maxLength` at most 1000, default
    200), `list` (items `{ id, ...scalar fields }`, at most `maxItems`, 500
    by default; string fields refuse control, bidirectional and invisible
    formatting characters) and `workflow` (a spec workflow graph);
  - an unknown type or field, or an initial value that does not fit, refuses
    the whole blueprint with a visible notice.
- **Bindings:** a prop value that is exactly `{ "$state": "name" }`, at any
  depth inside props, reads one variable. Ids and structure never bind. An
  unknown name refuses the blueprint. The player substitutes the current
  values and validates the resulting literal tree in full, so a bound value
  meets the same prop schemas, HTML-string checks and paint-time URL policy
  as a literal.
- **Writers:** the host, through the component's exported
  `setState(name, value)` (also on `mountPlayer`), `getState()` and
  `resetState()`. A value that does not fit its declaration is refused. The
  host may seed values with `initialState` (values that do not fit are
  ignored).
- **No host IO:** state lives in this player instance only. It leaves only
  through `onStateChange(snapshot)`, which the host opts into. The player
  never fetches, persists or posts it. A state change re-validates on the
  same handle, so loaded painters are kept.

### Drag between lists (spec 0.3.0 `reorder`)

A `sortable-list` paints its `reorder.bind` list variable. When the tree
has a reorder container, the player lazily loads one shared drag scope (a
single `Sortable.Root` around the painted tree, laid out with
`display: contents`). Every list registers with it, so a pointer drag or a
keyboard move (Space, arrows past a list's edge, Space) can carry an item
to another list anywhere in the layout, in reading order.

- **One rule set.** The scope adds no rule. Its drop verdict is the player's
  `canMove`, a dry run of the same checks `move` commits: both containers
  enabled, the target `accepts` the source `group` (or shares it), and the
  closed `moveItem` reducer (`locked`, `pull` move, clone or none, the
  list's `maxItems`). A drop runs `move`, which commits the state and then
  the source's `on.move`. What a drag offers is exactly what the data move
  does.
- **No id collisions.** Item keys are namespaced per container, so equal
  item ids in two lists never meet. Clones take the reducer's fresh id.
- **Other pieces.** A `data-board` moves cards between its columns and
  writes them to a bound `items` list. A `workflow-graph` in `edit` mode
  adds palette node types to its canvas and writes the graph to a bound
  `workflow` variable. The spec golden `lego.json` composes all three (see
  `tests/lego.test.ts`).

### Conditional regions (G07)

A node's `when` (a closed `Condition` from `@texuli/blocks/formula`; see the
catalog's
[render-renderer](../../catalog/docs/render-renderer.md#conditional-regions-audit-g07))
reads the local state. The player passes `formulaConditions` and the state
mapped to numbers:
- a `number` variable passes as is, and a `boolean` becomes `1` or `0`;
- `enum` and `string` variables are left out, so a condition that reads one
  is unknown and its node stays hidden.

A condition that is false or unknown hides its node, and `setState`
re-evaluates every condition on the same handle. With no state wrapper,
every input is unknown, so `when` nodes stay hidden. An invalid condition is
a validation error. Tested in `packages/player/tests/painting.test.ts`.

```json
{ "id": "layout-card", "props": { "title": "Details" },
  "when": { "op": "eq", "left": { "op": "var", "name": "details" }, "right": { "op": "num", "value": 1 } } }
```

### Named slots (G04)

A child that fills a named slot (`"slot": "hero"`) is mounted in the
component's snippet prop of that name; other children go to `children`.
The catalog renderer has already refused any slot the parent's manifest
does not declare. None of the player's own painted ids declares a named slot
other than `children`, so this matters for a host catalog that adds one.
Skeletons and placeholders keep their slot too.

**Planned, not built:** state inside the ADR-003 envelope (the wrapper above
is provisional), computed values and repeat (G08), a `set-state` message in the frame
protocol, and an activation digest over the declared blueprint. Today
`digest()` on the core handle covers the resolved tree.

### Composer host chrome

The composer is always host chrome, never blueprint content (design §8).
Ids in `HOST_CHROME_IDS` (today `chat-composer`) are denied at every tier,
even when a host catalog lists them, and their loaders are never called. A
blueprint that names one is refused, or shows a `tier-denied` placeholder
in a preview. A host passes its own composer as the `composer` snippet. It
renders in `[data-tx-player-host-chrome="composer"]`, under the surface and
outside the validated tree.

### Host regions (R21)

A blueprint reserves a place for host-owned UI, such as payment or sign-in,
with a `host-region` node. The agent never emits the sensitive fields itself
(audit G18):

```json
{ "id": "host-region", "props": { "name": "payment", "label": "Payment details" } }
```

```svelte
<Player {blueprint} hostRegions={{ payment }} />
{#snippet payment()}<PaymentForm />{/snippet}
```

- **Placement:** the manifest (`hostRegionManifest`) lives in the player
  catalog and is allowed at both tiers. `name` is lowercase letters, digits
  and hyphens, at most 32 characters (`isHostRegionName`). `label` is
  untrusted text.
- **What gets mounted:** a `name` the host lists in `hostRegions` mounts that
  snippet in a group labelled by `label`. The snippet is called with no
  arguments, so the player hands it no blueprint data.
- **Missing names:** a name the host leaves out paints `label` and the
  `hostRegionMissing` note as inert text. So does a name outside the pattern,
  even when the host map has that key.
- **Duplicates:** only the first node with a name mounts the snippet. Later
  ones paint their label with the `hostRegionDuplicate` note, so a payment
  form never mounts twice.
- **Submits:** the surface cancels every submit from painted content (D14).
  A form inside a host region the host mounted is host chrome, and its
  submit goes through.
- **Keyboard:** F6, Escape and tab-order normalization treat host content
  like the rest of the surface.

Tested in `packages/player/tests/painting.test.ts`.

**Planned, not built:** host regions for the iframe frame and `mountPlayer`
hosts (both take snippets only through Svelte today).

### Live updates (R20)

The host replaces the blueprint (a new `blueprint` prop, `mountPlayer`'s
`update`, or the frame protocol's `update` message). The player re-validates
the **whole** result, never a fragment, on the same handle, and keeps what the
reader did where it still fits:
- **Local state:** each variable the new blueprint still declares keeps its
  value when the new declaration accepts it. A value that no longer fits (a
  narrower range, a removed enum value) starts over, `initialState` seeds
  new variables, and dropped variables are gone. When an update changes the
  snapshot, `onStateChange` reports it once.
- **Flow view:** kept while the new flow still declares it, otherwise the
  flow's initial view. A host `view` applies when the host changes it; an
  unchanged `view` passed again on an update does not pull the reader back.
- **Selection:** a selected frame stays selected while the same node sits at
  its path. A path that now holds another catalog id is deselected.
- **Painters:** the handle and its loaded painters are kept, so unchanged
  nodes keep their painted elements. The handle is rebuilt only when
  `catalog`, `catalogHash`, `tier`, `status`, `invalidPolicy`, `loaders` or
  `loadTimeoutMs` really change.

Blueprint nodes have no stable ids yet, so "the same node" means the same
path and the same catalog id. An inserted node shifts the paths after it,
and their selection and component state go with the path. Tested in
`packages/player/tests/state.test.ts`.

**Planned, not built:** identity by stable node ids from the envelope, and
streaming appends (chat messages arriving one by one) as their own API.
Today a host appends by sending the whole updated blueprint.

### Iframe frame

For third-party hosts the package ships both halves of the player-frame
`postMessage` protocol (`PLAYER_FRAME_PROTOCOL`, version 1):

- **Host page:** `<PlayerFrame src allowedOrigins blueprint options />`
  renders an iframe only when `src` is HTTPS and its origin is on
  `allowedOrigins` (`resolveEmbedFrameSrc` from `@texuli/blocks/embed`), with
  `sandbox="allow-scripts"` (no `allow-same-origin`, so the frame has an
  opaque origin) and `referrerpolicy="no-referrer"`. It sends the blueprint
  after the frame says `ready` and grows to the reported block size, up to
  `maxBlockSize`. `createPlayerFrameHost` is the same logic without Svelte.
  It accepts messages only from its own frame's window with origin `"null"`.
  An opaque origin cannot be a `targetOrigin`, so the host posts to the
  frame's window with `"*"`, only after a `ready` from the current load.
  Send display data only, never credentials.
- **Frame page:** `mountPlayerFrame(target, { parentOrigins, catalog?, loaders? })`
  waits for `init`, mounts the player with the host's options and reports
  `resize` and `diagnostics` (counts and codes, no content) back.
  `createPlayerFrameClient` accepts messages only from `window.parent` on an
  allowed origin (HTTPS, or `http://localhost` / `127.0.0.1` for
  development; `*` and `null` are refused), pins the first one, and always
  replies to that exact origin.
- Every message is re-parsed (`parseHostMessage`, `parseFrameMessage`):
  unknown types and keys are dropped, options are rebuilt from known values
  only, and sizes are clamped to `PLAYER_FRAME_MAX_SIZE`. Catalogs and
  loaders never cross the boundary.

**Planned, not built:** a hosted `player-frame` page on a dedicated origin
with its own CSP and `frame-ancestors` allowlist, `intent` and
`intent-result` messages for the core's closed intents (action forms already
cross as `action` and `action-result`), the
`provenance`, `profile`, `theme` and `limits` options from the design, and
an end-to-end browser test of the protocol across real origins. Today the
protocol is covered by unit tests with stand-in windows.

Import `@texuli/player/styles.css` if the bundler does not preserve package CSS
side effects. Styles use Texuli tokens with system-color fallbacks and logical
properties; the player adapts down to narrow viewports and honors reduced
motion by using no motion effects.
