# Editor texels

**Package:** `@texuli/core`  
**Import:** `@texuli/core/editor-model` · `@texuli/core/editor-transforms` ·
`@texuli/core/editor-history` · `@texuli/core/editor-keymap` ·
`@texuli/core/editor-markdown` (subpaths only; not in the root barrel)  
**Source:** `packages/core/src/editor/`  
**Tests:** `packages/core/tests/editor-model.test.ts`,
`editor-transforms.test.ts`, `editor-history.test.ts`,
`editor-markdown.test.ts`

The framework-free model of the rich text editor that
[ADR-003](../../../docs/DECISIONS.md#adr-003-rich-text-editor-architecture)
and [EDITOR_ARCHITECTURE](../../../docs/EDITOR_ARCHITECTURE.md) decided:
document, selection, transforms, history, key intents and the Markdown codec.
No DOM, no HTML and no framework. The Svelte binding that renders it is
the in-development [`@texuli/editor`](../../editor/README.md) package
(on npm from `0.5.0`); nothing here touches the page.

```ts
import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
import { caret } from '@texuli/core/editor-model';
import { insertText, splitBlock } from '@texuli/core/editor-transforms';
import { createEditorHistory, editorHistoryReducer } from '@texuli/core/editor-history';

const { doc, diagnostics } = fromMarkdown(agentText); // untrusted by default
let history = createEditorHistory({ doc, selection: caret(doc.blocks[0].id) });
const result = insertText(history.present, 'Hello');
history = editorHistoryReducer(history, { type: 'apply', result, kind: 'typing', at: Date.now() });
const saved = toMarkdown(history.present.doc); // re-render sink-free
```

## Model (`editor-model`)

- **Document.** An `EditorDocument` is `{ version: 1, blocks }`.
  - Blocks: `paragraph`, `heading` (levels 1–4), `code` (`text`, optional
    `lang`), `list` (`bullet`, `ordered` with `start`, `todo` with `checked`
    items), `quote`, `divider` and `media` (`ref` and `alt`, resolved by the
    host).
  - Paragraphs and headings hold flat runs, `{ type: 'text', text, marks }`
    or `{ type: 'break' }`.
  - Marks: `strong`, `em`, `strike`, `code` and `link` (with `href`).
  - Every block and list item has a runtime-only `id`.
- **Invariants.** `normalizeDocument` repairs them and `validateEditorDocument`
  lists what is broken; it never throws.
  - Runs are non-empty and neighbors differ in marks.
  - Marks are unique and sorted (`link`, `strong`, `em`, `strike`, `code`),
    and `code` excludes every mark but `link`.
  - Containers are non-empty, and a list item starts with a paragraph.
  - `checked` appears only on todo items, and `start` only on ordered lists
    (omitted when it is 1).
  - There is at least one block, and lists and quotes nest at most 4 levels.
  - No control or bidirectional override characters (`cleanText`).
- **Structural sharing.** `normalizeDocument`, `replaceBlock`, `replaceItem` and
  `removeBlocks` keep unchanged blocks identical, so a renderer can skip them.
- **Loading untrusted documents.** `loadEditorDocument(input, { trust, limits, newId })`
  reads unknown JSON into a valid document and never throws.
  - Malformed parts are dropped, and unknown blocks become paragraphs of
    their text.
  - Headings deeper than 4 become level 4.
  - Every href passes `safeHref` at `trust` (`untrusted` by default); a
    refused link keeps its text.
  - Nesting, block count and characters are capped (`EDITOR_LIMITS`: depth
    4, 2,000 blocks, 200,000 characters). A 10,000-deep input, a cyclic
    object and 5,000 blocks are in the tests.
  - Each degradation is reported once in `diagnostics`.
  - Versions other than 1 are refused.
- **Selection.** An `EditorPoint` is `{ block, offset }`: a block id and a
  UTF-16 offset, where a break counts 1. An `EditorSelection` is a text
  selection (`anchor`, `focus`) or a node selection of a divider or media
  block.
  - `clampSelection` keeps a selection valid, snapping to grapheme
    boundaries.
  - `selectionRange` orders the ends.
  - `caret`, `textSelection`, `nodeSelection` and `selectAll` build
    selections.
- **Text boundaries.** `nextGrapheme`, `previousGrapheme`, `snapToGrapheme`,
  `nextWord` and `previousWord` use `Intl.Segmenter`, falling back to code
  points.
- **Inline trees.** `inlineToTree` folds runs into the nested shape the
  renderers walk (`text`, `code`, `break`, `strong`, `em`, `strike`, `link`).
  `inlineFromTree` reads that shape back, untrusted by default.
  - It also accepts the catalog's `value` text key and the blocks tree's
    `del`.
  - It caps nesting at 6.

## Transforms (`editor-transforms`)

Each transform takes an `EditorState` (`doc`, `selection`, `storedMarks`) and
returns `{ ok: true, state }` or `{ ok: false, errors }`. It never mutates its
input. Every accepted state is normalized and within the caps. Options:
`newId` and lower `limits` (a blocks `text` field holds 4,000 characters).

| Transform | Does |
| --- | --- |
| `insertText` | Types at the selection, replacing a range. The text takes the stored marks, else the marks before the caret; a link continues only strictly inside it. `\n` becomes a break; code keeps newlines and tabs |
| `insertBreak` | Shift+Enter: a break, or a newline in code |
| `splitBlock` | Enter. Splits the block. In a list it continues the list, and an empty item lifts out. An empty last paragraph of a quote leaves the quote. At the end of a heading the new block is a paragraph. In code it adds a newline, and an empty last line leaves the code block |
| `deleteBackward`, `deleteForward` | By grapheme, word or line. At a block start: lift a heading, code block, list item or quote first, otherwise join the neighbor. A divider or media block is selected first and deleted on the next press |
| `deleteSelection` | Deletes a range across blocks (emptied containers are pruned) or a selected void block |
| `setBlockType` | Paragraph, heading level or code. A list item's first block stays a paragraph |
| `toggleList`, `sinkListItem`, `liftListItem`, `toggleTodo` | Wrap, retype or unwrap lists; Tab and Shift+Tab; check a todo item |
| `toggleQuote`, `moveBlock` | Wrap or unwrap a quote; move a block or list item up or down |
| `toggleMark` | Toggles over a range (removed when every eligible character has the mark), or the stored marks at a caret |
| `setLink`, `removeLink` | `href` must pass `safeHref` at `trust` (`untrusted` by default), or the edit is refused |
| `insertBlock` | Inserts a divider or a media reference |
| `replaceSelection` | Paste of an already loaded fragment. Ids are fresh; nesting past the cap becomes paragraphs; blocks past the size caps are cut |
| `applyComposition` | Applies an input method's composed text as one edit (prefix and suffix diff) |
| `applyInputRules` | Markdown shortcuts at a paragraph's start (`#` to `####`, `-`, `1.`, `[ ]`, `>`, three backticks, `---`) and inline (`**x**`, `*x*`, `~~x~~`, `` `x` ``, autolinked URLs at the `untrusted` tier) |

Every transform, and a seeded run of 1,500 random transforms, is checked
against `validateEditorDocument`.

## History (`editor-history`)

`createEditorHistory(state, { limit })` and `editorHistoryReducer(history,
action)` keep a snapshot stack (`past`, `present`, `future`, at most 200
steps), with these actions:

- `apply` takes a transform result, a `kind` (`typing`, `deletion`,
  `input-rule` or `other`) and a time.
- `select` changes the selection without adding a step.
- `undo`, `redo` and `replace`.

Consecutive typing, or consecutive deletion, in one block within
`EDITOR_HISTORY_MERGE_MS` (500 ms) merges into one step. A selection change,
a pause, another kind or another block starts a new step. An input rule is
always its own step, so undo restores the typed characters. A refused result
keeps `present` and records `errors`.

## Key intents (`editor-keymap`)

`createEditorKeymap(platform).match(event)` maps a keydown to an
`EditorKeyIntent`, built on `createShortcutMap`. `Mod` is ⌘ on Apple
platforms and Ctrl elsewhere. Composing events never match.

| Intent | Chord |
| --- | --- |
| `toggle-strong`, `toggle-em`, `toggle-code`, `toggle-strike` | `Mod+B`, `Mod+I`, `Mod+E`, `Mod+Shift+X` |
| `link` | `Mod+K` |
| `undo`, `redo` | `Mod+Z`; `Mod+Shift+Z` or `Mod+Y` |
| `paragraph`, `heading-1` to `heading-4` | `Mod+Alt+0`, `Mod+Alt+1` to `Mod+Alt+4` |
| `ordered-list`, `bullet-list`, `todo-list` | `Mod+Shift+7`, `Mod+Shift+8`, `Mod+Shift+9` |
| `quote`, `toggle-todo` | `Mod+Shift+B`, `Mod+Enter` |
| `indent`, `outdent`, `escape` | `Tab`, `Shift+Tab`, `Escape` |

The binding uses Tab only inside lists, so focus is never trapped.
`intentFromInputType(inputType)` maps `beforeinput` input types to intents.
The composition types map to `composition`, and unsupported types (such as
`formatUnderline`) map to `null`.

## Markdown codec (`editor-markdown`)

`fromMarkdown(source, { trust, limits, maxSource })` reads the closed subset
that blocks text and catalog rich text use. `toMarkdown(doc)` writes it.

**Reading:**

- It follows the same rules as `@texuli/blocks/text/markdown`, with the same
  escapes, the same delimiter rules and the literal-text rule for raw HTML.
- Links pass `safeHref`, `untrusted` by default.
- Images inside text become their alt text. An image alone in a paragraph
  becomes a `media` block whose `ref` the host resolves.
- Headings deeper than 4 become level 4.
- Input is capped at 100,000 characters (`MARKDOWN_CODEC_LIMITS`).
- Delimiter closers and bracket pairs are computed once per span, so hostile
  delimiter runs stay linear. 100,000-character runs of `*a `, `_a `,
  `**a `, `[a`, `` `a `` and `~~a ` are in the tests, bounded at 3 s each.
- Block lines are classified in linear time: the heading closing sequence
  and the fence info string are read by hand, and the line patterns have no
  overlapping quantifiers (runs of spaces before a closing `#` or after a
  fence once backtracked cubically and quadratically). Trailing spaces
  before a hard break are counted from the end of the line.
