# Authoring (`@texuli/deck/authoring`)

Tools for people and agents who write decks: a typed builder, deterministic
layout selection, brief outlines that draft a deck, quality lint and bounded
RFC 6902 JSON Patch (ADR-009). Everything is pure and deterministic; the same
input always gives the same deck.

> **Status:** in the repository as `@texuli/deck` `0.4.0`, not on npm.

## Builder

```ts
import { deck, slide } from '@texuli/deck/authoring';

const result = deck({ title: 'Launch plan', locale: 'en' }, { style: { theme: 'nord' } })
  .slide(
    slide.titleHero(
      { title: 'Launch plan', subtitle: 'Three weeks to release' },
      { id: 'opening', notes: 'Introduce the plan, the team and what we need today.' }
    )
  )
  .slide(
    slide.bigStat(
      { number: '3', label: 'weeks from beta to general availability' },
      { id: 'timing', notes: 'The date is fixed; the scope can still move.' }
    )
  )
  .build();

if (result.ok) console.log(result.deck.slides.length); // 2
else console.log(result.diagnostics);
```

- `deck(meta, options?)` starts a builder. `DeckBuilderOptions` takes the
  deck's `style`, `navigation` and `outline`. `.slide(value)` (alias `.add`)
  appends a slide and returns the builder; `.build()` validates the whole
  deck with `parseDeck` and returns a `DeckBuildResult`:
  `{ ok: true, deck, diagnostics }` (warnings only) or
  `{ ok: false, diagnostics }`.
- `slide` holds typed constructors, one per catalog layout, whose props are
  typed by the layout (`LayoutProps`): `titleHero`, `sectionDivider`,
  `twoColumnSplit`, `threeColumnCards`, `imageLeft`, `imageRight`,
  `imageCentered`, `imageFullBleed`, `quote`, `codeWithCallout`, `bigStat`,
  `comparisonTable`, `processSteps`, `timeline`, `teamAvatars`, `closingCta`,
  `videoCentered`, `videoLeft`, `videoRight` and `chart`; plus
  `slide.layout(id, props, options)`, `slide.free({ id, blocks, master? })`
  and `slide.component(id, props, options)`. `SlideOptions` is the slide
  `id` with optional `title` and `notes`.
- `authoringLayoutIds` lists the 20 catalog layouts in catalog order (the
  stable order generated capability output uses); `DECK_LAYOUTS` is
  re-exported from the [model](model.md#layouts) for convenience.

Types only guide; `.build()` checks everything again, so a builder deck is
exactly as valid as a JSON one.

## Layout selection

```ts
import { selectDeckLayouts } from '@texuli/deck/authoring';

selectDeckLayouts([
  { id: 'adoption', role: 'metrics', pacing: 'punch' },
  { id: 'people', role: 'team' },
  { id: 'voice', role: 'anything', layout: 'quote' },
]);
// [
//   { id: 'adoption', layout: 'big-stat', override: false, rationale: 'Role "metrics" with pacing "punch"; …' },
//   { id: 'people', layout: 'team-avatars', override: false, rationale: 'Role "team" with pacing "idea"; …' },
//   { id: 'voice', layout: 'quote', override: true, rationale: 'Author override: layout "quote".' },
// ]
```

`selectDeckLayouts(requests, options?)` picks a layout for each
`LayoutRequest` (`id`, `role`, optional `pacing`, `purpose`, `layout` and
`blockTypes`) and explains it in a `LayoutChoice` (`id`, `layout`,
`rationale`, `override`). The rules, in order:

1. An author `layout` (a catalog id or `free`) always wins.
2. Otherwise candidates come from the content's `blockTypes` (`chart`,
   `table`, `steps`, `timeline`, `quote`, `code`, `image`, `video`, `stat`),
   then the `role` (`title`, `agenda`, `section`, `hook`, `problem`,
   `solution`, `metrics`, `chart`, `comparison`, `team`, `quote`, `steps`,
   `timeline`, `roadmap`, `code`, `demo`, `findings`, `risks`,
   `recommendations`, `close`, `ask`), then the pacing (`punch`, `idea`,
   `diagram`, `story`; anything else is `idea`), then `free`, keeping only
   layouts whose catalog pacing fits or that the role or content named.
3. A layout is not used a third time in a row when another candidate fits.

`options.aspect` is noted in the rationale when it is not 16:9.

## Brief outlines

```ts
import { generateDeckFromBrief } from '@texuli/deck/authoring';

const { deck, outline, selection } = generateDeckFromBrief({
  brief: 'Quarterly business review for the support team.',
});
// outline === 'qbr'; deck has 8 validated slides with draft guidance
```

`generateDeckFromBrief(options)` (`GenerateBriefOptions`: `brief`, optional
`title`, `outline` and `locale`) drafts a validated deck from one of eight
conservative outlines and returns a `GeneratedDeck` (`deck`, the `outline`
used and the layout `selection`). Without an `outline`, it is detected from
cue words in the brief (falling back to `talk`); the title defaults to the
brief's first sentence.

