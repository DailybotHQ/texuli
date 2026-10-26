# Text blocks

The text family renders the `heading`, `text` (paragraphs and rich text),
`list`, `quote` and `callout` blocks. It takes **untrusted data**: every block
passes the core schemas (`safeParseBlock`) and must be a text family type
before anything renders. A rejected block becomes an inert, translatable
notice. Added by T-blocks-text.

## Entry points

| Import | What it gives you | Measured gzip (`pnpm size`, 2026-10-24) |
| --- | --- | --- |
| `@texuli/blocks` | `loadTextFamily()`, `checkTextBlock`, `isTextFamilyBlock`, `TEXT_BLOCK_TYPES` and the types | added 0.45 KiB to the root when it landed; the family chunk loads lazily (4.79 KiB JS + 1.08 KiB CSS) |
| `@texuli/blocks/text` | the above, plus `DEFAULT_TEXT_BLOCK_LABELS` and `resolveTextBlockLabels` | 2.63 KiB + 1.08 KiB CSS |
| `@texuli/blocks/text/markdown` | `parseMarkdown`, `parseInline`, `inlineText`, `headingLevels`, `MARKDOWN_LIMITS` and the tree types | 2.54 KiB |
| `@texuli/blocks/text/renderers` | `TextBlockView` and `RichText`, eager | 6.93 KiB + 1.08 KiB CSS |

```svelte
<script lang="ts">
import { loadTextFamily } from '@texuli/blocks';

let { block }: { block: unknown } = $props();
</script>

{#await loadTextFamily() then { default: TextBlockView }}
  <TextBlockView {block} oninvalid={(issues) => console.warn(issues)} />
{/await}
```

`TextBlockView` props:

- `block: unknown`: the untrusted block.
- `labels?`: translations, merged over the English defaults. The keys are
  `invalid`, `codeBlock`, `taskDone`, `taskOpen` and `tones.<tone>`.
- `oninvalid?(issues)`: receives the schema issues when a block is rejected.

## What each block renders

| Block | Markup |
| --- | --- |
| `heading` | `<hgroup>` with an optional eyebrow `<p>`, `h1`–`h4` from `level` (with the block `id` as the anchor id), and an optional subtitle `<p>` |
| `text` | Markdown through `RichText` |
| `list` | `<ul>` or `<ol>` (`ordered`); each item is inline Markdown |
| `quote` | `<figure>` with a `<blockquote>`, and a `<figcaption><cite>` when `cite` is set |
| `callout` | `<div role="note">` with a visible tone label (not color alone), an optional title and a Markdown body |

## The Markdown subset

The parser is owned code, a closed subset:

- **Blocks:** paragraphs, `#` headings, `-`/`*`/`+` and `1.` lists (nested by
  indentation, `[ ]`/`[x]` task items), `>` quotes, fenced code and `---`
  rules.
- **Inline:** `**strong**`, `*em*`, `~~del~~`, `` `code` ``, `[text](href)`,
  `<https://…>` autolinks, backslash escapes, and hard breaks (two trailing
  spaces or `\` at the end of a line).

Its safety rules:

- **No HTML sink.** Raw tags such as `<script>` and `<img onerror>` stay
  literal text. Rendering uses Svelte text interpolation only, never
  `{@html}`.
- **Links pass `safeHref`** (untrusted tier) in the parser and again in the
  renderer. A link that fails renders its text without an anchor. Absolute
  links get `rel="noopener noreferrer nofollow"` and never `target`.
- **Images are not loaded** from text blocks: `![alt](src)` renders its alt
  text. Pictures belong to the media family and its `safeImageSrc` policy.
- **Hostile nesting degrades to text.** Quotes and lists nest at most 4
  levels, inline emphasis and links 6. The parser reads at most 4,000
  characters, the same cap as the schema's markdown field. Unmatched markers
  are literal. Pathological 4,000-character inputs (`*a `, `_a `, `**a `,
  unclosed brackets, deep `>`) parsed in 0–50 ms on an Apple-silicon laptop
  (2026-10-23), and the test bounds them at 1 s.
- **Relative headings.** The top Markdown heading level renders as
  `headingBase` (h3 by default) and deeper levels follow without gaps. Author
  text cannot outrank heading blocks or skip outline levels.

The schemas still reject control and bidirectional override characters
before any of this runs.

## Styling and accessibility

- **Logical properties throughout.** Borders sit on `inline-start`, so RTL
  mirrors (checked in a browser).
- **Tokens with fallbacks.** The custom properties are the contract names the
  token engine emits (`--tx-<role>`): `--tx-accent`, `--tx-info`,
  `--tx-success`, `--tx-warning`, `--tx-destructive` (the `danger` tone),
  `--tx-border`, `--tx-border-strong`, `--tx-muted` (inline code fills),
  `--tx-ring` (focus outlines), `--tx-radius` (surface corners) and
  `--tx-font-mono`.
- **Tone colors mark borders and tints only.** The fallbacks reach at least
  3:1 against both white and #121212. Tone text inherits the page color, so
  callouts keep the host's contrast in any scheme.
- **Links** keep the host's or the UA's color and are always underlined.
- **Forced colors:** borders become `CanvasText`.
- **No motion,** so there is nothing to reduce.
- **Keyboard:** code fences are focusable (`tabindex="0"`, named by
  `labels.codeBlock`) so wide code can scroll.
- **Task items** are disabled checkboxes named "Done" / "Not done"
  (translatable).
- **Browser check (not committed):** axe found no violations in light and
  dark, with and without `forced-colors: active`, on desktop Chromium and
  Pixel 7. That was a scratch Playwright spec, run against the
  `blocks-text` and `blocks-text-hostile` examples.

## Examples

- **`blocks-text`:** every block type, from fictional example.com data.
- **`blocks-text-hostile`:** raw HTML, an executable link, a bidi override
  and a foreign block type, rendered inertly or rejected.

Both live in `packages/examples/src/blocks-text/` and have visual baselines.

## Limits

- **Reveal is the host's job.** `step`, `reveal` and `tone` (other than on
  callouts and quotes) are carried but not acted on here. `@texuli/slides`
  plays `step` and `reveal` as deck reveal steps
  ([slides model](../../slides/docs/model.md#reveal-steps-fragments)).
- **The subset has no tables or images,** and no setext headings, reference
  links or HTML blocks. Those inputs render as text.
- **Inline parsing is greedy-simple, not CommonMark-exact.** Delimiter runs
  match the nearest valid closer.
