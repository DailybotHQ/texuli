import type {
  DesignSystem,
  DesignSystemIssue,
  DesignSystemVariant,
} from '../../generated/typescript/design-system.ts';
import { isRecord } from '../dialect.ts';
import {
  DESIGN_SYSTEM_FORMAT_VERSION,
  DS_DEFS,
  DS_PATTERNS,
  DS_RESERVED_KEYS,
  DS_ROOT,
  type DsNode,
  type DsObject,
  DESIGN_SYSTEM_LIMITS as LIMITS,
} from './vocabulary.ts';

/** The result of every design-system check: issues with JSON paths from `$`. */
export interface DesignSystemValidation {
  ok: boolean;
  errors: readonly DesignSystemIssue[];
}

export interface DesignSystemValidateOptions {
  /**
   * `untrusted` (the default: agent or user documents) refuses every `data:`
   * URL; `developer` (documents the host supplies) accepts base64 raster
   * images and fonts within their caps. SVG is a relative path only.
   */
  trust?: 'developer' | 'untrusted';
  /** Resolve `id@version` for the `extends` chain (cycles and depth); synchronous. */
  resolve?: (ref: string) => unknown;
  /** Stop after this many issues (default and ceiling 64). */
  maxErrors?: number;
}

type Code = DesignSystemIssue['code'];

interface Run {
  e: DesignSystemIssue[];
  max: number;
  trust: boolean;
  patch: boolean;
  bytes: number;
  seen: number;
}

const add = (r: Run, code: Code, path: string, message: string, hint?: string): undefined => {
  if (r.e.length < r.max) r.e.push(hint ? { code, path, message, hint } : { code, path, message });
};

const at = (path: string, key: string | number): string =>
  typeof key === 'number'
    ? `${path}[${key}]`
    : /^[A-Za-z_$][\w$]*$/.test(key)
      ? `${path}.${key}`
      : `${path}[${JSON.stringify(key)}]`;

/** Code points up to `max`, without spreading a huge string. */
const fits = (s: string, max: number): boolean =>
  s.length <= max || (s.length <= 2 * max && [...s].length <= max);

/** The code for an `extends` or `ref` value, or `undefined` when it is well formed. */
function refCode(v: string): Code | undefined {
  if (DS_PATTERNS.ref.test(v)) return;
  if (/[/\\]/.test(v) || (!v.startsWith('texuli:') && /^[a-z][a-z0-9+.-]*:/i.test(v)))
    return 'url-refused';
  const [id, range] = v.split('@');
  if (range !== undefined && DS_PATTERNS.id.test(id as string))
    if (/[\^~*xX<>|]/.test(range) || /^\d+(\.\d+)?$/.test(range)) return 'extends-range';
  return 'invalid-value';
}

