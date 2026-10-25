# Deck model

**Import:** `@texuli/slides/model` (also re-exported from `@texuli/slides`)  
**Source:** `packages/slides/src/model/`  
**Tests:** `tests/deck.test.ts`, `tests/transitions.test.ts`, `tests/media.test.ts`

The framework-free deck model: validation, the closed vocabularies (aspects,
masters, transitions), theme references, and the pure helpers the stage, the
grammar and the exporters share. Nothing here touches the DOM.

## Parsing a deck

```ts
import { parseDeck, resolveSlideMaster, resolveSlideTheme } from '@texuli/slides/model';

const result = parseDeck({
  meta: { title: 'Quarterly update', aspect: '16:9', themeRef: 'ocean' },
  masters: ['title', 'content'],
  slides: [
    {
      id: 'opening',
      title: 'Quarterly update',
      master: 'title',
      blocks: [{ type: 'heading', level: 2, text: 'Three priorities' }],
    },
  ],
});

if (result.success) {
  const slide = result.deck.slides[0];
  if (slide) {
    const layout = resolveSlideMaster(slide.master);
    const themeRef = resolveSlideTheme(result.deck, slide);
    console.log(layout.arrangement, layout.slots, themeRef);
  }
}
```

`parseDeck(input)` accepts unknown input and returns a `DeckParseResult`:
either `{ success: true, deck, issues: [] }` or `{ success: false, deck: null,
issues }`. Each `DeckIssue` has a `path` (such as `slides[2].master`) and a
`message`. It never throws.

A `Deck` holds:

- `meta` (`DeckMetadata`): a plain-text `title`, optional `description`, a
  `locale` language tag (`en`, `en-GB`), the `aspect` (`DeckAspect`, default
  `16:9`) and an optional deck `themeRef`;
- `masters`: the built-in master ids the slides may use;
- `slides`: ordered `DeckSlide` objects, each with a unique `id` (lowercase
  letters, digits and hyphens), an optional plain-text `title` and multi-line
  `notes`, an optional `master`, `themeRef` and `transition`, and `blocks`
  validated by `@texuli/blocks`;
- `settings` (`DeckSettings`): `startIndex`, `loop`, `showProgress` and
  `defaultTransition`, normalized with defaults.

Titles and notes refuse control and bidi-override characters. `DECK_LIMITS`
publishes the bounds: 120 slides, 48-character slide ids, 200-character
titles, 500-character descriptions, 6,000-character notes and 2,000 blocks
per slide.

## Vocabularies

| Constant | Values |
| --- | --- |
| `DECK_ASPECTS` | `16:9`, `4:3`, `1:1` (`DeckAspect`) |
| `SLIDE_MASTERS` | `title`, `section`, `content`, `two-column`, `media-left`, `media-right`, `quote`, `closing` (`SlideMasterId`) |
| `DECK_TRANSITIONS` | `none`, `fade`, `fade-up` (`DeckTransition`) |
| `SLIDE_MEDIA_TYPES` | `image`, `figure`, `video`, `gallery` (`SlideMediaType`) |

Any other value fails validation.

## Masters

A slide may only reference a master listed in the deck's `masters`; unknown
and undeclared references fail validation. A slide without a master resolves
to `content`. `resolveSlideMaster(id)` returns a `SlideMasterLayout` from
`SLIDE_MASTER_LAYOUTS`: the `SlideMasterArrangement` (`centered`, `stack`,
`split`, `media-start`, `media-end`, `quotation`) and its named slots
(`SlideMasterSlot`: `title`, `body`, `contentStart`, `contentEnd`, `media`,
`quote`, `attribution`, `footer`).

The stage composes only the media masters into regions today (below). The
other slots are model data that the stage does not lay out yet.

## Composition and media regions

`composeSlide(slide)` returns a `ComposedSlide`: the resolved master and its
regions (`SlideRegion`, each a `slot` of `media` or `body` with its blocks) in
reading order.

- On `media-left` and `media-right` slides, the first top-level media block
  (`isSlideMediaBlock`) moves into a `media` region, before or after the
  `body` region.
- Every other master keeps one `body` region.
- `SLIDE_REGION_FIT` sets image fit per region: `cover` in a media region,
  `contain` in the body. An authored `fit` on the block wins. Nested media,
  such as images inside `columns`, keeps the block defaults.

The slide is not mutated.

## Theme references

`meta.themeRef` sets the deck default, and a slide's `themeRef` replaces it.
`resolveSlideTheme(deck, slide)` returns the effective reference. A
`DeckThemeReference` is a catalog id string or an object:

```ts
{ kind: 'catalog', id: 'ocean', mode: 'dark' }
{ kind: 'embedded', theme: validatedTheme, mode: 'light' }
```

Catalog ids are checked only for the safe id syntax; the parser does not load
the theme library to confirm that an id exists. Embedded themes pass through
`defineTheme` from `@texuli/tokens/contract`. The optional `DeckThemeMode` is
`light`, `dark`, `high-contrast` or `system`. The stage resolves and applies
references (see [stage.md](stage.md)).

## Transitions

A slide's `transition` overrides `settings.defaultTransition`, which defaults
to `fade`. `resolveSlideTransition(deck, slide, { reducedMotion })` returns the
effective token, and always `none` under reduced motion. Transitions are
web-only styling; the stage and stylesheet apply them (see
[stage.md](stage.md) and [styles.md](styles.md)).
