## Untrusted documents

A document from an agent, a file or a share link is untrusted data. Use `loadUntrustedDocument` from `@texuli/document/schema` before any deep work. Default URL policy is the untrusted tier. There is no HTML sink.

## MCP operations

Agents call `document.run` to create, validate, inspect, patch, convert Markdown and emit a blueprint node. PDF and DOCX go through `document.export` (Node only). Both operations live in the Texuli tools registry. Inputs are bounded; diagnostics come back instead of throws.

```ts
import { loadUntrustedDocument } from '@texuli/document/schema';

const checked = loadUntrustedDocument(jsonText);
```

`createDocumentPlayerHost` from `@texuli/pages/host` lets the player paint a validated `document` blueprint with the reader. Do not invent a hosted generation service.