function walk(r: Run, node: DsNode, v: unknown, path: string, depth: number): undefined {
  if (r.e.length >= r.max) return;
  if (++r.seen > LIMITS.values || depth > LIMITS.depth) {
    add(r, 'invalid-value', path, 'The document is too large or too deep.');
    r.max = r.e.length;
    return;
  }
  const n = typeof node === 'string' ? (DS_DEFS[node] as DsNode) : node;
  if (!Array.isArray(n)) {
    const shape = n as DsObject;
    if (!isRecord(v)) return add(r, 'invalid-type', path, 'Expected an object.');
    for (const key of Object.keys(shape))
      if (key.endsWith('!') && !r.patch && !Object.hasOwn(v, key.slice(0, -1)))
        add(r, 'required', at(path, key.slice(0, -1)), 'Required.');
    for (const key of Object.keys(v)) {
      const child = Object.hasOwn(shape, key)
        ? shape[key]
        : Object.hasOwn(shape, `${key}!`)
          ? shape[`${key}!`]
          : undefined;
      if (r.e.length >= r.max) return;
      if (child === undefined)
        add(
          r,
          'unknown-key',
          at(path, key),
          'Unknown key.',
          `Allowed: ${Object.keys(shape)
            .map((k) => k.replace('!', ''))
            .join(', ')}`
        );
      else if (!(r.patch && v[key] === null)) walk(r, child, v[key], at(path, key), depth + 1);
    }
    return;
  }
  const tag = n[0];
  if (tag === 'l' || tag === 'm') {
    const list = tag === 'l';
    if (list ? !Array.isArray(v) : !isRecord(v))
      return add(r, 'invalid-type', path, `Expected ${list ? 'an array' : 'an object'}.`);
    const entries = Object.keys(v as object);
    const [, item, a, b] = n;
    if (list ? entries.length < a || entries.length > (b as number) : entries.length > a)
      return add(
        r,
        'invalid-value',
        path,
        `Expected ${list ? `${a} to ${b} items` : `at most ${a} entries`}.`
      );
    if (list && n[4] && new Set(v as unknown[]).size < entries.length)
      return add(r, 'invalid-value', path, 'Duplicate items.');
    for (const key of entries) {
      const value = (v as Record<string, unknown>)[key];
      const here = list ? at(path, Number(key)) : at(path, key);
      if (!list && (DS_RESERVED_KEYS.has(key) || !(b as RegExp).test(key)))
        add(
          r,
          'invalid-value',
          here,
          'Invalid or reserved key.',
          `Keys match ${(b as RegExp).source}`
        );
      else if (!(r.patch && !list && value === null)) walk(r, item, value, here, depth + 1);
    }
    return;
  }
  if (tag === 'b') {
    if (typeof v !== 'boolean') add(r, 'invalid-type', path, 'Expected a boolean.');
    return;
  }
  if (tag === 'n' || tag === 'i') {
    if (typeof v !== 'number' || !Number.isFinite(v))
      return add(r, 'invalid-type', path, 'Expected a number.');
    if ((tag === 'i' && !Number.isInteger(v)) || v < n[1] || v > n[2])
      add(
        r,
        'invalid-value',
        path,
        `Expected ${tag === 'i' ? 'an integer' : 'a number'} from ${n[1]} to ${n[2]}.`
      );
    return;
  }
  if (tag === 'k') {
    if (v !== n[1]) add(r, 'invalid-value', path, `Expected ${JSON.stringify(n[1])}.`);
    return;
  }
  if (typeof v !== 'string') return add(r, 'invalid-type', path, 'Expected a string.');
  if (tag === 'e') {
    if (!n[1].split(' ').includes(v))
      add(
        r,
        'invalid-value',
        path,
        'Not an allowed value.',
        `One of: ${n[1].split(' ').join(', ')}`
      );
  } else if (tag === 's' || tag === 't') {
    const ok =
      tag === 's' ? fits(v, n[2]) && n[1].test(v) : fits(v, n[1]) && DS_PATTERNS.text.test(v);
    if (!ok)
      add(
        r,
        'invalid-value',
        path,
        tag === 's'
          ? `Must match ${n[1].source}.`
          : `At most ${n[1]} characters, no control or bidi characters.`
      );
  } else if (tag === 'x') {
    const code = refCode(v);
    if (code) add(r, code, path, 'Expected texuli:<theme> or an exact id@x.y.z.');
  } else {
    // An image ('i') or font ('f') source: a relative path, or base64 data within caps.
    if (/^data:/i.test(v)) {
      const m =
        /^data:(image\/(?:png|jpeg|gif|webp|avif)|font\/(?:woff2?|ttf|otf));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
          v
        );
      if (!r.trust || !m || m[1]?.[0] !== n[1] || (m[2] as string).length % 4)
        return add(
          r,
          'url-refused',
          path,
          r.trust ? 'Unsupported data URL.' : 'Data URLs need developer trust.'
        );
      const p = m[2] as string;
      const bytes = (p.length / 4) * 3 - (p.endsWith('==') ? 2 : p.endsWith('=') ? 1 : 0);
      r.bytes += bytes;
      if (bytes > n[2] || r.bytes > LIMITS.inlineTotal)
        add(
          r,
          'inline-bytes',
          path,
          `Inline data over ${bytes > n[2] ? n[2] : LIMITS.inlineTotal} bytes.`
        );
    } else if (v.length > 512 || !(n[1] === 'i' ? DS_PATTERNS.image : DS_PATTERNS.font).test(v))
      add(r, 'url-refused', path, 'Expected a same-origin relative path with a file extension.');
  }
}

const start = (options: DesignSystemValidateOptions, patch: boolean): Run => ({
  e: [],
  max: Math.max(1, Math.min(LIMITS.errors, options.maxErrors ?? LIMITS.errors)),
  trust: options.trust === 'developer',
  patch,
  bytes: 0,
  seen: 0,
});

const done = (r: Run): DesignSystemValidation => ({ ok: r.e.length === 0, errors: r.e });

/** The `format-version` issue for a declared `formatVersion`, if any. */
function versionIssue(doc: Record<string, unknown>): DesignSystemIssue | undefined {
  const v = doc.formatVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > DESIGN_SYSTEM_FORMAT_VERSION)
    return {
      code: 'format-version',
      path: '$.formatVersion',
      message: `Expected an integer from 1 to ${DESIGN_SYSTEM_FORMAT_VERSION}; migrate older documents.`,
    };
}

/**
 * Check a design-system document against the closed vocabulary. Never
 * throws on a JSON value; returns every issue (up to `maxErrors`) with a
 * stable code and a JSON path. A future `formatVersion` stops at
 * `format-version`.
 */
