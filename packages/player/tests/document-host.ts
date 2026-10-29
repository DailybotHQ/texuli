/**
 * A document host for player tests, as `@texuli/pages/host` wires one: the
 * `@texuli/document` validator as `checkDocument`, and a `present` that
 * writes the validated title into the target as text (the real host mounts
 * the reader). The player never imports the document engine itself.
 */
import { vi } from 'vitest';
import { validateDocument } from '../../document/src/schema/index.ts';
import type {
  DocumentPlayerHost,
  DocumentPlayerHostRequest,
  DraftDocumentCheck,
} from '../src/document-host.ts';

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

export function testDocumentHost() {
  const requests: DocumentPlayerHostRequest[] = [];
  const stop = vi.fn();
  const host: DocumentPlayerHost = {
    checkDocument,
    present(request) {
      requests.push(request);
      const result = validateDocument(request.doc, { trust: request.tier });
      if (result.ok && request.target) {
        const article = document.createElement('article');
        article.setAttribute('data-test-document', result.document.meta.title);
        article.textContent = result.document.meta.title;
        request.target.append(article);
      }
      return () => {
        stop();
        request.target?.replaceChildren();
      };
    },
  };
  return { host, requests, stop };
}
