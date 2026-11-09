/**
 * The ADR-032 content hashes for the CLI, built on `canonicalJson` and
 * `sha256Hex` as `@texuli/tokens/design-system/compile-core` re-exports them
 * from `@texuli/spec/design-system`. `@texuli/tools` does not depend on
 * `@texuli/spec` directly, so this mirrors `designSystemContentHash` and
 * `libraryEntryContentHash` there; `tests/ds-create-cli.test.ts` checks both
 * give the same hash on every case. Swap to a direct re-export once
 * `@texuli/tokens/design-system/validate` re-exports the spec functions.
 */
import { canonicalJson, sha256Hex } from '@texuli/tokens/design-system/compile-core';

/** The fields an approval excludes from its own hash (ADR-032). */
const EXCLUDED = new Set(['status', 'approvedBy', 'approvedAt', 'contentHash']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function withoutApprovalFields(approval: unknown): unknown {
  if (!isRecord(approval)) return approval;
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(approval)) if (!EXCLUDED.has(key)) kept[key] = value;
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function entryForHash(entry: unknown): unknown {
  if (!isRecord(entry) || !Object.hasOwn(entry, 'approval')) return entry;
  return { ...entry, approval: withoutApprovalFields(entry.approval) };
}

/** SHA-256 of the canonical JSON of the document without its approval fields (and its entries'). */
export function designSystemContentHash(doc: unknown): string {
  if (!isRecord(doc)) return sha256Hex(canonicalJson(doc));
  const view: Record<string, unknown> = { ...doc };
  if (Object.hasOwn(doc, 'approval')) view.approval = withoutApprovalFields(doc.approval);
  if (Array.isArray(doc.library)) view.library = doc.library.map(entryForHash);
  return sha256Hex(canonicalJson(view));
}

/** SHA-256 of the canonical JSON of one library entry without its approval fields. */
export function libraryEntryContentHash(entry: unknown): string {
  return sha256Hex(canonicalJson(entryForHash(entry)));
}
