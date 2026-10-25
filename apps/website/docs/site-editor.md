# texuli.com: editor area

**App:** `apps/website`  
**Route:** `/editor-page/`  
**Components:** `src/components/editor-page/` (content data and the live island), `src/components/builder/inspector/text/` (the builder's rich text fields)  
**Tests:** `tests/e2e/site-editor.spec.ts` · `tests/e2e/site-builder.spec.ts` (text inspector case) · `scripts/tests/site-builder-inspector-richtext.test.ts` · `scripts/tests/docs-shell-nav.test.ts`

## Goal

Make `@texuli/editor` visible on the site: a live editor to try, the closed
node and mark vocabularies, how the builder uses it, the editor examples,
what ships and what is planned, and where the package docs live. Static
output, no runtime network to other origins, axe clean in light and dark.
The builder's Markdown fields edit through the same editor.

## How it works

| Section | What |
| --- | --- |
| Try the editor | `EditorLive.svelte` in a `client:load` island: `RichTextEditor` on a fictional document loaded with `fromMarkdown` at the `untrusted` tier, the Markdown it saves as below it, a **Reset the document** button and a keyboard hint list |
| Nodes and marks | Two static tables (`EDITOR_NODES`, `EDITOR_MARKS` in `editor.ts`): each node or mark, the element it renders as and its Markdown |
| In the builder | What the builder's text inspector does with the editor (below) |
| Examples | Links to `editor-basic`, `editor-toolbar` and `editor-long-document` |
| What ships / Planned | The capabilities that exist today, then the planned ones (copy in the editor's JSON format and drop, a block-type menu, drag handles, "Paste as Markdown", a browser behavior scenario, an axe sweep and measured long-document limits for the package, the editor on builder list items) |
| Package docs | The `packages/editor/` docs, `core-editor` and `EDITOR_ARCHITECTURE` by repository path, as text: the site does not render package docs |

The demo document covers every node except media: headings, a paragraph
with each mark and a link to `example.com`, bullet, numbered and todo lists,
a quote, a code block and a divider. The editor uses `--tx-*` tokens, so it
follows the site's light or dark mode, and it has no motion to reduce.

### Reaching the editor package

The islands import `RichTextEditor` from the `@texuli/editor/editor`
subpath (not the barrel, which does not lazy-load), through the website's
own `@texuli/editor` dependency. Earlier the site reached the package
through a one-line re-export in `@texuli/examples`; that interim bridge
was removed when the dependency landed (owner-authorized install,
2026-10-25).

### Toolbar names

The toolbar shows `H1`–`H3` and `1.` as glyphs, and the default names
(`Heading 1`, `Numbered list`) do not contain that text, which axe reports as
`label-content-name-mismatch` (WCAG 2.5.3, label in name). The site passes
`SITE_EDITOR_LABELS` (`Heading 1, H1`, `Numbered list, 1.`) to both editors.
The defaults belong to the editor package; changing them there is a
follow-up for that package.

## In the builder

`TextBlockEditor.svelte` keeps its props contract (`value`, `onchange`,
`legend`). Fields of kind `markdown` (text, quote, callout body) render
`MarkdownField.svelte`:

- **Same model in and out.** The field stores Markdown, the subset text
  blocks and the catalog's rich text parse. `readRichText` (in `richtext.ts`)
  loads it with `fromMarkdown`, capped at the field limit; `writeRichText`
  saves each edit with `toMarkdown`. The parser-backed validation, the
  character counter and the link verdicts still read the stored Markdown.
- **Diagnostics.** What the editor could not keep shows under **Editor
  notes**: a link the URL policy refused (its text is kept), or text past the
  field limit. The note clears after the next edit, which saves the cleaned
  Markdown.
- **No reload loop.** The field remembers the Markdown it last exchanged, so
  its own edits never reload the editor. Only an outside value (builder undo
  or redo, a JSON commit, the source textarea) replaces the document and
  restarts the editor's history. The document and the notes are held apart,
  because reassigning the document is what reloads the editor.
- **Markdown source.** A pressed **Markdown source** button swaps in the
  plain textarea, for exact text the editor would normalize (for example a
  soft line break, which the codec saves as a space).
- **Undo.** `ownsTextUndo` is unchanged and true for editable content, so
  Cmd/Ctrl+Z inside the editor is the editor's text undo. Each text edit is a
  prop change with the block's coalesce key, so typing joins one labeled
  builder step, and the builder's **Undo** takes the whole text edit back.
  The editor's toolbar undo buttons are named `Undo text` and `Redo text`, so
  they never share a name with the builder's **Undo** and **Redo**.

List items keep plain text fields; the editor there is planned.

## Navigation

- **Site sidebar:** `Editor` in the Components group (`NAV_GROUPS` in
  `src/components/foundation/site.ts`), after Slides.
- **Docs shell:** an `Editor` section in `src/components/docs-shell/nav.ts`
  (overview, package docs anchor, the toolbar example). It extends the docs
  shell's previous and next order after the Slides section.

## Tests

```bash
pnpm build
TEXULI_E2E_PORT=4874 pnpm exec playwright test tests/e2e/site-editor.spec.ts tests/e2e/site-builder.spec.ts --project=chromium
pnpm vitest run scripts/tests/site-builder-inspector-richtext.test.ts scripts/tests/docs-shell-nav.test.ts
```

`site-editor.spec.ts` serves `apps/website/dist` on a loopback port and
checks:

- the h1, the section headings, both vocabulary tables and no foreign
  network;
- the demo renders every node as a real element inside the textbox
  (heading, marks, the link with its address, quote, code, divider, todo
  checkboxes) and shows its Markdown;
- typing, a block type change by shortcut, Bold by shortcut with its pressed
  state, a `javascript:` link refused with a visible error and
  `aria-invalid`, a safe link kept, toolbar undo and redo, the keyboard undo,
  and reset with a fresh history;
- the example, sidebar and docs-shell links;
- axe (WCAG 2.1 A and AA) in light and dark.

The builder's text inspector case types through the editor, checks the
saved Markdown, that typing coalesces into one builder step, that
Cmd/Ctrl+Z in the editor undoes text only, that the builder's Undo restores
the previous Markdown in the editor, the source toggle with the refused-link
verdict, the editor note for that link, and axe.

## Not covered

- Firefox and WebKit, and input methods in a real browser (the editor
  package's component tests cover composition).
- Screen-reader output for the editor on the site.