The drafts never invent evidence. Each slide's props come from its layout's
sample with every content string replaced by `Draft: add verified details.`
(numbers by `0`), links by `https://example.com/` and media by a
placeholder; the title (or big-stat label) is the outline slide's title, or
`Draft: <purpose>`. A slide that falls back to `free` gets one
`Draft: <purpose>` text block. Every slide's notes say what to add (`Draft guidance: … Add only verified details from the
brief or cited sources.`). Optional outline slides are left out.

`DECK_OUTLINES` holds the outlines (`DeckOutlineTemplate`: `id`, `label`,
`cues` and `OutlineSlide` rows with `key`, `role`, `pacing` of type
`DeckPacing`, `title`, `purpose` and `optional`). `DECK_OUTLINE_IDS` (type
`DeckOutlineId`):

| Outline | Label | Cue words |
| --- | --- | --- |
| `pitch` | Pitch | pitch, investor, fundraise |
| `qbr` | Quarterly business review | qbr, quarterly business review, quarterly review |
| `launch` | Product launch | launch, release, go to market |
| `status` | Project status | status, project update, weekly update |
| `training` | Training | training, workshop, enablement |
| `lesson` | Lesson | lesson, teach, class |
| `report` | Report | report, findings, research |
| `talk` | Talk | talk, keynote, presentation |

[Templates](templates.md) wrap these outlines with a title.

## Lint

```ts
import { lintDeck } from '@texuli/deck/authoring';

const report = lintDeck(deckOrUntrustedValue);
// { ok, errors, warnings, truncated, issues: [{ rule: 'notes-missing', severity: 'warning', path: ['slides', 2, 'notes'], … }] }
```

`lintDeck(value)` accepts untrusted input and never throws. It runs
`parseDeck`, maps its issues onto rules, then adds static quality checks.
The report (`DeckLintReport`) has `ok` (no errors), the `errors` and
`warnings` counts and the `issues` (`DeckLintIssue`: a `DeckDiagnostic` with
a `rule` of type `DeckLintRule`). Its work is bounded on hostile input: one
issue per rule and path, at most `DECK_LINT_MAX_ISSUES` (200) listed with
`truncated: true` past it (the counts still cover every distinct issue), and
a deck over a structural limit of the model (`too-many`, such as more than
200 slides, or `too-deep`) gets the model issues only, without the quality
pass. `DECK_LINT_RULES` groups the rules:

| Rule | Severity | Raised when |
| --- | --- | --- |
| `unknown-layout` | error | The slide `layout` is not a catalog id or slide kind. |
| `layout-props` | error | A layout's props fail their schema or rule. |
| `image-alt` | error | An image (a layout `image` or an `image` block) has no descriptive alt text. |
| `image-size` | error | An image has no intrinsic `width` and `height`. |
| `step-order` | error | A later element is revealed before an earlier one (authored steps go down in document order). |
| `empty-steps` | warning | A step label in `steps` names a step on which nothing reveals (reported at that label; `custom` slides, whose host reveals its own steps, are skipped). |
| `unknown-background` | warning | A slide background string is not a preset id. |
| `custom-slide` | warning | A `custom` slide depends on a host renderer and may not travel with the deck. |
| `step-unrevealed` | warning | A step marker sits where the layout reveals nothing. |
| `notes-missing` | warning | A visible slide has no notes, or notes under 40 characters. |
| `notes-duplicate` | warning | A slide's notes repeat an earlier slide's. |
| `notes-boilerplate` | warning | Notes contain a boilerplate phrase such as "do not read the slide" (case-insensitive, anywhere in the notes). |
| `layout-repetition` | warning | A layout repeats more than twice in a row. |
| `too-many-words` | warning | A visible slide has more than 55 words of human text (60 for `title-hero` and `big-stat`): titles, bodies, list items, labels, captions and table cells, never settings such as chart kinds, ids, URLs, code or widths, and never the notes. A free slide is reported at its wordiest block, a layout slide at `props`. |
| `prefer-layout` | warning (listed under `suggestions`) | A visible free slide holds a chart, table, quote, code or image block that may fit a catalog layout better. |

Other `parseDeck` issues keep their code as the rule. Every starter deck in
`packages/deck/decks/` lints with no errors and no warnings
(`tests/authoring.test.ts`). `DECK_AUTHORING_LIMITS` holds the authoring
slide cap (200, the model's).

## JSON Patch

```ts
import { applyDeckPatch } from '@texuli/deck/authoring';

const result = applyDeckPatch(deck, [
  { op: 'test', path: '/slides/1/props/number', value: '3' },
  { op: 'replace', path: '/slides/1/props/number', value: '4' },
]);
// { ok: true, value: { …the patched copy… } }
// or { ok: false, index, reason }, with the input untouched
```

`applyDeckPatch(document, operations)` applies a full RFC 6902 patch
(`JsonPatchOperation`: `add`, `remove`, `replace`, `move`, `copy`, `test`) to
a copy of plain JSON data and returns a `JsonPatchResult`. It is atomic: on
the first failing operation it returns `{ ok: false, index, reason }` and the
input is never modified. Paths are RFC 6901 pointers; `__proto__`,
`prototype` and `constructor` segments are refused, a value cannot move into
its own descendant, and a patch holds at most `MAX_DECK_PATCH_OPERATIONS`
(1,000) operations. The result is plain data, not a validated deck: run
`parseDeck` (or `lintDeck`) on `value` before you use it.
