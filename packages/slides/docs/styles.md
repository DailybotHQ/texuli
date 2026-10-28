# Stylesheet

**Import:** `@texuli/slides/styles.css`  
**Source:** `packages/slides/src/styles.css`  
**Tests:** `tests/export.test.ts` (page sizes stay in sync with the CSS);
visual baselines for the `slides-*` examples

Plain CSS for `DeckStage` and `DeckPrint` ([stage.md](stage.md)). It imports
`@texuli/tokens/base.css` and reads the theme's `--tx-*` custom properties, so
it follows whatever theme the stage applies. Import it once per app:

```ts
import '@texuli/slides/styles.css';
```

Layout uses logical properties (`inline-size`, `margin-inline`,
`padding-block`), so the stage works in right-to-left documents. Media regions
are never reordered visually; DOM order is reading order.

## Class hooks

| Class | Element |
| --- | --- |
| `tx-deck-stage` | The stage root (region “Presentation: <title>”; `data-fullscreen` when fullscreen) |
| `tx-deck-stage__main` | The column that holds the overview or the slide viewport |
| `tx-deck-stage__viewport` | The letterboxed area the canvas scales into (`data-tx-deck-fit`: `pending` or `ready`; reads `--tx-deck-scale`, `--tx-deck-offset-x`, `--tx-deck-offset-y`) |
| `tx-deck-stage__canvas` | The fixed virtual canvas (1280 × 720 for 16:9; `data-width`, `data-height`), also used by thumbnails and presenter previews |
| `tx-deck-stage__slide` | One mounted slide (`data-tx-deck-slide`, `data-tx-deck-layout`, `data-tx-deck-active`, `data-tx-deck-bg-tone`, `data-step`, `data-step-count`; `data-tx-deck-enter` and `data-tx-deck-direction` for the CSS fallback) |
| `tx-deck-stage__slide-body` | A slide's content box inside the canvas |
| `tx-deck-stage__slide-title` | A slide's h2 title (stage and print) |
| `tx-deck-stage__regions` | A slide's region container (`data-master`, `data-arrangement`, `data-slots`) |
| `tx-deck-stage__region` | One region (`data-slot`: `body`, `media`, `contentStart`, `contentEnd`, `quote`, `attribution` or `footer`) |
| `tx-deck-stage__background` | A slide's background layer (color, gradient or media) |
| `tx-deck-stage__background-media` | The background image or video |
| `tx-deck-stage__scrim` | The contrast scrim over a media background (`data-tx-deck-scrim`) |
| `tx-deck-stage__footer` | The deck footer on the canvas (logo, footer text, slide number) |
| `tx-deck-stage__logo` | The deck logo in the footer (decorative, `alt=""`) |
| `tx-deck-stage__slide-number` | The visible slide number in the footer (hidden from assistive technology; the live region announces the position) |
| `tx-deck-stage__live` | The polite live region that announces “Slide n of m: <title>” |
| `tx-deck-stage__progress-bar` | The progress bar (`role="progressbar"`, `data-tx-deck-progress`: `top` or `bottom`) |
| `tx-deck-stage__progress-fill` | The progress bar fill (reads `--tx-deck-progress-ratio`) |
| `tx-deck-stage__toolbar` | The “Presentation controls” group |
| `tx-deck-stage__control` | A presenter-pane or presenter-window button |
| `tx-deck-stage__fullscreen-note` | The visible status note when fullscreen falls back to filling the window |
| `tx-deck-stage__blackout` | The blackout layer (B) over the canvas |
| `tx-deck-stage__blackout-hint` | The visible hint on the blackout layer |
| `tx-deck-stage__overview` | The overview navigation |
| `tx-deck-stage__presenter-side` | The presenter's pane column |
| `tx-deck-stage__timer` | The presenter timer row |
| `tx-deck-stage__notes` | The speaker notes pane |
| `tx-deck-stage__notes-text` | Notes text (`white-space: pre-wrap`; presenter and print) |
| `tx-deck-stage__next` | The “Up next” pane |
| `tx-deck-stage__next-title` | The next slide's title |
| `tx-deck-stage__pane-title` | A presenter pane heading |
| `tx-deck-stage__step-progress` | “Reveal step n of m” in the speaker notes pane |
| `tx-deck-stage__empty` | “This slide has no content yet.” and “No notes for this slide.” |
| `tx-deck-stage__placeholder` | A note for a layout, component or custom slide the stage cannot render (`role="note"`, `data-tx-deck-placeholder`) |
| `tx-deck-stage__placeholder-text` | The placeholder message |
| `tx-deck-stage__loading` | A block family still loading |
| `tx-deck-stage__error` | A block family that failed to load |
| `tx-deck-stage__fragment` | A box-less (`display: contents`) wrapper around a top-level block that reveals (`data-fragment`, `data-fragment-step`, `data-fragment-state`, `data-visible-items`, `data-emphasis`, `data-reveal`) |
| `tx-deck-stage__media-refused` | The note shown for media the paint policy refused |
| `tx-deck-stage__invalid` | The panel shown instead of a deck that failed validation |
| `tx-deck-stage__invalid-title` | Its alert heading (“This deck could not be shown.”) |
| `tx-deck-stage__invalid-summary` | The problem count |
| `tx-deck-stage__invalid-list` | The list of problems |
| `tx-deck-stage__invalid-path` | The JSON path of one problem |
| `tx-deck-stage__invalid-more` | “And n more.” past the listed problems |
| `tx-deck-print` | The print root (`data-aspect`, `data-notes`, `data-print-only`, `data-print-ready`) |
| `tx-deck-print__slide` | One printed slide page (`data-arrangement`) |
| `tx-deck-print__notes` | One notes page |
| `tx-deck-print__notes-title` | A notes page heading |

