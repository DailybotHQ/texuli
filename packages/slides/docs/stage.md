# Stage: DeckStage and DeckPrint

**Import:** `@texuli/slides/stage`  
**Source:** `packages/slides/src/stage/`  
**Tests:** `tests/stage.test.ts`, `tests/presenter.test.ts`,
`tests/transitions.test.ts`, `tests/theme.test.ts`, `tests/media.test.ts`,
`tests/print.test.ts`, `tests/a11y.test.ts`; browser sweep
`tests/e2e/a11y-slides.spec.ts`

The Svelte 5 runtime for a validated deck ([model.md](model.md)): the
interactive `DeckStage` and the all-pages `DeckPrint`. Import
`@texuli/slides/styles.css` once for their styles ([styles.md](styles.md)).

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
| `deck` | required | The validated `Deck` |
| `initialSlideId` | `settings.startIndex` | Open on this slide; lets a host restore a slide from its own URL or history |
| `onSlideChange` | — | Receives a `SlideNavigationIntent` (`{ index, slideId }`) for the host to persist; the stage never changes the URL |
| `presenter` | `false` | Bindable presenter mode |
| `onPresenterChange` | — | Called with `open` when presenter mode toggles |
| `loadTheme` | `loadDeckLibraryTheme` | Resolves catalog theme ids; `null` leaves them to host CSS |
| `mediaTrust` | `untrusted` | URL policy tier for media at paint (`DeckMediaTrust`) |
| `resolveAvatar` | — | Host adapter for `avatar:` image ids |

The stage mounts only the active slide, and lazily loads the block families
its blocks use (`loadDeckBlockFamily`; `DeckBlockRendererProps` is the props
shape a family renderer receives). A family that already loaded renders at
once on later slides.

### Keyboard and focus

The stage is a region named “Presentation: <title>”. Its controls are a group
named “Presentation controls”: Previous slide, Next slide, Overview and
Presenter. A polite live region announces “Slide n of m: <title>”.

| Key (focus inside the deck) | Action |
| --- | --- |
| Right, Page Down, Space, Enter | Next slide |
| Left, Page Up, Backspace | Previous slide |
| Home / End | First / last slide |
| `o` | Toggle the overview; focus moves to the current slide's item |
| `p` | Toggle presenter mode |
| `s` | In presenter mode, focus the speaker notes |
| Escape | Close the overview, then presenter mode, returning focus to its button |

Keys act only while focus is inside the deck. Navigation and letter keys are
ignored while a button, link or text field inside it has focus, so those keep
their own Enter and Space; Escape still works there. Navigating from a slide moves focus to the new slide.
Toggling presenter mode from a slide keeps focus on it. The deck loops only
when `settings.loop` is set.

### Presenter view

Presenter mode is a layout of the same deck; it never changes the deck data.
It shows the current slide with three panes, which stack below it on narrow
viewports:

- a “Speaker notes” complementary region (plain text, line breaks kept, never
  HTML);
- an “Up next” region with the next slide's title;
- an elapsed timer (`role="timer"`) with Pause/Resume and Reset.

The timer is a local stopwatch: it starts when presenter mode opens, pauses
when it closes, and uses no network clock. `createPresenterTimer(now?)`
returns that `PresenterTimer` (`start`, `pause`, `reset`, `elapsed`,
`running`), and `formatElapsed(ms)` formats it as `m:ss` or `h:mm:ss`, for
hosts that build their own presenter chrome.

Planned: a second-window or second-screen presenter, a next-slide thumbnail,
a wall clock, fullscreen, and reveal steps.

### Transitions and motion

The stage writes the resolved transition token (`resolveSlideTransition`) to
`data-transition` on the entering slide. The first paint never animates, and
only navigation to another slide animates: re-mounting the same slide for the
presenter view or the overview is a cut. Reduced motion comes from
`prefers-reduced-motion: reduce` or a host-set `data-tx-motion="reduce"` on
the root element, both observed after mount; under either, every slide cuts.
Exit, view and shared-element transitions are not implemented.

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
App-authored decks can pass `mediaTrust="developer"`.

Only the active slide's media loads. The overview lists titles, and the
presenter view shows the next slide by title only.

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
the sweep: axe in light, dark, overview, presenter and forced-colors states,
reflow at 320px, the keyboard map and reduced motion.
[sr-transcripts-slides.md](../../../docs/quality/sr-transcripts-slides.md)
holds VoiceOver transcripts authored from the accessibility tree.
