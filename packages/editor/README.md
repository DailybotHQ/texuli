# @texuli/editor

A rich text editor for Svelte 5: headings, lists, todo lists, quotes, code,
dividers, media references, and the strong, em, strike, code and link marks,
with undo and redo, input-method composition, Markdown shortcuts, a roving
formatting toolbar, a link dialog, safe paste, and Markdown in and out. The
document is an owned, closed model (the `@texuli/core` editor texels), and
the rendering is sink-free: no `{@html}`, no `innerHTML`, every link through
the URL policy. It is part of [Texuli](https://texuli.com), "Small pieces.
Infinite possibilities.": an MIT Svelte 5 component library by Dailybot, Inc.

> **Status: in development (pre-1.0).** `@texuli/editor` is published on
> npm as `0.11.3`, with provenance (first published as `0.5.0`; the publish
> workflow publishes it after `texuli`). Under 0.x a new minor (`0.12.0`) may contain
> breaking changes, so pin the exact version or use `^0.11.0`, which accepts
> only 0.11.x. The architecture
> contract is ADR-003 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
> and [EDITOR_ARCHITECTURE](https://github.com/DailybotHQ/texuli/blob/main/docs/EDITOR_ARCHITECTURE.md).

## Install

```bash
npm install @texuli/editor
```

In the Texuli workspace, depend on it as
`"@texuli/editor": "workspace:*"`. It builds on `@texuli/core`,
`@texuli/primitives`, `@texuli/tokens` and `texuli`; `svelte` (^5.57.2) is a
peer dependency. Import the token stylesheet once
(`@texuli/tokens/base.css`); the editor imports its own CSS.

## Quick start

```svelte
<script lang="ts">
  import { RichTextEditor } from '@texuli/editor/editor';
  import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';

  // Untrusted Markdown (agent output, stored text) reads at the untrusted tier.
  const { doc } = markdownToDocument('# Plan\n\n- [ ] Draft the **brief**\n- [x] Book the room');
  let markdown = $state(documentToMarkdown(doc));
</script>

<RichTextEditor value={doc} label="Notes" onChange={(next) => (markdown = documentToMarkdown(next))} />
```

`value` is read on mount and whenever a new document arrives from outside
(history restarts); the editor's own edits arrive through `onChange`. Keep a
held document in `$state.raw`, not `$state`, so it is not deep-proxied.

## Subpaths

| Import | What it gives you | Doc |
| --- | --- | --- |
| `@texuli/editor/editor` | `RichTextEditor` (toolbar, link dialog and surface), `EditorSurface`, the DOM selection mapping | [editor-surface](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-surface.md) |
| `@texuli/editor/toolbar` | `EditorToolbar`, the roving formatting toolbar | [editor-toolbar](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-toolbar.md) |
| `@texuli/editor/link-dialog` | `LinkDialog`, link editing through the URL policy | [editor-link-dialog](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-link-dialog.md) |
| `@texuli/editor/controller` | `EditorController`, the headless editor (history, commands, composition guard, announcements), and `DEFAULT_EDITOR_LABELS` | [editor-controller](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-controller.md) |
| `@texuli/editor/markdown` | `markdownToDocument` and `documentToMarkdown`: framework-free Markdown in and out | [editor-markdown](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-markdown.md) |
| `@texuli/editor/paste` | Framework-free clipboard import: the owned HTML tokenizer, plain text and the editor's JSON format | [editor-paste](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-paste.md) |
| `@texuli/editor` | The editor, toolbar, link dialog, controller and paste in one barrel (not the Markdown codec), plus `EDITOR_PACKAGE_VERSION` | — |

Each subpath has its own gzip budget in `texuli.budgets.json`
(`pnpm size --filter @texuli/editor`). The editor surface bundles the core
editor texels, so `@texuli/editor/editor` measures about 34 KiB gzip;
`@texuli/editor/markdown` about 8.5 KiB, and `./paste` and `./controller`
load no UI.

## New in 0.6.0

Ships in `0.6.0`; the `0.5.0` release predates it: host inline extensions
(G48). Mentions and references register a sigil from a closed set
(`createInlineExtensions` in `@texuli/core/editor-model`) and round-trip
through `@texuli/editor/markdown` as `<sigil>{id|label}` with an
`extension` mark that keeps their id; the editor renders them as a
`tx-editor-extension` span
([editor-markdown](https://github.com/DailybotHQ/texuli/blob/main/packages/editor/docs/editor-markdown.md#host-inline-extensions)).

## Key guarantees

- **No HTML sinks.** Every node and mark renders through owned Svelte
  components with text interpolation only. Raw HTML in Markdown stays
  literal text; pasted HTML goes through an owned tokenizer and an element
  allowlist; nothing is ever parsed as markup into the page.
- **Links and media pass the URL policy.** Links typed in the dialog pass
  `safeHref` at the editor's `trust` (`untrusted` by default) and are checked
  again at render; a refused one renders as text. Pasted and Markdown links
  are checked at the `untrusted` tier. Links get
  `rel="noopener noreferrer nofollow"` and no `target`. Media blocks are
  resolved by the host (`resolveMedia`) and their `src` passes
  `safeImageSrc`.
- **Bounded, linear input.** Documents are capped (2,000 blocks, 200,000
  characters, depth 4) and Markdown at 100,000 characters; reading and
  writing Markdown stay linear on hostile input (the tests read and write
  18 such inputs at the cap within a bound each).
- **Accessible editing.** One `contenteditable` textbox with a name; Tab
  indents only inside lists and Escape then Tab leaves the editor;
  `aria-readonly` in read-only mode; mark, block, list, undo, paste and
  refusal changes are announced politely through the core announcer.
- **Input methods.** Between `compositionstart` and `compositionend` the
  model is not touched; the composed text is applied as one step.
- **Styles** use `--tx-*` tokens and logical properties only, with
  forced-colors mappings.

## What is not done yet

- Copy writes no `application/x-texuli-editor+json` data yet (the native
  copy runs; paste reads that format when present). Drop is refused.
- No “Paste as Markdown” command, no block-type menu (the toolbar has
  heading buttons) and no drag handles.
- No browser behavior scenario, axe sweep, CSP matrix row or `tests/perf`
  limit for the editor yet; the long-document posture is a design budget,
  not a measured result.
- Tree adapters to blocks and the catalog are planned in those packages.

Tests: `pnpm vitest run packages/editor` (the model, hostile paste and
link-policy cases, the component, the Markdown codec and the docs coverage).
Examples: `editor-basic`, `editor-toolbar` and `editor-long-document` in
`@texuli/examples`, with light and dark visual baselines.

## Documentation

- The model, transforms, history and keymap:
  [core-editor](https://github.com/DailybotHQ/texuli/blob/main/packages/core/docs/core-editor.md)
- Decisions: ADR-003 in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
  and [EDITOR_ARCHITECTURE](https://github.com/DailybotHQ/texuli/blob/main/docs/EDITOR_ARCHITECTURE.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-editor).
