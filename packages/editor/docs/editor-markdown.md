# Markdown in and out

`@texuli/editor/markdown` reads Markdown into an editor document and writes
an editor document back as Markdown. It is framework-free, never touches the
DOM and produces no HTML. It wraps the owned codec in
[`@texuli/core/editor-markdown`](../../core/docs/core-editor.md#markdown-codec-editor-markdown)
(ADR-003, [EDITOR_ARCHITECTURE](../../../docs/EDITOR_ARCHITECTURE.md)
section 9), and it is not in the package barrel, so hosts that never read or
write Markdown do not pay for it.

```ts
import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';

// Untrusted by default: agent output, stored text, a pasted file.
const { doc, diagnostics } = markdownToDocument('# Plan\n\n- [ ] Draft\n- [x] Review');
const saved = documentToMarkdown(doc); // '# Plan\n\n- [ ] Draft\n- [x] Review'
```

| Export | Meaning |
| --- | --- |
| `markdownToDocument(source, options?)` | Reads Markdown into `{ doc, diagnostics }`, a valid `EditorDocument`. Never throws; a non-string source is read as its string form |
| `documentToMarkdown(doc, options?)` | Writes the document as Markdown that reads back to the same document |
| `MarkdownToDocumentOptions` | `trust` (`'untrusted'` by default), `newId`, lower `limits`, `maxSource` (the source cap) and `extensions` (host inline extensions, below) |
| `DocumentToMarkdownOptions` | `trust` (`'untrusted'` by default): the tier every link is checked at again before it is written; `extensions`: the host inline extensions written as tokens |
| `MARKDOWN_CODEC_LIMITS` | `source` 100,000 characters, `inlineDepth` 6 |

## What it reads and writes

The closed subset the editor holds, the same one `@texuli/blocks` text
blocks and the catalog's rich text parse:

| Markdown | Editor document |
| --- | --- |
| Paragraphs; `\` or two spaces before a newline | `paragraph`; a `break` run |
| `#` to `####` (`#####` and `######` read as level 4, with a `heading-clamped` diagnostic) | `heading` levels 1–4 |
| `-`, `*`, `+` and `1.` or `1)` lists, nested by 2 to 4 spaces | `list` of kind `bullet` or `ordered` (with `start`) |
| `- [ ]` and `- [x]` | `list` of kind `todo` with `checked` items |
| `>` | `quote` (blocks nest at most 4 levels; deeper lines become text with a `depth-capped` diagnostic) |
| Fenced code with an optional language | `code` with `lang` |
| `---`, `***`, `___` | `divider` |
| `![alt](ref)` alone in a paragraph | `media`, whose `ref` the host resolves (`resolveMedia`); inside text an image is its alt text |
| `**strong**`, `*em*` or `_em_`, `~~strike~~`, `` `code` ``, `[text](href)`, `<https://…>` | The `strong`, `em`, `strike`, `code` and `link` marks |

The writer always uses the forms in the first column: `-` for bullets, `*`
for em, three backticks for code (more when the code holds a run of
backticks), four-space indents for nested blocks, and a blank line before a
nested list. Writing is stable: what it writes reads and writes back
unchanged. What the subset cannot spell is dropped on write: empty
paragraphs, breaks in a heading (written as spaces), and breaks or
whitespace at the edges of a block or a mark.

## Host inline extensions

Mentions, references and other host entities round trip with their entity
id when the host registers them and passes the same `extensions` both ways.
A host registers a name and a sigil, never a pattern: the grammar is fixed,
`<sigil>{<id>|<label>}`.

```ts
import { createInlineExtensions } from '@texuli/core/editor-model';
import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';

const extensions = createInlineExtensions([
  { name: 'mention', sigil: '@', accepts: (id) => id.startsWith('person-') },
  { name: 'reference', sigil: '#', href: (id) => `https://example.com/records/${id}` },
]);
const { doc } = markdownToDocument('Ask @{person-1|Ada} about #{record-7|Roadmap}', { extensions });
documentToMarkdown(doc, { extensions }); // 'Ask @{person-1|Ada} about #{record-7|Roadmap}'
```

- **In the document** an entity is an `extension` mark (`name`, `id`) over
  its label text, so offsets, selection and editing stay plain text; typing
  right after it does not extend it, and it never shares a run with `link`
  or `code`. The editor surface renders it as
  `<span class="tx-editor-extension" data-tx-extension="mention" data-tx-entity="person-1">`.
- **Closed and bounded.** Sigils come from `EDITOR_EXTENSION_SIGILS`
  (`@ # $ % & + = ^`); names are `[a-z][a-z0-9-]{0,31}`; ids are 1 to 128
  characters of `[A-Za-z0-9_.:-]`; labels are 1 to 512 characters on one
  line, with `\}` and `\\` escapes. `createInlineExtensions` throws on a
  bad name or sigil, a duplicate, or more than 16 extensions. A host
  `accepts(id)` only sees ids that already passed the charset and length.
- **Untrusted by default.** A token whose sigil is not registered, whose id
  is refused, or whose label is empty or unclosed stays literal text.
  Without `extensions` nothing changes: the grammar is plain text, and an
  extension mark loaded or written without its registry keeps only its
  label (`mark-dropped`). Plain text that spells a token is written with its
  `{` escaped (`@\{`), so it reads back as text.
- **Links.** `extensionHref(extensions, mark)` returns the host `href(id)`
  checked by `safeHref` (`untrusted` by default), or `undefined`.
- **Linear time.** A token is matched in constant time after two linear
  passes over the span; floods of open tokens, long ids, unclosed labels and
  escaped closers are in the tests, compared at 100,000 and 400,000
  characters.

## Guarantees

- **No HTML.** Raw HTML (`<script>`, `<img onerror>`, comments, any tag)
  stays literal text in the document, and the writer escapes it (`\<b>`), so
  it reads back as the same text. Nothing is ever parsed as markup.
- **Links pass the URL policy.** Every link is checked by `safeHref` at
  `trust` when read (`'untrusted'` allows only `https:`, `mailto:` and
  `#fragment` links); a refused link keeps its text and reports
  `link-rejected` once. `documentToMarkdown` loads the document again at its
  own `trust` before writing, so a hand-built document with a
  `javascript:` href, or an `http:` link at the default tier, is written as
  plain text.
- **Bounded input.** The source is capped at 100,000 characters (the rest
  is dropped with a `text-truncated` diagnostic), and the document at the
  editor caps (2,000 blocks, 200,000 characters, depth 4). Control and
  bidirectional override characters are stripped.
- **Linear time.** Reading and writing stay linear on hostile input: runs
  of spaces before a heading's closing sequence or after a fence, emphasis
  and bracket floods, a single 100,000-character line, tens of thousands of
  lines in one paragraph, and long runs of marked links. The tests read and
  write 18 such inputs at the source cap within a bound each.
- **Line endings.** `\r\n` and `\r` read as `\n`. U+2028 and U+2029 are not
  Markdown line endings: they stay inside their line (a heading, list item
  or quote keeps its kind), and the document stores them as breaks.

Tests: `pnpm vitest run packages/editor/tests/markdown.test.ts` (round trip
of every format, HTML and link policy, line endings, hostile inputs). The
codec's own property tests (2,000 seeded documents) are in
`packages/core/tests/editor-markdown.test.ts`.
