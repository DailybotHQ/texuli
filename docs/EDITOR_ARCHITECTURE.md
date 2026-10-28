# Rich text editor architecture

**Status: the model and the editor package are implemented, in development
and unpublished.** This is the long-form companion to
[ADR-003](DECISIONS.md#adr-003-rich-text-editor-architecture) and fixes the
contracts that the editor tasks implement. The framework-free model exists
as core texels: the document, selection, transforms, history, key intents
and the Markdown codec ([core-editor](../packages/core/docs/core-editor.md)).
The `@texuli/editor` package (publishable from `0.5.0`, not on npm yet)
holds the paste import, Markdown in and out, the DOM selection mapping and
the Svelte 5 editing surface
([packages/editor](../packages/editor/README.md)). The browser behavior
scenario, CSP matrix row, perf limit and the blocks and catalog adapters are
still planned. Each section says what is fixed, the option chosen, one
rejected alternative, and how to reverse the choice.

Texuli builds the editor from scratch, like every primitive: no editor
dependency, no other component library, and no HTML sinks
([AGENTS.md](../AGENTS.md) rules 6 and 7).

## Goals and constraints

- **One shape in both directions.** The editor edits the same content the
  sink-free renderers display: `@texuli/blocks` text blocks (a `markdown`
  string, at most 4,000 characters) and the catalog rich-text subset
  (`@texuli/catalog/render/richtext`). Agent output can be loaded, edited,
  saved and re-rendered without passing through HTML.
- **Untrusted by default.** Loaded documents, pasted content and typed URLs
  are untrusted unless the host says otherwise
  ([SECURITY](SECURITY.md)).
- **CSP-clean.** The fixture build enforces `require-trusted-types-for
  'script'` with only the `svelte-trusted-html` policy, and inline style
  attributes are not allowed. The editor must not need a new Trusted Types
  policy and must not write `style` attributes.
- **Layers point down only** ([ARCHITECTURE](ARCHITECTURE.md)). Core (L0) is
  framework-free and cannot import blocks (L5) or catalog (L6). Chat is L4,
  so it cannot import another L4 package.
- **Accessible editing** that keeps the platform's caret, spellcheck, input
  methods and screen-reader editing support
  ([ACCESSIBILITY](ACCESSIBILITY.md)).

## 1. Layer placement

**Fixed:**

The model was first placed in `@texuli/editor/model`. The editor-texels task
(PLAN_005 task 8) took this section's reversal path and moved it down into
core, so blocks, catalog and chat-side hosts can all import it without
waiting for a new package. The table shows where things live now.

| Where | Subpath | What lives there | Status |
| --- | --- | --- | --- |
| L0 `@texuli/core` | `editor-model` | Document types and caps, the closed vocabularies, normalization, validation, the untrusted loader, selection, grapheme and word boundaries (`Intl.Segmenter`, with a code-point fallback), the nested inline interchange shape | Exists |
| L0 `@texuli/core` | `editor-transforms` | Pure transforms, the composition diff and the Markdown input rules | Exists |
| L0 `@texuli/core` | `editor-history` | The snapshot-stack history | Exists |
| L0 `@texuli/core` | `editor-keymap` | Key chords and `beforeinput` input types to editing intents, platform-aware (`Mod` is Cmd on Apple platforms, Ctrl elsewhere) | Exists |
| L0 `@texuli/core` | `editor-markdown` | The Markdown-subset codec | Exists |
| L4 `@texuli/editor` | `paste` | Framework-free clipboard import (section 8) | Exists |
| L4 `@texuli/editor` | `markdown` | `markdownToDocument` and `documentToMarkdown` over the core codec (section 9), outside the barrel | Exists |
| L4 `@texuli/editor` | `controller` | The headless editor: history, commands, composition guard, announcements | Exists |
| L4 `@texuli/editor` | `editor` | `RichTextEditor` and `EditorSurface`, plus the DOM selection mapping through `data-*` block markers (the planned core `editable-selection` texel lives here) | Exists |
| L4 `@texuli/editor` | `toolbar`, `link-dialog` | The formatting toolbar and the link dialog (Svelte 5), built on primitives and texuli components | Exists |
| L4 `@texuli/editor` | `.` | The package barrel. It does not lazy-load the UI: the entry measures about 34 KiB gzip with the core texels bundled | Exists |

The editor package depends on core, primitives, tokens and texuli, like the
other L4 packages. Adding the package and its `LAYERS` row in
`scripts/check-layers.ts` needs owner approval (workspace and lockfile).

**Who uses it:**

- **Blocks (L5)** and **catalog (L6)** import the model from core and own the
  adapters to their own trees (section 9).
- **Chat (L4)** cannot import the editor. A rich composer reaches the thread
  through the existing host `composer` snippet of `ChatThread`
  ([chat composer](../packages/chat/docs/chat-composer.md)). The built-in
  composer stays a textarea.

**Chosen:** generic editing behavior (segmentation, intents, composition, DOM
selection mapping) goes in core as texels. The document vocabulary and its
codec are a content contract, not a texel, so they go in the editor package.
**Rejected:** putting the document model in core. Every layer would carry a
content vocabulary that only the editor, blocks and catalog use, and core
would turn from behavior and policy into a content-format package.
**Rejected:** defining the interchange types in catalog (L6). The editor
cannot import upward.
**Amended (task 8):** the model now lives in core after all, outside the
root barrel, as the table above shows. The ADR-003 amendment records why.
**Reverse:** if a package at L1–L3 needs the model, move `model` down into
core as a texel subpath and keep `@texuli/editor/model` as a re-export so
imports do not change. If chat needs a built-in rich composer, move chat to
L5 (a `LAYERS` change); do not move the editor down.

## 2. Document model and vocabularies

**Fixed:** a document is versioned. It holds a tree of blocks, and each text
block holds a flat sequence of text runs with mark sets.

```ts
type EditorDocument = { version: 1; blocks: readonly Block[] };

type TextBlock =
  | { id: BlockId; type: 'paragraph'; content: Inline[] }
  | { id: BlockId; type: 'heading'; level: 1 | 2 | 3 | 4; content: Inline[] };

type Block =
  | TextBlock
  | { id: BlockId; type: 'list'; kind: 'bullet' | 'ordered' | 'todo'; start?: number; items: ListItem[] }
  | { id: BlockId; type: 'code'; lang?: string; text: string }
  | { id: BlockId; type: 'quote'; blocks: Block[] }
  | { id: BlockId; type: 'divider' }
  | { id: BlockId; type: 'media'; ref: string; alt: string };

type ListItem = { id: BlockId; checked?: boolean; blocks: Block[] }; // first block is a paragraph

type Inline =
  | { type: 'text'; text: string; marks: Mark[] }
  | { type: 'break' };

type Mark =
  | { type: 'strong' } | { type: 'em' } | { type: 'strike' } | { type: 'code' }
  | { type: 'link'; href: string };
```

This is a sketch of the contract; the exact TypeScript lands with the model
task.

Node vocabulary, version 1 (closed):

| Node | Notes |
| --- | --- |
| `paragraph` | The default text block |
| `heading` | Levels 1–4, the same range as the heading block. Deeper Markdown headings import as level 4, with a diagnostic |
| `list` | `bullet`, `ordered` (with `start`) or `todo` (items carry `checked`). Items hold blocks, so lists nest |
| `code` | Plain text with an optional `lang`. Marks are not allowed inside |
| `quote` | Holds blocks |
| `divider` | A void block |
| `media` | A void block that references media by `ref`. The host resolves `ref` through `safeImageSrc` or `safeMediaSrc`; the editor never loads a URL written in the document |

Mark vocabulary, version 1 (closed): `strong`, `em`, `strike`, `code` and
`link` (with `href`). `code` excludes every other mark except `link`. A run
holds each mark type at most once.

Invariants, enforced by `normalize` and checked by `validate`:

- Adjacent text runs with equal mark sets merge, and empty runs are removed.
  The only exception is an empty text block, which holds no runs.
- Marks are kept in canonical order: `link`, `strong`, `em`, `strike`,
  `code`.
- A document has at least one block. A list item starts with a paragraph.
- Lists and quotes nest at most 4 levels, the same as the blocks Markdown
  subset.
- No control characters or bidirectional override characters appear in text.
  The blocks schemas reject them, so the editor strips them on input and
  reports a diagnostic.
- Planned limits (`EDITOR_LIMITS`): 2,000 blocks, 200,000 characters, and
  href length capped by the URL policy. When the target is a blocks `text`
  field, the editor also enforces that field's 4,000-character cap and shows
  the remaining count.

Block `id`s are runtime-only. They are assigned on load and are never
serialized, so Markdown round trips do not depend on them.

**Versioning:**

- A vocabulary version is a closed set. Adding a node, a mark or an attribute
  creates a new `version`, plus a pure migration function from the previous
  version.
- A reader rejects versions newer than it knows.
- When untrusted input names a node type that is not in the vocabulary, the
  node degrades to a paragraph of its plain text, with a diagnostic. This is
  the same rule as everywhere else: hostile input degrades to text.

**Chosen:** flat inline runs with mark sets. **Rejected:** a nested inline
tree, the shape the renderers use. The same visible text could be stored as
several different trees (`strong(em(x))` and `em(strong(x))`), which makes
offsets, equality and normalization harder. Adapters build the nested trees
on export (section 9).
**Reverse:** the adapters are the only code that sees the run shape from
outside the model. A switch to nested inlines would replace the model
internals and keep the adapters' signatures.

## 3. Selection

**Fixed:** a selection is expressed in model coordinates. DOM ranges are
never stored.

```ts
type Point = { block: BlockId; offset: number };
type Selection =
  | { kind: 'text'; anchor: Point; focus: Point }
  | { kind: 'node'; block: BlockId }; // a divider or media block
```

- `offset` counts UTF-16 code units in the text block's flattened text, the
  same units as JavaScript strings and DOM offsets. A `break` counts as one
  unit.
- Transforms snap offsets to grapheme boundaries (`editor-model`), so a caret
  never splits an emoji or a combining sequence.
- On `selectionchange` the surface reads the DOM selection into a model
  selection (`editable-selection`). After each render it writes the model
  selection back. During composition it does neither (section 6).
- Arrow keys, Home/End and right-to-left caret movement stay native, and the
  model follows them.

**Chosen:** points made of a block id and an offset. **Rejected:** DOM ranges
as the source of truth. They point at nodes that each render replaces, and
they cannot be stored in history or tested without layout.
**Rejected:** points made of a path and an offset. Paths shift when blocks
are inserted above them, while ids stay stable across history.
**Reverse:** points pass through one module (`editable-selection` plus the
model's point helpers). Switching to paths would change only that module and
the history entries.

## 4. Transforms and commands

**Fixed:**

- A transform is a pure function of type `(state, ...args) => TransformResult`,
  where `state` is `{ doc, selection }`.
- A result holds either the new state and any diagnostics, or the issues that
  refused the edit.
- A transform never mutates its input. Unchanged blocks keep their object
  identity (structural sharing), so the renderer can skip them (section 11).
- Every accepted state is normalized. Tests check it with `validate`, and a
  seeded random-edit test applies hundreds of transforms and validates every
  result, like the
  [animation timeline model](../packages/media/docs/timeline.md).
- Core transforms are `insertText`, `deleteRange`, `splitBlock`,
  `joinBackward`, `joinForward`, `setBlockType`, `toggleMark`, `setLink`,
  `removeLink`, `wrapInList`, `liftListItem`, `sinkListItem`,
  `toggleTodo`, `insertBreak`, `insertBlock` (divider or media) and
  `replaceSelection` (paste).
- A command binds a transform to an intent from `editor-keymap`. The keyboard
  map in section 6 is a table of intents and commands.

**Chosen:** pure model-to-model functions with refusal results, the same
pattern as the image editor and the timeline model. **Rejected:** mutating
the DOM and reading the model back from it. The result would depend on the
browser, and it could not be tested in happy-dom.
**Reverse:** a step log (section 5) can wrap the same functions if
operational steps are ever needed, so the transform signatures stay.

## 5. History

**Fixed:**

- History is a snapshot stack of immutable `{ doc, selection }` states:
  `past`, `present`, `future`, and the last refusal's issues. Actions are
  `apply`, `undo`, `redo` and `replace`.
- Consecutive typing in one block merges into one undo step until a pause
  (planned at 500 ms), a selection jump, or a change of block. Consecutive
  deletions merge the same way.
- An input rule (section 6) is its own step, so Undo right after it restores
  the literal characters the user typed.
- History keeps at most 200 steps. Because of structural sharing, a step
  costs only the changed blocks.

**Chosen:** a snapshot stack, the same model as the image editor and timeline
histories. **Rejected:** an inverse-patch stack, where each step records its
own inverse. Each transform would need a correct inverse, and an inverse bug
corrupts the document silently. With structural sharing, snapshots cost
little memory and are correct by construction.
**Reverse:** if collaborative editing is planned, transforms also emit
invertible steps into a log, and history replays inverses. The snapshot API
(`undo`, `redo`, `replace`) stays the same for hosts.

## 6. Input, keyboard and IME composition

**Surface:**

- The editing surface is one `contenteditable` region. Svelte renders it
  from the model using text interpolation only.
- Every cancelable `beforeinput` event is prevented and handled as a command.
  The model is the only source of truth.

**Composition (input methods):**

- Between `compositionstart` and `compositionend`, the editor lets the
  browser change the composing block's DOM. During that time it does not
  re-render that block, apply input rules or shortcuts, or sync the
  selection.
- Enter is ignored while composing (`isComposing`, or key code 229), as the
  chat composer already does.
- At `compositionend`, `applyComposition` (`editor-transforms`) diffs the block's DOM text
  against its model text. It expects one contiguous change and applies it as
  a single `insertText` (merged in history). Then the block re-renders.
- Input types that cannot be canceled, such as some mobile replacement and
  autocorrect events, take the same diff path.

**Keyboard map.** `Mod` is Cmd on Apple platforms and Ctrl elsewhere.

| Input | Behavior |
| --- | --- |
| Typing | Replaces the selection with the text. Marks continue from the run before the caret (stored marks after a toggle) |
| Enter | Paragraph or heading: split. At the end of a heading, the new block is a paragraph. List item: new item (an unchecked item in todo lists). Empty list item: outdent one level, or leave the list at the top level. Code: newline. Empty last line in code: leave the code block. Empty paragraph that ends a quote: leave the quote |
| Shift+Enter | A `break` in text blocks; a newline in code |
| Backspace at block start | Heading, quote or list item: first lift it (to a paragraph, out of the quote, outdent). Paragraph: join with the previous text block. If the previous block is a divider or media block, select it (node selection); the next Backspace deletes it |
| Delete at block end | Mirrors Backspace forward |
| Word and line deletion | The native `deleteWordBackward`, `deleteSoftLineBackward` and related input types, with word boundaries from `editor-model` |
| Tab / Shift+Tab | Indent or outdent inside list items only. Elsewhere, Tab moves focus as usual, so focus is never trapped |
| Escape | Leaves the toolbar or link dialog back to the text. In the text, it arms a one-shot “Tab leaves the editor” state so Tab exits even from a list |
| Mod+B / Mod+I / Mod+E / Mod+Shift+X | Toggle strong / em / code / strike |
| Mod+K | Open the link dialog for the selection |
| Mod+Z / Mod+Shift+Z or Mod+Y | Undo / redo |
| Mod+Alt+0 / Mod+Alt+1–4 | Paragraph / heading level |
| Mod+Shift+7 / 8 / 9 | Ordered / bullet / todo list |
| Mod+Shift+B | Quote |
| Mod+Enter | Toggle the todo item's check |

Input rules at the start of a block: `#` to `####` followed by a space make a
heading; `-`, `*` or `+` and a space make a bullet list; `1.` and a space
make an ordered list; `[ ]` or `[x]` and a space make a todo; `>` and a space
make a quote; three backticks make a code block; `---` makes a divider.

Inline input rules: `**x**`, `*x*`, `` `x` `` and `~~x~~`, plus autolinking of
a typed URL when the next character is a space. An autolinked URL passes
`safeHref` (section 8).

**Chosen:** `contenteditable` with `beforeinput` handled by the editor and
the model as the source of truth. **Rejected:** a hidden textarea with a
custom-drawn caret. It loses native input methods, spellcheck, selection
handles on touch screens, and the screen reader's editing semantics.
**Reverse:** `editor-keymap` and `applyComposition` keep the input layer
separate. A different input surface would replace them and keep the
transforms, history and keyboard map.

## 7. Accessibility contract

**Surface semantics:**

- The surface is `role="textbox"` with `aria-multiline="true"`, named by
  `aria-labelledby` or `aria-label`, and described by a visually hidden
  keyboard help text (`aria-describedby`).
- Placeholder text is not the name.
- Read-only mode keeps the textbox in the reading order with
  `aria-readonly="true"`.

**Toolbar:**

- The toolbar is `role="toolbar"` with an `aria-label`. It uses core roving
  focus: one Tab stop, arrow keys move between controls, and Home/End jump to
  the ends.
- Mark buttons expose `aria-pressed`. The block-type control is a listbox or
  menu primitive.
- The toolbar comes before the surface in focus order.

**Rendered structure:**

- Headings, lists, quotes and code render as real elements (`h1`–`h4`,
  `ul`/`ol`/`li`, `blockquote`, `pre`/`code`, `hr`), so reading-mode
  navigation works.
- Todo checks are checkboxes named “Done” or “Not done” (translatable),
  outside the editable text.
- Indentation uses classes and `data-depth`, never `style` attributes.

**Announcements:** through the core announcer, polite, debounced and
translatable. Characters, words and caret movement are not announced; the
screen reader already speaks them. The editor announces:

- mark toggles with no selection (“Bold on”);
- block type changes (“Heading 2”, “Bulleted list”);
- list indent level (“Level 2”);
- undo and redo with what was undone (“Undid typing”);
- what paste did (“Pasted 3 paragraphs; 1 link removed”);
- a refused edit's reason (“The text block is full”).

**Visual:** forced-colors mappings, visible focus on the surface and every
control, logical properties throughout, and right-to-left support through the
inherited `dir`.

**Chosen:** a labelled multiline textbox with a separate roving toolbar,
following the Authoring Practices toolbar pattern. **Rejected:**
`role="application"`. It switches off the screen reader's reading and
editing support for the whole region and forces the editor to rebuild it.
**Reverse:** the roles live in the `ui` subpath only. Changing them changes no
model or texel contract.

## 8. Paste and link security

**Clipboard formats,** read in this order:

1. `application/x-texuli-editor+json`, from the editor's own copy. It is still
   untrusted: it is parsed, validated against the vocabulary, and every href
   passes the policy again.
2. `text/html`, sanitized into the vocabulary (below).
3. `text/plain`, inserted as text. Blank lines split paragraphs. Markdown is
   not interpreted on paste. A separate “Paste as Markdown” command runs the
   Markdown codec.

**HTML import:**

- Clipboard HTML goes through an owned, framework-free tokenizer
  (`@texuli/editor/paste`) that reads tags, attributes, text and character
  references from the string. It never builds a DOM.
- An allowlist maps elements to nodes and marks:
  - `p`, `div` and `br` → paragraph and break;
  - `h1`–`h6` → heading, clamped to level 4;
  - `ul`, `ol`, `li` and checkbox `input` → list, item and todo;
  - `pre`/`code` → code;
  - `blockquote` → quote;
  - `hr` → divider;
  - `b`/`strong` → strong; `i`/`em` → em; `s`/`del`/`strike` → strike;
    `code` → code;
  - `a[href]` → link.
- Every other element is dropped and its text is kept. `script`, `style`,
  `template` and the content of comments are dropped with their text.
- No attribute other than `href` is read. Images become their `alt` text;
  pasted media becomes a `media` block only when the host's `resolveMedia`
  callback accepts it.
- Pasted HTML is never inserted into the live DOM and never rendered as HTML.

**Links:**

- Every href, whether loaded, pasted, typed in the link dialog or autolinked,
  passes `safeHref` from `@texuli/core/url-policy`.
- The tier is the editor's `trust` prop, `untrusted` by default and failing
  closed through `resolveTrust`.
- Pasted and autolinked URLs always use `untrusted`, whatever the prop says.
- A refused href keeps its text, drops the link, and reports a
  `link-rejected` diagnostic.

**Inside the surface:**

- Links render as anchors with the policy-checked href and `rel="noopener
  noreferrer nofollow"`, and no `target`.
- A plain click places the caret. Mod+click opens the link.

**Limits:**

- A paste above the remaining document limit is cut at a block boundary,
  with a diagnostic.
- Control and bidirectional override characters are stripped.

**Chosen:** an owned string tokenizer with an allowlist. **Rejected:**
parsing with `DOMParser`. Under `require-trusted-types-for 'script'` it is a
Trusted Types sink, so it would need a new policy, which weakens the CSP
posture. It is also a large parser surface that the editor does not own.
**Reverse:** if the platform's HTML Sanitizer API becomes available in every
supported browser and passes the CSP matrix, the tokenizer can be replaced
behind `@texuli/editor/paste`. The allowlist mapping to the vocabulary stays.

## 9. Interchange with blocks and the catalog

**Fixed:** the wire format is the closed Markdown subset. It is the string
that blocks `text` fields and the catalog's rich text already parse.

- **Markdown codec.** `@texuli/core/editor-markdown` exports `toMarkdown(doc)` and
  `fromMarkdown(source, { trust })`; `@texuli/editor/markdown` wraps them as
  `markdownToDocument` and `documentToMarkdown` (which checks every link
  again at its `trust` before writing). It is an owned codec of the same subset
  as `@texuli/blocks/text/markdown`, with the same escapes, limits and
  literal-text rule for HTML.
- **Edit agent output.** `fromMarkdown` loads the untrusted string into the
  editor, `toMarkdown` saves it, and the existing renderers re-parse it
  sink-free. Agent content never becomes HTML at any step.
- **Tree adapters,** for hosts that hold parsed trees rather than strings.
  They live in the upper packages, which may import the editor model:
  - **Blocks** (planned `@texuli/blocks/text/editor`) maps the editor
    document to and from `MdDocument` and to block lists. A `text` block
    takes the whole document as Markdown. `heading`, `list`, `quote`,
    `divider` and `code` blocks map one to one when a host edits a block list
    rather than one text field. `media` maps to a media-family block.
  - **Catalog** (planned, beside `@texuli/catalog/render/richtext`) maps the
    editor's inline runs to and from `RichTextInline`.
    - Runs fold into nested nodes in the canonical mark order.
    - Catalog nodes have no `strike`; until the catalog vocabulary adds it
      (a versioned addition), strike exports as its plain children with a
      `mark-dropped` diagnostic.
    - A catalog link without `href` (rejected by the policy) imports as
      plain text.
    - Only paragraphs and breaks cross into catalog rich text; other blocks
      flatten to paragraphs with a diagnostic.
- **Round-trip invariants,** enforced by property tests:
  - `fromMarkdown(toMarkdown(d))` equals `normalize(d)` for every valid
    document within the limits;
  - `parseMarkdown(toMarkdown(d))` from blocks equals the blocks adapter's
    tree for `d`, so the editor and the renderer agree on every document the
    editor can produce.

**Chosen:** Markdown subset strings as the shared wire format, with adapters
in the layer that owns each tree. **Rejected:** making `RichTextInline` (L6)
the editor's model. The editor cannot import upward. That type also has no
blocks, no strike, and an optional `href`, which is a renderer-output shape,
not an editing shape.
**Reverse:** once the catalog and blocks adopt the editor model as their
parsed tree, the adapters shrink to re-exports. Until then, the property
tests keep the three parsers in agreement, and a mismatch fails the tests
rather than shipping.

## 10. Rendering long documents and size budgets

**Rendering:**

- The editor renders every block, keyed by `id`.
- Structural sharing means a keystroke re-renders only the changed block.
- Each block gets `content-visibility: auto` with a
  `contain-intrinsic-block-size` estimate. Off-screen blocks skip layout and
  paint, and they stay in the DOM, findable with in-page search, and
  readable by screen readers.

**Performance posture.** These are budgets the implementation must meet, not
measured numbers:

- For a document at the planned limit (2,000 blocks, 200,000 characters), a
  keystroke reaches paint within one frame on a desktop-class machine.
- The opt-in perf suite (`tests/perf`) measures this when the editor lands.

**Size posture:**

- The entry stays small and lazy-loads the UI chunk, the same split as the
  timeline editor.
- `model` and `paste` are separate subpaths, so a renderer-side host that
  only converts content does not load any UI.
- Budget rows for every new subpath are added by the owner in
  `texuli.budgets.json` when the package lands, at the first measured size
  plus the usual margin.
- No existing budget is raised for the editor. A host that does not import
  `@texuli/editor` pays nothing.

**Chosen:** measured full rendering with keyed blocks and `content-visibility`.
**Rejected:** windowed rendering, which removes off-screen blocks from the
DOM. It breaks in-page search, screen-reader browsing of the whole document,
and selections that extend past the window.
**Reverse:** if the perf suite shows the budget failing at the limit,
off-screen blocks can be windowed with the data package's virtual list, which
needs a move of the surface into a layer above data. Alternatively, the limit
can be lowered. Either change is a new decision.

## Tests the editor tasks owe

- **Model.** Unit tests for every transform, for normalization and for the
  validator, plus a seeded random-edit test that validates every result.
- **Codec.** Markdown codec round-trip property tests, a blocks parity test
  and a catalog adapter parity test.
- **Hostile input.** Paste tests with the hostile fixtures: `javascript:`
  links, `<script>`, `<img onerror>`, deep nesting, bidi overrides and
  oversized clipboards.
- **Texels.** Unit tests for the `editor-keymap` mapping and the
  `applyComposition` diff.
- **Browser.** A behavior scenario in Chromium covering typing, Enter and
  Backspace semantics, list indentation, undo, IME composition through the
  Chrome DevTools Protocol, axe, forced colors and the CSP matrix. Visual
  baselines for an example, and a perf limit in `tests/perf`.
