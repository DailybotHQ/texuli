# @texuli/editor

Rich text editor surface built on the `@texuli/core` editor texels:
the closed document model, pure transforms, snapshot history, keyboard
map and the Markdown codec, bound to an owned, sink-free Svelte 5
rendering (no `{@html}`, no `innerHTML`, links through the URL policy).
Layer L4, beside the other domain packages.

**Status: in development.** This package is private (`0.0.0`) and excluded
from packing until its own release; nothing here is published. The
architecture contract is
[ADR-003](../../docs/DECISIONS.md) and
[EDITOR_ARCHITECTURE](../../docs/EDITOR_ARCHITECTURE.md); the model lives in
[`@texuli/core`](../core) (the `editor-*` subpaths,
[core-editor](../core/docs/core-editor.md)).

## Subpaths

| Subpath | What it holds | Doc |
| --- | --- | --- |
| `.` | Everything below, as one barrel | — |
| `./editor` | `RichTextEditor` (toolbar, link dialog and surface), `EditorSurface`, the DOM selection mapping | [editor-surface](docs/editor-surface.md) |
| `./toolbar` | `EditorToolbar`, the roving formatting toolbar | [editor-toolbar](docs/editor-toolbar.md) |
| `./link-dialog` | `LinkDialog`, link editing through the URL policy | [editor-link-dialog](docs/editor-link-dialog.md) |
| `./controller` | `EditorController`, the headless editor (history, commands, composition guard, announcements) and `DEFAULT_EDITOR_LABELS` | [editor-controller](docs/editor-controller.md) |
| `./paste` | Framework-free clipboard import: the owned HTML tokenizer, plain text and the editor's JSON format | [editor-paste](docs/editor-paste.md) |

Each subpath has its own gzip budget in `texuli.budgets.json`
(`pnpm size --filter @texuli/editor`). The editor surface bundles the core
editor texels, so `./editor` measures about 34 KiB gzip; `./paste` and
`./controller` load no UI.

## Using it

```svelte
<script lang="ts">
  import { fromMarkdown, toMarkdown } from '@texuli/core/editor-markdown';
  import { RichTextEditor } from '@texuli/editor/editor';

  // Untrusted Markdown (agent output, stored text) loads at the untrusted tier.
  const { doc } = fromMarkdown('Hello **world**');
  let markdown = $state(toMarkdown(doc));
</script>

<RichTextEditor value={doc} label="Notes" onChange={(next) => (markdown = toMarkdown(next))} />
```

`value` is read on mount and whenever a new document arrives from outside
(history restarts); the editor's own edits arrive through `onChange`. Keep a
held document in `$state.raw`, not `$state`, so it is not deep-proxied.

## What works today

- **Rendering.** Every node and mark of the closed vocabulary renders through
  owned Svelte components with text interpolation only: `h1`–`h4`, `p`,
  `ul`/`ol`/`li`, todo checkboxes outside the editable text, `blockquote`,
  `pre`/`code`, `hr`, and media blocks the host resolves with `resolveMedia`
  (checked by `safeImageSrc` at the untrusted tier). Link hrefs are checked
  again by `safeHref` at render; a refused one renders as marked text. Links
  get `rel="noopener noreferrer nofollow"` and no `target`.
- **Input.** One `contenteditable` textbox. Every cancelable `beforeinput` is
  prevented and becomes a model transform; unsupported input types (such as
  underline) are refused. The keymap from `@texuli/core/editor-keymap` runs
  marks, headings, lists, quote, todo toggle, undo and redo; Tab indents only
  inside lists, and Escape then Tab leaves the editor.
- **Input methods.** Between `compositionstart` and `compositionend` the model
  is not touched; at the end the block's DOM text is diffed into one typing
  step and the block re-renders from the model. Inputs that cannot be
  canceled take the same path on `input`.
- **Selection.** Block id plus UTF-16 offset, read from the DOM on
  `selectionchange` and written back after each render.
- **Paste** is data: clipboard HTML goes through the owned tokenizer and an
  element allowlist, then the core untrusted loader; every pasted link is
  checked at the `untrusted` tier whatever the editor's `trust` is.
- **Links** typed in the dialog pass `safeHref` at the editor's `trust`
  (`untrusted` by default). A refused address shows a visible error and the
  document does not change.
- **Announcements** through the core announcer (polite): mark toggles at a
  caret, block type changes, list level, undo and redo, paste results and
  refusals.
- **Styles** use `--tx-*` tokens and logical properties only; forced-colors
  mappings are included. Off-screen top-level blocks use
  `content-visibility: auto`.
- **Read-only** mode keeps the textbox with `aria-readonly="true"` and refuses
  every edit.

Tests: `pnpm vitest run packages/editor` (22 tests in 2 files: the model,
including hostile paste and link-policy cases, and the component). Examples:
`editor-basic`, `editor-toolbar` and `editor-long-document` in
`@texuli/examples`, with light and dark visual baselines.

## Not done yet

- Copy writes no `application/x-texuli-editor+json` data yet (the native
  copy runs; paste reads that format when present). Drop is refused.
- No “Paste as Markdown” command, no block-type menu (the toolbar has
  heading buttons) and no drag handles.
- No browser behavior scenario, axe sweep, CSP matrix row or `tests/perf`
  limit for the editor yet; the long-document posture is a design budget,
  not a measured result.
- Tree adapters to blocks and the catalog are planned in those packages.

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-editor).
