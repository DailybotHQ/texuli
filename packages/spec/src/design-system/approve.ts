/**
 * `approveDesignSystem` (ADR-032): the document with `approval` stamped —
 * `status: approved`, who, when, the approved version and the
 * `contentHash` ({@link designSystemContentHash}). It validates first and
 * returns stable error codes instead of throwing; it never mutates its input.
 *
 * It records who approved; it cannot prove it. The guarantee is a human
 * commit of the document, reviewed through CODEOWNERS ({@link APPROVAL_NOTE}).
 */
import type { DesignSystem, DesignSystemIssue } from '../../generated/typescript/design-system.ts';
import { designSystemContentHash } from './hash.ts';
import { DS_LOCKED_PATTERNS } from './types-locked.ts';
import { validateDesignSystem } from './validate.ts';

export const APPROVAL_NOTE =
  'An approval records who approved and when; it cannot prove it. The guarantee is a reviewed commit of the document by its CODEOWNERS.';

export interface ApproveDesignSystemOptions {
  /** Who approved (free text, at most 120 characters, no control or bidi characters). */
  by: string;
  /** When: a `Date` or an ISO 8601 UTC date-time string. */
  at: Date | string;
  /** The approved version; it also becomes the document's `version`. Defaults to the document's. */
  version?: string;
  /** Trust for `validateDesignSystem` (default `untrusted`). */
  trust?: 'developer' | 'untrusted';
}

export type ApproveDesignSystemResult =
  | { ok: true; document: DesignSystem; contentHash: string }
  | { ok: false; errors: readonly DesignSystemIssue[] };

const refuse = (path: string, message: string, hint?: string): ApproveDesignSystemResult => ({
  ok: false,
  errors: [{ code: 'invalid-value', path, message, ...(hint ? { hint } : {}) }],
});

/** Validate, then stamp the approval. Library entries keep their own approvals. */
export function approveDesignSystem(
  document: unknown,
  options: ApproveDesignSystemOptions
): ApproveDesignSystemResult {
  const trust = options.trust ?? 'untrusted';
  const checked = validateDesignSystem(document, { trust });
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const doc = document as DesignSystem;
  const by = typeof options.by === 'string' ? options.by.trim() : '';
  if (by.length === 0)
    return refuse('$.approval.approvedBy', 'Name who approved.', 'Pass by: "<name>".');
  const at =
    options.at instanceof Date
      ? Number.isNaN(options.at.getTime())
        ? ''
        : options.at.toISOString()
      : options.at;
  if (typeof at !== 'string' || !DS_LOCKED_PATTERNS.dateTime.test(at))
    return refuse(
      '$.approval.approvedAt',
      'Expected an ISO 8601 UTC date-time.',
      'For example 2026-11-09T14:30:00Z.'
    );
  const version = options.version ?? doc.version;
  const stamped = {
    ...doc,
    version,
    approval: { status: 'approved', approvedBy: by, approvedAt: at, version },
  } as DesignSystem;
  const contentHash = designSystemContentHash(stamped);
  const approved = {
    ...stamped,
    approval: { ...stamped.approval, contentHash },
  } as DesignSystem;
  // The stamp itself must hold: a bad name, version or date is refused with its path.
  const again = validateDesignSystem(approved, { trust });
  if (!again.ok) return { ok: false, errors: again.errors };
  return { ok: true, document: approved, contentHash };
}
