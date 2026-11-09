/**
 * The library model of the kit (kit API §5.3, ADR-032): the design system's own components as
 * the document declares them, each with the catalog ids it composes (allowed, not allowed or
 * unknown) and its approval record, whose content hash the kit recomputes by the spec rule
 * (`libraryEntryContentHash` of `@texuli/spec/design-system`: SHA-256 of the canonical JSON of
 * the entry without its `approval`). Pure and total over JSON values; text is clipped with
 * `KIT_LIMITS`, never interpreted.
 */
import { canonicalJson, sha256Hex } from '@texuli/tokens/design-system/compile-core';
import type { KitApprovalView } from '../shared/approval.ts';
import { KIT_LIMITS, kitText } from '../shared/limits.ts';
import type { KitAllowManifest, KitCatalog, KitLibraryEntry } from '../shared/types.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const HASH = /^[0-9a-f]{64}$/;

/** A library entry's content hash, by the spec rule: the entry without its `approval`. */
export function kitEntryContentHash(entry: unknown): string {
  if (!isRecord(entry) || !Object.hasOwn(entry, 'approval')) return sha256Hex(canonicalJson(entry));
  const { approval: _approval, ...rest } = entry;
  return sha256Hex(canonicalJson(rest));
}

/** A library entry's approval view (the same shape as the document's, `kitApproval`). */
export function kitEntryApproval(entry: unknown): KitApprovalView {
  const computedHash = kitEntryContentHash(entry);
  const record = isRecord(entry) && isRecord(entry.approval) ? entry.approval : undefined;
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

/** Whether a composed catalog id is allowed by the design system. */
export type KitComposeState = 'allowed' | 'not-allowed' | 'unknown';

export interface KitLibraryItem {
  /** The library id (the snippet key), clipped to 64 characters. */
  readonly id: string;
  readonly name: string;
  readonly purpose?: string;
  readonly version?: string;
  /** The entry's own status field. */
  readonly status: 'draft' | 'approved' | 'unknown';
  readonly composes: readonly { readonly id: string; readonly state: KitComposeState }[];
  readonly approval: KitApprovalView;
  /** The entry as the document declares it (passed to the host's snippet). */
  readonly entry: KitLibraryEntry;
}

export interface KitLibraryModel {
  readonly items: readonly KitLibraryItem[];
  /** More entries than `KIT_LIMITS.libraryEntries`: the rest are not shown. */
  readonly clipped: boolean;
  /** Whether an allow set applies (manifest or document); unlocked otherwise. */
  readonly locked: boolean;
}

/** The allow keys that apply: the manifest's, else the document's own `allow`; `undefined` is unlocked. */
function allowedIds(document: unknown, allow?: KitAllowManifest): Set<string> | undefined {
  const section = allow
    ? allow.allow
    : isRecord(document) && isRecord(document.allow)
      ? document.allow
      : undefined;
  return section ? new Set(Object.keys(section)) : undefined;
}

/**
 * The library section's model: every `document.library` entry (at most
 * `KIT_LIMITS.libraryEntries`), its composed ids marked against the allow set and the
 * catalog, and its approval with the hash check.
 */
export function libraryModel(
  document: unknown,
  allow?: KitAllowManifest,
  catalog?: KitCatalog
): KitLibraryModel {
  const raw = isRecord(document) && Array.isArray(document.library) ? document.library : [];
  const allowed = allowedIds(document, allow);
  const known = catalog ? new Set(catalog.components.map((c) => c.id)) : undefined;
  const items: KitLibraryItem[] = [];
  const seen = new Set<string>();
  for (const value of raw.slice(0, KIT_LIMITS.libraryEntries)) {
    if (!isRecord(value)) continue;
    const id = kitText(value.id, 64)?.text;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const composes = (Array.isArray(value.composes) ? value.composes : [])
      .slice(0, KIT_LIMITS.listItems)
      .flatMap((ref) => {
        const cid = kitText(ref, 64)?.text;
        if (!cid) return [];
        const state: KitComposeState =
          known && !known.has(cid)
            ? 'unknown'
            : allowed && !allowed.has(cid)
              ? 'not-allowed'
              : 'allowed';
        return [{ id: cid, state }];
      });
    items.push({
      id,
      name: kitText(value.name, 200)?.text ?? id,
      purpose: kitText(value.purpose)?.text,
      version: kitText(value.version, 64)?.text,
      status: value.status === 'approved' || value.status === 'draft' ? value.status : 'unknown',
      composes,
      approval: kitEntryApproval(value),
      entry: value as unknown as KitLibraryEntry,
    });
  }
  return { items, clipped: raw.length > KIT_LIMITS.libraryEntries, locked: allowed !== undefined };
}
