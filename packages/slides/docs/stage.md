# Stage: DeckStage and DeckPrint

**Import:** `@texuli/slides/stage`  
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
| `deck` | required | A v2 deck, or any input `migrateDeck` understands (Texuli v1, grammar tree, Protoyard). An invalid deck shows its diagnostics and is never painted |
| `syncHash` | `true` | Keep `#/<slide>/<step>` in the URL (`replaceState`) and follow `hashchange` and deep links. Only the first stage on a page claims the hash |
| `fit` | `container` | `container` letterboxes the canvas inside the host box; `viewport` fills the window height |
| `tier` | `untrusted` | URL policy tier for every link and media source painted (`DeckMediaTrust`) |
| `mediaTrust` | — | v1 name of `tier`, kept for existing hosts |
| `messages` | — | Partial overrides of every stage string (`DeckStageMessages`; English defaults) |
| `locale` / `dir` | `meta.locale` / `meta.dir` | Override the `lang` and `dir` of the stage |
| `plugins` | `[]` | Engine plugins (`beforeNavigate`, `beforeRender`/`afterRender`, `onAction`, …), in order |
| `renderers` | — | Renderer tables, first answer wins (`DeckRenderers`: layouts, components, backgrounds, custom slides) |
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
| `resolveAvatar` | — | Host adapter for `avatar:` image ids |
| `controller` | `null` | Read-only binding to the engine `DeckController` for imperative hosts |
| `chrome` | — | Snippet that replaces the default toolbar and progress bar (the [chrome layers](#chrome) stay) |
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
  free-slide block body.
- **Canvas:** a fixed virtual canvas (1280 × 720 for 16:9) is scaled into
  the stage with a `ResizeObserver` and letterboxed. CSS variables go on the
  stage root through `deckCssVars` (the CSSOM, never a static `style`).
- **Mounting:** at most three slides are mounted (the active one and its
  neighbours, `inert` and hidden from assistive tech). The block families of
  the next slides load when the browser is idle (`prefetchDeckSlides`,
  `slideBlockFamilies`, `whenIdle`); `loadDeckBlockFamily` loads one family
  (`DeckBlockRendererProps` is what a family renderer receives).
- **Slides** are `role="group"` with `aria-roledescription="slide"`, named
  by their title (or "Slide n"), and carry `data-step` and `data-step-count`.

### Routing, keys and pointer

- **Hash:** `#/<slide>/<step>`. `claimDeckHash` gives the page hash to one
  stage, `releaseDeckHash` frees it, `readDeckHash`, `writeDeckHash` and
  `watchDeckHash` read, write (`replaceState`) and follow it on a
  `DeckRouteWindow`. Hostile hashes are ignored.
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
host replaces it with `presenterView`. `createPresenterTimer(now?)` returns
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
  imports `@texuli/tokens/library-expand` on first use. On mount, every id the
  deck references (`deckCatalogThemeIds`) loads once, through
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
