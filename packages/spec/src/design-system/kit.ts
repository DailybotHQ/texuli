/**
 * Svelte-free kit models (ADR-032, T-017-kit): `kitApproval` / `kitContentHash` and
 * `changesModel` over two design-system documents. `@texuli/spec/design-system` is the
 * home; `texuli/ds-kit` re-exports them. Token diffs stay in the kit wrapper (they need
 * `@texuli/tokens/design-system/diff`, which this layer cannot import).
 */
import { designSystemContentHash } from './hash.ts';

const COMPONENTS = 4096;
const LIBRARY_ENTRIES = 64;
const LIST_ITEMS = 100;
const HASH = /^[0-9a-f]{64}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value.slice(0, LIST_ITEMS).flatMap((v) => {
        const text = clip(v, 64);
        return text !== undefined ? [text] : [];
      })
    : undefined;

/** The document's content hash (the ADR-032 rule: `designSystemContentHash`). */
export function kitContentHash(doc: unknown): string {
  return designSystemContentHash(doc);
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
  /** The hash computed from the document. */
  readonly computedHash: string;
  /** `missing`: the record has no `contentHash` to compare. */
  readonly hash: KitHashCheck;
}

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
  return {
    present: true,
    status,
    approvedBy: clip(record.approvedBy, 200),
    approvedAt: clip(record.approvedAt, 200),
    version: clip(record.version, 200),
    contentHash,
    computedHash,
    hash:
      contentHash === undefined ? 'missing' : contentHash === computedHash ? 'matches' : 'differs',
  };
}

export type KitChangeKind = 'added' | 'removed' | 'changed';

/** One version of the design system to compare. `compiled` is ignored here (the kit adds tokens). */
export interface KitVersion {
  readonly document: unknown;
  readonly compiled?: unknown;
}

export const KIT_ALLOW_LISTS = [
  'variants',
  'sizes',
  'tones',
  'densities',
  'colors',
  'states',
] as const;
export type KitAllowList = (typeof KIT_ALLOW_LISTS)[number];

export type KitAllowChange =
  | { readonly kind: 'locked' | 'unlocked' }
  | { readonly kind: 'added' | 'removed'; readonly component: string }
  | {
      readonly kind: 'changed';
      readonly component: string;
      readonly list: KitAllowList;
      readonly added: readonly string[];
      readonly removed: readonly string[];
      readonly before?: readonly string[];
      readonly after?: readonly string[];
    };

export interface KitLibraryChange {
  readonly kind: KitChangeKind;
  readonly id: string;
  readonly fields?: readonly {
    readonly field: string;
    readonly before?: string;
    readonly after?: string;
  }[];
}

export interface KitApprovalChange {
  readonly field: 'status' | 'version' | 'approvedBy' | 'approvedAt' | 'contentHash';
  readonly before?: string;
  readonly after?: string;
}

export interface KitChangesModel {
  readonly from?: string;
  readonly to?: string;
  readonly allow: readonly KitAllowChange[];
  readonly library: readonly KitLibraryChange[];
  readonly approval: readonly KitApprovalChange[];
  /** Inputs beyond a model cap that were omitted from its detail list. */
  readonly warnings: readonly string[];
  readonly contentChanged: boolean;
  readonly identical: boolean;
}

function allowSection(document: unknown): Record<string, unknown> | undefined {
  return isRecord(document) && isRecord(document.allow) ? document.allow : undefined;
}

function diffAllow(
  before: unknown,
  after: unknown
): { changes: KitAllowChange[]; warnings: string[] } {
  const a = allowSection(before);
  const b = allowSection(after);
  if (!a && !b) return { changes: [], warnings: [] };
  if (!a) {
    const diff = diffAllow({ allow: {} }, after);
    return {
      changes: [{ kind: 'locked' }, ...diff.changes.filter((change) => change.kind !== 'locked')],
      warnings: diff.warnings,
    };
  }
  if (!b) return { changes: [{ kind: 'unlocked' }], warnings: [] };
  const changes: KitAllowChange[] = [];
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(byText);
  const omitted = Math.max(0, ids.length - COMPONENTS);
  const warnings =
    omitted === 0
      ? []
      : [
          `Allow change details omit ${omitted} component${omitted === 1 ? '' : 's'} beyond the ${COMPONENTS}-component limit.`,
        ];
  for (const id of ids.slice(0, COMPONENTS)) {
    const component = clip(id, 64) ?? id;
    if (!Object.hasOwn(a, id)) {
      changes.push({ kind: 'added', component });
      continue;
    }
    if (!Object.hasOwn(b, id)) {
      changes.push({ kind: 'removed', component });
      continue;
    }
    const x = isRecord(a[id]) ? a[id] : {};
    const y = isRecord(b[id]) ? b[id] : {};
    for (const list of KIT_ALLOW_LISTS) {
      const left = strings(x[list]);
      const right = strings(y[list]);
      if (JSON.stringify(left) === JSON.stringify(right)) continue;
      changes.push({
        kind: 'changed',
        component,
        list,
        added: (right ?? []).filter((v) => !(left ?? []).includes(v)),
        removed: (left ?? []).filter((v) => !(right ?? []).includes(v)),
        ...(left ? { before: left } : {}),
        ...(right ? { after: right } : {}),
      });
    }
  }
  return { changes, warnings };
}

