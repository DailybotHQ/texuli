# @texuli/slides

Presentation decks for [Texuli](https://texuli.com), an MIT-licensed Svelte 5
component library by Dailybot, Inc. (*Small pieces. Infinite
possibilities.*). Describe a deck as data (ordered slides holding Texuli
content blocks), validate decks that an agent writes, and present them on a
keyboard-driven Svelte 5 stage with a presenter view, fullscreen, themes and
reveal steps. The same deck also prints to PDF through the browser and
exports to PPTX locally.

> **Status: 0.x release.** Texuli is in development. The packages are
> published to npm as `0.2.0`, a pre-1.0 release (1.0.0 will be the first
> stable release). Under 0.x, a new minor (`0.3.0`) may contain breaking
> changes, so pin the exact version or use `^0.2.0`, which accepts only 0.2.x.

## Install

```bash
npm install @texuli/slides svelte
```

Svelte 5 (`^5.57.2`) is a peer dependency. Import the stage and print
stylesheet once:

```ts
import '@texuli/slides/styles.css';
```

## Quick start

```svelte
<script lang="ts">
  import '@texuli/slides/styles.css';
  import { parseDeck } from '@texuli/slides/model';
  import { DeckStage } from '@texuli/slides/stage';

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

Decks an agent returns go through `validateDeckDraft` from
`@texuli/slides/grammar` first. It runs the catalog's draft validation at the
`untrusted` tier by default, then the deck rules (slide ids, masters, theme
references, reveal steps), and never throws.

## What's inside

The root entry, `@texuli/slides`, re-exports the model, grammar, templates
and the main export functions.

| Subpath | What it does |
| --- | --- |
| `@texuli/slides/model` | `parseDeck`, the closed vocabularies (aspects, masters, transitions), reveal steps, theme references and slot layouts |
| `@texuli/slides/grammar` | Catalog encodings of decks and `validateDeckDraft` for agent decks |
| `@texuli/slides/stage` | `DeckStage` (keyboard, overview, presenter view and screen, fullscreen, themes, transitions, media) and `DeckPrint` |
| `@texuli/slides/export` | Print plans, a PDF seam (browser print or a host exporter) and local PPTX export |
| `@texuli/slides/templates` | Report, pitch and review starter decks |
| `@texuli/slides/styles.css` | Stage and print styles, named print pages and reduced-motion rules |

## Features

- **Reveal steps.** Blocks, list items and code highlights reveal one step
  at a time on the stage; print and PPTX export flatten them to the final
  state.
- **Presenter tools.** An overview grid, a presenter view with speaker
  notes, and a presenter screen in a second same-origin window.
- **Fullscreen** with a visible window-filling fallback.
- **Slot layouts** for every master, including media regions.
- **Starter templates** for a report, a pitch and a review.

Not built yet: a presenter screen on another device, a tool-side PDF
exporter, and deck video.

## Key guarantees

- **Validated agent decks.** `validateDeckDraft` refuses hostile shapes with
  diagnostics: unknown blocks, sinks, over-limit trees, bad slide ids,
  undeclared masters and out-of-range reveal steps.
- **URL policy at paint.** Media URLs are checked when they paint, at the
  `untrusted` tier by default.
- **Keyboard and screen readers.** The stage has a documented key map with
  managed focus, honors reduced motion and supports forced colors.
- **Local, deterministic export.** Export is framework-free and uploads
  nothing; the same deck always gives the same PPTX bytes.

## Documentation

- Website: [texuli.com](https://texuli.com) and the
  [slides overview](https://texuli.com/slides-page/), with a live tour deck
- Deck model: [model.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/model.md)
- Catalog grammar and agent decks: [grammar.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/grammar.md)
- Stage, keyboard and presenter screen: [stage.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/stage.md)
- Print, PDF and PPTX export: [export.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/export.md)
- Starter templates: [templates.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/templates.md)
- Stylesheet hooks: [styles.md](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/docs/styles.md)

## Related packages

- [`@texuli/blocks`](https://www.npmjs.com/package/@texuli/blocks): the content blocks slides are made of.
- [`@texuli/catalog`](https://www.npmjs.com/package/@texuli/catalog): the validation that agent decks pass.
- [`@texuli/player`](https://www.npmjs.com/package/@texuli/player): paints any validated blueprint, decks included, as a document.

## Contributing

Source, issues and contribution guidelines live at
[github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli). Report
bugs at [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues).

## License

MIT © Dailybot, Inc.
