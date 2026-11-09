/**
 * Approval stamping and hash verification for `texuli ds approve` and
 * `texuli ds hash` (ADR-032). Pure: the CLI validates the document first and
 * writes the result.
 *
 * The stamp records who approved and when; it cannot prove it. The real
 * guarantee is a human commit of the document, reviewed through CODEOWNERS
 * ({@link APPROVAL_NOTE}).
 */
import {
  approveDesignSystem,
  type DesignSystem,
  designSystemContentHash,
  libraryEntryContentHash,
} from '@texuli/spec/design-system';

export { APPROVAL_NOTE } from '@texuli/spec/design-system';

export interface StampApprovalOptions {
  /** Who approved (free text, at most 120 characters). */
  by: string;
  /** When; defaults to now. Written as an ISO 8601 UTC date-time. */
  at?: Date;
  /** The approved version; it also becomes the document's `version`. Defaults to the document's. */
  version?: string;
}

/**
 * The document with `approval` stamped by `approveDesignSystem` of
 * `@texuli/spec/design-system`. When the stamp itself is refused (a name with
 * control or bidi characters, a version that is not semver), the unhashed
 * stamp comes back so the caller's validation reports it with its code and
 * path. Throws only when `by` is empty.
 */
export function stampApproval(doc: DesignSystem, options: StampApprovalOptions): DesignSystem {
  const by = options.by.trim();
  if (by.length === 0) throw new TypeError('ds approve needs --by <name>.');
  const at = options.at ?? new Date();
  const result = approveDesignSystem(doc, {
    by,
    at,
    ...(options.version ? { version: options.version } : {}),
  });
  if (result.ok) return result.document;
  const version = options.version ?? doc.version;
  return {
    ...doc,
    version,
    approval: { status: 'approved', approvedBy: by, approvedAt: at.toISOString(), version },
  } as DesignSystem;
}

export interface HashCheck {
  contentHash: string;
  /** The hash the approval records, if any. */
  stored?: string;
  /** `true` or `false` when a hash is stored; `undefined` when none is. */
  matches?: boolean;
}

export interface DesignSystemHashReport extends HashCheck {
  id?: string;
  version?: string;
  status?: string;
  library: (HashCheck & { id?: string })[];
  /** False when any stored hash (the document's or an entry's) does not match. */
  ok: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function check(contentHash: string, approval: unknown): HashCheck {
  const stored =
    isRecord(approval) && typeof approval.contentHash === 'string'
      ? approval.contentHash
      : undefined;
  return stored === undefined
    ? { contentHash }
    : { contentHash, stored, matches: stored === contentHash };
}

/** The document's content hash and each library entry's, against the hashes their approvals record. */
export function hashReport(doc: unknown): DesignSystemHashReport {
  const record = isRecord(doc) ? doc : {};
  const main = check(designSystemContentHash(doc), record.approval);
  const library = (Array.isArray(record.library) ? record.library : []).map((entry) => {
    const item = isRecord(entry) ? entry : {};
    return {
      ...(typeof item.id === 'string' ? { id: item.id } : {}),
      ...check(libraryEntryContentHash(entry), item.approval),
    };
  });
  const status = isRecord(record.approval) ? record.approval.status : undefined;
  return {
    ...(typeof record.id === 'string' ? { id: record.id } : {}),
    ...(typeof record.version === 'string' ? { version: record.version } : {}),
    ...(typeof status === 'string' ? { status } : {}),
    ...main,
    library,
    ok: main.matches !== false && library.every((entry) => entry.matches !== false),
  };
}
