# Code blocks

**Package:** `@texuli/blocks` · **Entries:** `@texuli/blocks/code` (light), `@texuli/blocks/code/tokenizer` (engine), `@texuli/blocks/code/renderers` (Svelte), `@texuli/blocks/code-field` (the editable field, new in `0.13.1`), plus `loadCodeFamily()` from the package root.

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
| `header` | none | A snippet that replaces the visible name at the start of the bar (a language badge, a filename with an icon). The name stays in the bar, visually hidden, as the code region's accessible name |
| `toolbar` | none | A snippet of extra actions at the end of the bar, before the copy button |

Both snippets receive a `CodeBlockBarContext`: `name` (the filename, the
language in capitals, or the `code` label), `filename`, `lang`, `code`,
`copy()` (copies with the built-in status and announcement, so a host copy
button behaves like the default one) and `copyStatus` (`idle`, `copying`,
`copied` or `failed`).

```svelte
<CodeBlockView {block} copyable={false}>
  {#snippet header(bar)}<span class="badge">{bar.lang}</span> {bar.filename}{/snippet}
  {#snippet toolbar(bar)}<button type="button" onclick={bar.copy}>Copy</button>{/snippet}
</CodeBlockView>
```

Labels (`resolveCodeBlockLabels`): `invalid`, `code` (the name of a block with no filename or language), `copy`, `copied`, `copyFailed`, `copyName` (a template with `{name}`, by default `Copy {name} code`), `copiedAnnouncement` and `copyFailedAnnouncement`.

## Code field

New in `0.13.1`. `CodeField` from `@texuli/blocks/code-field` is an editable,
syntax-highlighted code field for forms and settings screens:

```svelte
<script lang="ts">
  import { CodeField } from '@texuli/blocks/code-field';
  let value = $state('const greeting = "hello";');
</script>

<CodeField bind:value language="ts" label="Snippet" lineNumbers name="snippet" />
```

**How it works.** A real `<textarea>` holds the text, the caret, the
selection, undo and the form value. Its text is transparent, and it sits over
an `aria-hidden` `<pre>` that prints the same text as token spans from the
owned tokenizer: elements and text nodes, never HTML. Both layers share the
font, line height, padding, tab size, white space and wrapping, with
ligatures and kerning off. The overlay follows the textarea's scroll. Token
colors are the code block's (`code.css`), without its bold and italic, so a
heavier or slanted face cannot shift a glyph away from the caret. The field
grows with its content, from `rows` lines; put it in a scroll container to
cap its height.

