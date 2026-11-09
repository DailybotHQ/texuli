/**
 * The allow manifest a compiled design system carries beside its CSS
 * (ADR-032). Checkers read it; `emitCss` never does, so a document with or
 * without `allow` compiles to the same stylesheet. Disabled variants stay
 * in the CSS and are flagged here as empty lists (allow none).
 *
 * Allow and library values come from the resolved document when supplied;
 * `contentHash` and `version` still identify the source document as written.
 * The catalog is never imported; pass `catalogDigest` when the caller has one.
 */
import { designSystemContentHash } from '@texuli/spec/design-system';

/** Blueprint spec version this manifest names (ADR-032, spec 0.13.0). */
export const ALLOW_MANIFEST_SPEC_VERSION = '0.13.0';

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const AXIS = ['variants', 'sizes', 'tones', 'densities', 'states'] as const;
const ALLOW_CAP = 256;
const AXIS_CAP = 32;
const LIBRARY_CAP = 64;

export interface DesignSystemAllowManifestEntry {
  readonly variants?: readonly string[];
  readonly sizes?: readonly string[];
  readonly tones?: readonly string[];
  readonly densities?: readonly string[];
  readonly states?: readonly string[];
}

export interface DesignSystemAllowManifestLibraryEntry {
  readonly id: string;
  readonly version: string;
  readonly status: string;
}

export interface DesignSystemAllowManifest {
  readonly allow?: Readonly<Record<string, DesignSystemAllowManifestEntry>>;
  readonly library?: readonly DesignSystemAllowManifestLibraryEntry[];
  readonly version: string;
  readonly contentHash: string;
  readonly specVersion: string;
  readonly catalogDigest?: string;
}

export interface CompileAllowManifestOptions {
  /** Catalog hash from the caller; never loaded here. */
  catalogDigest?: string;
  /** Effective document after extends, variant and patches; source metadata stays from `doc`. */
  resolvedDocument?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const strings = (value: unknown, cap: number): string[] | undefined => {
  if (!Array.isArray(value)) return;
  const out: string[] = [];
  for (let i = 0; i < value.length && out.length < cap; i++) {
    const item = value[i];
    if (typeof item === 'string') out.push(item);
  }
  return out;
};

function copyAllow(value: unknown): Record<string, DesignSystemAllowManifestEntry> | undefined {
  if (!isRecord(value)) return;
  const ids = Object.keys(value)
    .filter((id) => !RESERVED.has(id))
    .sort();
  const allow: Record<string, DesignSystemAllowManifestEntry> = {};
  const cap = Math.min(ids.length, ALLOW_CAP);
  for (let i = 0; i < cap; i++) {
    const id = ids[i] as string;
    const raw = value[id];
    const entry: Record<string, readonly string[]> = {};
    if (isRecord(raw))
      for (const axis of AXIS) {
        const listed = strings(raw[axis], AXIS_CAP);
        if (listed) entry[axis] = listed;
      }
    allow[id] = entry;
  }
  return allow;
}

function copyLibrary(value: unknown): DesignSystemAllowManifestLibraryEntry[] | undefined {
  if (!Array.isArray(value)) return;
  const library: DesignSystemAllowManifestLibraryEntry[] = [];
  const cap = Math.min(value.length, LIBRARY_CAP);
  for (let i = 0; i < cap; i++) {
    const entry = value[i];
    if (!isRecord(entry) || typeof entry.id !== 'string') continue;
    if (typeof entry.version !== 'string' || typeof entry.status !== 'string') continue;
    if (RESERVED.has(entry.id)) continue;
    library.push({ id: entry.id, version: entry.version, status: entry.status });
  }
  return library;
}

/**
 * Build the allow manifest of a design-system document. Pure and total over
 * JSON values; never throws. A document without `allow` omits that field.
 */
export function compileAllowManifest(
  doc: unknown,
  options: CompileAllowManifestOptions = {}
): DesignSystemAllowManifest {
  const record = isRecord(doc) ? doc : {};
  const effective = isRecord(options.resolvedDocument) ? options.resolvedDocument : record;
  const allow = copyAllow(effective.allow);
  const library = copyLibrary(effective.library);
  const version = typeof record.version === 'string' ? record.version : '';
  const manifest: DesignSystemAllowManifest = {
    ...(allow ? { allow } : {}),
    ...(library ? { library } : {}),
    version,
    contentHash: designSystemContentHash(doc),
    specVersion: ALLOW_MANIFEST_SPEC_VERSION,
    ...(typeof options.catalogDigest === 'string' ? { catalogDigest: options.catalogDigest } : {}),
  };
  return manifest;
}