- `\r\n` and `\r` read as `\n`. U+2028 and U+2029 are not line endings: they
  stay inside their line (a heading, list item or quote keeps its kind) and
  the model stores them as breaks.

**Writing:**

- The writer escapes what would read back differently and checks its own
  output by reading it back.
- Writing is stable: what was written reads and writes back unchanged for
  2,000 seeded inputs.
- Writing is linear: each mark's span end is computed once from the end of
  the paragraph, and runs of breaks are crossed in constant time (long
  marked link labels and tens of thousands of breaks once made it
  quadratic).
- Reading what was written gives the same document, except what the subset
  cannot spell: empty paragraphs, breaks in headings (written as spaces),
  breaks and whitespace at the edges of a block or of a mark, and an em mark
  on a lone `*` or `_` (5 of the 2,000 seeded inputs).

## Not covered yet

- **Parity with the blocks parser** is only by construction; there is no
  test of it. A parity test that runs both parsers belongs to the blocks
  adoption task, because core cannot import blocks.
- **Paste import** of clipboard HTML (the owned tokenizer in the ADR) is not
  a core texel: it lives in `@texuli/editor/paste`.
- **The DOM side is not in core:** DOM selection mapping, the
  `beforeinput` binding and the editing surface live in `@texuli/editor`
  (`./controller`, `./editor`).
- **Code blocks inside list items** do not round-trip two consecutive blank
  lines.
- **Size:** these subpaths are larger than the 4 KiB per-texel default
  budget (see the package README), so each has its own row in
  `texuli.budgets.json`; `pnpm size` reports all three within budget.
