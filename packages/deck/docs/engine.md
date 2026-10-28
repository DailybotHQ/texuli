# Engine (`@texuli/deck/engine`)

The framework-free presentation runtime of `@texuli/deck` (ADR-009):
navigation over a deck, an imperative controller with typed events and
ordered plugins, hash routes, the controls registry and pure input
decisions, canvas fit, transition metadata, an auto-slide scheduler, the
presenter protocol and the English stage messages. It reads decks and
returns data; the stage (`@texuli/slides`) owns the DOM, rendering and
browser APIs.

> **Status:** in development; `@texuli/deck` is on npm from `0.4.0`.

The engine touches no `window`, `document` or `BroadcastChannel` when it is
imported, has no runtime dependencies, and imports only this package's own
model (for step counts); `tests/engine-import-guard.test.ts` enforces both.

## Controller

```ts
import { createDeckController } from '@texuli/deck/engine';

const controller = createDeckController(deck, {
  plugins: [
    {
      name: 'analytics',
      afterNavigate(state, previous) {
        console.log(`${previous.slideId} → ${state.slideId} step ${state.step}`);
      },
    },
  ],
});

const stop = controller.subscribe('slidechange', ({ state, source }) => {
  console.log(state.slideId, source); // 'plan' 'api'
});

controller.next();
controller.goTo('closing');
controller.getState(); // { slideIndex, slideId, step, stepCount, overview, blackout, paused, … }
stop();
controller.destroy();
```

`createDeckController(deck, options?)` returns a `DeckController`. The deck
is any model-v2-shaped object (`EngineDeck`); a deck from `parseDeck` fits.

