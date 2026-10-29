/**
 * @texuli/document/schema: the document validator on the `@texuli/deck`
 * schema kit (ADR-011). Structure and closed vocabularies at the
 * `untrusted` tier by default, the URL policy for links and media, embedded
 * decks through `@texuli/deck`, and the JSON Schema export.
 */
export { DOCUMENT_CODES, type DocumentCode, documentSchema, jsonBytes } from './schema.ts';
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
