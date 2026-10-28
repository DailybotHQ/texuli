# @texuli/blocks

Content blocks for pages, documents and slides: a closed vocabulary of
typed JSON blocks (headings, rich text, columns, tabs, images, tables, KPIs,
charts, maps, polls, code and more), an untrusted-input guard that validates
them, framework-free engines and Svelte 5 renderers. It is built for content
that comes from people or AI agents: anything that fails validation becomes
an inert notice instead of reaching the page. It is part of
[Texuli](https://texuli.com), "Small pieces. Infinite possibilities.": an MIT
Svelte 5 component library by Dailybot, Inc.

> **Status: 0.x release.** `@texuli/blocks` is published on npm as `0.4.0`, a
> pre-1.0 release (1.0.0 will be the first stable release). Under 0.x, a new
> minor (`0.5.0`) may contain breaking changes, so pin the exact version or
> use `^0.4.0`, which accepts only 0.4.x.

## Install

```sh
npm install @texuli/blocks @texuli/tokens svelte
```

- `svelte` (^5.57.2) is a peer dependency.
- The renderers style themselves with the Texuli `--tx-*` design tokens.
  Import the token stylesheet once in your app (installing `@texuli/tokens`
  directly lets your bundler resolve it); each renderer imports its own CSS.

```css
@import '@texuli/tokens/base.css';
```

## Quick start

Validate untrusted JSON, then render the text family with its lazily loaded
renderer:

```svelte
<script lang="ts">
  import { isTextFamilyBlock, loadTextFamily, parseUntrustedBlocks } from '@texuli/blocks';

  // For example, JSON produced by an agent.
  let { input }: { input: string } = $props();

  const result = $derived(parseUntrustedBlocks(input));
</script>

{#if result.success}
  {#await loadTextFamily() then { default: TextBlockView }}
    {#each result.blocks.filter(isTextFamilyBlock) as block, index (index)}
      <TextBlockView {block} />
    {/each}
  {/await}
{:else}
  <p>This content could not be displayed.</p>
{/if}
```

With `input` set to
`[{"type":"heading","level":2,"text":"Release notes"},{"type":"text","markdown":"A **safe** paragraph."}]`,
this renders an `h2` and a paragraph. `parseUntrustedBlocks` accepts JSON text
or objects, enforces size, depth and count limits, strips invisible and
bidirectional control characters, and returns either the typed blocks or a
list of issues. It never throws.

The package root exports a `load*Family()` renderer loader and a
`*_BLOCK_TYPES` list for every family, plus `check*Block` guards and
`is*FamilyBlock` narrowers for most of them.

## What's inside

| Family | Block types | Imports |
| --- | --- | --- |
| Core | Schemas, limits, safety checks, the untrusted guard, text helpers and catalog metadata | `@texuli/blocks`, `@texuli/blocks/core` |
| Formula | A closed calculator language: parser, AST, evaluator and formatter | `@texuli/blocks/formula` |
| Text | `heading`, `text`, `list`, `quote`, `callout` | `@texuli/blocks/text`, `@texuli/blocks/text/engine`, `@texuli/blocks/text/markdown`, `@texuli/blocks/text/renderers` |
| Structure | `columns`, `grid`, `tabs`, `accordion`, `cards`, `divider`, `cta` | `@texuli/blocks/structure`, `@texuli/blocks/structure/engine`, `@texuli/blocks/structure/renderers` |
| Media | `image`, `figure`, `video`, `gallery` | `@texuli/blocks/media`, `@texuli/blocks/media/engine`, `@texuli/blocks/media/renderers` |
| Embed | `embed-app`, `link-preview` | `@texuli/blocks/embed`, `@texuli/blocks/embed/engine`, `@texuli/blocks/embed/renderers` |
| Interactive | `poll`, `quiz`, `calculator`, `checklist` | `@texuli/blocks/interactive`, `@texuli/blocks/interactive/engine`, `@texuli/blocks/interactive/renderers` |
| Data | `table`, `stat`, `kpi`, `chart` (line, area, bar, stacked bar, combo, heatmap, scatter) | `@texuli/blocks/data`, `@texuli/blocks/data/engine`, `@texuli/blocks/data/renderers` |
| Map | `map`: places and an optional route on an offline basemap | `@texuli/blocks/map`, `@texuli/blocks/map/engine`, `@texuli/blocks/map/renderers` |
| Diagram | `flow`, `tree`, `board` and `terminal` diagrams | `@texuli/blocks/diagram`, `@texuli/blocks/diagram/engine`, `@texuli/blocks/diagram/renderers` |
| Code | `code`, with syntax colors from an owned tokenizer | `@texuli/blocks/code`, `@texuli/blocks/code/engine`, `@texuli/blocks/code/tokenizer`, `@texuli/blocks/code/renderers` |

In each family, the plain subpath is the light API (guards, labels, the lazy
loader), `/engine` is framework-free logic, and `/renderers` gives you the
Svelte views eagerly. `@texuli/blocks/text/markdown` is the owned Markdown
subset parser.

The core vocabulary includes `safeParseBlocks` and `safeParseBlock`,
`parseUntrustedBlocks`, `BLOCK_LIMITS`, `BLOCK_CATALOG` with
`validateBlocksForAuthoring` (metadata for builders and agents), and the
text helpers `walkBlocks`, `blockText` and `headingOutline`.

## Key guarantees

- **Untrusted by design.** Every block passes an owned runtime validator
  before anything renders; a rejected block becomes an inert, translatable
  notice.
- **No HTML sinks.** Markdown, code and every other block render as Svelte
  text and elements, never through `{@html}`. Raw tags in Markdown stay
  literal text.
- **URL policy on every link.** Links, calls to action and link previews pass
  `safeHref` at the `untrusted` tier. Block media accepts only avatar ids,
  small inline `data:` images and videos, and relative paths; remote URLs are
  refused at parse time.
- **No code execution.** Formulas are closed JSON ASTs that are parsed,
  evaluated and formatted, never run as code. Embed apps start only after the
  user activates them, inside a host-provided mount, and link previews never
  fetch.
- **No network from maps.** The map block draws on an offline, fictional
  basemap; it never loads tiles or geocodes.
- **Trojan Source safe.** Bidirectional overrides and invisible control
  characters are stripped or refused.

## Documentation

- Site: [texuli.com](https://texuli.com) and the
  [blocks gallery](https://texuli.com/blocks-page/)
- Families:
  [text](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/text.md),
  [structure](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/structure.md),
  [media](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/media.md),
  [embed](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/embed.md),
  [interactive](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/interactive.md),
  [data](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/blocks-data.md),
  [map](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/map.md),
  [code](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/code.md),
  [formula](https://github.com/DailybotHQ/texuli/blob/main/packages/blocks/docs/formula.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-blocks).
