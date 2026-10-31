# Stage: DeckStage and DeckPrint

**Import:** `@texuli/slides/stage` (and `@texuli/slides/stage-core`, below)  
**Source:** `packages/slides/src/stage/`  
**Tests:** `tests/stage.test.ts` (input, canvas, routing, keys, pointer,
transitions, i18n, steps, renderers, style, hooks, themes),
`tests/stage-seams.test.ts` (messages, preparation, steps, renderers,
routing and transition helpers), `tests/stage-content.test.ts` (print,
media, fragments, slot masters, fullscreen, presenter screen),
`tests/stage-chrome.test.ts` (toolbar, slide list, blackout, laser, help,
copy link, first-visit hint, tooltips, full screen overlay); browser sweep
`tests/e2e/a11y-slides.spec.ts`

The Svelte 5 runtime for a deck ([model.md](model.md)) on the
`@texuli/deck` engine (ADR-009): the interactive `DeckStage` and the
all-pages `DeckPrint`. Import `@texuli/slides/styles.css` once for their
styles ([styles.md](styles.md)); the chrome components carry their own
scoped styles.

```svelte
<script lang="ts">
  import '@texuli/slides/styles.css';
  import { DeckStage } from '@texuli/slides/stage';
  import { createDeckFromTemplate } from '@texuli/slides/templates';

  const deck = createDeckFromTemplate('review');
</script>

<DeckStage {deck} initialSlideId="demo" onSlideChange={(intent) => console.log(intent)} />
```

## DeckStage

