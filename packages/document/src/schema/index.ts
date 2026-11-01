/**
 * @texuli/document/schema: the document validator on the `@texuli/deck`
 * schema kit (ADR-011). Structure and closed vocabularies at the
 * `untrusted` tier by default, the URL policy for links and media, embedded
 * decks through `@texuli/deck` (`checkDeckPayload`), and the JSON Schema
 * export. `@texuli/document/schema-core` is the same without the deck model.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import type { Schema } from '@texuli/deck/schema';
import type { TexuliDocument } from '../model/types.ts';
import { checkDeckPayload } from './deck-check.ts';
import { documentSchemaCore } from './schema.ts';
import {
  type DocumentValidation,
  isDocument as isDocumentCore,
  type LoadDocumentOptions,
  loadUntrustedDocument as loadCore,
  type ValidateDocumentOptions,
  validateDocument as validateCore,
} from './validate.ts';

export { checkDeckPayload } from './deck-check.ts';
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
  type LoadDocumentOptions,
  type ValidateDocumentOptions,
} from './validate.ts';

/** The document schema for a URL tier (`untrusted` by default), inline decks checked as deck model v2. */
export function documentSchema(trust: HrefTrust = 'untrusted'): Schema<TexuliDocument> {
  return documentSchemaCore(trust, checkDeckPayload);
}

/** Validate a document: every issue at once, a fresh copy when valid, never a throw. */
export function validateDocument(
  input: unknown,
  options: ValidateDocumentOptions = {}
): DocumentValidation {
  return validateCore(input, { validateDeck: checkDeckPayload, ...options });
}

/** True when `input` is a valid document at the tier. */
export function isDocument(
  input: unknown,
  options: ValidateDocumentOptions = {}
): input is TexuliDocument {
  return isDocumentCore(input, { validateDeck: checkDeckPayload, ...options });
}

/**
 * Load a document from somewhere untrusted (a file, a share link, an
 * agent): JSON text is size-checked before `JSON.parse`, then the value is
 * validated at the tier (`untrusted` by default).
 */
export function loadUntrustedDocument(
  input: unknown,
  options: LoadDocumentOptions = {}
): DocumentValidation {
  return loadCore(input, { validateDeck: checkDeckPayload, ...options });
}
