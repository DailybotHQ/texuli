# `@texuli/document/schema-core`

The document validator of [`@texuli/document/schema`](schema.md) without the
deck model, so a host that validates documents with no inline deck never
loads `@texuli/deck/model` (Protoyard G133). It still uses the
`@texuli/deck/schema` kit the document schema is written with.

> **Status: in development.** From `0.11.3` (pre-1.0).

```ts
import { loadUntrustedDocument, validateDocument } from '@texuli/document/schema-core';

const result = validateDocument(value); // inline decks are refused
const withDecks = validateDocument(value, { validateDeck: myDeckCheck });
```

- `validateDocument`, `isDocument` and `loadUntrustedDocument` take the
  same `ValidateDocumentOptions` and `LoadDocumentOptions` and return the
  same `DocumentValidation` and `DocumentDiagnostic`s. Every check is the
  same, except that an inline deck embed is refused with `invalid-deck`
  unless `validateDeck` is passed. A deck embedded by `ref` is accepted as
  in the full entry.
- `validateDeck` is a `DeckPayloadValidator`: it gets the inline payload and
  returns a `DeckPayloadResult` (`{ ok: true }`, or `{ ok: false, issues }`
  with `DeckPayloadIssue`s, whose errors become `invalid-deck` issues). A
  validator that throws is reported as an `invalid-deck` issue.
  `checkDeckPayload` from `@texuli/document/schema` is the full entry's
  validator.
- `documentSchemaCore(trust, validateDeck)` is the schema value, built once
  per tier and validator; `documentJsonSchema()` is the same JSON Schema
  export.
- `DOCUMENT_CODES`, `DocumentCode`, `DESIGN_SYSTEM_REF_PATTERN` and
  `jsonBytes` are the same values as in the full entry.
