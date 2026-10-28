# @texuli/deck

The framework-free, dependency-free deck engine for
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). One validated deck
model that you generate from JSON or from Markdown, with layouts, steps,
navigation, a presenter protocol, lint and authoring helpers. The
`@texuli/slides` stage presents it.

> **Status: in development, not on npm.** This package is being built in the
> repository (PLAN_008, [ADR-009](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> Its subpaths are declared but empty until their tasks land; nothing here is
> released yet.

## Planned subpaths

| Subpath | What it will do |
| --- | --- |
| `@texuli/deck` | Convenience aggregate of every engine API |
| `@texuli/deck/model` | Deck model v2, migration from earlier decks, lint, patch and text twins |
| `@texuli/deck/schema` | The owned schema kit: all-issues validation, types and a JSON Schema export |
| `@texuli/deck/engine` | Navigation, hash routing, controls, motion, canvas fit, auto-slide and the presenter protocol |
| `@texuli/deck/markdown` | The Markdown dialect to and from a deck |
| `@texuli/deck/math` | A TeX subset to a MathML node tree |
| `@texuli/deck/authoring` | A typed builder and brief outlines |
| `@texuli/deck/templates` | Starter decks and templates |

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-deck).
