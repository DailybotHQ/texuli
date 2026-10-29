# @texuli/slides

The presentation stage of [Texuli](https://texuli.com), an MIT-licensed
Svelte 5 component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). Write a deck as JSON or as Markdown, and the stage presents
it: a fixed canvas that scales to any screen, URL routes for every slide and
step, keyboard and touch input, an overview, a presenter window, 21 layouts,
backgrounds with guaranteed text contrast, and any Texuli component on a
slide. The same deck prints to PDF through the browser and exports to PPTX
locally.

The deck model, its validation, the Markdown dialect and the navigation
engine live in [`@texuli/deck`](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/README.md),
a framework-free package with no runtime dependencies. This package is the
Svelte 5 stage on top of it
([ADR-009](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).

> **Status: 0.x release, in development.** The stage described here is
> published on npm as `0.6.0` (first published in `0.4.0`, together with
> the first release of `@texuli/deck`). `@texuli/slides@0.3.0` has the
> previous deck model (model v1) and its stage. Texuli is pre-1.0: under 0.x
> a new minor may contain breaking changes, and `0.4.0` was one, so pin the
> exact version or use
> `^0.6.0`, which accepts only 0.6.x.
> The upgrade path is in
> [migration.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/migration.md).

## Install

```bash
npm install @texuli/slides @texuli/deck svelte
```

Svelte 5 (`^5.57.2`) is a peer dependency. Import the stylesheet once:

```ts
import '@texuli/slides/styles.css';
```

## Quick start

### A JSON deck

`DeckStage` takes the deck as data. It validates it before it paints, and
shows the diagnostics instead of a broken slide when the deck is invalid.

```svelte
<script lang="ts">
  import '@texuli/slides/styles.css';
  import { DeckStage } from '@texuli/slides/stage';

  const deck = {
    formatVersion: 2,
    meta: { title: 'Quarterly update', locale: 'en' },
    style: { theme: 'ocean', transition: 'slide' },
    slides: [
      {
        id: 'opening',
        layout: 'title-hero',
        props: { title: 'Quarterly update', subtitle: 'Fictional numbers for Northwind' },
      },
      {
        id: 'adoption',
        layout: 'big-stat',
        notes: 'Pause after the number.',
        props: { number: '82%', label: 'of releases shipped on the day they merged' },
      },
      {
        id: 'trend',
        title: 'Releases per month',
        layout: 'free',
        blocks: [
          { type: 'heading', level: 2, text: 'Releases per month' },
          {
            type: 'component',
            component: 'charts-bar',
            step: 1,
            props: {
              title: 'Releases per month',
              description: 'Releases grew from 12 in January to 31 in March.',
              series: [
                {
                  id: 'releases',
                  label: 'Releases',
                  points: [
                    { x: 'Jan', y: 12 },
                    { x: 'Feb', y: 22 },
                    { x: 'Mar', y: 31 },
                  ],
                },
              ],
            },
          },
        ],
      },
    ],
  };
</script>

<DeckStage {deck} />
```

The first slide uses the `title-hero` layout, the second `big-stat`, and the
third is a free slide whose bar chart appears on the first step. The stage
validates at the `untrusted` tier by default, so a deck an agent wrote is
safe to pass as is. `DeckStage` also accepts a deck in an earlier shape (a
model v1 deck, a catalog grammar tree, a Protoyard deck) and migrates it
first.

### A Markdown deck

`parseDeckMarkdown` from `@texuli/deck/markdown` reads the same deck from
Markdown. Pass the stage's `validateDeckBlock` so block bodies get the
stage's own checks, and every issue comes back with its line and column.

```svelte
<script lang="ts">
  import '@texuli/slides/styles.css';
  import { parseDeckMarkdown } from '@texuli/deck/markdown';
  import { DeckStage, validateDeckBlock } from '@texuli/slides/stage';

  const source = `---
title: Quarterly update
locale: en
theme: ocean
---

<!-- .slide: id=opening layout=title-hero -->

# Quarterly update

Fictional numbers for Northwind

---

## Three priorities

- Ship smaller changes <!-- .element: fragment -->
- Measure lead time <!-- .element: fragment -->

Note: Keep it short.
`;

  const result = parseDeckMarkdown(source, { validateBlock: validateDeckBlock });
</script>

{#if result.ok && result.deck}
  <DeckStage deck={result.deck} />
{:else}
  <ul>
    {#each result.issues as issue}
      <li>{issue.source?.line}:{issue.source?.column} {issue.message}</li>
    {/each}
  </ul>
{/if}
```

`---` separates slides, `Note:` starts the speaker notes, and the fragment
comments reveal the list one item per step. The dialect also has `--`
vertical stacks, `layout="<id>"` with `:::` regions for every layout, code
steps (`[1-2|4-6]`), `$$` math and `::: component <catalog-id>` fences. It
takes the Markdown syntax of reveal.js as an inspiration, but it is not
compatible with it: raw HTML, iframes, `class`, `style` and event handlers
are refused with a diagnostic. `deckToMarkdown` writes a deck back as
canonical Markdown. The dialect is documented with `@texuli/deck`.

## Features

- **Canvas.** Every slide is painted on a fixed virtual canvas (1280 × 720
  for 16:9; also 4:3, 9:16 and 1:1) and scaled into the host box or the
  window, so a slide looks the same on a phone, a laptop and a projector.
- **Routes.** `#/<slide>/<step>` follows every move (with `replaceState`),
  so a link opens a slide at a step. Only one stage on a page owns the hash.
- **Input.** Keys, a click on the slide, touch swipes and the toolbar run
  the same actions (the engine's controls registry). Vertical stacks
  (outline sections with `stack: true`, `--` in Markdown) are walked in
  order: the steps, then the stack, then the next slide.
- **Chrome.** A toolbar that folds into “More” when it does not fit, a
  slide list, a progress bar, blackout, a laser pointer, copy link, print,
  a controls and shortcuts dialog, a first-visit hint and a full screen
  overlay. Every string can be overridden through `messages`.
- **Overview.** A thumbnail grid of every slide, by keyboard or pointer.
- **Presenter.** A presenter layout beside the slides (notes, up next,
  timers) and a presenter window: a second same-origin window linked to the
  stage over a closed protocol. When the browser blocks the window, the
  presenter view stays on the page and says why.
- **21 layouts.** Title hero, section divider, two-column split, three-column
  cards, image and video left, right, centered and full bleed, quote, code
  with callout, big stat, comparison table, process steps, timeline, team
  avatars, closing call to action, chart, and free blocks with the eight v1
  masters ([layouts.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/layouts.md)).
- **Backgrounds.** 13 presets, hex colors, angled gradients, images and
  video, with a scrim that keeps slide text at a contrast of at least 4.5:1.
- **Steps and motion.** Fragments with eight effects and a highlight tone,
  code highlight steps, step labels, and the transitions `none`, `fade`,
  `fade-up`, `slide`, `zoom` and `morph`, all of which cut or fade under
  reduced motion.
- **Any component on a slide.** Every `@texuli/blocks` family and every
  slide-renderable catalog component (charts, data views, media, chat
  display, workflow graphs, sortable lists, controls and forms), loaded
  lazily, at the host's trust tier
  ([components.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/components.md)).
- **Math.** `$$` block math in an owned TeX subset, painted as MathML Core.
- **Print and PDF.** A print view with one page per visible slide, sized to
  the canvas, with optional notes pages; the browser saves it as PDF.
- **PPTX.** A local, deterministic PowerPoint export: text and tables as
  editable PowerPoint content, images and charts as pictures the host
  supplies, and a report of everything it leaves out
  ([export.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/export.md)).

Not built: a presenter screen on another device, a server-side PDF or image
renderer, deck video export, inline `$…$` math inside text blocks, and a
public subpath for configuring the default component registry (see
[components.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/components.md)).

## What's inside

| Subpath | What it does |
| --- | --- |
| `@texuli/slides/stage` | `DeckStage` (model v2 and v1), `DeckPrint` (v1), the chrome, overview and presenter components, preparation (`prepareDeck`, `validateDeckBlock`), routing, steps, renderers, themes, transitions and the v1 presenter sync |
| `@texuli/slides/stage-core` | `DeckStageCore`: the same stage with no reference to the default renderer tables, for hosts that bring every renderer (their build emits none of the defaults' chunks or CSS), and the rest of `./stage` except `DeckStage`, `DeckPrint` and the default-table loaders ([stage.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/stage.md)) |
| `@texuli/slides/export` | Print plans and flags, `DeckPrintView` for v2 decks, the PDF seam, PPTX for v1 and v2 decks, and the owned XML and ZIP writers |
| `@texuli/slides/styles.css` | Stage and print styles, named print pages and reduced-motion rules |
| `@texuli/slides/model` | The model v1 (`0.3.0`) deck: `parseDeck`, masters, slots and reveal steps, kept for existing decks |
| `@texuli/slides/grammar` | Catalog encodings of model v1 decks and their `validateDeckDraft` |
| `@texuli/slides/templates` | The three model v1 starter decks (report, pitch, review) |

The root entry, `@texuli/slides`, re-exports the model v1 API, the grammar,
the templates and the main export functions. New code builds v2 decks with
`@texuli/deck`: `parseDeck` and `loadUntrustedDeck` (`/model`),
`parseDeckMarkdown` (`/markdown`), the typed builder and brief outlines
(`/authoring`) and nine starter templates (`/templates`).

## Key guarantees

- **Validated before paint.** Every deck goes through migration and
  `parseDeck` with the stage's block and component checks; every issue has a
  code, a JSON path (or a Markdown line and column) and a fix. An invalid
  deck shows its diagnostics and is never painted.
- **No HTML sinks.** Text is painted as text. The Markdown dialect refuses
  HTML, and no deck field reaches `innerHTML`.
- **URL policy at paint.** Every link and media source passes
  `safeHref`, `safeImageSrc` or `safeMediaSrc` at the host's tier
  (`untrusted` by default); the deck never carries its own tier.
- **Read-only by default.** Components that change data (sortable lists,
  board moves, workflow editing, embeds, form submits) need a capability the
  host grants; interactive blocks keep their state in memory.
- **Bounded work.** At most three slides are mounted, content families load
  only for mounted slides, and the 200-slide deck limit is covered by
  performance tests.
- **Keyboard and screen readers.** A documented key map, a polite live
  region for the slide and step, focus that follows the incoming slide,
  reduced motion and forced colors
  ([stage.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/stage.md)).
- **Local, deterministic export.** Print and PPTX upload nothing; the same
  deck always gives the same PPTX bytes.

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it:

- `@texuli/slides/stage-core` (`DeckStageCore`): the stage with no
  reference to the default renderer tables (G72); `DeckStage` is the core
  with the defaults set.
- `loadDeckMigration` and `loadedDeckMigration` on `@texuli/slides/stage`
  (G73), a `tools` toolbar snippet (G82), and prepared decks:
  `prepareDeckV2`, `isPreparedDeck` and `PreparedDeckOk`, painted at the
  `developer` tier without migrating or validating again (G83)
  ([stage](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/stage.md)).
- `@texuli/slides/export`: `preloadDeckPrintView` (G81), and print
  isolation only while a print view with `isolate` is mounted (G80)
  ([export](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/export.md)).
- Server builds keep slide content: the stage preloads its default
  renderers through the package's `#deck-ssr` import.
- **Breaking:** transitions and v2 fragments play through
  `@texuli/core/motion`; the `tx-deck-slide-*` CSS keyframes are gone.

## Documentation

- Website: [texuli.com](https://texuli.com) and the
  [slides page](https://texuli.com/slides-page/), with live JSON and Markdown
  editors
- Stage, keyboard, chrome and presenter: [stage.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/stage.md)
- The 21 layouts and their renderers: [layouts.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/layouts.md)
- Components on slides: [components.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/components.md)
- Print, PDF and PPTX export: [export.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/export.md)
- Stylesheet hooks: [styles.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/styles.md)
- Upgrading from `0.3.0`: [migration.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/migration.md)
- Model v1 decks (`0.3.0`): [model.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/model.md)
- Catalog grammar and agent decks: [grammar.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/grammar.md)
- Model v1 starter templates: [templates.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/templates.md)

## Related packages

- [`@texuli/deck`](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/README.md): the deck model, Markdown dialect, engine and authoring (in development, first published in `0.4.0`).
- [`@texuli/blocks`](https://www.npmjs.com/package/@texuli/blocks): the content blocks free slides are made of.
- [`@texuli/player`](https://www.npmjs.com/package/@texuli/player): paints the catalog components on slides, and paints deck blueprints as a document.
- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the validation that agent decks and slide components pass.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-slides).
