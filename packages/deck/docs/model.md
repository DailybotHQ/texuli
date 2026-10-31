# Deck model v2 (`@texuli/deck/model`)

The canonical deck document of `@texuli/deck` (ADR-009). One definition,
built on the owned [schema kit](schema.md), gives all-issues validation, the
TypeScript types and a JSON Schema 2020-12 export. Everything here is data
and pure functions: no Svelte, no DOM, no fetching, and no function throws on
bad input.

> **Status:** in development; `@texuli/deck` is on npm from `0.4.0`. The
> `@texuli/slides` `0.3.0` uses the previous deck model; migrate those
> decks with `migrateDeck` (below).

```ts
import { loadUntrustedDeck, migrateDeck, parseDeck } from '@texuli/deck/model';
```

The root import `@texuli/deck` re-exports everything on this page together
with the [schema kit](schema.md).

## The document

```json
{
  "formatVersion": 2,
  "meta": { "title": "Quarterly review", "locale": "en", "dir": "ltr" },
  "style": { "theme": "nord", "aspect": "16:9", "transition": "slide", "background": "solid-color" },
  "navigation": { "start": "opening", "loop": false, "autoSlideMs": 0 },
  "outline": {
    "title": "Agenda",
    "sections": [{ "id": "intro", "title": "Introduction", "slideIds": ["opening", "numbers"] }]
  },
  "slides": [
    {
      "id": "opening",
      "layout": "title-hero",
      "props": { "title": "Quarterly review", "subtitle": "What shipped and what is next" },
      "notes": "Welcome everyone and set the agenda for the next twenty minutes."
    },
    {
      "id": "numbers",
      "layout": "free",
      "master": "content",
      "blocks": [
        { "type": "heading", "level": 2, "text": "Numbers" },
        { "type": "list", "items": [{ "text": "Lead time down" }, { "text": "Rollbacks rare" }], "step": 1 }
      ]
    }
  ]
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `formatVersion` | `2` | Required. Any other value is `unsupported-version`; convert older decks with `migrateDeck`. |
| `meta` | object | Required. `title` (1 to 200 code points), optional `description` (500), `locale` (BCP 47, `LOCALE_PATTERN`, at most 35), `dir` (`DECK_DIRECTIONS`, type `DeckDirection`: `ltr`, `rtl`, `auto`; default `auto`), `author` (120), `date` (ISO `YYYY-MM-DD`, `ISO_DATE_PATTERN`). |
| `style` | object | Optional; see [Style and themes](#style-and-themes). |
| `navigation` | object | Optional. `start` (a visible slide id), `loop` (default `false`), `autoSlideMs` (`0` is off, otherwise 1,000 to 600,000). |
| `outline` | object | Optional. `title` (120) and 1 to 200 `sections`; each section has an `id`, an optional `title` (120), 1 to 200 `slideIds` and an optional `stack: true` (a vertical stack). |
| `slides` | array | Required. 1 to 200 slides, told apart by `layout`. |
| `designSystem` | object | Optional (from `0.10.0`). The design system the deck follows; see [Design systems](#design-systems). |

Lengths count Unicode code points. Single-line strings are trimmed and
refuse control, line-break and bidi-override characters; notes and code are
multi-line.

### Limits

`DECK_MODEL_LIMITS` holds every deck-level bound:

| Key | Value |
| --- | --- |
| `slides` | 200 |
| `sections` | 200 |
| `sectionSlides` | 200 |
| `titleLength` | 200 |
| `descriptionLength` | 500 |
| `authorLength` | 120 |
| `outlineTitleLength` | 120 |
| `notesLength` | 6,000 |
| `stepLabels` | 32 |
| `stepLabelLength` | 80 |
| `freeBlocks` | 2,000 |
| `autoSlideMinMs` | 1,000 |
| `autoSlideMaxMs` | 600,000 |

`BLOCK_JSON_LIMITS` bounds one free-slide item (depth 12, 100 keys, 2,000
items, 300,000-code-point strings for a base64 image, 64-character keys).
`MAX_SLIDE_STEPS` (32) is the most distinct steps a slide may have, and
`MAX_AUTHORED_STEP` (1,000) the largest authored step number.

### Shared syntax

From `shared.ts`, used by every part of the model:

- `SLIDE_ID_PATTERN` and the `slideId` schema: slide, section and block ids
  are lowercase slugs of 1 to 64 characters (`isSlideId` tests one).
- `line(max, min?)` and `multiline(max)`: the single-line and multi-line
  string schemas.
- `MEDIA_SRC_PATTERN` and `mediaSrc`: an `https:` URL (no `.svg`), a relative
  path without `..`, backslashes or `.svg`, a base64 `data:` raster. The SVG
  refusal ignores letter case (`.SVG`, `.Svg`) and sees a percent-encoded dot
  or end marker (`%2esvg`, `.svg%3F`, `.svg%23`)
  (`png`, `jpeg`, `gif`, `webp`, `avif`) or video (`mp4`, `webm`), or an
  `avatar:av-NNN` id.
- `LINK_HREF_PATTERN` and `linkHref`: `https:`, `mailto:`, a `#fragment`,
  the deck's own route (`#/<slide-id>` or `#/<slide-id>/<step>`, step 0 to
  32, as the engine's `parseDeckHash` reads it) or a relative path (no `//`,
  no `..`). Any other `#/…` path stays refused.
