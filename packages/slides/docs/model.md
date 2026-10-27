# Deck model

**Import:** `@texuli/slides/model` (also re-exported from `@texuli/slides`)  
**Source:** `packages/slides/src/model/`  
**Tests:** `tests/decks.test.ts`, `tests/stage.test.ts`,
`tests/stage-content.test.ts`

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

Titles and notes refuse control and bidi-override characters. Block `step`
and `reveal` must follow the [reveal step rules](#reveal-steps-fragments). `DECK_LIMITS`
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

The stage lays every master out into its slots (below). The `title` slot is
the slide title itself.

## Composition, slots and media regions

`composeSlide(slide)` returns a `ComposedSlide`: the resolved master and its
regions (`SlideRegion`, each a `slot` of type `SlideRegionSlot` with its
blocks) in reading order.

- **Slot masters.** `SLIDE_MASTER_CONTENT_SLOTS` is the closed list of content
  slots per master:

  | Master | Slots, in order |
  | --- | --- |
  | `title`, `content`, `closing` | `body`, `footer` |
  | `section` | `body` |
  | `two-column` | `contentStart`, `contentEnd`, `footer` |
  | `quote` | `quote`, `attribution` |
  | `media-left`, `media-right` | `body` (plus the `media` region below) |

  Top-level `divider` blocks separate the slots: blocks before the first
  divider fill the first slot, blocks after it the next, and so on. A divider
  used as a separator is not painted, and its `step` or `reveal` does
  nothing. Dividers past the last slot stay ordinary blocks, and empty slots
  are left out, so a `two-column` slide without a divider is one
  `contentStart` column. The rule needs no new block or catalog vocabulary:
  agent decks express slots with blocks they can already emit.
- **Media masters.** On `media-left` and `media-right` slides, the first
  top-level media block (`isSlideMediaBlock`) moves into a `media` region,
  before or after the `body` region. Dividers there stay ordinary blocks.
- **Image fit.** `SLIDE_REGION_FIT` sets image fit per region: `cover` in a
  media region, `contain` in every other region. An authored `fit` on the
  block wins. Nested media, such as images inside `columns`, keeps the block
  defaults.

Slots carry no per-slide or per-block assignment field: a named-slot prop on
the catalog's `deck-slide` would change the catalog and spec contract, which
this layer does not own.

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

## Reveal steps (fragments)

A slide can reveal its content one step at a time. Steps use two closed
fields every block already validates (`@texuli/blocks`): `step`, an integer
from 0 to 32, and `reveal`, a `BLOCK_REVEALS` token (`fade`, `fade-up`,
`grow`, `highlight`, `strike`). There is no free-form markup. A slide starts
at step 0 and advances to its last step, `slideStepCount(slide)`, which is 0
when nothing on it reveals.

`blockFragment(block)` returns the `DeckFragment` a top-level block declares
(its `kind`, first `step`, `lastStep` and `reveal`), or `null` for a static
block. The `DeckFragmentKind` values, in `DECK_FRAGMENT_KINDS`, are checked in
this order:

| Kind | Declared by | At step `s` |
| --- | --- | --- |
| `emphasis` | `reveal: 'highlight'` or `'strike'` | Always shown; emphasized from `s ≥ step` (no `step` means from the start) |
| `highlights` | A code block with `highlights` | Always shown; step `step + i` shows `highlights[i]` (no `step` means 0) |
| `items` | A list with a `step` | Item `i` appears at step `step + i` |
| `enter` | Any other block with `step` ≥ 1 | Hidden until `step` |

A block without a `step` (or with `step: 0`) and without an emphasis reveal
is static. Steps are absolute: two blocks with the same step reveal
together. The entrance tokens `DECK_ENTRANCE_REVEALS` (`fade`, `fade-up`,
`grow`, a `DeckEntranceReveal`, tested by `isEntranceReveal`) pick the
animation; without one, the slide's transition animates the reveal (see
[stage.md](stage.md#reveal-steps)).

`fragmentView(fragment, step)` returns the `DeckFragmentView` the stage
paints: `hidden`, the `visibleItems` of a list, the code `hostStep`,
`emphasized`, and `current` (this step revealed it, or its newest item).

`parseDeck` adds two rules the block schema cannot see, through
`checkSlideFragments(blocks)`, which returns a `DeckFragmentIssue` or `null`:

- `step` and `reveal` apply only to top-level slide blocks; on a block nested
  in `columns` or `tabs` they fail validation (the stage would not play them);
- a slide reaches at most `DECK_MAX_SLIDE_STEPS` (32) steps, so a list at step
  31 holds at most two items.

## Transitions

A slide's `transition` overrides `settings.defaultTransition`, which defaults
to `fade`. `resolveSlideTransition(deck, slide, { reducedMotion })` returns the
effective token, and always `none` under reduced motion. Transitions are
web-only styling; the stage and stylesheet apply them (see
[stage.md](stage.md) and [styles.md](styles.md)).
