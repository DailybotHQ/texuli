## Markdown in and out

`markdownToDocument` reads Markdown into a valid editor document and `documentToMarkdown` writes it back, so the saved text reads back to the same document. Both live in `@texuli/editor/markdown`, outside the package barrel.

- Reading is untrusted by default: raw HTML stays literal text and every link passes the URL policy, so a refused link keeps only its text.
- The editor holds headings 1 to 4, paragraphs, bulleted, numbered and todo lists, quotes, fenced code, dividers and the strong, em, strike, code and link marks. Deeper headings become level 4, with a diagnostic.
- Input is capped and read in linear time; nothing here produces HTML.

```ts
import { documentToMarkdown, markdownToDocument } from '@texuli/editor/markdown';

const { doc, diagnostics } = markdownToDocument(agentText);
const saved = documentToMarkdown(doc);
```
