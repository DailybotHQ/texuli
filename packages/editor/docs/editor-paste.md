# Clipboard import

`@texuli/editor/paste` turns clipboard data into a fragment of the closed
editor vocabulary. It is framework-free and never touches the DOM.

| Export | Meaning |
| --- | --- |
| `readClipboard(data, options?)` | Reads `application/x-texuli-editor+json`, then `text/html`, then `text/plain`; a format that reads as empty falls through. Plain text is never read as Markdown. Never throws |
| `importHtml(html, options?)` | Clipboard HTML through the shared DOM-free reader, `htmlToMarkdownTree` from [`@texuli/core/html`](../../core/docs/core-html.md) at the `untrusted` tier, then onto the editor vocabulary (`fromMarkdownTree` from `@texuli/core/editor-markdown`) |
| `importPlainText(text, options?)` | Blank lines split paragraphs; single newlines become breaks. Markdown is not interpreted |
| `importEditorJson(json, options?)` | The editor's own format, still untrusted |
| `tokenizeHtml`, `htmlToBlocks`, `decodeEntities` | Deprecated: the previous tokenizer stages, still exported for compatibility; `importHtml` no longer uses them |
| `PASTE_LIMITS` | `source` 1,000,000 characters, `containers` 4, `marks` 64 |

A `PasteResult` holds `doc` (empty `blocks` for an empty clipboard),
`diagnostics`, `source`, `blocks` and `linksRemoved`.
`pastedBlockCount(result)` counts the pasted blocks, containers included.

Types: `PasteOptions` (`newId`, lower `limits`); `PasteSource` (`'editor'`,
`'html'`, `'text'`, `'markdown'` from `importMarkdown` in
[`@texuli/editor/markdown`](editor-markdown.md) (the "Paste as Markdown"
command, which lives with the parser), or `'empty'`); `ClipboardLike` (what
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
- Clipboard HTML is read by `@texuli/core/html` (ADR-034): a single-pass
  tokenizer that keeps only the attributes it maps (event handlers, styles,
  `srcset` and the rest are gone after tokenizing), drops `script`, `style`,
  `template`, `iframe`, `svg`, `math`, `textarea`, `noscript`, `xmp`,
  `plaintext` and the other raw-text elements with their content, skips
  comments, and decodes character references (scheme obfuscation such as
  `&#106;avascript:` or `javascript&colon;` included) before the URL policy.
  Its hostile corpus (OWASP filter evasion and mutation XSS) is in
  `packages/core/tests/markdown/security/`.
- Mapping onto the editor: paragraphs and breaks, `h1`–`h6` (clamped to 4),
  lists, checkbox items and todos, `pre` code (with a `language-` class),
  quotes, dividers, the strong, em, strike, code and link marks; images
  become their alt text, table cells become paragraphs, mentions and
  footnote content keep their text, and underline and spoiler keep their
  text without a mark. A refused link keeps its text, counts in
  `linksRemoved` and reports `link-rejected`.
- Plain text is never read as Markdown. "Paste as Markdown"
  (`importMarkdown`, `controller.pasteMarkdown`, the surface's
  Mod+Alt+Shift+V) is the user's explicit choice, still at the `untrusted`
  tier.
- Floods stay linear: lists and quotes past depth 4 are unwrapped into their
  parent (`depth-capped`), and the reader caps source, nesting and nodes.
