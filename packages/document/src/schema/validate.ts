/**
 * Validation entry points. Every one is total: it never throws, does bounded
 * work on hostile input (the schema kit caps depth, nodes, lengths and
 * issues; the loader caps bytes before parsing), and returns a fresh copy.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import {
  createDiagnostic,
  type DeckDiagnostic,
  type JsonSchema,
  toJsonSchema,
  validate,
} from '@texuli/deck/schema';
import { DOCUMENT_LIMITS } from '../model/limits.ts';
import type { TexuliDocument } from '../model/types.ts';
import { type DeckPayloadValidator, DOCUMENT_CODES, documentSchemaCore } from './schema.ts';

/** One issue: a code, a severity, a path (`jsonPath`, RFC 6901 `pointer`), a message and a fix. */
export type DocumentDiagnostic = DeckDiagnostic;

export interface ValidateDocumentOptions {
  /** URL tier for link hrefs and media refs. Default `untrusted`. */
  trust?: HrefTrust;
  /** Diagnostics kept (default 200). */
  maxIssues?: number;
  /**
   * Checks inline deck payloads. `@texuli/document/schema` defaults it to
   * `checkDeckPayload`; `@texuli/document/schema-core` has no default and
   * refuses inline decks (`invalid-deck`) unless one is passed.
   */
  validateDeck?: DeckPayloadValidator | null;
}

export type DocumentValidation =
  | { ok: true; document: TexuliDocument; issues: DocumentDiagnostic[]; truncated: boolean }
  | { ok: false; document?: undefined; issues: DocumentDiagnostic[]; truncated: boolean };

/** Nested values the validator visits at most (texts, runs, marks, blocks, JSON payloads). */
const MAX_NODES = 1_000_000;

/** Validate a document: every issue at once, a fresh copy when valid, never a throw. */
export function validateDocument(
  input: unknown,
  options: ValidateDocumentOptions = {}
): DocumentValidation {
  const result = validate(documentSchemaCore(options.trust, options.validateDeck ?? null), input, {
    maxIssues: options.maxIssues,
    maxNodes: MAX_NODES,
  });
  if (result.ok)
    return {
      ok: true,
      document: result.value as TexuliDocument,
      issues: result.issues,
      truncated: result.truncated,
    };
  return { ok: false, issues: result.issues, truncated: result.truncated };
}

/** True when `input` is a valid document at the tier. */
export function isDocument(
  input: unknown,
  options: ValidateDocumentOptions = {}
): input is TexuliDocument {
  return validateDocument(input, { ...options, maxIssues: 1 }).ok;
}

export interface LoadDocumentOptions extends ValidateDocumentOptions {
  /** Bytes of JSON text read before parsing (default `DOCUMENT_LIMITS.bytes`). */
  maxBytes?: number;
}

function single(message: string, fix: string): DocumentValidation {
  return {
    ok: false,
    issues: [createDiagnostic(DOCUMENT_CODES.invalidInput, message, [], { fix })],
    truncated: false,
  };
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
  const maxBytes = options.maxBytes ?? DOCUMENT_LIMITS.bytes;
  let value = input;
  if (typeof input === 'string') {
    // UTF-16 length ≤ UTF-8 bytes ≤ 3 × length: refuse early without encoding.
    if (input.length > maxBytes)
      return single(`The document is larger than ${maxBytes} bytes.`, 'Split the document.');
    try {
      value = JSON.parse(input);
    } catch {
      return single('The document is not valid JSON.', 'Pass JSON text or plain JSON data.');
    }
  }
  return validateDocument(value, options);
}

/** The JSON Schema 2020-12 of the document format (untrusted tier). */
export function documentJsonSchema(): JsonSchema {
  return toJsonSchema(documentSchemaCore('untrusted'), {
    $id: 'https://texuli.com/schemas/document.schema.json',
    title: 'Texuli document',
    description: 'A Texuli block document, format version 1 (ADR-011).',
  });
}
