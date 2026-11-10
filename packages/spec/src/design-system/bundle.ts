/**
 * Portable design-system bundles (ADR-032): one JSON unit that carries the
 * document, its library component sources as text, the allow manifest and
 * the release history. Bounded untrusted input; hashes are verified;
 * sources are never executed. Pure and total: `{ ok, errors }` instead of
 * throws.
 */
import type {
  DesignSystemBundle,
  DesignSystemBundleAllowManifest,
  DesignSystemBundleHistoryEntry,
  DesignSystemBundleLibrarySource,
} from '../../generated/typescript/design-system-bundle.ts';
import { isRecord } from '../dialect.ts';
import { SPEC_VERSION } from '../version.ts';
import { canonicalJson, designSystemContentHash, sha256Hex } from './hash.ts';
import { validateDesignSystem } from './validate.ts';

export const DESIGN_SYSTEM_BUNDLE_FORMAT = 'texuli/design-system-bundle';
export const DESIGN_SYSTEM_BUNDLE_VERSION = 1;

/** Caps accepted from the document and bundle fields. */
export const DESIGN_SYSTEM_BUNDLE_LIMITS = Object.freeze({
  allow: 4096,
  axis: 32,
  library: 64,
  history: 32,
  source: 65_536,
  changelog: 4_000,
  extensions: 16,
});

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const AXIS = ['variants', 'sizes', 'tones', 'densities', 'colors', 'states'] as const;
const SHA256 = /^[0-9a-f]{64}$/;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const SAFE_ID = /^(?=.{1,64}$)[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const LANGUAGE = /^[a-z][a-z0-9+-]{0,31}$/;
const ISO_UTC =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?Z$/;
const NAMESPACE = /^[a-z][a-z0-9]{1,15}$/;

export const DESIGN_SYSTEM_BUNDLE_CODES = [
  'unknown-key',
  'invalid-type',
  'invalid-value',
  'required',
  'format-version',
  'content-hash-mismatch',
  'library-hash-mismatch',
  'path-refused',
  'too-large',
] as const;
export type DesignSystemBundleCode = (typeof DESIGN_SYSTEM_BUNDLE_CODES)[number];

export interface DesignSystemBundleIssue {
  code: DesignSystemBundleCode;
  path: string;
  message: string;
  hint?: string;
}

export interface DesignSystemBundleValidation {
  ok: boolean;
  errors: readonly DesignSystemBundleIssue[];
}

export interface PackLibrarySource {
  readonly id: string;
  readonly version: string;
  readonly language?: string;
  readonly source: string;
  readonly contentHash?: string;
}

export interface PackHistoryEntry {
  readonly version: string;
  readonly contentHash: string;
  readonly changelog?: string;
  readonly approvedAt?: string;
  readonly approvedBy?: string;
  readonly status?: 'approved' | 'draft';
}

export interface PackBundleInput {
  readonly document: unknown;
  readonly librarySources?: readonly PackLibrarySource[];
  readonly history?: readonly PackHistoryEntry[];
  readonly catalogDigest?: string;
  readonly extensions?: readonly string[];
}

export type PackBundleResult =
  | { ok: true; bundle: DesignSystemBundle }
  | { ok: false; errors: readonly DesignSystemBundleIssue[] };

export type UnpackBundleResult =
  | {
      ok: true;
      bundle: DesignSystemBundle;
      document: DesignSystemBundle['document'];
      allowManifest: DesignSystemBundleAllowManifest;
      librarySources: readonly DesignSystemBundleLibrarySource[];
      history: readonly DesignSystemBundleHistoryEntry[];
    }
  | { ok: false; errors: readonly DesignSystemBundleIssue[] };

const issue = (
  code: DesignSystemBundleCode,
  path: string,
  message: string,
  hint?: string
): DesignSystemBundleIssue => (hint ? { code, path, message, hint } : { code, path, message });

const at = (path: string, key: string | number): string =>
  typeof key === 'number'
    ? `${path}[${key}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;

function pathRefused(id: string): boolean {
  return (
    id.includes('/') ||
    id.includes('\\') ||
    id.includes('\0') ||
    id.includes('..') ||
    RESERVED.has(id) ||
    !SAFE_ID.test(id)
  );
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return;
  const out: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const item = value[i];
    if (typeof item === 'string') out.push(item);
  }
  return out;
}

function copyAllow(value: unknown): DesignSystemBundleAllowManifest['allow'] | undefined {
  if (!isRecord(value)) return;
  const ids = Object.keys(value)
    .filter((id) => !RESERVED.has(id))
    .sort();
  const allow: Record<string, Record<string, readonly string[]>> = {};
  for (const id of ids) {
    const raw = value[id];
    const entry: Record<string, readonly string[]> = {};
    if (isRecord(raw))
      for (const axis of AXIS) {
        const listed = strings(raw[axis]);
        if (listed) entry[axis] = listed;
      }
    allow[id] = entry;
  }
  return allow;
}

function copyLibrary(
  value: unknown
): NonNullable<DesignSystemBundleAllowManifest['library']> | undefined {
  if (!Array.isArray(value)) return;
  const library: { id: string; version: string; status: string }[] = [];
  const cap = Math.min(value.length, DESIGN_SYSTEM_BUNDLE_LIMITS.library);
  for (let i = 0; i < cap; i++) {
    const entry = value[i];
    if (!isRecord(entry) || typeof entry.id !== 'string') continue;
    if (typeof entry.version !== 'string' || typeof entry.status !== 'string') continue;
    if (RESERVED.has(entry.id)) continue;
    library.push({ id: entry.id, version: entry.version, status: entry.status });
  }
  return library;
}

/** The allow manifest packed beside a document (same fields as compileAllowManifest). */
export function allowManifestFromDocument(
  doc: unknown,
  options: { catalogDigest?: string; extensions?: readonly string[] } = {}
): DesignSystemBundleAllowManifest {
  const record = isRecord(doc) ? doc : {};
  const allow = copyAllow(record.allow);
  const library = copyLibrary(record.library);
  const namespaces = [...new Set((options.extensions ?? []).filter((ns) => NAMESPACE.test(ns)))]
    .sort()
    .slice(0, DESIGN_SYSTEM_BUNDLE_LIMITS.extensions);
  return {
    ...(allow ? { allow } : {}),
    ...(library ? { library } : {}),
    version: typeof record.version === 'string' ? record.version : '',
    contentHash: designSystemContentHash(doc),
    specVersion: SPEC_VERSION,
    ...(typeof options.catalogDigest === 'string' ? { catalogDigest: options.catalogDigest } : {}),
    ...(namespaces.length > 0 ? { extensions: namespaces } : {}),
  };
}

function collect(
  errors: DesignSystemBundleIssue[],
  max: number,
  next: DesignSystemBundleIssue
): void {
  if (errors.length < max) errors.push(next);
}

function checkSha(
  value: unknown,
  path: string,
  errors: DesignSystemBundleIssue[]
): string | undefined {
  if (typeof value !== 'string') {
    collect(errors, 64, issue('invalid-type', path, 'Must be a SHA-256 hex string.'));
    return;
  }
  if (!SHA256.test(value)) {
    collect(errors, 64, issue('invalid-value', path, 'Must be a lowercase hex SHA-256.'));
    return;
  }
  return value;
}

function checkSource(
  value: unknown,
  path: string,
  errors: DesignSystemBundleIssue[]
): DesignSystemBundleLibrarySource | undefined {
  if (!isRecord(value)) {
    collect(errors, 64, issue('invalid-type', path, 'A library source must be an object.'));
    return;
  }
  for (const key of Object.keys(value)) {
    if (!['id', 'version', 'language', 'source', 'contentHash'].includes(key))
      collect(errors, 64, issue('unknown-key', at(path, key), `"${key}" is not allowed.`));
  }
  if (typeof value.id !== 'string') {
    collect(errors, 64, issue('required', at(path, 'id'), '"id" is required.'));
    return;
  }
  if (pathRefused(value.id)) {
    collect(
      errors,
      64,
      issue('path-refused', at(path, 'id'), 'A library source id cannot traverse paths.', value.id)
    );
    return;
  }
  if (typeof value.version !== 'string' || value.version.length === 0) {
    collect(errors, 64, issue('required', at(path, 'version'), '"version" is required.'));
    return;
  }
  if (typeof value.source !== 'string') {
    collect(errors, 64, issue('required', at(path, 'source'), '"source" is required.'));
    return;
  }
  const sourceBytes =
    value.source.length > DESIGN_SYSTEM_BUNDLE_LIMITS.source
      ? value.source.length
      : new TextEncoder().encode(value.source).byteLength;
  if (sourceBytes > DESIGN_SYSTEM_BUNDLE_LIMITS.source) {
    collect(
      errors,
      64,
      issue(
        'too-large',
        at(path, 'source'),
        `Source is at most ${DESIGN_SYSTEM_BUNDLE_LIMITS.source} UTF-8 bytes.`
      )
    );
    return;
  }
  if (value.language !== undefined) {
    if (typeof value.language !== 'string' || !LANGUAGE.test(value.language))
      collect(
        errors,
        64,
        issue('invalid-value', at(path, 'language'), 'language is a short hint.')
      );
  }
  const expected = sha256Hex(value.source);
  const stored = checkSha(value.contentHash, at(path, 'contentHash'), errors);
  if (stored !== undefined && stored !== expected) {
    collect(
      errors,
      64,
      issue(
        'library-hash-mismatch',
        at(path, 'contentHash'),
        'The recorded contentHash does not match the source text.'
      )
    );
    return;
  }
  if (stored === undefined) return;
  return {
    id: value.id,
    version: value.version,
    source: value.source,
    contentHash: expected,
    ...(typeof value.language === 'string' && LANGUAGE.test(value.language)
      ? { language: value.language }
      : {}),
  };
}

function checkDuplicateSourceIds(
  value: readonly unknown[],
  errors: DesignSystemBundleIssue[]
): void {
  const ids = new Set<string>();
  for (let index = 0; index < value.length; index++) {
    const entry = value[index];
    if (!isRecord(entry) || typeof entry.id !== 'string') continue;
    if (ids.has(entry.id)) {
      collect(
        errors,
        64,
        issue(
          'invalid-value',
          at(at('$.librarySources', index), 'id'),
          'Library source ids must be unique.',
          entry.id
        )
      );
    } else ids.add(entry.id);
  }
}

function checkCurrentVersionHistory(
  document: unknown,
  history: readonly unknown[],
  errors: DesignSystemBundleIssue[]
): void {
  if (!isRecord(document) || typeof document.version !== 'string') return;
  const current = designSystemContentHash(document);
  for (let index = 0; index < history.length; index++) {
    const entry = history[index];
    if (
      !isRecord(entry) ||
      entry.version !== document.version ||
      typeof entry.contentHash !== 'string' ||
      entry.contentHash === current
    )
      continue;
    collect(
      errors,
      64,
      issue(
        'content-hash-mismatch',
        at(at('$.history', index), 'contentHash'),
        'A history entry for the packed version does not match the document.'
      )
    );
  }
}

function checkHistory(
  value: unknown,
  path: string,
  errors: DesignSystemBundleIssue[]
): DesignSystemBundleHistoryEntry | undefined {
  if (!isRecord(value)) {
    collect(errors, 64, issue('invalid-type', path, 'A history entry must be an object.'));
    return;
  }
  for (const key of Object.keys(value)) {
    if (
      !['version', 'contentHash', 'changelog', 'approvedAt', 'approvedBy', 'status'].includes(key)
    )
      collect(errors, 64, issue('unknown-key', at(path, key), `"${key}" is not allowed.`));
  }
  if (typeof value.version !== 'string' || value.version.length === 0) {
    collect(errors, 64, issue('required', at(path, 'version'), '"version" is required.'));
    return;
  }
  const hash = checkSha(value.contentHash, at(path, 'contentHash'), errors);
  if (hash === undefined) return;
  if (value.changelog !== undefined) {
    if (typeof value.changelog !== 'string')
      collect(
        errors,
        64,
        issue('invalid-type', at(path, 'changelog'), 'changelog must be a string.')
      );
    else if (value.changelog.length > DESIGN_SYSTEM_BUNDLE_LIMITS.changelog)
      collect(
        errors,
        64,
        issue('too-large', at(path, 'changelog'), 'changelog is at most 4000 characters.')
      );
  }
  if (value.approvedAt !== undefined) {
    if (typeof value.approvedAt !== 'string' || !ISO_UTC.test(value.approvedAt))
      collect(
        errors,
        64,
        issue('invalid-value', at(path, 'approvedAt'), 'approvedAt is ISO 8601 UTC.')
      );
  }
  if (value.approvedBy !== undefined && typeof value.approvedBy !== 'string')
    collect(
      errors,
      64,
      issue('invalid-type', at(path, 'approvedBy'), 'approvedBy must be a string.')
    );
  if (value.status !== undefined && value.status !== 'approved' && value.status !== 'draft')
    collect(errors, 64, issue('invalid-value', at(path, 'status'), 'status is approved or draft.'));
  return {
    version: value.version,
    contentHash: hash,
    ...(typeof value.changelog === 'string' ? { changelog: value.changelog } : {}),
    ...(typeof value.approvedAt === 'string' ? { approvedAt: value.approvedAt } : {}),
    ...(typeof value.approvedBy === 'string' ? { approvedBy: value.approvedBy } : {}),
    ...(value.status === 'approved' || value.status === 'draft' ? { status: value.status } : {}),
  };
}

function checkAllowManifest(
  value: unknown,
  document: unknown,
  errors: DesignSystemBundleIssue[]
): DesignSystemBundleAllowManifest | undefined {
  const path = '$.allowManifest';
  if (!isRecord(value)) {
    collect(errors, 64, issue('invalid-type', path, 'allowManifest must be an object.'));
    return;
  }
  for (const key of Object.keys(value)) {
    if (
      ![
        'allow',
        'library',
        'version',
        'contentHash',
        'specVersion',
        'catalogDigest',
        'extensions',
      ].includes(key)
    )
      collect(errors, 64, issue('unknown-key', at(path, key), `"${key}" is not allowed.`));
  }
  if (typeof value.version !== 'string')
    collect(errors, 64, issue('required', at(path, 'version'), '"version" is required.'));
  if (typeof value.specVersion !== 'string' || !SEMVER.test(value.specVersion))
    collect(errors, 64, issue('invalid-value', at(path, 'specVersion'), 'specVersion is x.y.z.'));
  if (value.allow !== undefined) {
    if (!isRecord(value.allow)) {
      collect(errors, 64, issue('invalid-type', at(path, 'allow'), 'allow must be an object.'));
    } else {
      const ids = Object.keys(value.allow);
      if (ids.length > DESIGN_SYSTEM_BUNDLE_LIMITS.allow)
        collect(
          errors,
          64,
          issue(
            'too-large',
            at(path, 'allow'),
            `At most ${DESIGN_SYSTEM_BUNDLE_LIMITS.allow} allowed components.`
          )
        );
      for (const id of ids) {
        if (RESERVED.has(id))
          collect(errors, 64, issue('invalid-value', at(at(path, 'allow'), id), 'Reserved key.'));
        const entry = value.allow[id];
        if (!isRecord(entry)) {
          collect(
            errors,
            64,
            issue('invalid-type', at(at(path, 'allow'), id), 'An allow entry must be an object.')
          );
          continue;
        }
        for (const axis of AXIS) {
          const values = entry[axis];
          if (values === undefined) continue;
          if (!Array.isArray(values)) {
            collect(
              errors,
              64,
              issue(
                'invalid-type',
                at(at(at(path, 'allow'), id), axis),
                'Axis values must be an array.'
              )
            );
          } else if (values.length > DESIGN_SYSTEM_BUNDLE_LIMITS.axis) {
            collect(
              errors,
              64,
              issue(
                'too-large',
                at(at(at(path, 'allow'), id), axis),
                `At most ${DESIGN_SYSTEM_BUNDLE_LIMITS.axis} values for an axis.`
              )
            );
          } else if (values.some((item) => typeof item !== 'string')) {
            collect(
              errors,
              64,
              issue(
                'invalid-type',
                at(at(at(path, 'allow'), id), axis),
                'Axis values must be strings.'
              )
            );
          }
        }
      }
    }
  }
  const hash = checkSha(value.contentHash, at(path, 'contentHash'), errors);
  const expected = designSystemContentHash(document);
  if (hash !== undefined && hash !== expected)
    collect(
      errors,
      64,
      issue(
        'content-hash-mismatch',
        at(path, 'contentHash'),
        'The recorded contentHash does not match the packed document.'
      )
    );
  if (value.catalogDigest !== undefined)
    checkSha(value.catalogDigest, at(path, 'catalogDigest'), errors);
  return value as unknown as DesignSystemBundleAllowManifest;
}

/**
 * Check a JSON value as a design-system bundle: schema shape, hashes,
 * bounds and path-safe source ids. Sources are never executed.
 */
export function validateBundle(value: unknown): DesignSystemBundleValidation {
  const errors: DesignSystemBundleIssue[] = [];
  if (!isRecord(value))
    return { ok: false, errors: [issue('invalid-type', '$', 'A bundle must be an object.')] };
  for (const key of Object.keys(value)) {
    if (
      !['format', 'version', 'document', 'allowManifest', 'librarySources', 'history'].includes(key)
    )
      collect(errors, 64, issue('unknown-key', at('$', key), `"${key}" is not allowed.`));
  }
  if (value.format !== DESIGN_SYSTEM_BUNDLE_FORMAT)
    collect(
      errors,
      64,
      issue('format-version', '$.format', `format must be ${DESIGN_SYSTEM_BUNDLE_FORMAT}.`)
    );
  if (value.version !== DESIGN_SYSTEM_BUNDLE_VERSION)
    collect(errors, 64, issue('format-version', '$.version', 'version must be 1.'));
  if (value.document === undefined)
    collect(errors, 64, issue('required', '$.document', '"document" is required.'));
  else {
    const checked = validateDesignSystem(value.document);
    if (!checked.ok) {
      for (const item of checked.errors) {
        const path = item.path.startsWith('$.')
          ? `$.document${item.path.slice(1)}`
          : at('$.document', item.path);
        collect(errors, 64, issue('invalid-value', path, item.message, item.hint));
      }
    }
  }
  if (value.allowManifest === undefined)
    collect(errors, 64, issue('required', '$.allowManifest', '"allowManifest" is required.'));
  else if (value.document !== undefined)
    checkAllowManifest(value.allowManifest, value.document, errors);
  if (!Array.isArray(value.librarySources))
    collect(
      errors,
      64,
      issue('required', '$.librarySources', '"librarySources" must be an array.')
    );
  else if (value.librarySources.length > DESIGN_SYSTEM_BUNDLE_LIMITS.library)
    collect(
      errors,
      64,
      issue(
        'too-large',
        '$.librarySources',
        `At most ${DESIGN_SYSTEM_BUNDLE_LIMITS.library} library sources.`
      )
    );
  else
    value.librarySources.forEach((entry, index) => {
      checkSource(entry, at('$.librarySources', index), errors);
    });
  if (Array.isArray(value.librarySources)) checkDuplicateSourceIds(value.librarySources, errors);
  if (!Array.isArray(value.history))
    collect(errors, 64, issue('required', '$.history', '"history" must be an array.'));
  else if (value.history.length > DESIGN_SYSTEM_BUNDLE_LIMITS.history)
    collect(
      errors,
      64,
      issue(
        'too-large',
        '$.history',
        `At most ${DESIGN_SYSTEM_BUNDLE_LIMITS.history} history entries.`
      )
    );
  else
    value.history.forEach((entry, index) => {
      checkHistory(entry, at('$.history', index), errors);
    });
  if (Array.isArray(value.history))
    checkCurrentVersionHistory(value.document, value.history, errors);
  return { ok: errors.length === 0, errors };
}

function fail(errors: readonly DesignSystemBundleIssue[]): PackBundleResult {
  return { ok: false, errors };
}

/**
 * Pack a design-system document, optional library sources and release
 * history into one bundle. Computes source hashes and the allow manifest.
 * Sources are stored as text and never executed.
 */
export function packBundle(input: PackBundleInput): PackBundleResult {
  const errors: DesignSystemBundleIssue[] = [];
  const checked = validateDesignSystem(input.document);
  if (!checked.ok) {
    for (const item of checked.errors) {
      const path = item.path.startsWith('$.')
        ? `$.document${item.path.slice(1)}`
        : at('$.document', item.path);
      collect(errors, 64, issue('invalid-value', path, item.message, item.hint));
    }
    return fail(errors);
  }
  const sourcesIn = input.librarySources ?? [];
  if (sourcesIn.length > DESIGN_SYSTEM_BUNDLE_LIMITS.library)
    return fail([
      issue(
        'too-large',
        '$.librarySources',
        `At most ${DESIGN_SYSTEM_BUNDLE_LIMITS.library} library sources.`
      ),
    ]);
  const librarySources: DesignSystemBundleLibrarySource[] = [];
  for (let i = 0; i < sourcesIn.length; i++) {
    const entry = sourcesIn[i] as PackLibrarySource;
    const built = checkSource(
      {
        id: entry.id,
        version: entry.version,
        source: entry.source,
        contentHash: entry.contentHash ?? sha256Hex(entry.source),
        ...(entry.language !== undefined ? { language: entry.language } : {}),
      },
      at('$.librarySources', i),
      errors
    );
    if (built) librarySources.push(built);
  }
  checkDuplicateSourceIds(librarySources, errors);
  const historyIn = input.history ?? [];
  if (historyIn.length > DESIGN_SYSTEM_BUNDLE_LIMITS.history)
    return fail([
      issue(
        'too-large',
        '$.history',
        `At most ${DESIGN_SYSTEM_BUNDLE_LIMITS.history} history entries.`
      ),
    ]);
  const history: DesignSystemBundleHistoryEntry[] = [];
  for (let i = 0; i < historyIn.length; i++) {
    const built = checkHistory(historyIn[i], at('$.history', i), errors);
    if (built) history.push(built);
  }
  checkCurrentVersionHistory(input.document, history, errors);
  if (typeof input.catalogDigest === 'string' && !SHA256.test(input.catalogDigest))
    collect(
      errors,
      64,
      issue('invalid-value', '$.catalogDigest', 'Must be a lowercase hex SHA-256.')
    );
  if (errors.length > 0) return fail(errors);
  const document = input.document as DesignSystemBundle['document'];
  const allowManifest = allowManifestFromDocument(input.document, {
    ...(typeof input.catalogDigest === 'string' ? { catalogDigest: input.catalogDigest } : {}),
    ...(input.extensions ? { extensions: input.extensions } : {}),
  });
  const bundle: DesignSystemBundle = {
    format: DESIGN_SYSTEM_BUNDLE_FORMAT,
    version: DESIGN_SYSTEM_BUNDLE_VERSION,
    document,
    allowManifest,
    librarySources,
    history,
  };
  return { ok: true, bundle };
}

/** Unpack a bundle after {@link validateBundle}: the parts, never executed. */
export function unpackBundle(value: unknown): UnpackBundleResult {
  const checked = validateBundle(value);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const record = value as DesignSystemBundle;
  return {
    ok: true,
    bundle: record,
    document: record.document,
    allowManifest: record.allowManifest,
    librarySources: record.librarySources,
    history: record.history,
  };
}

/** Canonical JSON of a bundle (sorted keys, no whitespace): the round-trip identity. */
export function bundleCanonicalJson(bundle: DesignSystemBundle): string {
  return canonicalJson(bundle);
}
