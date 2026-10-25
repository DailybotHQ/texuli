# Code blocks

**Package:** `@texuli/blocks` · **Entries:** `@texuli/blocks/code` (light), `@texuli/blocks/code/tokenizer` (engine), `@texuli/blocks/code/renderers` (Svelte), plus `loadCodeFamily()` from the package root.

A code block shows source text with syntax colors from an owned, linear-time
tokenizer. Nothing becomes HTML: the tokenizer returns `{ kind, text }`
tokens, and the renderer prints each token's text in a span colored by a theme
role. It is ported from Protoyard's code family, which replaced a 303 KB
highlight.js.

```svelte
<script lang="ts">
  import { loadCodeFamily } from '@texuli/blocks';
  const CodeBlockView = loadCodeFamily().then((module) => module.default);
</script>

{#await CodeBlockView then View}
  <View
    block={{ type: 'code', lang: 'ts', filename: 'notes.ts', code: 'const a = 1;' }}
    lineNumbers
    highlights={['1']}
  />
{/await}
```

## Data (validated)

Every block passes `checkCodeBlock(value)` (the core block schema; line specs use the shared `core/schema/line-spec.ts` parser, so data that validates highlights the same lines) before anything renders. A rejected block becomes an inert notice, and `oninvalid` receives the issues.

| Field | Rule |
| --- | --- |
| `type` | `'code'` |
| `code` | Up to 20,000 characters and 400 lines; no control or bidi override characters |
| `lang` | Optional; a short lowercase token (`/^[a-z][a-z0-9+-]{0,31}$/`) |
| `filename` | Optional plain text, without line breaks or bidi overrides |
| `caption` | Optional plain text of at most 200 characters, shown under the code and included in `blockText` |
| `lineNumbers` | Optional boolean |
| `highlights` | Optional: 1 to 16 line specs (`"1-2,4"`), one per step. Each spec is at most 120 characters, and every line must exist in the code |
| `step` | Optional (every block has it): the deck step where the highlight steps start |

Unknown fields are dropped. Markup in `code` is data: `<script>` renders as the text `<script>`.

## Renderer props (`CodeBlockView`)

| Prop | Default | Meaning |
| --- | --- | --- |
| `block` | required | Untrusted block data |
| `labels` | English | Overrides for every visible or announced string (see below) |
| `oninvalid` | none | Called with the issues when the block is rejected |
| `lineNumbers` | the block's | Overrides the block's `lineNumbers`. Numbers are drawn by CSS (`content: attr(data-line) / ""`), so they are never copied or read as text |
| `highlights` | the block's | Overrides the block's `highlights`. Accepts line specs, or lists of lines and `[start, end]` ranges |
| `hostStep` | none | The host's current step (a deck fragment). Host step `block.step + i` shows highlight step `i`, clamped |
| `step` | none | Picks the highlight step directly (clamped); wins over `hostStep`. With neither, the first step shows |
| `copyable` | `true` | Shows the copy button |

Labels (`resolveCodeBlockLabels`): `invalid`, `code` (the name of a block with no filename or language), `copy`, `copied`, `copyFailed`, `copyName` (a template with `{name}`, by default `Copy {name} code`), `copiedAnnouncement` and `copyFailedAnnouncement`.

## Languages

Grammars exist for `ts`, `js`, `json`, `bash`, `python`, `html`, `css`, `sql` and `yaml`, plus aliases: `typescript`, `tsx`, `javascript`, `jsx`, `mjs`, `sh`, `shell`, `zsh`, `console`, `py`, `xml`, `svg`, `svelte`, `vue`, `postgres`, `sqlite`, `mysql`, `yml` and more (`resolveCodeLanguage`). Any other language, including `text`, shows as plain text.

The renderer loads only the grammar of the block's language (`loadCodeGrammar`, one lazy chunk per grammar, cached). Until that grammar arrives, the same text shows unhighlighted. `tokenizeCode(code, lang)` on `@texuli/blocks/code/tokenizer` bundles every grammar, for tools, servers and tests.

**Tokenizer guarantees** (held by tests):
- The token texts always concatenate back to the input.
- Unterminated strings run to the end of their line; unterminated block comments run to the end of the input.
- Grammars may not use capture groups.
- Input beyond 20,000 characters stays plain.
- Pathological 20 KB inputs (about 70 patterns per grammar) tokenize in linear time.

## Accessibility and style

- **Scroll area.** It is a `region` named by the filename, the language in capitals, or the `code` label. It is focusable so keyboard users can scroll long lines, and it is always `dir="ltr"`, even on RTL pages, while the header bar follows the page.
- **Copy.** The button writes the exact source, through `copyText` from `texuli/kbd-code`. It shows `Copied` or `Copy failed`, and announces the result in a polite live region. Its accessible name includes the block's name.
- **Highlighted lines.** They are `<mark>` elements with a muted background and a primary edge on the start side.
- **Token colors.** These are theme roles: `primary` (keywords and tags, also bold), `success` (strings and attributes), `destructive` (numbers and constants), `info` (functions and types), `mutedForeground` (comments, also italic) and `surfaceForeground`. A test checks every role at 4.5:1 as text on `surface` and on `muted` in every library theme (light and dark, 420 palettes). `secondary` and `accent` are fills and never reach AA as text, so they are not used. In forced colors, highlighted lines use `Highlight` / `HighlightText`.
- **Styles.** `code.css` sits in `@layer tx.components`, uses logical properties, and has no static `style=`. In a grid or flex parent, long lines scroll inside the block instead of widening the page.

## Verified

- `pnpm vitest run packages/blocks/tests/code.test.ts`: 67 tests.
  - Golden tokens for all nine grammars, plus invariants, seeded round trips, linear time, the capture-group refusal and highlight steps.
  - The guard, accepting valid blocks and rejecting 12 hostile shapes.
  - Labels, token styles and the theme contrast sweep.
  - The grammar loader.
  - The renderer: exact text, inert markup, unknown languages, region names, highlights and line numbers, copy success and failure, `copyable`, and the invalid notice.
  - Hygiene: no HTML sinks, and the engine imports nothing outside its folder.
- In the browser, on Chromium, WebKit and the Pixel 7 in light and dark, the `blocks-code` and `blocks-code-hostile` examples pass axe (also with forced colors on Chromium and the Pixel 7). On the phone, the page does not overflow and long lines scroll inside the block.
- Visual baselines: `blocks-code` and `blocks-code-hostile`, light and dark, Chromium and the Pixel 7.

## Size (`pnpm size`, gzip, 2026-10-24)

| Entry | Size | Budget |
| --- | ---: | --- |
| `@texuli/blocks/code` (light entry: guard, labels, loader, styles) | 3.57 KiB + 1.16 KiB CSS (7.07 KiB lazy) | 20 KiB |
| `@texuli/blocks/code/tokenizer` (every grammar) | 5.03 KiB | 16 KiB |
| `@texuli/blocks/code/renderers` | 6.50 KiB + 1.16 KiB CSS | 12 KiB |
| `@texuli/blocks` root (every family) | 27.27 KiB | 32 KiB |

When the code family landed, it grew the root from 13.04 to 14.22 KiB.

## Limits

- **Scope.** Highlighting is lexical (no parser), there are nine grammars, and nothing is ever executed.
- **Theme contrast.** It is guaranteed for the library themes. A custom theme should keep `primary`, `success`, `info` and `destructive` readable as text on `surface` and `muted`.
