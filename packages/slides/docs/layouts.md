# Layouts and their renderers

**Source:** `packages/slides/src/layouts/` (renderers),
`packages/deck/src/model/layouts/` (the catalog: ids, props, limits)  
**Tests:** `tests/layouts.test.ts` (the renderer table, every catalog
sample painted, limits, text fit, prop steps, media and links per tier, v1
masters on free slides, background contrast),
`packages/deck/tests/model-layouts.test.ts`
(the catalog and its props schemas); visual baselines `slides-layout-<id>`
(one example per layout, light and dark, desktop and Pixel 7);
`tests/e2e/a11y-slides.spec.ts`

> **Status: in development.** The layouts arrive with the next minor,
> `0.4.0`, which is in the repository and **not on npm yet**. The published
> `0.3.0` has the eight model v1 masters only ([model.md](model.md)).

A model v2 slide names its layout in `layout`. The deck engine owns the
**layout catalog** (`DECK_LAYOUTS` in `@texuli/deck/model`): 20 layouts with
strict props, plus `free`, a slide made of blocks. That is the 21 layouts.
Two more slide kinds are not catalog layouts: `component` (one catalog
component fills the slide, see [components.md](components.md)) and `custom`
(a host-registered component; a labelled placeholder without one).

Each catalog entry carries what an author or an agent needs to pick it:
a `label` and `description`, `useWhen` and `dontUseWhen` guidance, its
`pacing` fit (`punch`, `idea`, `diagram`, `story`), human-readable `limits`,
the props schema (exported as JSON Schema by `layoutsJsonSchema`), a valid
sample and the props paths a step marker may reveal
(`layoutSteppablePaths`). `validateLayoutProps(id, props)` checks props with
every issue at once.

```ts
const slide = {
  id: 'adoption',
  layout: 'big-stat',
  props: { number: '82%', label: 'of releases shipped on the day they merged' },
};
```

## The catalog

| Layout | Renderer | Required props | Steppable paths | Pacing |
| --- | --- | --- | --- | --- |
| `title-hero` | `TitleHero` | `title` (`subtitle`, `meta`) | the whole body | punch, story |
| `section-divider` | `SectionDivider` | `title` (`eyebrow`) | the whole body | punch |
| `two-column-split` | `TwoColumnSplit` | `left`, `right` (`title`) | `left`, `right` | idea, diagram |
| `three-column-cards` | `ThreeColumnCards` | `cards` (exactly 3) | each card | idea, diagram |
| `image-left` | `MediaSide` | `image`, `body` (`title`, `heading`) | `image` | idea, diagram |
| `image-right` | `MediaSide` | `image`, `body` | `image` | idea, story |
| `image-centered` | `MediaCentered` | `image` (`title`, `caption`) | `image` | diagram, punch |
| `image-full-bleed` | `ImageFullBleed` | `image` (`caption`, `credit`, `overlay`) | `image` | punch, story |
| `quote` | `Quote` | `quote` (`cite`) | the whole body | punch, story |
| `code-with-callout` | `CodeWithCallout` | `code`, `bullets` (`title`, `heading`) | `code` (each highlight range is a step) | diagram, idea |
| `big-stat` | `BigStat` | `number`, `label` (`context`, `source`) | the whole body | punch |
| `comparison-table` | `ComparisonTable` | `columns` (2–4), `rows` (3–5) | each row | diagram, idea |
| `process-steps` | `ProcessSteps` | `steps` (3–5) | each step | idea, diagram |
| `timeline` | `Timeline` | `events` (4–8) | each event | story, diagram |
| `team-avatars` | `TeamAvatars` | `people` (1–8) | each person | idea, story |
| `closing-cta` | `ClosingCta` | `title`, `cta` (`text`, `footnote`) | `cta` | punch, story |
| `video-centered` | `MediaCentered` | `video` (`title`, `caption`) | `video` | diagram, story |
| `video-left` | `MediaSide` | `video`, `body` | `video` | idea, diagram |
| `video-right` | `MediaSide` | `video`, `body` | `video` | idea, story |
| `chart` | `ChartSlide` | `spec` (`title`, `height`, `showTable`) | `spec` | diagram, idea |
| `free` | the stage's block renderer | `blocks` (up to 2,000; `master`) | any top-level block | every pacing |

A step marker (`step`, `fragment` or `reveal`) on the props object itself
reveals the whole body; on a steppable path it reveals that element.

## How the renderers work

- **Lazy.** One Svelte renderer per layout (some serve several layouts), each
  imported the first time a slide with that layout mounts or is prefetched.
  A deck with only `title-hero` slides loads only `TitleHero`.
