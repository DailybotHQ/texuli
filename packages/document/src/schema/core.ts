/**
 * @texuli/document/schema-core: the document validator without the deck
 * model. Inline deck embeds are refused (`invalid-deck`) unless the host
 * passes `validateDeck`; everything else is checked exactly as in
 * `@texuli/document/schema`.
 */
export {
  DESIGN_SYSTEM_REF_PATTERN,
  type DeckPayloadIssue,
  type DeckPayloadResult,
  type DeckPayloadValidator,
  DOCUMENT_CODES,
  type DocumentCode,
  documentSchemaCore,
  jsonBytes,
} from './schema.ts';
export {
  type DocumentDiagnostic,
  type DocumentValidation,
  documentJsonSchema,
  isDocument,
  type LoadDocumentOptions,
  loadUntrustedDocument,
  type ValidateDocumentOptions,
  validateDocument,
} from './validate.ts';