| Method | What it does |
| --- | --- |
| `goTo(target, { source }?)` | Jumps by slide id, visible index or `DeckLocation`. Unknown or hidden ids fall back to the first visible slide. |
| `next()`, `prev()`, `first()`, `last()` | Moves by step, then by slide (see [Navigation](#navigation)). Each takes `{ source }`. |
| `getState()` | The current `DeckState`: a `DeckLocation` plus `overview`, `blackout` and `paused`. |
| `subscribe(listener)` | A state listener `(state, previous)`; returns an unsubscribe function. |
| `subscribe(event, listener)` | A typed event listener (`DeckListener`); returns an unsubscribe function. |
| `setOverview(open)`, `setBlackout(active)` | Toggle the overview and blackout flags. |
| `pause()`, `resume()` | Pause and resume (and the auto-slide scheduler). |
| `handleInput(event, state?, source?)` | Runs `decideDeckInput`, applies the action and returns it (or `null`). Any input pauses auto-slide. |
| `beforeRender(context?)`, `afterRender(context?)` | The stage calls these around each paint; plugins observe a read-only `DeckRenderContext`. |
| `destroy()` | Stops auto-slide, runs plugin cleanups and `onDestroy`, emits `destroy` and drops every listener. |

`DeckControllerOptions` extends the navigator options with `plugins`,
`autoSlideMs` (overrides `deck.navigation.autoSlideMs`; 0 or omitted is off),
an injectable `clock` and `autoSlidePaused`.

Every move carries a source (`DeckActionSource`): `api`, `keyboard`,
`pointer`, `swipe`, `auto`, `presenter` or `route`.

### Events

`DeckEventMap` (names `DeckEventName`):

| Event | Detail | When |
| --- | --- | --- |
| `statechange` | `DeckStateChange` (`state`, `previous`, `source`) | Any location or flag change from a move |
| `slidechange` | `DeckStateChange` | The slide changed |
| `stepchange` | `DeckStateChange` | The step changed on the same slide |
| `overview` | `{ open, state }` | The overview opened or closed |
| `blackout` | `{ active, state }` | Blackout toggled |
| `pause` | `{ paused, state }` | Paused or resumed |
| `action` | `{ action, source }` | Any input action, including stage-owned ones (help, laser, fullscreen, presenter, print, copy link) |
| `destroy` | `{ state }` | The controller was destroyed |

### Plugins

A `DeckPlugin` has a `name` and optional hooks, called in registration
order:

| Hook | Contract |
| --- | --- |
| `setup(controller)` | Once, after the controller is built; may return a cleanup. |
| `beforeNavigate(target, current)` | Return `false` to cancel, a `DeckLocation` to redirect, or nothing to continue (`BeforeNavigateResult`). |
| `afterNavigate(state, previous)` | After a move changed the location. |
| `beforeRender(context)`, `afterRender(context)` | Around a paint, through the stage. Read-only: plugins never inject HTML or mutate the model. |
| `onAction(action, source)` | Every input action. |
| `onDestroy()` | On `destroy()`. |

The controller applies navigation, overview and blackout itself. Chrome
actions (help, laser, fullscreen, presenter, print, copy link, jump, debug)
are emitted as `action` events for the stage to render.

## Navigation

```ts
import { createDeckNavigator } from '@texuli/deck/engine';

const navigator = createDeckNavigator(deck, { initialSlideId: 'plan' });
navigator.next(); // { slideIndex, slideId, step, stepCount, sectionId?, verticalIndex? }
```

`createDeckNavigator(deck, options?)` is the pure navigator the controller
uses (`DeckNavigator`). The deck is read once; later mutations of the input
are ignored. Locations (`DeckLocation`) are immutable snapshots: the index
into the full `slides` array, the slide id, the step, `stepCount` (the
maximum step index, so steps run `0…stepCount`) and, for a slide in a
vertical stack, `sectionId` and `verticalIndex`.

- **Hidden slides** are skipped by sequential moves; `goTo` of a hidden or
  unknown id falls back to the first visible slide.
- **Start:** `NavigatorOptions.initialSlideId` (and `initialStep`), else
  `deck.navigation.start`, else the first visible slide.
- **Steps first:** `next` advances the step until `stepCount`, then moves on;
  `prev` steps back, and entering a slide backwards lands on its last step.
- **Vertical stacks** come from `outline.sections` with `stack: true`
  (`EngineSection`): `next` and `prev` walk the steps, then the vertical
  siblings, then the surrounding horizontal order. `goToVertical(sectionId, index, step?)`
  jumps inside a stack.
- **Looping:** `navigation.loop: true` wraps at both ends.
- **Step counts** default to `modelSlideStepCount(slide)`, the model's
  [steps](model.md#fragments-and-steps) algorithm with the layout's
  steppable paths; pass `NavigatorOptions.stepCount` to override it.
  `stepCountFor(slideId)` reads one, and `visibleSlides()` lists the
  navigable slides.

`EngineDeck` and `EngineSlide` are the structural shapes the engine reads.

## Hash routes

```ts
import { formatDeckHash, formatDeckRoute, parseDeckHash, parseDeckRoute } from '@texuli/deck/engine';

formatDeckHash('plan', 2); // '#/plan/2'
parseDeckHash('#/plan/2'); // { slideId: 'plan', step: 2 }
parseDeckRoute('#/plan/2', '?print=1'); // { location: { slideId: 'plan', step: 2 }, flags: { print: true, notes: false } }
formatDeckRoute({ slideId: 'plan', step: 2 }, { notes: true }); // '?notes=1#/plan/2'
```

The format is `#/<slide-id>/<step>`: a lowercase slug of at most
`DECK_HASH_ID_MAX` (64) characters and a step from 0 to `DECK_HASH_STEP_MAX`
(32). `parseDeckHash` accepts `#/id/step`, `#/id`, `/id/step` and `id/step`
(as `DeckHashLocation`) and returns `null`, never throwing, for empty,
hostile or malformed input: traversal (`..`), uppercase, percent-encoding,
`//`, or `?`, `#` and `\` inside. `formatDeckHash` clamps the step and returns
`#/` for an invalid id. Print and notes flags (`DeckRouteFlags`) live on the
search string (`?print=1&notes=1`); `parseDeckRoute` returns a
`ParsedDeckRoute` and `formatDeckRoute(location, flags?)` writes the query
before the hash. The browser `location` belongs to the host.

## Controls and input

`DECK_CONTROLS` is the single source for the toolbar, the help dialog and
the key map. Each `DeckControl` has an `action` (`DeckAction`, one of
`DECK_INPUT_ACTIONS`), a `group` (`DECK_CONTROL_GROUPS`, type
`DeckControlGroup`: `navigate`, `view`, `present`, `share`, `help`,
`debug`), message keys for its label and description, its `keys`
(`DeckControlKey`), whether it is a `toggle`, and the capabilities it
`requires` (`DECK_CONTROL_CAPABILITIES`, type `DeckControlCapability`:
`fullscreen`, `popup`, `clipboard`, `print`, `debug`). `DeckInputAction` is a
deprecated alias of `DeckAction`.

| Action | Keys |
| --- | --- |
| `next` | → ↓ Page Down Space Enter |
| `prev` | ← ↑ Page Up Shift+Space Backspace |
| `first`, `last` | Home, End |
| `overview` | O (Esc closes) |
| `fullscreen` | F |
| `fullscreen-exit` | Esc |
| `presenter` | S or P |
| `blackout` | B or . (Esc closes) |
| `laser` | L (Esc closes) |
| `print` | Ctrl+P or ⌘+P |
| `help` | ? (Esc closes) |
| `debug` | D (Esc closes; only when the `debug` capability is on) |
| `jump`, `copy-link` | No key: toolbar only |

- `deckControlFor(action)` returns one control (it throws a `RangeError` for
  an unknown action, a developer error).
- `availableDeckControls(env?)` lists the controls a `DeckControlEnvironment`
  supports; `DEFAULT_DECK_CONTROL_ENVIRONMENT` has every capability but
  `debug`.
- `deckKeyBindings(env?)` gives help-dialog rows (`DeckKeyBinding`), and
  `DECK_KEY_BINDINGS` is the default-environment list.

**Input decisions.** `decideDeckInput(event, state?)` turns a plain
`DeckInputEvent` (a `key`, a `click` or a `swipe`) into a `DeckAction` or
`null`. `DeckInputState` describes what is open (`overview`: `closed`,
`open` or `closing`; `blackout`, `laser`, `help`, `fullscreen`, `debug`,
`debugAvailable`) and the text direction. The rules:

- Keys are ignored while composing (IME), in editable targets, and with
  Ctrl, ⌘ or Alt (except the print shortcut); toggles do not repeat.
- Esc closes the innermost open thing, in `DECK_ESCAPE_ORDER`: debug, help,
  overview, blackout, laser, then fullscreen.
- While help, the overview or blackout is open, only its own toggle key
  acts, and navigation keys do nothing; toggles and navigation keys do
  nothing during the overview's closing transition (no double advance).
- In `rtl` decks, ← and → swap.
- Clicks advance (`next`) only with the primary button, no modifiers, no
  text selection and nothing open.
- Swipes need at least `DECK_SWIPE_MIN_DISTANCE` (50 px) on the horizontal
  axis, `DECK_SWIPE_AXIS_RATIO` (1.5×) dominance and less than
  `DECK_SWIPE_MAX_DURATION_MS` (800 ms); mouse swipes are ignored. Left is
  `next`.
- Keys, clicks and swipes on interactive targets never move the deck: form
  fields, links, buttons, media, control roles, and anything inside an
  element with `DECK_INTERACTIVE_ATTRIBUTE` (`data-tx-deck-interactive`, set
  by interactive blocks) or `DECK_CHROME_ATTRIBUTE` (`data-tx-deck-chrome`).

The event target is described as plain facts (`DeckInputTarget`: tag, role,
editable, link, watched attributes). `inputPathFrom(nodes, stopAt?)` builds
that path from a real `event.composedPath()`, stopping at the deck root.

## Canvas fit

Slides paint on a fixed virtual canvas and scale uniformly.

```ts
import { fitDeckCanvas } from '@texuli/deck/engine';

fitDeckCanvas(1920, 1200, '16:9');
// { scale: 1.5, width: 1920, height: 1080, offsetX: 0, offsetY: 60, canvasWidth: 1280, canvasHeight: 720, aspect: '16:9', fit: 'contain' }
```

`DECK_ASPECTS` (type `DeckAspect`) and `DECK_CANVAS`: 16:9 is 1280×720, 4:3
is 1024×768, 9:16 is 720×1280 and 1:1 is 1080×1080; `DEFAULT_DECK_ASPECT` is
16:9. `deckCanvasSize(aspect)` returns a `DeckCanvasSize` (unknown aspects
fall back to 16:9) and `isDeckAspect` tests one.
`fitDeckCanvas(width, height, aspect?, fit?)` returns a `CanvasFit` (scale,
rendered size, letterbox offsets, canvas size, aspect and mode). The
`DeckFitMode` is `contain` (letterbox), `cover` (fill and crop) or
`container` (letterboxed `contain`, for embedded decks).

## Motion

Transition metadata for the stage; rendering is the stage's.
`resolveDeckTransition({ slide, style, motion, reducedMotion })` takes a
`ResolveTransitionInput` and returns a `ResolvedTransition` (`name`,
`requested`, `durationMs`, `motion`, `reason` of type `TransitionReason`).
The rule is the model's: slide override, then deck style, then
`DEFAULT_TRANSITION` (`fade`); the motion ceiling (`MOTION_LEVELS`, type
`DeckMotion`, default `DEFAULT_MOTION`) is lowered, never raised, by reduced
motion (`effectiveMotion`); reduced motion plays a `REDUCED_FADE_MS` (150 ms)
fade; `subtle` scales by `SUBTLE_SCALE` (0.6) and plays `zoom` as `fade`;
`TRANSITION_MS` gives full durations; nothing exceeds `MAX_MOTION_MS`
(400 ms). `DECK_TRANSITIONS` (type `DeckTransition`) lists `none`, `fade`,
`fade-up`, `slide`, `zoom` and `morph`; `isDeckTransition` and
`isMotionLevel` test values.

`morphPairsFor(slides, style?)` reports the slide pairs (`MorphPair`:
`fromSlideId`, `toSlideId`) whose destination resolves to `morph`; the stage
matches elements across the pair. This module is self-contained and does not
import the model's motion module (the model has the same rule as
`resolveSlideTransition`).

## Auto-slide

```ts
import { createAutoSlideScheduler } from '@texuli/deck/engine';

const scheduler = createAutoSlideScheduler({
  intervalMs: 5_000,
  onAdvance: () => controller.next({ source: 'auto' }),
});
scheduler.start();
```

`createAutoSlideScheduler(options)` (`AutoSlideOptions`) returns an
`AutoSlideScheduler` with `start`, `pause`, `resume`, `stop`, `isPaused`,
`isRunning` and `input` (user input pauses it and clears the pending tick).
The interval is clamped to 1,000…600,000 ms. The clock is injectable
(`SchedulerClock`: `setTimeout`, `clearTimeout`, `now`), so tests are
deterministic; the default clock reads `globalThis` only when a method runs.
The controller creates one itself when `autoSlideMs` (or
`deck.navigation.autoSlideMs`) is above 0.

## Presenter protocol

A closed, versioned protocol (`PRESENTER_PROTOCOL_VERSION`, 1) that keeps an
audience view and a presenter view in step over a same-origin channel.

- **Messages** (`PresenterMessage`) are exactly `{ type, slideId, step }`,
  with `type` one of `PRESENTER_MESSAGE_TYPES` (type `PresenterMessageType`):
  `hello`, `sync` or `request`; a lowercase slide id; and a step from 0 to 32.
  Any other key, shape or value is rejected.
- **Channel names** are `PRESENTER_PROTOCOL_PREFIX` (`texuli-deck-presenter/1:`)
  plus a namespace: `presenterChannelName(namespace)`, with
  `sanitizePresenterNamespace` lowering and cleaning the namespace (at most
  96 characters, `default` when empty).
- `parsePresenterMessage(value)` returns a fresh message or `null` (it never
  throws); `isPresenterMessage` is the type guard; `presenterMessage(type, slideId, step)`
  builds one or returns `null` for invalid arguments.

Transports (`PresenterTransport`: `name`, `post`, `subscribe`, `close`)
validate every message on both sides and never construct a global at import:

- `createPresenterTransport(channel, name?)` wraps any
  `PresenterChannelLike` (a `BroadcastChannel` or a test double);
- `createBroadcastPresenterTransport(namespace, factory?)` opens a
  `BroadcastChannel` when the host has one (or the injected factory), and
  returns `null` otherwise;
- `createMemoryPresenterTransport(namespace?)` is an in-process bus for
  tests.

## Messages

`DECK_MESSAGES` holds the English default of every stage string: control
labels and descriptions (`controls.*`), chrome (`chrome.*`), the overview
(`overview.*`), the presenter view (`presenter.*`), print (`print.*`), the
debug panel (`debug.*`), layout fallbacks (`layout.*`) and stage status
(`stage.*`). `DeckMessageKey` is a key, `DeckMessages` a partial override
map, and `MessageValues` the placeholder values.

```ts
import { formatMessage, resolveDeckLocale } from '@texuli/deck/engine';

formatMessage('stage.slideOf', { current: 3, total: 12 }); // 'Slide 3 of 12'
formatMessage('stage.slideOf', { current: 3, total: 12 }, { 'stage.slideOf': 'Diapositiva {current} de {total}' });
resolveDeckLocale(deck.meta, { locale: 'es' }); // { locale: 'es', dir: 'auto' }
```

`formatMessage(key, values?, overrides?)` fills `{name}` placeholders and
leaves unknown ones intact. `resolveDeckLocale(deck?, override?)` merges the
deck's `meta.locale` and `meta.dir` with host overrides (`DeckLocale`),
defaulting to `en` and `auto`; the stage sets `lang` and `dir` from it.