The view transitions carry two `view-transition-class` values the stylesheet
times: `tx-deck-slide` on the slide snapshot and `tx-deck-morph` on paired
morph elements (`data-tx-deck-morph-id`); both also carry `tx-deck`, which the
reduced-motion rule shortens to 150 ms.

## States the stylesheet reads

- **Transitions:** `data-transition="fade"` and `"fade-up"` on an entering
  slide animate for `--tx-motion-base` (180ms by default). `fade-up` rises
  along the block axis only, so it looks the same in right-to-left layouts.
- **Reveal steps:** a fragment with `data-fragment-state="hidden"` and list
  items past `data-visible-items` get `visibility: hidden`. They keep their
  space, so the slide does not move as it reveals, and leave the accessibility
  tree. `data-emphasis="highlight"` tints and outlines the block;
  `data-emphasis="strike"` strikes it through and dims it. `data-reveal`
  (`fade`, `fade-up`, `grow`) animates the fragment, or its newest list item,
  for `--tx-motion-base`, only under `prefers-reduced-motion: no-preference`.
- **Reduced motion:** under `prefers-reduced-motion: reduce`, on a stage with
  `data-motion="reduce"`, or under a root `data-tx-motion="reduce"`, slide
  animation is off, so CSS-only hosts get the cut too.
- **Media regions:** `data-arrangement="media-start"` and `"media-end"` lay the
  media and body regions side by side, stacking them below 40rem. An image in
  a media region fills a bounded frame. Body images and videos are capped in
  height and never cropped.
- **Slot masters:** `data-arrangement="split"` with a `contentEnd` slot sets
  two equal columns, stacking below 40rem; the columns follow the writing
  direction. A `footer` region spans the slide, set smaller and muted above a
  border. `centered` masters center their content and the slide title.
  `quotation` limits the line length, enlarges the `quote` slot and aligns
  the `attribution` to the inline end.
- **Fullscreen:** `data-fullscreen` lets the stage scroll inside itself;
  `data-fullscreen="viewport"` pins it over the window (`position: fixed`,
  `inset: 0`).
- **Presenter:** the panes sit beside the slide and stack below 48rem.
- **Forced colors:** borders on the stage, controls, presenter panes and the
  refused-media note use `CanvasText`; a highlight emphasis uses `Mark` and
  `MarkText`.

## Print

Each aspect has a named page with zero margins: `tx-deck-16-9` (13.333in ×
7.5in), `tx-deck-4-3` (10in × 7.5in) and `tx-deck-1-1` (7.5in × 7.5in). A
print slide (`data-aspect`) uses its page and breaks after itself. The notes
appendix starts on a new page, and `print-color-adjust: exact` keeps theme
colors.

On screen, a print page keeps its aspect as a minimum and grows to fit its
content, so narrow previews never clip or scroll sideways. Clipping to one
page applies only under `@media print`. Also under `@media print`:

- a `DeckStage` hides its toolbar, overview and presenter panes;
- a `printOnly` print view replaces the stage on the page.
