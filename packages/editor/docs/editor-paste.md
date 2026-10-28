# Clipboard import

`@texuli/editor/paste` turns clipboard data into a fragment of the closed
editor vocabulary. It is framework-free and never touches the DOM.

| Export | Meaning |
| --- | --- |
| `readClipboard(data, options?)` | Reads `application/x-texuli-editor+json`, then `text/html`, then `text/plain`; a format that reads as empty falls through. Never throws |
| `importHtml(html, options?)` | The owned tokenizer and the element allowlist |
| `importPlainText(text, options?)` | Blank lines split paragraphs; single newlines become breaks. Markdown is not interpreted |
| `importEditorJson(json, options?)` | The editor's own format, still untrusted |
| `tokenizeHtml`, `htmlToBlocks`, `decodeEntities` | The tokenizer stages, for tests and tools |
| `PASTE_LIMITS` | `source` 1,000,000 characters, `containers` 4, `marks` 64 |

A `PasteResult` holds `doc` (empty `blocks` for an empty clipboard),
`diagnostics`, `source`, `blocks` and `linksRemoved`.
`pastedBlockCount(result)` counts the pasted blocks, containers included.

Types: `PasteOptions` (`newId`, lower `limits`); `PasteSource` (`'editor'`,
`'html'`, `'text'` or `'empty'`; `'markdown'` is reserved, no import
produces it yet: read Markdown with
[`@texuli/editor/markdown`](editor-markdown.md)); `ClipboardLike` (what
`readClipboard` needs from a `DataTransfer`: `getData(type)` and optional
`types`); and the tokenizer stages' `HtmlToken`, `RawBlock` (a loose block
before the loader) and `HtmlImportStats` (`blocks` built and whether the
source was `truncated`). `EDITOR_CLIPBOARD_TYPE` is
`application/x-texuli-editor+json`.

**Security posture:**

- Every format ends in `loadEditorDocument` at the `untrusted` tier, so
  document caps (2,000 blocks, 200,000 characters, depth 4), control and
  bidirectional override stripping, and `safeHref` apply to every pasted link
  whatever the editor's own `trust` is. A refused link keeps its text.
- The tokenizer reads only `href`, `alt`, checkbox `type` and `checked`. Event
  handlers, styles and image sources are never read. `script`, `style`,
  `template`, `iframe`, `svg` and similar elements are dropped with their
  content; comments are skipped.
- Allowlist: `p`/`div` and other sectioning elements split paragraphs, `br`
  is a break, `h1`–`h6` are headings (clamped to 4), `ul`/`ol`/`li` and
  checkbox inputs are lists and todos, `pre` is code, `blockquote` is a quote,
  `hr` is a divider, `b`/`strong`, `i`/`em`, `s`/`del`/`strike` and `code` are
  marks, `a[href]` is a link, and `img` becomes its alt text.
- Floods stay linear: lists and quotes past depth 4 flatten into the deepest
  one, repeated marks stop counting at 64, and the build stops at the block
  cap.