- `boundedProps` (`t.json` with depth 4) and `componentProps` (depth 8,
  2,000 items per array, so data views and workflow graphs fit).
- `FRAGMENT_EFFECTS`, `BLOCK_REVEALS`, `FRAGMENT_TONES` and `stepFields`
  (see [Fragments and steps](#fragments-and-steps)), with the types
  `FragmentEffect`, `BlockReveal` and `FragmentTone`.
- `DECK_TRANSITIONS` and `deckTransition` (type `DeckTransition`),
  `DECK_ASPECTS` (type `DeckAspect`) and `DECK_CANVAS`, the fixed virtual
  canvas per aspect: 16:9 is 1280×720, 4:3 is 1024×768, 9:16 is 720×1280 and
  1:1 is 1080×1080.

The engine checks syntax only. The deck never names a trust tier: the stage
applies `@texuli/core/url-policy` (`safeHref`, `safeImageSrc`,
`safeMediaSrc`) at the host's tier when it paints, `untrusted` by default.

## Slides

Every slide shares the base fields (type `SlideBase`):

| Field | Rules |
| --- | --- |
| `id` | Required slide id; unique across slides and sections. |
| `title` | Optional, 200 code points. |
| `notes` | Optional speaker notes, multi-line, at most 6,000 code points. |
| `hidden` | Hidden slides stay out of navigation and print unless the host asks. |
| `background` | A background preset id or spec; overrides `style.background`. |
| `transition` | The transition into this slide; overrides `style.transition`. |
| `theme` | A theme reference for this slide. |
| `steps` | Up to 32 step labels of 80 code points: `steps[i]` names step `i + 1`. |

`layout` picks the slide kind. `DECK_SLIDE_LAYOUTS` lists every value a slide
may carry: the 20 catalog layouts plus the three kinds in `DECK_SLIDE_KINDS`
(type `DeckSlideKind`). `isSlideLayout` tests one; an unknown value is a
single `unknown-layout` issue.

- **Catalog layouts** (`LayoutSlide`): `layout` names one of the 20 layouts
  and `props` follows its strict schema.
- **`free`** (`FreeSlide`, schema `freeSlide`): up to 2,000 `blocks` and an
  optional `master` (`SLIDE_MASTERS`, type `SlideMasterId`: `title`,
  `section`, `content`, `two-column`, `media-left`, `media-right`, `quote`,
  `closing`; default `content`).
- **`component`** (`ComponentSlide`, schema `componentSlide`): one
  whole-slide catalog component, `{ "component": { "component": "<id>", "props": {} } }`.
- **`custom`** (`CustomSlide`, schema `customSlide`): a slide painted by a
  host-registered component, `{ "props": { "component": "<slug>", "data": {} } }`;
  a placeholder without one. Lint warns that it may not travel with the deck.

`DeckSlide` is the union of the four, `deckSlide` its schema, and
`DeckSlideLayout` the type of `layout`.

### Free-slide items

A free slide holds blocks and component items (`SlideItem`, schema
`slideItem`):

- A **block** (`SlideBlock`) is any `@texuli/blocks` block. This L0 package
  checks only a bounded JSON object with a block head: `type` (a lowercase
  slug, `BLOCK_TYPE_PATTERN`), an optional `id`, the step fields and a `tone`
  (`BLOCK_TONES`: `neutral` plus the fragment tones). Nested blocks in the
  containers named by `BLOCK_CONTAINERS` (`blocks`, `children`, `columns`,
  `panels[].blocks`) get the same head check; `forEachNested` visits them.
  The block body is the host's to validate (the `validateBlock` hook).
- A **component item** (`SlideComponentItem`, schema `componentItem`):
  `{ "type": "component", "component": "<id>", "props": {}, "height": "md" }`,
  where `component` matches `COMPONENT_ID_PATTERN` and `height` is one of
  `COMPONENT_HEIGHTS` (`sm`, `md`, `lg`, `fill`). Props are bounded JSON; the
  host registry validates them at its tier.

`JsonObject` is the plain JSON object type the item types build on.
`STEP_FIELD_KEYS` (`step`, `fragment`, `reveal`) names the step fields that
`stripStepFields` removes, at every nesting level, before a block reaches the
host block parser.

### Layouts

The layout catalog (`DECK_LAYOUTS`, type `DeckLayoutCatalog`) has the 20
props layouts in `DECK_CATALOG_LAYOUT_IDS` (type `DeckCatalogLayoutId`) and
`free`, together `DECK_LAYOUT_IDS` (type `DeckLayoutId`). Each entry
(`DeckLayoutEntry` for props layouts, `DeckFreeLayoutEntry` for `free`,
`DeckLayoutCatalogEntry` for either) carries a `label`, a `description`,
`useWhen` and `dontUseWhen` guidance, its `pacing` (`LAYOUT_PACING`, type
`LayoutPacing`: `punch`, `idea`, `diagram`, `story`), human-readable `limits`
(`LayoutLimits`), the `steppable` paths, the props schema and a valid
`sample` with fictional data. `LayoutProps` maps each id to its validated
props type.

| Layout | Label | Pacing | Steppable paths | Limits |
| --- | --- | --- | --- | --- |
| `title-hero` | Title hero | punch, story | (props) | title 1–100 characters; optional subtitle and meta, 160 characters each |
| `section-divider` | Section divider | punch | (props) | title 1–120 characters; optional eyebrow, 80 characters |
| `two-column-split` | Two-column split | idea, diagram | (props), `left`, `right` | exactly two columns; body 1–600 characters each; optional heading, 80 |
| `three-column-cards` | Three-column cards | idea, diagram | (props), `cards.*` | exactly 3 cards; heading 1–80, body 1–280 characters; optional icon name |
| `image-left` | Image left | idea, diagram | (props), `image` | one image with alt text; body 1–600 characters |
| `image-right` | Image right | idea, story | (props), `image` | one image with alt text; body 1–600 characters |
| `image-centered` | Image centered | diagram, punch | (props), `image` | one image with alt text; optional caption, 200 characters |
| `image-full-bleed` | Image full bleed | punch, story | (props), `image` | one image with alt text; optional caption (200) and credit (160) |
| `quote` | Quote | punch, story | (props) | quote 1–280 characters; optional cite, 120 characters |
| `code-with-callout` | Code with callout | diagram, idea | (props), `code` | source 1–8,000 characters, kept verbatim; 1–6 bullets of up to 200 characters; up to 16 highlight ranges, each revealed as a step |
| `big-stat` | Big stat | punch | (props) | number 1–32 characters; label 1–200 characters; optional context and source |
| `comparison-table` | Comparison table | diagram, idea | (props), `rows.*` | 2–4 columns; 3–5 rows; every row has one value per column |
| `process-steps` | Process steps | idea, diagram | (props), `steps.*` | 3–5 steps; title 1–80, optional body 200 characters |
| `timeline` | Timeline | story, diagram | (props), `events.*` | 4–8 events; time 1–40, text 1–200 characters |
| `team-avatars` | Team avatars | idea, story | (props), `people.*` | 1–8 people; name 1–80, optional role 80; optional avatar id or media source |
| `closing-cta` | Closing call to action | punch, story | (props), `cta` | title 1–120 characters; one link: label 1–60, href up to 512; optional footnote |
| `video-centered` | Video centered | diagram, story | (props), `video` | one video; optional caption, 200 characters |
| `video-left` | Video left | idea, diagram | (props), `video` | one video; body 1–600 characters |
| `video-right` | Video right | idea, story | (props), `video` | one video; body 1–600 characters |
| `chart` | Chart | diagram, idea | (props), `spec` | spec: a chart block without `type`, checked by the stage chart block parser; spec JSON: depth 6, 100 keys per object, 400 items per array; optional height (sm, md, lg) and data table |
| `free` | Free blocks | punch, idea, diagram, story | — | 1–2,000 top-level blocks; lint warns past 48; each block follows the blocks schema and may carry step fields |

Most layouts take an optional `title` prop of at most 120 code points;
`title-hero`, `section-divider` and `closing-cta` require theirs, and
`image-full-bleed`, `quote` and `big-stat` have none. Images (`image`) are
`{ src, alt, width?, height? }` (alt up to 300 code points, dimensions 1 to
4,096); videos (`video`) are
`{ src, label?, width?, height?, autoplay?, loop?, muted? }`. Layout media and
links are capped at 512 code points.

The props schemas are exported one by one: `titleHeroProps`,
`sectionDividerProps`, `twoColumnSplitProps`, `threeColumnCardsProps`,
`imageSideProps` (shared by `image-left` and `image-right`),
`imageCenteredProps`, `imageFullBleedProps` (with `overlay` from
`IMAGE_OVERLAYS`: `none`, `dark`, `light`), `quoteProps`,
`codeWithCalloutProps`, `bigStatProps`, `comparisonTableProps` (refined: one
value per column, `true`/`false`/`null` cells allowed), `processStepsProps`,
`timelineProps`, `teamAvatarsProps`, `closingCtaProps`, `videoCenteredProps`,
`videoSideProps` (shared by `video-left` and `video-right`) and `chartProps`.
The chart body is `chartSpec`: a bounded JSON object in the shape of a Texuli
chart block without `type` (`kind`, `title`, `description`, `series`,
`cells` or `points`, `props`), within `CHART_SPEC_LIMITS` (depth 6, 100 keys,
400 items, 2,000-code-point strings). The engine checks the bounds, the
`kind` syntax and the step fields; the stage validates the rest with the
chart block parser.

Catalog helpers:

- `isLayoutId` (the 21 ids) and `isCatalogLayoutId` (the 20 props layouts).
- `getDeckLayout(id)`: the entry, or `undefined`.
- `layoutPropsSchema(id)`: the props schema of a catalog layout.
- `validateLayoutProps(id, props, options?)`: a `ValidateResult` with every
  issue; `free` reports `layout-props` (it has blocks, not props) and an
  unknown id reports `unknown-layout` at the sibling `layout` path.
  `LayoutValidateOptions` adds `layoutPath` to the kit's validate options.
- `layoutSteppablePaths(id)`, `isSteppablePath(layout, path)` and
  `steppablePattern(path)` (`['cards', 2]` becomes `cards.*`).
- `layoutsJsonSchema()`: one JSON Schema document with a `$defs` entry per
  layout.
- `LAYOUT_CODES`: `unknown-layout` and `layout-props`.

## Style and themes

`style` (schema `deckStyle`, type `DeckStyle`) keeps the authored document as
written; `DECK_STYLE_DEFAULTS` holds the defaults and `resolveDeckStyle`
applies them.

| Field | Values | Default |
| --- | --- | --- |
| `theme` | A theme reference (below) | the host default |
| `fontPair` | A font pairing slug | the theme font |
| `aspect` | `16:9`, `4:3`, `9:16`, `1:1` | `16:9` |
| `density` | `DECK_DENSITIES`: `compact`, `default`, `comfortable`, `spacious` | `default` |
| `radius` | `DECK_RADII`: `none`, `small`, `medium`, `large`, `full` | `medium` |
| `motion` | `DECK_MOTIONS`: `full`, `subtle`, `none` (a ceiling) | `full` |
| `transition` | `none`, `fade`, `fade-up`, `slide`, `zoom`, `morph` | `fade` |
| `background` | A background preset id or spec | `solid-color` |
| `logo` | An image source (`logoSrc`: media syntax, 512) | none |
| `footer` | One line, 160 code points | none |
| `slideNumbers` | boolean | `true` |
| `progress` | `DECK_PROGRESS`: `none`, `top`, `bottom` | `bottom` |
| `codeTheme` | A code highlight theme slug | the stage default |
| `math` | boolean, enables TeX math | `false` |

Types: `DeckDensity`, `DeckRadius`, `DeckMotion`, `DeckProgress`.

**Theme references** (schema `deckThemeReference`, type `DeckThemeInput`) are
a catalog id shorthand (`"nord"`) or an object (schema `deckThemeObject`,
type `DeckThemeReference`), told apart by `kind`:

- `{ "kind": "catalog", "id": "nord", "mode": "dark" }`: a Texuli library
  theme;
- `{ "kind": "embedded", "theme": { … } }`: a theme object, bounded by
  `EMBEDDED_THEME_LIMITS` (depth 6, 100 keys, 64 items, 512-code-point
  strings) and validated by the stage with `defineTheme`;
- `{ "kind": "seed", "seed": 1234 }`: a palette seed from 0 to
  `DECK_THEME_SEED_MAX` (`0xffffffff`) that the stage turns into a generated
  theme.

`mode` is one of `DECK_THEME_MODES` (type `DeckThemeMode`: `light`, `dark`,
`high-contrast`, `system`). `resolveThemeMode(reference, hostMode?)` returns
the concrete mode (type `DeckResolvedThemeMode`): the reference's own, else
the host's, else `light`, so exports are deterministic. `normalizeThemeReference`
turns the shorthand into its object form. Theme, font-pair and code-theme ids
match `STYLE_SLUG_PATTERN` (schema `styleSlug`). `THEME_CODES` names
`unknown-theme-kind`, `embedded-theme` and `unknown-theme`.

**Resolving a style.** `resolveDeckStyle(style, options?)` returns a
`DeckStyleResolution`: the `ResolvedDeckStyle` with every default applied,
the concrete `mode`, the allowed `motion`, the `transition` the stage plays
(`DeckResolvedTransition`), the virtual `canvas` size, the `--tx-deck-*`
CSS variables (`cssVars`, keys of type `DeckCssVar`, prefix
`DECK_VAR_PREFIX`) and recovered `issues`. `ResolveDeckStyleOptions` takes
a slide `override`, `reducedMotion`, `hostMode`, `knownThemes`,
`knownFontPairs`, `knownCodeThemes` (unknown ids warn with the
`STYLE_CODES`) and a `path` prefix. Each field is validated on its own, so
one bad field falls back to its default without discarding the rest, and
author strings (footer, logo) never reach a CSS variable.

The tables behind the variables: `DECK_DENSITY_SCALE` (0.875, 1, 1.125,
1.25), `DECK_RADIUS_VALUES` (`0` to `9999px`), `DECK_ASPECT_RATIOS`
(`16 / 9` …), `DECK_TRANSITION_MS`, `DECK_SUBTLE_FACTOR` (0.6),
`DECK_REDUCED_MOTION_MS` (150) and `DECK_TRANSITION_CAP_MS` (400).
`resolveDeckTransition(transition, motion, reducedMotion?)` is the
two-field form of the transition rule (the full resolver is
`resolveSlideTransition`, below).

## Design systems

> **New in `0.10.0`.**

A deck may name the design system it follows
([ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface)),
with the same shape as a blueprint envelope's `designSystem` and a
document's (schema `deckDesignSystem`, type `DeckDesignSystem`):

```jsonc
{ "formatVersion": 2, "meta": { "title": "Harbor review" },
  "designSystem": { "ref": "acme@2.1.0" },       // the host resolves it
  // or: "designSystem": { "inline": { "format": "texuli/design-system", … } }
  "slides": [ /* … */ ] }
```

- **Closed:** exactly one of `ref` and `inline`; any other key is
  `unknown-key`, both or neither is `design-system`.
- **`ref`:** an exact `id@x.y.z` (an optional prerelease) or
  `texuli:<theme>` (a library theme), at most 200 characters, matching
  `DECK_DESIGN_SYSTEM_REF_PATTERN`: the blueprint's
  `$defs.designSystemReference.ref` grammar (a test compares them). A range,
  a URL or a path is `pattern`.
- **`inline`:** a JSON object bounded by `DECK_DESIGN_SYSTEM_LIMITS`
  (depth 16, 200 keys, 64 items, 360,000-code-point single-line strings);
  anything else is `design-system` (`DESIGN_SYSTEM_CODES`).

This L0 model checks the shape only. The design-system rules (AA contrast,
URL tiers, the closed vocabulary) run where the document is compiled: the
`@texuli/slides` stage resolves a `ref` through the host's `designSystems`
resolver (never a fetch), compiles lazily and applies the result to the
stage root ([stage](../../slides/docs/stage.md#design-systems)). A host can
also run `checkDesignSystemReference` from `@texuli/spec/design-system`
ahead of time. `style.theme` still applies: the design system's tokens
apply over it on the stage root. Migration carries a top-level
`designSystem` from every earlier shape unchanged, and deck Markdown holds
a `ref` in the `designSystem` frontmatter key
([markdown](markdown.md#frontmatter)); an inline document stays in JSON.

## Backgrounds

`style.background` and `slides[].background` (schema `deckBackground`, type
`DeckBackground`) take one of 13 preset ids or a spec object. `DEFAULT_DECK_BACKGROUND`
is `solid-color`.

| Preset | Spec |
| --- | --- |
| `solid-color` | `{ kind: 'solid', token: 'background' }` |
| `solid-surface` | `{ kind: 'solid', token: 'surface' }` |
| `solid-primary` | `{ kind: 'solid', token: 'primary' }` |
| `solid-accent` | `{ kind: 'solid', token: 'accent' }` |
| `solid-muted` | `{ kind: 'solid', token: 'muted' }` |
| `solid-inverse` | `{ kind: 'solid', token: 'inverse' }` |
| `gradient-brand` | `{ kind: 'gradient', gradient: 'brand' }` (primary → info) |
| `gradient-dusk` | `{ kind: 'gradient', gradient: 'dusk' }` (foreground → primary) |
| `gradient-dawn` | `{ kind: 'gradient', gradient: 'dawn' }` (warning → destructive) |
| `gradient-forest` | `{ kind: 'gradient', gradient: 'forest' }` (success → info) |
| `gradient-mist` | `{ kind: 'gradient', gradient: 'mist' }` (muted → accent → surface) |
| `pattern-dots` | `{ kind: 'pattern', pattern: 'dots' }` |
| `pattern-grid` | `{ kind: 'pattern', pattern: 'grid' }` |

`DECK_BACKGROUND_PRESETS` maps each id to its spec, `DECK_BACKGROUND_PRESET_IDS`
lists them (type `DeckBackgroundPresetId`), `deckBackgroundPreset` is the
enum schema (an unknown id is the error `unknown-background`) and
`isDeckBackgroundPreset` tests an id.

Spec objects (schema `deckBackgroundSpec`, type `DeckBackgroundSpec`, kinds
`DeckBackgroundKind`):

- `solid`: a palette `token` (`DECK_SOLID_TOKENS`, type `DeckSolidToken`) or
  a hex `color` (`HEX_COLOR_PATTERN`, `#rrggbb`), not both
  (`solid-conflict`); neither means `background`.
- `gradient`: a `gradient` from `DECK_GRADIENT_IDS` (stops in
  `DECK_GRADIENTS`, type `DeckGradient`) and an `angle` from 0 to 359
  (default `DECK_GRADIENT_ANGLE`, 135).
- `pattern`: `dots` or `grid` (`DECK_PATTERNS`, type `DeckPattern`).
- `image` or `image-full`: `src`, `alt`, `fit` (`DECK_MEDIA_FITS`: `cover`,
  `contain`), `tone` (`DECK_MEDIA_TONES`: `dark`, `light`), `overlay` (0 to
  0.9) and `position` (`DECK_MEDIA_POSITIONS`).
- `video` or `video-full`: `src`, an image `poster`, `tone`, `overlay` and
  `position`. An image kind with a video source, or the reverse, is
  `media-kind`.

No author string ever reaches CSS: colors come from the caller's palette, a
validated hex, or numbers computed by the resolver, and iframe backgrounds
are not part of the model. `BACKGROUND_CODES` names the four codes this
module raises.

**Resolving a background.** `resolveDeckBackground(background, palette, options?)`
returns a `ResolvedDeckBackground`: paint `layers` bottom to top
(`DeckBackgroundLayer`: a color, a gradient, a pattern, a media layer, a
scrim), the `textTone` and `textColor`, the `scrim` alpha and color, the
worst-case `contrast`, the `--tx-deck-bg-*` variables (`cssVars`, keys of
type `DeckBackgroundCssVar`, prefix `DECK_BG_VAR_PREFIX`) and recovered
`issues`. The palette (`DeckBackgroundPalette`) maps each of
`DECK_PALETTE_ROLES` (type `DeckPaletteRole`) to a color; the stage passes
the active theme's resolved roles. `ResolveDeckBackgroundOptions` takes a
higher `minimumContrast`, a `path` prefix and a `slideId`.

The guarantee: body text reaches WCAG AA, `DECK_TEXT_CONTRAST_MIN` (4.5:1),
over everything behind it. Gradients are checked at their stops and points
between them, patterns on their base and lines, media at the worst possible
pixel (pure black and pure white). When the background alone is not enough,
a scrim is added at the lowest alpha, in `DECK_SCRIM_STEP` (0.05) steps up to
`DECK_SCRIM_MAX` (0.9), that works; an author `overlay` only ever raises it.
Background video is always muted, looping, inline and without controls.

The contrast math is exported (sRGB hex only; outputs are lowercase
`#rrggbb`): `parseHexColor` (type `Rgb`), `toHex`, `normalizeHex`,
`opaqueColor` (composites `rgb()`/`rgba()` over a base), `relativeLuminance`,
`contrastRatio`, `compositeOver`, `sampleGradient`, `worstContrast`,
`scrimStepFor`, `inkWithScrim` and `chooseInk` (with `ChooseInkOptions`,
returning an `InkChoice` with a `TextTone`). `PURE_LIGHT` (`#ffffff`) and
`PURE_DARK` (`#000000`) are the fallback inks.

## Fragments and steps

A slide starts at step 0 (its initial state) and advances one step per
"next". Any block, component item, list, code highlight or steppable props
object may carry step fields (`stepFields`):

| Field | Values |
| --- | --- |
| `step` | Authored step number, 0 to 1,000. 0 belongs to the initial state. |
| `fragment` | One of `FRAGMENT_EFFECTS`: `in`, `fade-up`, `out`, `in-then-out`, `grow`, `shrink`, `highlight`, `strike`. |
| `reveal` | The earlier block vocabulary, `BLOCK_REVEALS`: `fade`, `fade-up`, `grow`, `highlight`, `strike` (mapped by `REVEAL_EFFECT`; `fade` is `in`). Exclusive with `fragment` (`fragment-conflict`). |
| `tone` | A highlight tone from `FRAGMENT_TONES`: `accent`, `info`, `success`, `warning`, `danger`. |

Rules, from `slideSteps`:

- Distinct non-zero authored steps are sorted and renumbered 1, 2, 3…, so
  gaps never cost an empty click.
- A `list` block with `step`: item *i* enters at `step + i`.
- A code block's `highlights` (or a props `code` object): highlight *i* at
  `step + i`, `step` defaulting to 0.
- Props markers count anywhere in `props`; a marker off the layout's
  steppable paths still counts, with a `step-unrevealed` warning. A props
  object with `fragment` or `reveal` but no `step` reveals nothing and is
  reported as the warning `step-missing` at the marker's path.
- `slide.steps` labels name steps 1… and may extend the count.
- A `custom` slide steps through its labels only.
- More than 32 distinct steps is the error `too-many-steps`.

`slideSteps(slide, options?)` returns `SlideSteps`: `count`, `initial` (0),
one `SlideStep` per state (its `index`, optional `label` and `fragments`) and
`issues` (`StepDiagnostic`, codes `StepCode` from `STEP_CODES`). Each
`SlideFragment` has a `kind` (`FragmentKind`: `block`, `item`, `highlight`,
`prop`), a slide-relative `path` and `jsonPath`, the `effect`, an optional
`tone`, the dense `step`, the `authored` step, and optionally `blockId`,
`item` and `lines`. The input is structural (`StepSource`, with
`StepSourceBlock` items and `StepMarkerFields`); `SlideStepsOptions` takes
the layout's `steppablePaths` and a `path` prefix. `slideStepCount` returns
only the count and `slideFragments` flattens the fragments.

What a fragment looks like at a step is its phase (`FRAGMENT_PHASES`, type
`FragmentPhase`): `hidden`, `visible`, `active` (effect applied: grown,
shrunk, highlighted, struck) or `gone`. `fragmentPhase(fragment, step)`
computes it, `isPhaseShown` is true for `visible` and `active`, and
`activeCodeHighlight(fragments, ownerPath, step)` returns the line range a
code block shows at a step. Hidden and gone fragments keep their layout
space; leaving the accessibility tree is the stage's job.

## Transitions and motion

The transition into a slide follows slide → deck → `fade`
(`DEFAULT_TRANSITION`). The deck's `style.motion` (`MOTION_LEVELS`, type
`MotionLevel`; default `DEFAULT_MOTION`, `full`) is a ceiling, and the
viewer's reduced-motion preference only lowers it:

- `none` motion or a `none` transition plays nothing;
- reduced motion plays a `REDUCED_FADE_MS` (150 ms) fade;
- `subtle` keeps the direction, plays `zoom` as `fade` and scales durations
  by `SUBTLE_SCALE` (0.6);
- `full` plays `TRANSITION_MS` (`fade` and `fade-up` 300, `slide` 400,
  `zoom` 350, `morph` 400);
- nothing exceeds `MAX_MOTION_MS` (400 ms).

`resolveSlideTransition(input)` takes a `SlideTransitionInput` (the slide,
the deck, and `MotionOptions`: `motion` and `reducedMotion`) and returns a
`ResolvedTransition` (`name`, `durationMs`, `requested`, `motion` and a
`TransitionReason`). `resolveDeckTransitions(deck, options?)` does every
slide (`DeckSlideTransition`); its inputs are the structural
`TransitionDeck` and `TransitionSlide`. `effectiveMotion` returns the level
after the preference. Fragments animate through `resolveFragmentMotion(effect, options?)`
(`FragmentMotionOptions`, returning a `ResolvedFragmentMotion` with a
`FragmentMotionReason`): moving effects (`fade-up`, `grow`, `shrink`) become
`in` under `none` and reduced motion, and a full fragment lasts `FRAGMENT_MS`
(300 ms). `isDeckTransition` and `isMotionLevel` test values.

## Validating: `parseDeck`

```ts
parseDeck(input: unknown, options?: ParseDeckOptions): DeckParseResult
```

1. **Structural pass:** every field, limit and union through the schema kit.
2. **Cross-field passes**, which run even when the structural pass failed, on
   a bounded plain copy, so authors see every problem at once: unique slide,
   section and block ids; sections name known slides, each slide in at most
   one section, stack sections contiguous; `navigation.start` is a visible
   slide; not every slide hidden; the steps of every slide.
3. **Host phase:** the hooks below check what this L0 package cannot know.

`DeckParseResult` has `ok` (no errors; warnings may remain), the validated
and trimmed `deck` (only when `ok`), every `issue`, the `steps` of each slide
(computed on partial input too) and `truncated`.

`ParseDeckOptions` holds the **host hooks**:

| Option | What it does |
| --- | --- |
| `validateBlock(block, path)` | Validates one top-level free-slide block (step fields removed), for example with `@texuli/blocks` `safeParseBlock`. `path` is absolute; return issues with absolute paths, or nothing. |
| `validateComponent(component, path)` | Validates a component's props with the host registry, for inline items and component slides. The input is a `DeckComponentInput` (`component`, `props`). |
| `knownComponents` | Component ids the host can paint; any other id is `unknown-component`. |
| `maxIssues` | Issues kept before `truncated` (default 200). |

A hook returns a `DeckHookResult` (diagnostics or `undefined`); a hook that
throws becomes a `block-props` or `component-props` issue, never an
exception.

`deckSchema` is the deck schema itself (type `Deck`), with `deckMeta`
(`DeckMeta`), `deckNavigation` (`DeckNavigation`), `deckOutline`
(`DeckOutline`) and `deckSection` (`DeckSection`). `DECK_FORMAT_VERSION` is
`2`. `deckJsonSchema(options?)` writes the JSON Schema 2020-12 document from
the same schemas (`DeckJsonSchemaOptions` takes an `$id`); each layout's
props is a `$defs` entry named by its id and the cross-field rules are in
`description`.

## Loading untrusted decks: `loadUntrustedDeck`

```ts
loadUntrustedDeck(input: unknown, options?: UntrustedDeckOptions): UntrustedDeckResult
```

For a deck from a share link, a pasted file, an embed message or agent
output. Cheap checks run before any deep work:

1. **JSON text:** UTF-8 size and nesting depth are scanned on the text
   (`jsonTextDepth`), then `JSON.parse`; a syntax error reports
   `invalid-json` with its line and column (`jsonErrorOffset` and
   `lineColumn`).
2. **A plain-data copy** (`copyPlainData`): no accessors, cycles, class
   instances, functions or prototype keys; hidden characters (controls,
   zero-width, bidi) are stripped with a `hidden-characters` warning.
3. **Counts:** slides and nodes under the slides.
4. **`migrateDeck`** when the input is an earlier shape, then `parseDeck`.

`UntrustedDeckOptions` takes every `ParseDeckOptions` field plus the
`UntrustedDeckLimits`; `DEFAULT_UNTRUSTED_DECK_LIMITS` are:

| Limit | Default |
| --- | --- |
| `maxBytes` | 1 MiB of UTF-8 (the text, or the copy of parsed data) |
| `maxDepth` | 32 |
| `maxNodes` | 20,000 objects and arrays under the slides |
| `maxSlides` | 200 |

`UntrustedDeckResult` is a `DeckParseResult` plus `from`, the detected input
shape. Nothing in the loader runs code, fetches or renders.

The plain-data helpers are exported: `copyPlainData(input, options?)`
(`PlainCopyOptions`: `maxDepth`, `maxBytes`, `strip`, `maxIssues`; returns a
`PlainCopyResult` with `value`, `issues`, `failed`, `truncated` and
`bytes`), `stripHiddenCharacters` and `utf8Length`.

## Migrating: `migrateDeck`

```ts
migrateDeck(input: unknown): DeckMigration
```

The input shape is detected (`detectDeckShape`), not read from a version
number. `DECK_SOURCES` (type `DeckSource`):

| Source | Detected by | Conversion |
| --- | --- | --- |
| `v2` | `formatVersion` present | Returned unchanged. |
| `texuli-v1` | `meta` plus `slides[].blocks` (the `@texuli/slides` `0.3.0` model) | Every slide becomes a lossless free slide with its master; `settings` moves to `style` and `navigation`, `startIndex` becomes a start id. |
| `texuli-grammar` | A `layout-deck` tree with `deck-slide` (or legacy `layout-card`) children | Block nodes become blocks, `charts-*` nodes chart blocks, other catalog nodes component items. |
| `protoyard` | `style` plus `slides` with `layout`, no `meta` | A title is derived, `paletteSeed` becomes a seed theme, a ChartSpec becomes a chart block body, unknown background slugs become `solid-color`. |
| `unknown` | Anything else | Returned as is, with `invalid-deck`. |

`DeckMigration` holds the v2 `deck` (unvalidated: pass it to `parseDeck`), the
`from` source and the `issues`: every judgement call is a `migrated`
warning. A top-level `designSystem` on any earlier shape is carried over
unchanged (`parseDeck` checks it). Migration is pure, idempotent and never throws. Lifting a free
slide's master to a catalog layout is a lint suggestion (`prefer-layout`),
never done here.

## Diagnostics

Every issue is a `DeckDiagnostic` (see the [schema kit](schema.md)):
`code`, `severity`, `path`, `jsonPath` (`$.slides[2].props.title`),
`pointer` (`/slides/2/props/title`), `message`, an optional `fix`, `slideId`
and, from Markdown, `source` line and column. `DeckIssue` narrows the code
to `DeckCode`, the keys of `DECK_CODES`; `DeckCodeInfo` is one row
(`severity`, `group`, `meaning`) and `isDeckCode` tests a code.

| Code | Severity | Group | Meaning |
| --- | --- | --- | --- |
| `invalid-type` | error | structure | The value has the wrong JSON type. |
| `required` | error | structure | A required key is missing. |
| `unknown-key` | error | structure | The object has a key the model does not define. |
| `too-short` | error | structure | The text is shorter than its minimum (code points). |
| `too-long` | error | structure | The text is longer than its maximum (code points). |
| `too-few` | error | structure | The list has fewer items than its minimum. |
| `too-many` | error | structure | The list, record or deck has more items than its maximum. |
| `out-of-range` | error | structure | The number is outside its allowed range. |
| `not-integer` | error | structure | The number must be a whole number. |
| `not-finite` | error | structure | NaN and Infinity are not data. |
| `pattern` | error | structure | The text does not match the required syntax. |
| `reserved` | error | structure | The value is reserved in this position. |
| `enum` | error | structure | The value is not one of the listed values. |
| `unknown-kind` | error | structure | A union `kind` names no known variant. |
| `unsafe-text` | error | structure | The text holds control, line-break or bidi-override characters. |
| `unsafe-key` | error | structure | `__proto__`, `constructor` and `prototype` are refused. |
| `too-deep` | error | structure | The value nests deeper than allowed. |
| `cycle` | error | structure | The value contains itself. |
| `too-large` | error | loader | The input is larger than the byte or node budget. |
| `invalid-input` | error | loader | The input is not plain JSON data (accessors, class instances, functions…). |
| `unknown-layout` | error | structure | The slide `layout` is not a catalog id or slide kind. |
| `layout-props` | error | structure | A layout props rule failed (e.g. comparison row width). |
| `invalid-block` | error | structure | A free-slide item is not a block shape (`type`, `id`, step fields). |
| `unknown-background` | error | style | The background preset or spec kind is unknown. |
| `solid-conflict` | error | style | A solid background sets both `token` and `color`. |
| `media-kind` | error | style | An image background has a video source, or the reverse. |
| `invalid-palette-color` | warning | style | A palette color could not be read; replaced. |
| `unknown-theme-kind` | error | style | A theme reference `kind` is not catalog, embedded or seed. |
| `embedded-theme` | error | style | An embedded theme is not an object. |
| `unknown-theme` | warning | style | The catalog theme id is unknown to the host; default used. |
| `design-system` | error | style | A design system names neither or both of `ref` and `inline`, or its inline document is not an object. |
| `unknown-font-pair` | warning | style | The font pairing is unknown to the host; theme font used. |
| `unknown-code-theme` | warning | style | The code theme is unknown to the host; default used. |
| `duplicate-id` | error | cross-field | A slide or section id is used twice. |
| `duplicate-block-id` | error | cross-field | A block id is used twice in the deck. |
| `unknown-slide` | error | cross-field | A section or `navigation.start` names no slide. |
| `section-overlap` | error | cross-field | A slide is listed in more than one section. |
| `stack-not-contiguous` | error | cross-field | A vertical-stack section lists slides that are not adjacent in `slides`. |
| `start-hidden` | error | cross-field | `navigation.start` names a hidden slide. |
| `all-hidden` | error | cross-field | Every slide is hidden; nothing would present. |
| `fragment-conflict` | error | cross-field | A step marker sets both `fragment` and `reveal`. |
| `too-many-steps` | error | cross-field | A slide has more than 32 distinct steps. |
| `step-unrevealed` | warning | cross-field | A step marker sits where the layout reveals nothing. |
| `step-missing` | warning | cross-field | A props marker sets `fragment` or `reveal` but no `step`; it is ignored. |
| `unknown-component` | error | host | The component id is not in the host registry. |
| `component-props` | error | host | The host registry refused the component props. |
| `block-props` | error | host | The host block validator refused a block. |
| `unsupported-version` | error | version | `formatVersion` is not 2. |
| `migrated` | warning | version | The input was converted to model v2; review the note. |
| `invalid-json` | error | loader | The text is not valid JSON (line and column given). |
| `hidden-characters` | warning | loader | Invisible or reordering characters were removed from a string. |
| `invalid-deck` | error | loader | The input is not a recognized deck shape. |

The Markdown dialect adds its own `md-*` codes ([markdown](markdown.md#diagnostics))
and lint adds rules ([authoring](authoring.md#lint)).

## Schema building blocks

The schemas behind the types are exported for hosts that compose their own
checks: `deckMeta`, `deckNavigation`, `deckOutline`, `deckSection`,
`deckSlide`, `freeSlide`, `componentSlide`, `customSlide`, `componentItem`,
`slideItem`, `deckStyle`, `deckThemeReference`, `deckThemeObject`,
`deckBackground`, `deckBackgroundSpec`, `deckBackgroundPreset`, `logoSrc`,
`styleSlug`, `slideId`, `mediaSrc`, `linkHref`, `deckTransition`,
`boundedProps` and `componentProps`. Pass any of them to `validate` or
`toJsonSchema` from the [schema kit](schema.md).