const LIBRARY_FIELDS = ['name', 'purpose', 'version', 'status'] as const;
const LIBRARY_APPROVAL_FIELDS = ['status', 'approvedBy', 'version', 'contentHash'] as const;

function libraryById(document: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  const list = isRecord(document) && Array.isArray(document.library) ? document.library : [];
  for (const entry of list.slice(0, LIBRARY_ENTRIES))
    if (isRecord(entry) && typeof entry.id === 'string' && !out.has(entry.id))
      out.set(entry.id, entry);
  return out;
}

function diffLibrary(before: unknown, after: unknown): KitLibraryChange[] {
  const a = libraryById(before);
  const b = libraryById(after);
  const changes: KitLibraryChange[] = [];
  for (const id of [...new Set([...a.keys(), ...b.keys()])].sort(byText)) {
    const shown = clip(id, 64) ?? id;
    const x = a.get(id);
    const y = b.get(id);
    if (!x) changes.push({ kind: 'added', id: shown });
    else if (!y) changes.push({ kind: 'removed', id: shown });
    else {
      const fields: { field: string; before?: string; after?: string }[] = [];
      for (const field of LIBRARY_FIELDS) {
        const l = clip(x[field], 200);
        const r = clip(y[field], 200);
        if (l !== r)
          fields.push({ field, ...(l ? { before: l } : {}), ...(r ? { after: r } : {}) });
      }
      const lc = (strings(x.composes) ?? []).join(', ');
      const rc = (strings(y.composes) ?? []).join(', ');
      if (lc !== rc) fields.push({ field: 'composes', before: lc, after: rc });
      const xa = isRecord(x.approval) ? x.approval : {};
      const ya = isRecord(y.approval) ? y.approval : {};
      for (const field of LIBRARY_APPROVAL_FIELDS) {
        const l = clip(xa[field], 200);
        const r = clip(ya[field], 200);
        if (l !== r)
          fields.push({
            field: `approval.${field}`,
            ...(l ? { before: l } : {}),
            ...(r ? { after: r } : {}),
          });
      }
      if (fields.length > 0) changes.push({ kind: 'changed', id: shown, fields });
    }
  }
  return changes;
}

const APPROVAL_FIELDS = ['status', 'version', 'approvedBy', 'approvedAt', 'contentHash'] as const;

function diffApproval(before: unknown, after: unknown): KitApprovalChange[] {
  const a = isRecord(before) && isRecord(before.approval) ? before.approval : {};
  const b = isRecord(after) && isRecord(after.approval) ? after.approval : {};
  const changes: KitApprovalChange[] = [];
  for (const field of APPROVAL_FIELDS) {
    const l = clip(a[field], 200);
    const r = clip(b[field], 200);
    if (l !== r) changes.push({ field, ...(l ? { before: l } : {}), ...(r ? { after: r } : {}) });
  }
  return changes;
}

/** What changed from `previous` to `current` in the document (allow, library, approval). */
export function changesModel(previous: KitVersion, current: KitVersion): KitChangesModel {
  const version = (doc: unknown) => (isRecord(doc) ? clip(doc.version, 64) : undefined);
  const allow = diffAllow(previous.document, current.document);
  const library = diffLibrary(previous.document, current.document);
  const approval = diffApproval(previous.document, current.document);
  const contentChanged = kitContentHash(previous.document) !== kitContentHash(current.document);
  const from = version(previous.document);
  const to = version(current.document);
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    allow: allow.changes,
    library,
    approval,
    warnings: allow.warnings,
    contentChanged,
    identical:
      !contentChanged &&
      allow.changes.length === 0 &&
      library.length === 0 &&
      approval.length === 0,
  };
}