export function validateDesignSystem(
  doc: unknown,
  options: DesignSystemValidateOptions = {}
): DesignSystemValidation {
  const r = start(options, false);
  if (!isRecord(doc)) {
    add(r, 'invalid-type', '$', 'Expected an object.');
    return done(r);
  }
  const version = versionIssue(doc);
  if (version) return done({ ...r, e: [version] });
  walk(r, DS_ROOT, doc, '$', 0);
  let ref = doc.extends;
  const seen = new Set([`${doc.id}@${doc.version}`]);
  for (
    let hops = 1;
    typeof ref === 'string' && !ref.startsWith('texuli:') && DS_PATTERNS.ref.test(ref);
    hops++
  ) {
    if (seen.has(ref)) add(r, 'extends-cycle', '$.extends', `The extends chain returns to ${ref}.`);
    else if (hops > LIMITS.extendsDepth)
      add(
        r,
        'extends-depth',
        '$.extends',
        `The extends chain is deeper than ${LIMITS.extendsDepth}.`
      );
    else if (options.resolve) {
      seen.add(ref);
      const next = options.resolve(ref);
      ref = isRecord(next) ? next.extends : undefined;
      continue;
    }
    break;
  }
  return done(r);
}

/** A typed partial document: objects merge, arrays replace, `null` removes. */
export type DesignSystemPatch = PatchOf<DesignSystemVariant>;
type PatchOf<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: PatchOf<T[K]> | null }
    : T;

/** Check a patch: the sections only, every field optional, `null` to remove. */
export function validateDesignSystemPatch(
  patch: unknown,
  options: DesignSystemValidateOptions = {}
): DesignSystemValidation {
  const r = start(options, true);
  walk(r, 'variant', patch, '$', 0);
  return done(r);
}

/**
 * Merge a patch into a document, purely: objects merge, arrays and scalars
 * replace, `null` removes, and `__proto__`, `constructor` and `prototype`
 * are skipped. Validate the result again.
 */
export function applyDesignSystemPatch(base: DesignSystem, patch: DesignSystemPatch): DesignSystem {
  return merge(base, patch) as unknown as DesignSystem;
}

function merge(base: unknown, patch: object): Record<string, unknown> {
  const out: Record<string, unknown> = isRecord(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(patch)) {
    if (DS_RESERVED_KEYS.has(key)) continue;
    if (value === null) delete out[key];
    else out[key] = isRecord(value) ? merge(out[key], value) : value;
  }
  return out;
}

/** One `formatVersion` step. */
export interface DesignSystemMigration {
  from: number;
  to: number;
  migrate(doc: Readonly<Record<string, unknown>>): Record<string, unknown>;
}

/** Every step, in order (none yet: formatVersion 1 is the first). */
export const DESIGN_SYSTEM_MIGRATIONS: readonly DesignSystemMigration[] = Object.freeze([]);

export type DesignSystemMigrationResult =
  | { ok: true; document: DesignSystem; from: number; to: number; applied: string[] }
  | { ok: false; errors: [DesignSystemIssue] };

/**
 * Bring a document up to the current `formatVersion`. Pure and total: never
 * throws on a JSON value and never mutates it; an unknown or future version
 * is a `format-version` result. Validate the migrated document.
 */
export function migrateDesignSystem(doc: unknown): DesignSystemMigrationResult {
  if (!isRecord(doc))
    return {
      ok: false,
      errors: [{ code: 'invalid-type', path: '$', message: 'Expected an object.' }],
    };
  const issue = versionIssue(doc);
  if (issue) return { ok: false, errors: [issue] };
  const from = doc.formatVersion as number;
  let current: Record<string, unknown> = { ...doc };
  const applied: string[] = [];
  for (let v = from; v < DESIGN_SYSTEM_FORMAT_VERSION; ) {
    const step = DESIGN_SYSTEM_MIGRATIONS.find((m) => m.from === v);
    if (!step)
      return {
        ok: false,
        errors: [
          { code: 'format-version', path: '$.formatVersion', message: `No migration from ${v}.` },
        ],
      };
    current = step.migrate(current);
    applied.push(`${step.from}->${step.to}`);
    v = step.to;
  }
  return {
    ok: true,
    document: current as unknown as DesignSystem,
    from,
    to: DESIGN_SYSTEM_FORMAT_VERSION,
    applied,
  };
}

/**
 * Check a blueprint's design-system reference: exactly one of `ref`
 * (`id@x.y.z` or `texuli:<theme>`) and `inline` (a whole document, checked
 * by {@link validateDesignSystem} at `options.trust`).
 */
export function checkDesignSystemReference(
  value: unknown,
  options: DesignSystemValidateOptions = {}
): DesignSystemValidation {
  const r = start(options, false);
  if (!isRecord(value)) {
    add(r, 'invalid-type', '$', 'Expected an object.');
    return done(r);
  }
  const keys = Object.keys(value);
  for (const key of keys)
    if (key !== 'ref' && key !== 'inline')
      add(r, 'unknown-key', at('$', key), 'Unknown key.', 'Allowed: ref, inline');
  const ref = Object.hasOwn(value, 'ref');
  if (ref === Object.hasOwn(value, 'inline'))
    add(r, ref ? 'invalid-value' : 'required', '$', 'Set exactly one of ref or inline.');
  else if (ref) walk(r, ['x'], value.ref, '$.ref', 1);
  else
    for (const issue of validateDesignSystem(value.inline, options).errors)
      add(r, issue.code, `$.inline${issue.path.slice(1)}`, issue.message, issue.hint);
  return done(r);
}