- **Wired by default.** `DeckStage` asks the host's `renderers` first, then
  the layout table, then the component registry. A host replaces a layout by
  answering `layout` for it in its own `DeckRenderers` table (see
  [stage.md](stage.md#renderers)). The default layout table is
  `layoutRenderers`, exported from `@texuli/slides/layouts` (see
  [Import and API](#import-and-api)); the print export paint uses
  the same table.
- **One frame.** Every layout paints inside a frame that covers the slide
  body and is a size container, so the type scale follows the virtual canvas
  and reads the same on 16:9, 4:3, 9:16 and 1:1. Text uses the slide's
  background text color, which the background resolver holds at a contrast
  of at least 4.5:1; accents are decorative.
- **Text fit.** Layout CSS clamps lines first. When a title or a table is
  still too long, the renderer measures it and shrinks it in steps, down to
  floors of 24 canvas pixels for body text and 18 for labels (the same
  minimums the deck lint reads). It writes only CSSOM properties, which a
  strict CSP allows, and does nothing where layout cannot be measured (SSR,
  tests).
- **Text is text.** Props are painted as text, never as HTML. Code goes
  through the `blocks-code` family (tokenized), the chart through the
  `blocks-data` chart block, and the call to action through the `cta`
  content block.
- **URL policy at paint.** Images use the `@texuli/media` `Image` and videos
  the `VideoPlayer`, both at the host's tier (`untrusted` by default). A
  refused source shows the stage's refused-media notice in its frame. The
  call-to-action link passes `safeHref`; a refused link renders its label as
  plain text. Videos never autoplay.
- **Right to left.** The media panes, columns and cards follow the inline
  direction, so they mirror with `dir="rtl"`; reading order follows the
  layout name (media first for `-left`).
- **Messages.** The refused-media notice comes from the stage messages, so
  a host overrides it through `messages`. The few strings layouts add for
  assistive tech (“Yes”, “No” and “Not applicable” in comparison cells, the
  chart data table caption and its error) are English only for now; moving
  them into the stage messages is open.

Layout-specific behavior:

- `comparison-table` is a real table with row and column headers; `true` and
  `false` cells read “Yes” and “No” and show a check or a dash, `null` reads
  “—”.
- `team-avatars` resolves an avatar id through the host's `resolveAvatar`
  and a media source through the URL policy; without either, the person
  shows their initials.
- `timeline` wraps more than four events onto a second row, each row with
  its own axis.
- `chart` takes any Texuli chart kind as a chart block without `type`;
  `showTable` adds a plain data table under series charts. A spec the chart
  block parser refuses shows a note instead of a broken chart.
- `three-column-cards` accepts an `icon` name, but `@texuli/slides` does not
  depend on the icon set yet, so each card shows its number in the icon
  tile.

## Import and API

```ts
import { layoutRenderers } from '@texuli/slides/layouts';
```

The `@texuli/slides/layouts` subpath (in `0.4.0`, in development and not on
npm yet) exports the layout renderer table and the helpers the renderers
are built from. `DeckStage` (and the print paint) already install
`layoutRenderers` after the host's `renderers`, so a host does not need to
pass it. Import it to compose or wrap it: for example, a table that answers
`layout` for one id and delegates the rest to `layoutRenderers.layout`, or
calls `layoutRenderers.prefetch` to warm chunks ahead of time. The
renderer components themselves are not exported; they load through the
table.

| Export | Kind | What it is |
| --- | --- | --- |
| `layoutRenderers` | `DeckRenderers` | The frozen layouts table for `DeckStage` (`renderers={layoutRenderers}`): `layout(slide)` returns the lazy renderer for a catalog layout id (else `undefined`), `prefetch(slide)` loads its chunk. |
| `LAYOUT_RENDERER_ENTRIES` | `Readonly<Record<DeckCatalogLayoutId, DeckLazyRenderer>>` | One lazy renderer (`{ load }`) per catalog layout; `MediaSide` and `MediaCentered` serve several ids. |
| `LAYOUT_RENDERER_IDS` | `readonly DeckCatalogLayoutId[]` | The 20 layout ids the table renders (every catalog layout except `free`). |
| `LAYOUT_TEXT_MINIMUMS` | constant | `{ bodyPx: 24, labelPx: 18 }`: the canvas-pixel floors text fit never goes below (the deck lint reads the same numbers). |
| `fitScale` | `(needed, available, min) => number` | The zoom that fits `needed` px into `available` px, between `min` and 1; 1 for invalid sizes or an overflow of 2 px or less. |
| `fitFontSize` | `(start, minPx, overflows) => number` | Steps a font size down 6 % at a time from `start` while `overflows(size)` is true, stopping at `minPx` (at most 40 steps). |
| `textOverflows` | `(node, fontSize) => boolean` | True when a box's scroll size exceeds its client size by more than half a line (at least 4 px). |
| `fitText` | `(minPx) => (node) => cleanup` | An attachment that shrinks one text element's font size until it fits, never below `minPx`; re-measures on resize, load and DOM changes; writes `style.fontSize` and `data-tx-deck-fit`. |
| `fitContent` | `(min = 0.75) => (node) => cleanup` | An attachment that zooms an element (CSS `zoom`) until its content fits its box, never below `min`; writes `style.zoom` and `data-tx-deck-fit`. Both attachments do nothing without `requestAnimationFrame` (SSR). |
| `LAYOUT_MEDIA_DEFAULT_SIZE` | constant | `{ width: 1280, height: 720 }`: the size a layout image or video assumes without author dimensions. |
| `avatarId` | `(value) => string \| undefined` | The avatar id in `av-001` or `avatar:av-001`, else `undefined`. |
| `layoutImageSrc` | `(src, tier, resolveAvatar?) => string \| undefined` | The image URL a layout may paint at the tier: avatar ids through the host adapter, other sources through the `@texuli/media` image resolver (`safeImageSrc`); `undefined` when refused. |
| `layoutVideoSrc` | `(src, tier) => { src: string \| undefined }` | The video URL through the `@texuli/media` video resolver (`safeMediaSrc`); `src` is `undefined` when refused. |
| `layoutCodeBlock` | `({ lang, source, highlights? }) => Block \| null` | The `code` block of `code-with-callout`, checked by the block schema (`null` when refused). |
| `layoutChartBlock` | `(spec) => Block \| null` | The `chart` block of the `chart` layout: the spec without its step fields, typed `chart`, schema-checked. |
| `layoutCtaBlock` | `({ label, href }) => Block \| null` | The `cta` block of `closing-cta`, or `null` when the block schema refuses the href. |
| `initials` | `(name) => string` | Up to two uppercase initials by code point (`Ada Example` → `AE`). |
| `DECK_LAYOUT_MESSAGES` | constant | The English strings layouts add for assistive tech (`layout.yes`, `layout.no`, `layout.empty`, `layout.chartTable`, `layout.chartInvalid`, `layout.video`); not localizable yet. |
| `DeckLayoutMessageKey` | type | A key of `DECK_LAYOUT_MESSAGES`. |
| `layoutMessage` | `(key, values?) => string` | A layout string with its `{name}` placeholders filled from `values` (unknown names stay as written). |
| `PropPath` | type | `readonly (string \| number)[]`: a path relative to the slide's `props` (`['cards', 1]`, `[]` for the whole body). |
| `LayoutSteps` | interface | `at(path)` returns the fragment attributes for a props object (`{}` when not stepped); `highlight(path)` the current code highlight index, or `undefined`. |
| `layoutSteps` | `(step) => LayoutSteps` | Step helpers over a `DeckStepContext`; without one (a thumbnail, print) nothing is stepped. |
| `useLayoutSteps` | `(read) => LayoutSteps` | The step helpers of the slide being rendered: the stage's step context, else `read().step`. Call it while a component initializes (it reads a Svelte context). |
| `LayoutSlideOf` | `type LayoutSlideOf<Id>` | A catalog layout slide narrowed to one layout id (`layout: Id`, `props: LayoutProps[Id]`). |
| `LayoutRendererProps` | `interface LayoutRendererProps<Id>` | The props every layout renderer receives: `slide: LayoutSlideOf<Id>` and `context: DeckSlideRenderContext`. |

## Free slides and masters

A `free` slide holds blocks (any `@texuli/blocks` block, `math` blocks and
component items) and arranges them with one of the eight model v1 masters
(`master`, default `content`): `title`, `section`, `content`, `two-column`,
`media-left`, `media-right`, `quote` and `closing`. Top-level `divider`
blocks split the content into the master's slots, as in model v1
([model.md](model.md#composition-slots-and-media-regions)). A migrated v1
deck is all free slides, so it keeps its look.

## Backgrounds

Every slide kind takes a `background` (and the deck a default in
`style.background`): one of 13 presets (`solid-color`, `solid-surface`,
`solid-primary`, `solid-accent`, `solid-muted`, `solid-inverse`,
`gradient-brand`, `gradient-dusk`, `gradient-dawn`, `gradient-forest`,
`gradient-mist`, `pattern-dots`, `pattern-grid`) or a spec: a hex color, an
angled gradient, an image or a video. The stage paints the layers (base,
gradient or pattern, media, scrim) from `resolveDeckBackground` in
`@texuli/deck/model`, and the scrim is chosen so slide text keeps a contrast
of at least 4.5:1 against the worst point of the background (tested for
every library theme in light and dark). Image and video
sources pass the URL policy at the host's tier. The `slides-backgrounds`
example paints all 13 presets and one spec of each kind.

## Examples

The examples registry renders each layout on the stage
(`slides-layout-<id>`, for example `slides-layout-big-stat`), with committed
light and dark baselines on desktop Chromium and the Pixel 7.
