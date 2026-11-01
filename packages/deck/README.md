# @texuli/deck

The framework-free, dependency-free deck engine for
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). One validated deck
model (model v2) that you write as JSON or as Markdown, with 20 catalog
layouts, backgrounds with a contrast guarantee, fragments and steps,
transitions, navigation with vertical stacks, hash routes, a controls
registry, canvas fit, auto-slide, a presenter protocol, lint, RFC 6902
patches, text twins, a typed builder, brief outlines and templates. It has no
Svelte and no DOM: the `@texuli/slides` stage presents its decks, and Node
tools and agents can use it on its own.

> **Status: in development (pre-1.0).** `@texuli/deck` is published on npm
> as `0.11.2`, with provenance (first published as `0.4.0`). It was built in PLAN_008
> (ADR-009 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> The `@texuli/slides` stage renders it from `0.4.0` (`@texuli/slides` `0.3.0`
> has the previous deck model), and `@texuli/spec` ships the blueprint spec
> that encodes deck model v2 from `0.4.0` (spec `0.10.0` in `@texuli/spec@0.11.2`).
> Under 0.x a new minor may contain breaking changes, so pin the exact
> version or use `^0.11.0`
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

## Install

```bash
npm install @texuli/deck
```

It has **no runtime dependencies** and no
peer dependencies: no Svelte, no DOM framework, no schema library.

## Quick start: JSON

`parseDeck` validates a deck and reports every issue at once, each with a
code, a JSON path, an RFC 6901 pointer and a fix. It never throws.

```ts
import { parseDeck } from '@texuli/deck/model';
import { formatDiagnostic } from '@texuli/deck/schema';

const result = parseDeck({
  formatVersion: 2,
  meta: { title: 'Quarterly review', locale: 'en' },
  style: { theme: 'nord', aspect: '16:9', transition: 'slide' },
  slides: [
    {
      id: 'opening',
      layout: 'title-hero',
      props: { title: 'Quarterly review', subtitle: 'What shipped and what is next' },
      notes: 'Welcome everyone and set the agenda for the next twenty minutes.',
    },
    {
      id: 'adoption',
      layout: 'big-stat',
      props: { number: '87%', label: 'of releases shipped the day they merged' },
    },
  ],
});

if (result.ok) {
  console.log(result.deck.slides.length); // 2
} else {
  for (const issue of result.issues) console.log(formatDiagnostic(issue));
}
```

Decks that arrive from somewhere untrusted (a share link, a pasted file, an
agent) go through `loadUntrustedDeck` instead: it bounds bytes, depth and
nodes before any deep work, migrates earlier deck shapes, then validates.

## Quick start: Markdown

`parseDeckMarkdown` reads the deck Markdown dialect into the same validated
deck, with every issue located by line and column. Its syntax is inspired by
reveal.js Markdown but is its own closed dialect: there is no HTML, and it is
not compatible with reveal.js documents.

```ts
import { parseDeckMarkdown } from '@texuli/deck/markdown';

const result = parseDeckMarkdown(`---
title: Quarterly review
transition: slide
---

<!-- .slide: layout=title-hero -->

# Quarterly review

What shipped and what is next

---

## Priorities

- Ship smaller changes <!-- .element: fragment -->
- Measure every release <!-- .element: fragment -->

Note: Keep this slide short.
`);

console.log(result.ok, result.deck?.slides.map((slide) => slide.id));
// true [ 'quarterly-review', 'priorities' ]
```

`deckToMarkdown(deck)` writes the canonical Markdown back; supported features
round-trip to the same deck.

## Subpaths

| Import | What it gives you | Measured gzip |
| --- | --- | --- |
| `@texuli/deck` | The model and the schema kit (everything in `./model` and `./schema`) | 37,827 B |
| `@texuli/deck/model` | Deck model v2: schemas and types, `parseDeck`, the untrusted loader, migration, the 21-entry layout catalog, style and themes, backgrounds with contrast math, fragments and steps, transitions, the diagnostic code table and the JSON Schema export | 37,550 B |
| `@texuli/deck/schema` | The owned schema kit: combinators as data, all-issues validation, `Infer` types and JSON Schema 2020-12 | 8,980 B |
| `@texuli/deck/engine` | The controller with events and plugins, navigation with vertical stacks, hash routes, the controls registry and input decisions, canvas fit, motion, auto-slide, the presenter protocol and the stage messages | 24,156 B |
| `@texuli/deck/markdown` | The deck Markdown dialect to and from a deck, and the text and outline twins | 57,866 B |
| `@texuli/deck/math` | A TeX subset to a MathML node tree | 6,021 B |
| `@texuli/deck/authoring` | The typed builder, layout selection, brief outlines, quality lint and RFC 6902 patches | 30,740 B |
| `@texuli/deck/templates` | Deterministic starter templates | 27,361 B |

Sizes are the gzip measurements recorded on the final PLAN_008 code in
`texuli.budgets.json` (`pnpm size --filter @texuli/deck`); each subpath has
its own budget there.

The repository also keeps seven paired starter decks in `packages/deck/decks/`
(each as `<name>.json` and `<name>.md`), described in
[templates](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/templates.md).
They are fixtures, not an exported subpath.

## Key guarantees

- **One model, two sources.** JSON and Markdown produce the same validated
  `Deck`; `tests/authoring.test.ts` checks that every starter deck's JSON
  and Markdown parse to equal decks and round-trip through `deckToMarkdown`.
- **All issues, never a throw.** Validation, the Markdown reader, the
  loader, migration and lint report one `DeckDiagnostic` shape (code,
  severity, path, JSON path, pointer, message, fix, slide id and, for
  Markdown, line and column), capped at 200.
- **No HTML.** The model holds data only. The Markdown dialect refuses raw
  HTML, iframes, `class`, `style` and `on*` attributes with a diagnostic;
  math becomes a MathML node tree from a closed tag and attribute allowlist,
  never a markup string.
- **Syntax here, policy at paint.** Media sources and links are checked for
  syntax only. The deck never carries a trust tier: the stage applies
  `@texuli/core/url-policy` at the host's tier when it paints.
- **Bounded on hostile input.** Size, depth, node, slide, step and issue
  caps hold for JSON, Markdown, math and patches; prototype keys, accessors,
  cycles and hidden characters are refused or stripped and reported.
- **Framework-free and DOM-free.** No `window`, `document` or
  `BroadcastChannel` at import (`tests/engine-import-guard.test.ts`); the
  engine imports nothing outside this package's `src/`.

## Documentation

- [Model](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/model.md):
  deck model v2, limits, slide kinds, layouts, backgrounds, style, steps,
  transitions, diagnostics, `parseDeck`, the loader and migration
- [Schema kit](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/schema.md)
- [Engine](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/engine.md):
  controller, navigation, routes, controls, canvas, motion, auto-slide,
  presenter protocol and messages
- [Markdown dialect](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/markdown.md)
- [Math](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/math.md)
- [Authoring](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/authoring.md):
  builder, outlines, layout selection, lint and patches
- [Templates](https://github.com/DailybotHQ/texuli/blob/main/packages/deck/docs/templates.md)
  and the starter decks
- Decision: ADR-009 in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- The stage: [`@texuli/slides`](https://github.com/DailybotHQ/texuli/blob/main/packages/slides/README.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-deck).