| Prop | Default | What it does |
| --- | --- | --- |
| `deck` | required | A v2 deck, or any input `migrateDeck` understands (Texuli v1, grammar tree, Protoyard), or a prepared deck (an `ok` result of `prepareDeck` or `prepareDeckV2`, see [prepared decks](#preparation-canvas-and-mounting)). An invalid deck shows its diagnostics and is never painted |
| `syncHash` | `true` | Keep `#/<slide>/<step>` in the URL (`replaceState`) and follow `hashchange` and deep links. Only the first stage on a page claims the hash |
| `fit` | `container` | `container` letterboxes the canvas inside the host box; `viewport` fills the window height |
| `tier` | `untrusted` | URL policy tier for every link and media source painted (`DeckMediaTrust`) |
| `mediaTrust` | — | v1 name of `tier`, kept for existing hosts |
| `trustBadge` | `true` | Show the stage's trust badge, **Untrusted content** (`stage.untrustedBadge`, overridable through `messages`), at the inline start of the toolbar row when the paint tier is `untrusted`. The stage paints catalog components through players with `chrome={false}`, so this badge is the deck's trust signal; the `developer` tier never shows it. See [Trust badge](#trust-badge) |
| `messages` | — | Partial overrides of every stage string (`DeckStageMessages`; English defaults) |
| `locale` / `dir` | `meta.locale` / `meta.dir` | Override the `lang` and `dir` of the stage |
| `plugins` | `[]` | Engine plugins (`beforeNavigate`, `beforeRender`/`afterRender`, `onAction`, …), in order |
| `renderers` | — | Renderer tables, first answer wins (`DeckRenderers`: layouts, components, backgrounds, custom slides, and the free-slide block check `validateBlock`) |
| `defaults` | built-in (`DeckStage`), none (`DeckStageCore`) | The `DeckDefaultRenderersSource` the tables come from. `DeckStage` sets it; on `DeckStageCore` leave it unset (the stage then never references the defaults) |
| `defaultRenderers` | `true` | Append the default tables (the 20 catalog layouts and the component registry) after `renderers`. They are imported on first use (`loadDefaultDeckRenderers`), so the first stage on a page shows a polite loading status (`aria-busy`) for one chunk; await `loadDefaultDeckRenderers()` before mounting to paint at once. `false` leaves every slide to the host's tables: none of the defaults' code is in the stage's initial graph and nothing of them loads (no lazy chunk, CSS or prefetch), component ids are the host's to check, and a slide no table answers shows a labelled placeholder |
| `autofocus` | `false` | Focus the active slide on mount |
| `namespace` | a unique id | Instance namespace: presenter channel, view-transition names and the first-visit hint |
| `initialSlideId` | first visible slide | Open on this slide (a valid URL hash wins when the stage owns it) |
| `initialStep` | `0` | Open the initial slide at this [reveal step](#reveal-steps) |
| `autoSlideMs` | `navigation.autoSlideMs` | Auto-slide interval; `0` turns it off. It never runs during SSR and pauses while the tab is hidden |
| `clickToAdvance` | `true` | A primary click on the slide advances; links, controls, media, interactive blocks and the chrome never do |
| `presenter` | `false` | Bindable presenter layout |
| `presenterTimer` | `false` | Show the elapsed timer in the presenter pane |
| `sync` | `null` | A same-origin link to another stage window: the engine presenter protocol, or a v1 `DeckSync` ([presenter screen](#presenter-screen)) |
| `loadTheme` | `loadDeckLibraryTheme` | Resolves catalog theme ids; `null` leaves them to host CSS |
| `designSystems` | — | `{ resolve, mode }` for a deck's `designSystem.ref` (from `0.10.0`); see [Design systems](#design-systems) |
| `onDesignSystem` | — | Called with a `PlayerDesignSystemEvent` when a deck's design system applies or is refused |
| `resolveAvatar` | — | Host adapter for `avatar:` image ids |
| `controller` | `null` | Read-only binding to the engine `DeckController` for imperative hosts |
| `chrome` | — | Snippet that replaces the default toolbar and progress bar (the [chrome layers](#chrome) stay) |
| `tools` | — | Snippet of host controls added to the default toolbar as its last group, labelled "More tools" (`stage.groupTools`), G82. They follow the stage's own tools in Tab order, stay out of the "More" fold, and the progress bar stays. Not rendered when `chrome` replaces the toolbar |
| `toolbarPosition` | `bottom` | Where the toolbar (or the `chrome` snippet) sits: `bottom` puts it below the slide, aligned to the inline end, with its popups opening upward; `top` puts it above the slide. DOM order follows, so Tab reaches the controls after the slide content by default. The root carries `data-tx-deck-toolbar` |
| `overviewView` | — | Snippet that replaces the default overview |
| `presenterView` | — | Snippet that replaces the default presenter pane |
| `onSlideChange` | — | Receives a `SlideNavigationIntent` (`{ index, slideId }`) when the slide changes |
| `onStepChange` | — | Receives a `SlideStepIntent` (`{ index, slideId, step, stepCount }`) on every slide or step change |
| `onPresenterChange` | — | Called with `open` when the presenter layout toggles |
| `onFullscreenChange` | — | Called with the `DeckFullscreenState` (`off`, `native`, `viewport`) |
| `onError` | — | Called with the diagnostics when the deck is invalid |

### Preparation, canvas and mounting

- **Input:** `prepareDeck(input, hooks)` migrates and validates any input
  and never throws (a `PreparedDeck`: the deck, or its issues). The host
  registry adds its checks through `DeckValidationHooks`
  (`deckValidationHooks` merges the tables); `validateDeckBlock` checks one
  free-slide block body against `@texuli/blocks`. A host whose free-slide
  renderer paints its own block types replaces that check with
  `validateBlock(block, path)` on its renderer table (the first table with
  one wins; return `undefined` to accept a block, or diagnostics to refuse
  it, and call `validateDeckBlock` to keep the default for the rest). The
  built-in free-slide renderer still checks each block when it paints it, so
  a block it cannot read shows a placeholder, never raw data.

  ```ts
  const hostBlocks: DeckRenderers = {
    validateBlock: (block, path) =>
      block.type === 'host-card' ? undefined : validateDeckBlock(block, path),
    free: () => HostFreeSlide,
  };
  // <DeckStage {deck} renderers={hostBlocks} />
  ```

  A heavy check (a schema library) can stay out of the initial JavaScript:
  `loadValidateBlock()` on the table imports it on first use and resolves to
  the check, or to a module exporting `validateBlock` or a default
  (`DeckBlockValidatorModule`; the check is a `DeckBlockValidator`). The
  stage calls `loadDeckValidators(list)` and validates only once
  `deckValidatorsReady(list)` is true, showing the loading status
  meanwhile. A `validateBlock` on the same table wins over it; until it
  loads (outside the stage) and if its import fails, every free-slide block
  is refused, so unchecked content is never accepted.

  ```ts
  const hostBlocks: DeckRenderers = {
    loadValidateBlock: () => import('./validate-host-blocks.ts'),
    free: () => HostFreeSlide,
  };
  ```
- **Default tables:** `loadDefaultDeckRenderers()` imports the layouts
  table and the component registry once (later calls share the import) and
  `loadedDefaultDeckRenderers()` returns them synchronously once loaded (or
  `undefined`). The stage and the print view call it only when their
  `defaultRenderers` is on; a failed import paints without them (their
  slides show placeholders). In the browser, the stage does not validate or
  paint the deck until the tables are there. The same call also loads the
  built-in block support and `migrateDeck` (below), so awaiting it before
  mounting still paints the first stage at once, whatever the input.
- **Server rendering:** a server build preloads all of it before it
  renders, so the server HTML keeps the slides (no-JS readers and
  crawlers), not the loading status. `DeckStage` imports `#deck-ssr`, a
  package `imports` entry: the `browser` condition is an empty module, and
  the default condition (Vite server builds, Node) awaits every layout and
  registry painter, the built-in block support, `migrateDeck` and the six
  block families at module load (a part that fails keeps its loading
  status; it never stops the server). Browser bundles get none of it
  (`tests/bundle-graph.test.ts`). Lazy code inside a painter (a chart
  family in a data block, say) still loads on first use. In the browser,
  hydration still starts from the lazy path: each part shows its loading
  status until its chunk arrives, then the slide paints again.
- **Built-in block support (lazy):** the default block check
  (`validateDeckBlock`, the `@texuli/blocks` schema), the built-in
  free-slide renderer and the block-family prefetch are one chunk that the
  stage imports on first use. `loadBuiltinDeckBlocks()` imports it once and
  never rejects (a `BuiltinDeckBlocks`: `validateBlock`, `prefetch`, and
  `ok`, false when the import failed); `loadedBuiltinDeckBlocks()` returns
  it synchronously once loaded. The stage waits for it before validating
  only when no renderer table brings a block check (`validateBlock` or
  `loadValidateBlock`), showing the loading status meanwhile; if the import
  fails, every free-slide block is refused (the error state, never
  unchecked content). The built-in free-slide renderer loads like any lazy
  renderer, only for a free slide no table's `free` answers (a host that
  brings its own check but not a `free` renderer sees the slide's loading
  status once). The block families of the next slides are prefetched only
  for those slides. A host with `defaultRenderers={false}`, its own
  `validateBlock` and a `free` renderer for every free slide has no
  `@texuli/blocks` code in its initial graph and never loads the chunk; a
  host with `defaultRenderers={false}` and no block check awaits
  `loadBuiltinDeckBlocks()` before mounting to paint at once. `prepareDeck`
  and `validateDeckBlock` stay synchronous (they import the check
  statically).
- **Migration (lazy):** a v2 deck (`formatVersion` present) needs no
  migration, so the stage imports `migrateDeck` only for a deck in an
  earlier shape (Texuli v1, a grammar tree, a Protoyard deck) and validates
  it once that import arrives; if the import fails, the deck is refused
  ("The deck could not be migrated."). A v2 deck never loads the migration
  code. `loadDeckMigration()` imports it once (later calls share the import;
  it never rejects: a failed import resolves to `null` and is retried by the
  next call) and `loadedDeckMigration()` returns it synchronously once
  loaded, so a host with an earlier-shape deck awaits `loadDeckMigration()`
  before mounting and the first stage paints without its loading status
  (G73). It is the stage's own cache, so it lives here rather than in
  `@texuli/deck` (whose `migrateDeck` is a plain synchronous import).
- **Prepared decks (G83):** an `ok` result of `prepareDeck(input, hooks)`
  or of `prepareDeckV2(input, hooks)` (the light variant: a v2 deck only,
  checked with the host's own `hooks.validateBlock`, a `DeckBlockCheck`,
  so neither `migrateDeck` nor `@texuli/blocks` is imported) is a prepared
  deck (`PreparedDeckOk`). Hand it to the stage as `deck` with
  `tier="developer"` and the stage paints it on its first render without
  migrating or validating it again: no migration, built-in block check or
  lazy validator chunk loads for it (with the default tables on, their own
  load still brings those chunks; use `defaultRenderers={false}` or the
  stage core to keep them out). The brand is the prepare functions' own
  record, not the object's shape: `isPreparedDeck(value)` is true only for
  a result they returned in this page, and its wrapper is frozen. A
  look-alike object (agent output, a JSON or `structuredClone` copy) is
  validated like any input, and at the `untrusted` tier the stage
  validates a prepared deck's `deck` again. Never prepare agent content
  for the developer tier: the hooks you pass are the only checks it gets
  (`tests/stage-prepared.test.ts`, and `tests/bundle-graph.test.ts` for a
  stage-core host with `prepareDeckV2`).
- **Stage core (`@texuli/slides/stage-core`, G72):** `DeckStageCore` is the
  whole stage without any reference to the default tables: `DeckStage` is
  `DeckStageCore` with `defaults` set to `DECK_DEFAULT_RENDERERS_SOURCE`
  (a `DeckDefaultRenderersSource`: `load()` and `loaded()`, the two loaders
  above). Without `defaults` the core behaves as `defaultRenderers={false}`,
  and a host build that imports only `@texuli/slides/stage-core` emits no
  chunk, CSS or prefetch of the layouts table, the component registry or
  its catalog outline, not even as a lazy chunk (`tests/bundle-graph.test.ts`,
  "emits no default-table chunk at all"). Its server preload
  (`#deck-ssr-core`) loads the built-in block support, `migrateDeck` and the
  block families, never the default tables. `@texuli/slides/stage-core`
  exports the same names as `@texuli/slides/stage` except `DeckStage`,
  `DeckPrint`, `DECK_DEFAULT_RENDERERS_SOURCE`, `loadDefaultDeckRenderers`
  and `loadedDefaultDeckRenderers` (a test keeps the two lists in step).
  To print from such a host, use `DeckPrintViewCore` from
  `@texuli/slides/export-core` (G105), which takes the same `defaults`
  source and references no default table either
  ([export.md](export.md#export-core-texulislidesexport-core-g105)).

  ```svelte
  <script lang="ts">
    import { DeckStageCore } from '@texuli/slides/stage-core';
    const renderers = { validateBlock: checkHostBlock, free: () => HostFreeSlide };
  </script>

  <DeckStageCore {deck} {renderers} />
  ```
- **Canvas:** a fixed virtual canvas (1280 × 720 for 16:9) is scaled into
  the stage with a `ResizeObserver` and letterboxed. CSS variables go on the
  stage root through `deckCssVars` (the CSSOM, never a static `style`).
- **Mounting:** at most three slides are mounted (the active one and its
  neighbours, `inert` and hidden from assistive tech). While the browser is
  idle (`whenIdle`) the stage runs every table's `prefetch` for the next
  slides and loads the block families of the next free slides the built-in
  renderer paints (`prefetchDeckSlides` and `slideBlockFamilies` do the
  same for a list of slides); `loadDeckBlockFamily` loads one family
  (`DeckBlockRendererProps` is what a family renderer receives).
- **Landmark:** the stage root is a `region` named "Presentation: <title>"
  (`stage.label`). Before the deck has validated (SSR, lazy chunks) the name
  comes from the input's own `meta.title` (or a Protoyard `outline.title`),
  so several stages on one page keep distinct names; a loading stage whose
  input names no title has no name, and an unnamed region is not a
  landmark. The loading status is a `status`, never a second landmark. Two
  decks with the same title on one page get the same name: give them
  distinct titles, or a distinct `stage.label` through `messages`.
- **Slides** are `role="group"` with `aria-roledescription="slide"`, named
  by their title (or "Slide n"), and carry `data-step` and `data-step-count`.

### Routing, keys and pointer

- **Hash:** `#/<slide>/<step>`. `claimDeckHash` gives the page hash to one
  stage, `releaseDeckHash` frees it, `readDeckHash`, `writeDeckHash` and
  `watchDeckHash` read, write (`replaceState`) and follow it on a
  `DeckRouteWindow`. Hostile hashes are ignored. A followed hash past a
  slide's last step is clamped, and the address is rewritten to the clamped
  route (also when the deck did not move). A `hashchange` that arrives while a
  slide transition plays is queued and applied when the transition ends (the
  latest one wins), and the stage never overwrites a deck route it did not
  write: a transition that finishes before the user's `hashchange` runs
  follows the typed route instead of replacing it.
- **Keys** follow the engine registry (`DECK_CONTROLS`, `decideDeckInput`);
  `keyInput` and `clickInput` describe the DOM event for it. Keys act while
  focus is inside the deck; the deck that owns the hash also takes keys
  while nothing on the page has focus. Navigation keys are ignored on
  buttons, links, fields, interactive blocks and the chrome.

| Key | Action |
| --- | --- |
| → ↓ Page Down Space Enter | Next step, or the next slide |
| ← ↑ Page Up Shift+Space Backspace | Previous step, or the previous slide |
| Home / End | First / last slide |
| `O` | Overview |
| `F` | Full screen |
| `S` or `P` | Presenter layout |
| `B` or `.` | [Blackout](#chrome) |
| `L` | [Laser pointer](#chrome) |
| `?` | [Controls and shortcuts](#chrome) |
| Ctrl/⌘ + P | The browser's print (the print styles hide the chrome) |
| Esc | Closes the innermost layer: help, overview, blackout, laser, then full screen (`DECK_ESCAPE_ORDER`) |

  In right-to-left decks the horizontal arrows swap.
- **Pointer:** a primary click on the slide advances (`clickToAdvance`;
  `selectionLength` keeps selecting text from advancing; the first click on
  an embedded deck only focuses it). `createSwipeTracker` turns a touch or
  pen drag into a swipe (≥ 50 px, < 800 ms); a second finger cancels it.
- **Events:** the root dispatches `DeckStageEvent`s (`DECK_STAGE_EVENTS`,
  typed by `DeckStageEventMap` and `DeckStageEventName`) through
  `dispatchDeckEvent`: `tx-deck:ready`, `change`, `step`,
  `transition-start`, `transition-end`, `overview`, `presenter`,
  `fullscreen`, `blackout`, `action` (every chrome action: help, laser, copy
  link, print, slide list) and `error`.

### Chrome

Every chrome component reads `getDeckStageContext()` (a
`DeckStageContext`, set by the stage with `setDeckStageContext`; the slide
list entries are `DeckStageSlideEntry`) and `getDeckChromeContext()` (the
`DeckChromeState` the stage creates with `createDeckChromeState` and
provides with `setDeckChromeContext`), and marks its root with
`data-tx-deck-chrome`, so clicks and swipes on it never move the deck.
Every string comes from the messages (`DECK_CHROME_MESSAGES` joins
`DECK_STAGE_MESSAGES`).

- **`DeckToolbar`:** a group named “Presentation controls” with one group
  per registry group (Navigate, View, Present, Share and print, Help). It
  shows every control `deckChromeEnvironment(window)` allows (print only
  where the page can print, copy link only with a clipboard path, no debug
  panel). Buttons are icons with their label as text for assistive tech;
  toggles report `aria-pressed`, the help button `aria-expanded`, and
  Previous and Next are `aria-disabled` at the ends of a deck that does not
  loop. Targets are at least 32 px (44 px on touch). When the full toolbar
  does not fit (measured, never a breakpoint), the View, Present, Share and
  Help groups fold into “More”, a disclosure (Escape closes it). By default
  it sits below the slide, aligned to the inline end (right in left-to-right
  decks, left in right-to-left ones); `toolbarPosition="top"` puts it above.
  Its `tools` prop (the stage's `tools` snippet, G82) renders host controls
  as a last group, "More tools", that never folds into “More”.
  The toolbar hides in full screen.
- **Slide list:** the counter (“3 / 12”, named “Choose a slide, 3 / 12”)
  opens a listbox of every slide by number and title. Focus starts on the
  current slide; arrows, Home and End move, Enter or a click jumps (focus
  goes to the slide), Escape closes and returns to the counter, Tab or a
  pointer outside closes.
- **Tooltips:** one per toolbar (a `DeckTooltip` showing a
  `DeckTooltipContent`): the label, the registry description and the keys
  (`deckShortcutText`). Its runtime loads on the first hover, focus or touch
  on a tool. It opens after 300 ms of hover, at once on keyboard focus, and
  after a 500 ms touch, whose click it swallows. While it shows, its button
  is `aria-describedby` it; Escape closes only the tooltip. It stays inside
  the viewport, and blackout and the laser suppress it.
- **`DeckProgress`:** the progress bar, on the edge `style.progress` names
  (`top`, `bottom`; `none` hides it), a `progressbar` named “Deck progress”
  and valued by the slide position.
- **`DeckChrome`:** the layers over the stage, mounted even when a host
  replaces the toolbar:
  - **Blackout** (`B`, `.`): a black screen over the whole stage, one real
    button. For two seconds it says “Screen blacked out. Press B or select
    to show the slide.”, then turns fully black. A click, `B` or Esc brings
    the slide back and focus returns to it.
  - **Laser** (`L`): a red dot replaces the cursor over the slides, starting
    where the pointer was (else in the middle), with a “Laser on” chip; a
    touch moves it to each tap. A click does not advance while it is on.
    Turning it on or off is announced politely.
  - **Controls and shortcuts** (`?`): a modal dialog (`showModal`)
    generated from `DECK_CONTROLS`, grouped as in the toolbar, with every
    key and “Button only” for controls without keys, filtered by the page's
    capabilities. Focus moves to Close and stays inside (Tab wraps); Esc,
    `?` or Close shut it, and focus returns to its opener (or the slide).
  - **Copy link:** copies `deckSlideLink(location.href, slide, step)`
    (`#/<slide>/<step>`) with `copyDeckText`, which falls back to
    `execCommand('copy')` and reports a failure. A toast answers (“Link to
    this slide copied.” or “Could not copy the link.”) in a polite live
    region and its visible twin, for 2.5 s.
  - **Print** (the button): opens `deckPrintLink(…)` (`?print=1` plus the
    slide hash) in a new tab, where the host renders `DeckPrint` when
    `parseDeckRoute(location.hash, location.search).flags.print` is set; a
    host that does not handle `?print=1` shows the deck there. When the tab
    cannot open, the page prints itself.
  - **First-visit hint:** “Use ← → to move, F for full screen, ? for every
    control.” It shows once per `namespace` (`claimFirstRunHint`, stored in
    `localStorage` and safe when storage throws), never in a hidden tab or
    under automation (`firstRunHintAllowed`; `?hint=1` forces it,
    `?hint=0` turns it off), for `FIRST_RUN_HINT_MS` (6 s) or until the
    first key, pointer or wheel input. It never takes focus.
  - **Full screen overlay:** in full screen, Leave full screen, Previous,
    the counter and Next. It shows on entering and on every pointer move,
    and fades after 2.5 s (then `inert`); blackout and the laser hide it.

  Help, the laser, the hint, the overlay, the slide list and “More” load on
  their own chunks the first time they open.
- **Actions:** `runDeckChromeAction(stage, chrome, action)` runs any deck
  action the way the keys do; a host `chrome` snippet uses it with the two
  contexts. `DeckChromeNotice` is the toast's message.
- **Accessibility:** forced colors keep every control and layer bordered
  (blackout stays black), motion only fades and glides with no reduced
  motion preference, the toolbar follows `dir` and the arrow icons mirror in
  right-to-left decks.

### Messages and language

`createDeckTranslator(overrides)` returns the `DeckTranslate` every string
goes through: the engine catalog plus the stage keys
(`DECK_STAGE_MESSAGES`, `DeckStageOnlyMessageKey`; together
`DeckStageMessageKey`). Overrides are partial (`DeckStageMessages`);
non-string values keep the default. `meta.locale` becomes `lang` and
`meta.dir` becomes `dir`.

### Reveal steps

Each mounted slide gets a step context (`setDeckStepContext`;
`getDeckStepContext()` returns a `DeckStepContext`). `deckSlideSteps` reads a
slide's step table, `clampStep` bounds a step, `deckStepView` builds a plain
context from a `StepViewInput` and `createDeckStepContext` a reactive one.
Renderers spread `DeckFragmentAttributes` on stepped elements; fragments
keep their space when hidden. Forward steps animate per effect; going back
and reduced motion cut.

### Renderers

`renderers` plugs layouts, components, backgrounds and custom slides in
without editing the stage. `DeckRenderers` tables are flattened by
`deckRendererList`; `resolveSlideRenderer`, `resolveItemRenderer` and
`resolveBackgroundRenderer` ask them with a `DeckRendererLookup`. An entry
(`DeckRendererEntry`) is a component or a `DeckLazyRenderer`
(`isLazyRenderer`, `loadRenderer` loads it once, `readyRenderer` returns it
when loaded). Renderers receive `DeckSlideRendererProps` with a
`DeckSlideRenderContext`, `DeckItemRendererProps` or
`DeckBackgroundRendererProps`. Free slides compose with `composeFreeSlide`
(a `ComposedFreeSlide` of `FreeSlideRegion`s) and `freeSlideEntry`
(`FreeSlideEntry`). A slide without a renderer shows a labelled
placeholder.

### Transitions and motion

`playDeckTransition(options)` (`PlayDeckTransitionOptions`,
`PlayedDeckTransition`) renders the resolved transition with View
Transitions (`DeckViewTransition` on a `DeckTransitionDocument`, names from
`viewTransitionPrefix` and `viewTransitionIdent`, keyframes from
`transitionKeyframes`), a CSS fallback, or a cut (`DeckTransitionMode`,
`DeckTransitionDirection`). Morph pairs match `DECK_MORPH_ATTRIBUTE`.
Reduced motion turns movement into a short fade; motion `none` cuts.

Every animation plays through the shared runtime, `@texuli/core/motion`
([ADR-013](../../../docs/DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)),
loaded as its own chunk (`stage/motion.ts`; the stage warms it on mount, and
`stage/motion-capture.ts` is the small static half). `@texuli/deck` still
resolves what to play as data, with its `full` / `subtle` / `none` levels:

- **View Transitions:** the snapshot animations take their timing from the
  runtime's plan for the live incoming slide (`resolveMotion`: durations
  clamped to 1 s; under reduced motion the deck's 150 ms opacity-only fade,
  the runtime's `fade` reduced-motion policy).
- **CSS fallback:** the incoming slide keeps `data-tx-deck-enter` as a
  marker, and its entrance plays through `animate` (no CSS keyframes), with
  the same `fade` policy.
- **Fragments** (v2 phases, `data-tx-deck-fragment`): `styles.css` holds the
  end states only; on a step change the stage reads each fragment's style,
  then animates every changed one from its old style to its new one (500 ms
  at `full`, × 0.6 at `subtle` with no travel or scale, instant under reduced
  motion and at `none`; at most 64 elements per step). A fragment fading out
  stays `visibility: visible` until its animation ends. The v1 reveal steps
  (`data-reveal`) keep their CSS animation (planned).

Tests: `tests/stage-motion.test.ts`.

Focus after a keyboard move waits for the incoming slide: with View
Transitions the DOM swaps inside the transition's update callback, so the
stage focuses the target slide there, never the outgoing one. That deferred
focus only happens while focus is still in the deck or was dropped to
`<body>` by the swap, so an embedded deck never takes focus back from the page.

### Overview

`O` or the toolbar opens `DeckOverview`; choosing a slide closes it and
returns focus to the slide. Each card is named by its visible caption
(“3 Pricing”) and described by its position (`stage.overviewCardPosition`,
“slide 3 of 25”). A host replaces it with `overviewView`.

### Presenter view

`S`, `P` or the toolbar opens the presenter layout, `DeckPresenterPane`
beside the slides (notes, up next, and with `presenterTimer` a timer). A
host replaces it with `presenterView`. The timers start with the pane and the
status line says so from the first paint (`DeckPresenterTimers.onChange`
repaints it on every start, pause, reset and slide change); the slide
stopwatch restarts the moment the deck moves to another slide, not when the
transition paints it. In a stage with a bounded height (`fit="viewport"` or
the window-filling full screen) the pane scrolls inside the slide row, so the
toolbar never covers its Previous and Next buttons. `createPresenterTimer(now?)` returns
a `PresenterTimer` and `formatElapsed(ms)` formats it.

### Fullscreen

`F`, the toolbar or `toggleFullscreen()` on the context toggle full screen.
`canUseNativeFullscreen(element, document)` checks for the Fullscreen API.
With it, the stage root enters full screen (`data-fullscreen="native"`) and
follows the browser leaving it. Without it, or when the browser refuses,
the stage fills the window (`data-fullscreen="viewport"`) and says so in a
status note; while it fills the window, focus that leaves the stage returns
to the slide. Entering and leaving move focus to the slide.
`onFullscreenChange` reports each `DeckFullscreenState`.

### Presenter screen

A presenter screen is a second `DeckStage` instance, in another window or tab
of the same browser, driven by the same position over `BroadcastChannel`. No
server is involved, so it works only within one origin on one device; it
does not reach another computer or a phone.

```ts
import { createDeckSync } from '@texuli/slides/stage';

// In both windows, with the same deck and the same key:
const sync = createDeckSync({ deck: 'board-update-q3' });
// Audience window: <DeckStage {deck} {sync} />
// Presenter window (the host opens it): <DeckStage {deck} {sync} presenter />
```

- `createDeckSync(options)` (`DeckSyncOptions`: `deck` key, `channel` name,
  optional `open` for a custom `DeckSyncChannel`) returns a `DeckSync`
  (`post`, `hello`, `subscribe`, `close`), or `null` when the browser has no
  `BroadcastChannel` or the key is unusable, so the host can say the
  presenter screen is unavailable.
- Messages (`DeckSyncMessage`, tagged `DECK_SYNC_PROTOCOL`) carry only a
  `DeckSyncPosition`: a slide id and a reveal step. `parseDeckSyncMessage`
  accepts only the closed shapes for the deck's key; extra fields, other
  decks, bad ids and out-of-range steps are dropped. A position for a slide
  the receiving deck lacks is ignored, and steps are clamped to the slide.
- Either window can drive: each posts its position changes and follows the
  other's, without echoing a received position back. A stage posts nothing
  for its first position. When a stage connects it sends `hello`; a stage not
  in presenter mode answers with its position, and a presenter screen answers
  only after it has moved or followed, so a newly opened presenter screen
  joins the audience's slide instead of moving it.
- The host opens and closes the second window; the stage never calls
  `window.open`.

### Themes

The stage applies deck and slide themes with the `@texuli/tokens` engine. A
slide's theme overrides the deck's.

- **Loading:** embedded themes apply directly. Catalog ids go through
  `loadTheme` (a `DeckThemeLoader`). The default, `loadDeckLibraryTheme`,
  imports `@texuli/tokens/library-expand` on first use, and a palette seed
  imports `@texuli/tokens/generator` on first use, so a host that passes its
  own `loadTheme` (or `null`) has neither the theme library records nor the
  generator in its initial graph (`tests/bundle-graph.test.ts` checks it by
  module id). Until a catalog or seed theme resolves, the stage paints with
  inherited or host CSS and `data-theme-status="loading"`. On mount, every
  id the deck references (`deckCatalogThemeIds`) loads once, through
  `createDeckThemeCache`, which validates each theme with `defineTheme` again.
- **Applying:** `deckThemeVariables(theme, mode)` produces the `--tx-*`
  properties and `color-scheme` written on the stage element, with
  `data-tx-theme`, `data-tx-mode`, `data-tx-surface` and `data-tx-motion`.
  High contrast keeps the theme's style tokens and swaps every semantic color
  for the engine's system-color palette.
- **Modes:** `resolveDeckThemeMode(ref, matchMedia, hostMode)`. An explicit
  mode wins. `system` follows the nearest host `data-tx-mode` (light, dark or
  high-contrast) first, then `prefers-contrast: more`, then
  `prefers-color-scheme`. Server rendering uses light until mount.
- **Status:** `data-theme-status` on the stage is `applied`, `loading`,
  `unavailable` (the loader rejected the id; host CSS applies) or `host`
  (`loadTheme={null}`).

A print-specific theme and per-slide compiled CSS are planned.

### Design systems

> **New in `0.10.0`.**

A deck may name the design system it follows with a top-level
`designSystem` (`{ ref }` or `{ inline }`, the blueprint's shape;
[deck model](../../deck/docs/model.md#design-systems),
[ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface)).
The stage applies it the way `@texuli/player` applies a blueprint's:

1. **Lazy:** a validated deck with a `designSystem` loads the stage's
   design-system step with `import()`, which loads
   `@texuli/player/design-system` (the player's own resolver) and the
   compiler. A deck without one never loads any of them
   (`tests/bundle-graph.test.ts` checks the initial graph by module id).
2. **Resolved by the host:** `designSystems.resolve(ref)` returns a
   document or a compiled design system (sync or async; a cached JSON copy
   works). The stage never fetches; `texuli:<theme>` falls back to the theme
   library. A resolved document must declare the exact `id` and `version`
   of the ref. An inline document compiles at the stage's tier (`tier`, else
   `mediaTrust`, else `untrusted`), so agent decks refuse `data:` URLs and
   remote assets; a host-resolved one compiles at `developer`.
3. **Applied on the stage root, in place of the deck theme:** the compiled
   variables for `designSystems.mode` (default: `dark` when the stage mode
   is dark, else `light`), `data-tx-ds` and the other scope attributes,
   `data-tx-scope` and `data-tx-mode`. The deck theme (`style.theme`, a
   slide's `theme`) stops writing its variables while the design system
   applies, and backgrounds resolve against the design system's palette.
   Font faces register for host-resolved documents or at the `developer`
   tier.
4. **Component defaults:** the compiled `defaults` (a default `variant` or
   `size`, closed vocabulary) reach every texuli component on the slides
   (a poll's buttons, a structure block's cards) through the
   `texuli/defaults` context, merged over an outer provider's; a prop set by
   a block still wins.

The root carries `data-tx-deck-design-system` (`pending`, `applied` or
`refused`). When nothing resolves, the resolver throws or returns another
document, or the compiler refuses the document (`aa-text`, `url-refused`
…), the deck theme keeps painting, a `role="status"` paragraph shows the
`stage.designSystemRefused` message, and `onDesignSystem` receives the
code. It never throws, and the slides still paint. A later deck without a
design system restores the deck theme and the library defaults
(`tests/stage-design-system.test.ts`).

```svelte
<DeckStage
  {deck}
  designSystems={{ resolve: (ref) => savedDesignSystems.get(ref) }}
  onDesignSystem={(event) => console.log(event.status)}
/>
```

`DeckPrint` and the print view (`DeckPrintView`) follow the deck theme
only (a deck design system in print is planned); the PPTX writer takes
`design` values built from a compiled design system
([export.md](export.md)).

### Media

Image, figure, video and gallery blocks render through the `@texuli/blocks`
media family, inside the master regions from `composeSlide`
([model.md](model.md)).

Before a media block is painted, `gateDeckMedia(block, options)` checks every
source with the core URL policy at the `mediaTrust` tier, returning a
`DeckMediaGate` (`block`, or `null`, and the `refused` paths) for the given
`DeckMediaOptions`. Images, figures and posters use `safeImageSrc`; videos use
`safeMediaSrc`. `avatar:` ids paint only through `resolveAvatar`, wrapped by
`deckAvatarResolver` so its URLs pass the developer tier.

At `untrusted`, relative image paths and host-resolved avatars paint. `data:`
images and video are refused: the untrusted policy needs `https` from an
allowed origin, and the block schema only accepts relative or `data:` video.
A refused block becomes a visible note; a refused gallery item is dropped.
App-authored decks can pass `tier="developer"`.

### Trust badge

At the `untrusted` tier (the default) the stage shows one badge,
**Untrusted content**, at the inline start of the row that holds the toolbar
(or the host `chrome` snippet), above or below the slide with
`toolbarPosition`. It is the deck-level counterpart of the player's
artifact-frame badge: each catalog component on a slide paints through a
`Player` with `chrome={false}`, which drops the player's own badge, so the
stage carries the trust signal once for the whole deck instead of once per
component. The badge is plain text (`data-tx-deck-trust="untrusted"`), read
in reading order, never focusable, uses `CanvasText` in forced colors, and
hides in print and, with the default toolbar, in full screen (the overlay
replaces the toolbar row). Reword it with
`messages={{ 'stage.untrustedBadge': '…' }}`. Hosts that present their own
content pass `tier="developer"` and never see it; `trustBadge={false}` hides
it at the `untrusted` tier for a host that states the trust of the deck
itself, next to the stage.

Only the mounted slides (at most three) load their media.

### Style helpers

`DECK_FALLBACK_PALETTES` and `deckBackgroundPalette` give the contrast math
real colors; `slideThemeReference`, `deckThemeReferences`, `deckThemeKey`,
`deckThemeId`, `loadDeckTheme`, `resolveStageMode` and `seedColor` resolve
deck and slide themes. `deckSyncLink(sync)` adapts either sync transport to
one `DeckSyncLink` of `DeckSyncSignal`s.

## DeckPrint

`DeckPrint` renders every page of a print plan (see [export.md](export.md)):
slides as “Slide n: <title>” regions, then notes pages when asked.

| Prop | Default | What it does |
| --- | --- | --- |
| `deck` | required | The validated `Deck` |
| `notes` | `none` | `none`, `appendix` or `handout` (`DeckPrintNotes`) |
| `loadTheme` | `loadDeckLibraryTheme` | Same contract as `DeckStage` |
| `printOnly` | `false` | Hidden on screen; when printing, it replaces any `DeckStage` on the page |
| `onReady` | — | Called once with the `DeckPrintPlan` when the pages are ready |
| `mediaTrust` | `untrusted` | Same paint policy as the stage |
| `resolveAvatar` | — | Same as the stage |
| `mediaTimeoutMs` | `10000` | Longest wait for images before reporting ready anyway |

Each page applies its effective slide theme; `system` or missing modes print
light, while explicit `dark` and `high-contrast` hold. `DeckPrint` preloads
the block families and themes it needs, switches every image to
`loading="eager"`, and waits until each has loaded or failed
(`settleDeckImages`). Then it sets `data-print-ready="true"` and calls
`onReady`; a host should request the PDF after that. Videos print as whatever
frame the browser shows. Notes print as plain text, and nothing in the print
view takes keyboard focus.

On screen, each page keeps its aspect as a minimum and grows to fit its
content; clipping to one page applies only when printing.

## Accessibility

[docs/quality/a11y-slides.md](../../../docs/quality/a11y-slides.md) records
the sweep: axe in light, dark, overview, presenter, help, blackout and
forced-colors states, reflow at 320px, the keyboard map and reduced motion.
[sr-transcripts-slides.md](../../../docs/quality/sr-transcripts-slides.md)
holds VoiceOver transcripts authored from the accessibility tree.
