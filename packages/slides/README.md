# @texuli/slides

Validated presentation decks: a deck model of ordered slides holding
`@texuli/blocks` content, catalog encodings and agent validation, a Svelte 5
stage with a presenter view, print/PDF and PPTX export, and starter
templates. The package is private and source-first while Texuli is in
development; it is not published to npm.

## Status

Implemented in `src/` and exported through [`package.json`](package.json):
six subpaths plus the root entry, which re-exports the model, grammar,
templates and the main export functions. Covered by the unit and component
tests in [`tests/`](tests) (`pnpm vitest run packages/slides`), the golden
decks in [`tests/golden/`](tests/golden), the slides accessibility sweep, and
visual baselines for the slides examples. Each subpath has a page in
[`docs/`](docs).

Not implemented yet: reveal steps (fragments) on the stage, fullscreen, a
second-screen presenter, slot layout for the non-media masters, a tool-side
PDF exporter, and deck video.

## Using the package

The package peers on Svelte 5 (`^5.57.2`); its `@texuli/*` dependencies are
workspace links.

```svelte
<script lang="ts">
  import '@texuli/slides/styles.css';
  import { DeckStage } from '@texuli/slides/stage';
  import { parseDeck } from '@texuli/slides/model';

  const result = parseDeck({
    meta: { title: 'Quarterly update', themeRef: 'ocean' },
    masters: ['title', 'content'],
    slides: [
      { id: 'opening', title: 'Quarterly update', master: 'title', blocks: [] },
      {
        id: 'priorities',
        title: 'Priorities',
        notes: 'Keep it short.',
        blocks: [{ type: 'list', items: [{ text: 'Ship' }, { text: 'Measure' }] }],
      },
    ],
  });
</script>

{#if result.success}
  <DeckStage deck={result.deck} />
{/if}
```

Decks an agent returns go through `validateDeckDraft` first
([grammar](docs/grammar.md)). Media URLs are checked at paint at the
`untrusted` tier by default ([stage](docs/stage.md#media)).

## Areas

| Import | What it does | Documentation |
| --- | --- | --- |
| `@texuli/slides/model` | `parseDeck`, the closed vocabularies (aspects, masters, transitions), theme references, master and media-region composition | [Deck model](docs/model.md) |
| `@texuli/slides/grammar` | Render tree, structured `slides[]` and legacy-card encodings; `validateDeckDraft` for agent decks | [Catalog grammar and agent decks](docs/grammar.md) |
| `@texuli/slides/stage` | `DeckStage` (keyboard, overview, presenter view, themes, transitions, media) and `DeckPrint` | [Stage](docs/stage.md) |
| `@texuli/slides/export` | Print plans and the PDF seam (browser print or a host exporter); local PPTX export; the XML and ZIP writers | [Print, PDF and PPTX export](docs/export.md) |
| `@texuli/slides/templates` | Report, pitch and review starter decks | [Starter templates](docs/templates.md) |
| `@texuli/slides/styles.css` | Stage and print styles, named print pages, reduced-motion rules | [Stylesheet](docs/styles.md) |

## Examples and baselines

The examples registry (`packages/examples/src/slides/`) renders each starter
template in `DeckStage` (`slides-template-report`, `slides-template-pitch`,
`slides-template-review`) and a media deck in `DeckPrint`
(`slides-media-deck`). Each has committed light and dark visual baselines on
desktop Chromium and the Pixel 7 (`pnpm visual -g slides-`). Like the rest of
the suite, the baselines are recorded on macOS only.

## Size

The package subpaths have been measured, including the stage's initial and
deferred JavaScript, but the size budget rows still await owner review; see
the PLAN_004 slides size audit. `pnpm size --filter slides` reports the
numbers.

## Accessibility

[docs/quality/a11y-slides.md](../../docs/quality/a11y-slides.md) records the
slides accessibility sweep (`tests/e2e/a11y-slides.spec.ts`, run on the four
slides examples). It covers axe in light, dark, overview, presenter and
forced-colors states, reflow at 320px, the keyboard map with focus movement,
and reduced motion.
[docs/quality/sr-transcripts-slides.md](../../docs/quality/sr-transcripts-slides.md)
holds VoiceOver transcripts authored from the accessibility tree. The
keyboard contract is in [docs/stage.md](docs/stage.md#keyboard-and-focus).

## Checks

```bash
pnpm vitest run packages/slides
pnpm --filter @texuli/slides typecheck
npx biome check packages/slides
pnpm check:layers
```

`tests/docs.test.ts` keeps these docs complete: every subpath needs a page
linked here, and every exported name, stage prop and stylesheet hook must
appear in its page.
