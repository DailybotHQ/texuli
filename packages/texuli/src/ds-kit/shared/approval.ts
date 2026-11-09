/**
 * The approval record the kit header shows (kit API §11.3, ADR-032): status, the declared
 * approver and date, the version, the content hash and whether that hash still matches the
 * document. The kit cannot prove who approved (a reviewed commit does), so the copy says
 * "declared", never "verified by".
 */
import { canonicalJson, sha256Hex } from '@texuli/tokens/design-system/compile-core';
import { kitText } from './limits.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function withoutApproval(value: unknown): unknown {
  if (!isRecord(value) || !Object.hasOwn(value, 'approval')) return value;
  const { approval: _approval, ...rest } = value;
  return rest;
}

/**
 * The document's content hash, by the same rule as `designSystemContentHash` in
 * `@texuli/spec/design-system` (ADR-032): SHA-256 of the canonical JSON of the document
 * without its `approval`, with every library entry also without its own `approval`. A test
 * holds the two equal; `texuli` reaches the hash primitives through `@texuli/tokens`.
 */
export function kitContentHash(doc: unknown): string {
  if (!isRecord(doc)) return sha256Hex(canonicalJson(doc));
  const view = withoutApproval(doc) as Record<string, unknown>;
  if (Array.isArray(doc.library)) view.library = doc.library.map(withoutApproval);
  return sha256Hex(canonicalJson(view));
}

export type KitHashCheck = 'matches' | 'differs' | 'missing';

export interface KitApprovalView {
  /** No `approval` record: the document was never submitted for approval. */
  readonly present: boolean;
  readonly status: 'draft' | 'approved' | 'unknown';
  readonly approvedBy?: string;
  readonly approvedAt?: string;
  readonly version?: string;
  readonly contentHash?: string;
  /** The hash the kit computed from the document. */
  readonly computedHash: string;
  /** `missing`: the record has no `contentHash` to compare. */
  readonly hash: KitHashCheck;
}

const HASH = /^[0-9a-f]{64}$/;

/** The approval view of a document (total over JSON values). */
export function kitApproval(doc: unknown): KitApprovalView {
  const computedHash = kitContentHash(doc);
  const record = isRecord(doc) && isRecord(doc.approval) ? doc.approval : undefined;
  if (!record) return { present: false, status: 'unknown', computedHash, hash: 'missing' };
  const status =
    record.status === 'approved' || record.status === 'draft' ? record.status : 'unknown';
  const contentHash =
    typeof record.contentHash === 'string' && HASH.test(record.contentHash)
      ? record.contentHash
      : undefined;
  const short = (value: unknown) => kitText(value, 200)?.text;
  return {
    present: true,
    status,
    approvedBy: short(record.approvedBy),
    approvedAt: short(record.approvedAt),
    version: short(record.version),
    contentHash,
    computedHash,
    hash:
      contentHash === undefined ? 'missing' : contentHash === computedHash ? 'matches' : 'differs',
  };
}
