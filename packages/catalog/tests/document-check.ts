/**
 * The host side of documents in blueprints, as a host wires it: the
 * `@texuli/document` validator and patcher behind the catalog's injected
 * `checkDocument` and `patchDocument` seams. The catalog itself never
 * imports the document engine (it stays out of `@texuli/catalog/validate`).
 */

import type { TexuliDocument } from '../../document/src/model/index.ts';
import { applyDocumentPatch, type DocumentPatch } from '../../document/src/ops/index.ts';
import { validateDocument } from '../../document/src/schema/index.ts';
import type { DocumentPatcher } from '../src/edit/types.ts';
import type { DraftDocumentCheck } from '../src/validate/document.ts';

export const checkDocument: DraftDocumentCheck = (doc, tier) => {
  const result = validateDocument(doc, { trust: tier });
  const issues = result.issues.map((issue) => ({
    code: issue.code,
    path: issue.jsonPath,
    message: issue.message,
    severity: issue.severity,
  }));
  return result.ok ? { ok: true, document: result.document, issues } : { ok: false, issues };
};

export const patchDocument: DocumentPatcher = (doc, patch) => {
  const checked = validateDocument(doc);
  if (!checked.ok) return { ok: false, message: 'The document is invalid.' };
  const result = applyDocumentPatch(checked.document as TexuliDocument, patch as DocumentPatch);
  return result.ok
    ? { ok: true, document: result.document, inverse: result.inverse }
    : { ok: false, message: `Patch operation ${result.index}: ${result.reason}` };
};
