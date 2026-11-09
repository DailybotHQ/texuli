/**
 * The changes model of the kit (kit API §5.4, owner answer 6): what changed between the
 * previous and the current version of a design system. It combines
 * `diffDesignSystems` of `@texuli/tokens/design-system/diff` over the compiled outputs
 * (tokens, contrast regressions, defaults, attributes) with a kit-local diff of the locked
 * sections the tokens diff has no class for yet: the allow set, the library and the
 * approval. This is what a consumer shows before moving a pinned version (Protoyard's
 * `ds use --upgrade`). Pure and total over JSON values.
 */
import type { CompiledDesignSystem } from '@texuli/tokens/design-system/compile-core';
import { type DesignSystemDiff, diffDesignSystems } from '@texuli/tokens/design-system/diff';
import { kitContentHash } from '../shared/approval.ts';
import { KIT_LIMITS, kitText } from '../shared/limits.ts';
import type { KitCompiled } from '../shared/types.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const strings = (value: unknown): string[] | undefined =>
  Array.isArray(value)
    ? value
        .slice(0, KIT_LIMITS.listItems)
        .flatMap((v) => (typeof v === 'string' ? [kitText(v, 64)?.text ?? ''] : []))
    : undefined;

export type KitChangeKind = 'added' | 'removed' | 'changed';

/** One version of the design system to compare. */
export interface KitVersion {
  readonly document: unknown;
  readonly compiled?: KitCompiled;
}

/** The allow lists of one component. */
export const KIT_ALLOW_LISTS = ['variants', 'sizes', 'tones', 'densities', 'states'] as const;
export type KitAllowList = (typeof KIT_ALLOW_LISTS)[number];

export type KitAllowChange =
  /** The design system became locked or unlocked. */
  | { readonly kind: 'locked' | 'unlocked' }
  /** A component entered or left the allow set. */
  | { readonly kind: 'added' | 'removed'; readonly component: string }
  /**
   * One list of an allowed component changed. `before`/`after` `undefined` means the list was
   * omitted (every catalog value allowed).
   */
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
  /** For `changed`: each field that changed, with its before and after text. */
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
  /** `undefined` when either compiled output is missing ("compile both versions to compare tokens"). */
  readonly tokens?: DesignSystemDiff;
  readonly allow: readonly KitAllowChange[];
  readonly library: readonly KitLibraryChange[];
  readonly approval: readonly KitApprovalChange[];
  /** Whether the content (the document without its approval) changed. */
  readonly contentChanged: boolean;
  /** Nothing changed in any part the kit compares. */
  readonly identical: boolean;
}

function allowSection(document: unknown): Record<string, unknown> | undefined {
  return isRecord(document) && isRecord(document.allow) ? document.allow : undefined;
}

function diffAllow(before: unknown, after: unknown): KitAllowChange[] {
  const a = allowSection(before);
  const b = allowSection(after);
  if (!a && !b) return [];
  if (!a)
    return [
      { kind: 'locked' },
      ...diffAllow({ allow: {} }, after).filter((c) => c.kind !== 'locked'),
    ];
  if (!b) return [{ kind: 'unlocked' }];
  const changes: KitAllowChange[] = [];
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort(byText);
  for (const id of ids.slice(0, KIT_LIMITS.components)) {
    const component = kitText(id, 64)?.text ?? id;
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
  return changes;
}

const LIBRARY_FIELDS = ['name', 'purpose', 'version', 'status'] as const;

function libraryById(document: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  const list = isRecord(document) && Array.isArray(document.library) ? document.library : [];
  for (const entry of list.slice(0, KIT_LIMITS.libraryEntries))
    if (isRecord(entry) && typeof entry.id === 'string' && !out.has(entry.id))
      out.set(entry.id, entry);
  return out;
}

function diffLibrary(before: unknown, after: unknown): KitLibraryChange[] {
  const a = libraryById(before);
  const b = libraryById(after);
  const changes: KitLibraryChange[] = [];
  for (const id of [...new Set([...a.keys(), ...b.keys()])].sort(byText)) {
    const shown = kitText(id, 64)?.text ?? id;
    const x = a.get(id);
    const y = b.get(id);
    if (!x) changes.push({ kind: 'added', id: shown });
    else if (!y) changes.push({ kind: 'removed', id: shown });
    else {
      const fields: { field: string; before?: string; after?: string }[] = [];
      for (const field of LIBRARY_FIELDS) {
        const l = kitText(x[field], 200)?.text;
        const r = kitText(y[field], 200)?.text;
        if (l !== r)
          fields.push({ field, ...(l ? { before: l } : {}), ...(r ? { after: r } : {}) });
      }
      const lc = (strings(x.composes) ?? []).join(', ');
      const rc = (strings(y.composes) ?? []).join(', ');
      if (lc !== rc) fields.push({ field: 'composes', before: lc, after: rc });
      const la = isRecord(x.approval) ? kitText(x.approval.status, 32)?.text : undefined;
      const ra = isRecord(y.approval) ? kitText(y.approval.status, 32)?.text : undefined;
      if (la !== ra)
        fields.push({
          field: 'approval',
          ...(la ? { before: la } : {}),
          ...(ra ? { after: ra } : {}),
        });
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
    const l = kitText(a[field], 200)?.text;
    const r = kitText(b[field], 200)?.text;
    if (l !== r) changes.push({ field, ...(l ? { before: l } : {}), ...(r ? { after: r } : {}) });
  }
  return changes;
}

/** What changed from `previous` to `current`. */
export function changesModel(previous: KitVersion, current: KitVersion): KitChangesModel {
  const version = (doc: unknown) => (isRecord(doc) ? kitText(doc.version, 64)?.text : undefined);
  const tokens =
    previous.compiled && current.compiled
      ? diffDesignSystems(
          previous.compiled as unknown as CompiledDesignSystem,
          current.compiled as unknown as CompiledDesignSystem
        )
      : undefined;
  const allow = diffAllow(previous.document, current.document);
  const library = diffLibrary(previous.document, current.document);
  const approval = diffApproval(previous.document, current.document);
  const contentChanged = kitContentHash(previous.document) !== kitContentHash(current.document);
  const from = version(previous.document);
  const to = version(current.document);
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(tokens ? { tokens } : {}),
    allow,
    library,
    approval,
    contentChanged,
    identical:
      !contentChanged &&
      allow.length === 0 &&
      library.length === 0 &&
      approval.length === 0 &&
      (tokens?.identical ?? true),
  };
}