| Prop | Default | Meaning |
| --- | --- | --- |
| `value` | `''` | The source text (`bind:value`) |
| `language` | none | A language id or alias, as for code blocks; anything else is plain text |
| `label` | none | A visible `<label>` for the textarea. Or name it with `aria-label` or `aria-labelledby`; one of the three is required |
| `placeholder`, `readonly`, `disabled`, `name`, `id`, `required`, `aria-*`, `data-*` | | Reach the textarea |
| `oninput`, `onchange`, `onkeydown`, other DOM handlers | | Reach the textarea; the caller's handler runs first, and `preventDefault()` in `onkeydown` takes a key over |
| `onValueChange` | none | Called with the new value after every edit |
| `rows` | `4` | Visible lines before the field grows |
| `wrap` | `false` | Wraps long lines instead of scrolling sideways |
| `tabSize` | `2` | Columns per tab stop (1 to 8), and the spaces one Tab inserts |
| `indentWith` | `'spaces'` | `'tab'` inserts one tab character |
| `lineNumbers` | `false` | Decorative line numbers (`aria-hidden`); with `wrap`, each number is CSS content on its own line |
| `highlightLimit` | `20000` | Characters past which highlighting turns off (at most 20,000) |
| `showKeyboardHint` | `false` | Shows the keyboard hint under the field (it is always the textarea's description) |
| `labels` | the dictionary | `{ keyboardHint }`; the default comes from `blocks.code-field.keyboard-hint` in the label dictionary (`@texuli/blocks/i18n`) |
| `class`, `style`, `hidden` | | Land on the wrapper |
| `ref`, `textareaRef` | | The wrapper and the textarea (bindable) |

The entry also exports the edits behind the keys, as data
(`indentEdit`, `newlineEdit`, `applyCodeFieldEdit`, `indentUnit`), the
limits (`CODE_FIELD_HIGHLIGHT_LIMIT`, `CODE_FIELD_SYNC_LIMIT`) and the labels
(`DEFAULT_CODE_FIELD_LABELS`, `resolveCodeFieldLabels`).

**Keyboard.** The field captures Tab for indentation, so it follows the
WAI-ARIA Authoring Practices advice for widgets that use Tab: a documented
way out that does not trap keyboard users.

| Key | Action |
| --- | --- |
| Tab | Indents: inserts one indent at the caret, or indents every selected line |
| Shift+Tab | Outdents the current or selected lines |
| Enter | A new line with the current line's indentation |
| Escape, then Tab or Shift+Tab | Leaves the field (focus moves on as usual). Escape is not stopped, so a dialog around the field still closes on it |
| Ctrl, Alt or Meta with Tab | Left to the browser |

Edits go through the browser's editing commands, so undo and redo keep them.
The textarea's description (`aria-describedby`) says "Tab inserts
indentation. To leave the field, press Escape, then Tab." A `readonly` or
`disabled` field captures no key and has no hint.

**Large inputs.** Up to 4,000 characters the overlay re-tokenizes on every
input. Past that, the work moves to the next animation frame, which runs
before that frame is painted, so the overlay never shows stale text and a
burst of inputs tokenizes once. Past `highlightLimit` (20,000 characters by
default) there is no overlay and no line numbers: the textarea paints its own
text, and typing stays fast.
A `disabled` field also has no overlay: it shows the textarea's own text,
dimmed, so it reads as inactive.

**Server rendering and hydration.** The entry bundles every grammar, so the
server HTML already holds the highlighted value, and it needs no inline
style (strict CSP). Hydration keeps the server's textarea: text typed before
the scripts arrive is kept, and the caret stays where it was.

**Themes and forced colors.** The field reads the input and surface roles
(`--tx-input`, `--tx-surface`, `--tx-ring`) and the token colors, so it
follows light, dark and every library theme. In forced colors the overlay
text is hidden and the textarea shows its own text in system colors.

**Verified.** `packages/blocks/tests/code.test.ts` covers the edits, the
binding, Tab, Shift+Tab, Enter and Escape, readonly and disabled, line
numbers, wrapping, labels, the large-input fallback, the deferred
tokenization and the absence of HTML sinks; `code-field-ssr.test.ts` covers
the server HTML. `tests/e2e/code-field.spec.ts` runs on Chromium and WebKit:
it photographs the field painting only the overlay's text and only the
textarea's text, in one color, and requires the same pixels (no wrap, wrap,
tabs and a sideways scroll; a 1px drift is caught). It also checks the keys,
undo and hydration, axe in light and dark, and forced colors (Chromium). The
`blocks-code-field` example has visual baselines (light and dark, Chromium
and the Pixel 7) and renders under the strict CSP and on the server with
every other example.

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

- `pnpm vitest run packages/blocks/tests/code.test.ts`: 13 tests.
  - Golden tokens for all nine grammars, plus invariants, seeded round trips, linear time, the capture-group refusal and highlight steps.
  - The guard, accepting valid blocks and rejecting 12 hostile shapes.
  - Labels, token styles and the theme contrast sweep.
  - The grammar loader.
  - The renderer: exact text, inert markup, unknown languages, region names, highlights and line numbers, copy success and failure, `copyable`, the `header` and `toolbar` snippets, and the invalid notice.
  - Hygiene: no HTML sinks, and the engine imports nothing outside its folder.
- In the browser, on Chromium, WebKit and the Pixel 7 in light and dark, the `blocks-code` and `blocks-code-hostile` examples pass axe (also with forced colors on Chromium and the Pixel 7). On the phone, the page does not overflow and long lines scroll inside the block.
- Visual baselines: `blocks-code` and `blocks-code-hostile`, light and dark, Chromium and the Pixel 7.

## Size (`pnpm size`, gzip, 2026-10-24)

| Entry | Size | Budget |
| --- | ---: | --- |
| `@texuli/blocks/code` (light entry: guard, labels, loader, styles) | 3.57 KiB + 1.16 KiB CSS (7.07 KiB lazy) | 20 KiB |
| `@texuli/blocks/code/tokenizer` (every grammar) | 5.03 KiB | 16 KiB |
| `@texuli/blocks/code/renderers` | 6.50 KiB + 1.16 KiB CSS | 12 KiB |
| `@texuli/blocks/code-field` (measured 2026-11-04: the field and every grammar) | 8.44 KiB + 2.05 KiB CSS | 20 KiB (the `@texuli/blocks/*` default) |
| `@texuli/blocks` root (every family) | 27.27 KiB | 32 KiB |

When the code family landed, it grew the root from 13.04 to 14.22 KiB.

## Limits

- **Scope.** Highlighting is lexical (no parser), there are nine grammars, and nothing is ever executed.
- **Theme contrast.** It is guaranteed for the library themes. A custom theme should keep `primary`, `success`, `info` and `destructive` readable as text on `surface` and `muted`.
