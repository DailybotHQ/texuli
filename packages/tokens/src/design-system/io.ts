/**
 * Shared pieces of the design-system importers and emitters (T-ds-io): the
 * result and warning types, a capped JSON reader that never throws, value
 * converters that refuse CSS injection and invisible characters (the spec's
 * closed forms, checked again with the `css-safe` rules), and `finalize`,
 * which validates an assembled document and drops each invalid optional value
 * with a warning instead of failing the whole import.
 */

import {
  type DesignSystem,
  type DesignSystemIssue,
  migrateDesignSystem,
  validateDesignSystem,
} from '@texuli/spec/design-system';
import { isSafeCssColor } from '../contract/css-safe.ts';
import { parseDsColor } from './color.ts';
import { DEFAULT_DESIGN_SYSTEM_SEED, splitFontStack } from './from-theme.ts';

/** Warning codes: the import went on without the value. */
export const DESIGN_SYSTEM_IMPORT_WARNINGS = [
  'unmapped',
  'unsafe-value',
  'invalid-value',
  'reserved-key',
  'alias',
  'limit',
  'default',
  'lossy',
] as const;

/** Error codes of the importers themselves; the spec's validation codes may follow. */
export const DESIGN_SYSTEM_IMPORT_ERRORS = ['invalid-input', 'input-limit'] as const;

export type DesignSystemImportWarningCode = (typeof DESIGN_SYSTEM_IMPORT_WARNINGS)[number];

export interface DesignSystemImportWarning {
  code: DesignSystemImportWarningCode;
  /** A JSON path into the input (`$.color.light.primary`), or into the document for `default`. */
  path: string;
  message: string;
}

export interface DesignSystemImportError {
  code: (typeof DESIGN_SYSTEM_IMPORT_ERRORS)[number] | DesignSystemIssue['code'];
  path: string;
  message: string;
  hint?: string;
}

export type DesignSystemImportResult =
  | { ok: true; document: DesignSystem; warnings: DesignSystemImportWarning[] }
  | { ok: false; errors: DesignSystemImportError[]; warnings: DesignSystemImportWarning[] };

export interface DesignSystemImportOptions {
  /** The trust level the result is validated at; `untrusted` by default (user and agent files). */
  trust?: 'developer' | 'untrusted';
  /** Override the identity the importer would choose. */
  id?: string;
  version?: string;
  name?: string;
  /** The cap on JSON text, in UTF-16 code units; 1 MiB by default. */
  maxBytes?: number;
}

/** Caps every importer shares. */
export const DESIGN_SYSTEM_IMPORT_LIMITS = Object.freeze({
  bytes: 1_048_576,
  nodes: 50_000,
  depth: 32,
  aliasDepth: 16,
  stringLength: 4_096,
  warnings: 200,
});

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/** Control, bidi and zero-width characters: never accepted in any imported string. */
export const INVISIBLE =
  // biome-ignore lint/suspicious/noControlCharactersInRegex: the importers refuse these characters
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/;

/** The spec's closed color forms (`@texuli/spec/design-system`, `colorValue`). */
const NUM = '(?:\\d{1,3}(?:\\.\\d{1,6})?|\\.\\d{1,6})';
export const DOC_COLOR = new RegExp(
  `^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|oklch\\(${NUM}%? ${NUM} ${NUM}(?: \\/ ${NUM}%?)?\\))$`
);
const DOC_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SEMVER =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
/** A font family name the document accepts (the spec's `stack` item). */
export const STACK_NAME = /^-?[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/;

export const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `$.a.b`, quoting keys that are not identifiers (the spec's path form). */
export function at(path: string, key: string | number): string {
  if (typeof key === 'number') return `${path}[${key}]`;
  return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`;
}

/** Collects warnings up to a cap, so a hostile file cannot grow the result without bound. */
export class Warnings {
  readonly list: DesignSystemImportWarning[] = [];
  add(code: DesignSystemImportWarningCode, path: string, message: string): void {
    if (this.list.length < DESIGN_SYSTEM_IMPORT_LIMITS.warnings)
      this.list.push({ code, path, message });
  }
}

export class InputLimit extends Error {}

/**
 * A plain JSON copy of `input` (JSON text is parsed first): reserved keys are
 * skipped with a warning, non-JSON values dropped, strings capped, depth
 * deeper than the cap cut with a `limit` warning, and more nodes than the cap
 * raise {@link InputLimit}. Getters may throw; callers wrap in `guard`.
 */
export function readJson(input: unknown, warnings: Warnings, maxBytes: number): Json {
  let value = input;
  if (typeof input === 'string') {
    if (input.length > maxBytes) throw new InputLimit(`The text is over ${maxBytes} characters.`);
    value = JSON.parse(input);
  }
  let nodes = 0;
  const copy = (node: unknown, path: string, depth: number): Json | undefined => {
    if (++nodes > DESIGN_SYSTEM_IMPORT_LIMITS.nodes)
      throw new InputLimit(`More than ${DESIGN_SYSTEM_IMPORT_LIMITS.nodes} values.`);
    if (node === null || typeof node === 'boolean') return node;
    if (typeof node === 'number') return Number.isFinite(node) ? node : undefined;
    if (typeof node === 'string') {
      if (node.length > DESIGN_SYSTEM_IMPORT_LIMITS.stringLength) {
        warnings.add('limit', path, 'The string is too long.');
        return undefined;
      }
      if (INVISIBLE.test(node.replace(/[\t\n\r]/g, ''))) {
        warnings.add('unsafe-value', path, 'Refused: control, bidi or zero-width characters.');
        return undefined;
      }
      return node;
    }
    if (typeof node !== 'object') return undefined;
    if (depth >= DESIGN_SYSTEM_IMPORT_LIMITS.depth) {
      warnings.add('limit', path, `Nested deeper than ${DESIGN_SYSTEM_IMPORT_LIMITS.depth}.`);
      return undefined;
    }
    if (Array.isArray(node)) {
      const out: Json[] = [];
      for (let i = 0; i < node.length; i++) {
        const child = copy(node[i], at(path, i), depth + 1);
        out.push(child === undefined ? null : child);
      }
      return out;
    }
    const proto = Object.getPrototypeOf(node);
    if (proto !== Object.prototype && proto !== null) return undefined;
    const out: JsonObject = {};
    for (const key of Object.keys(node)) {
      if (RESERVED_KEYS.has(key)) {
        warnings.add('reserved-key', at(path, key), 'Reserved keys are never read.');
        continue;
      }
      const child = copy((node as Record<string, unknown>)[key], at(path, key), depth + 1);
      if (child !== undefined) out[key] = child;
    }
    return out;
  };
  return copy(value, '$', 0) ?? null;
}

/** Runs an importer body: a thrown error or a cap becomes a result, never an exception. */
export function guard(
  warnings: Warnings,
  body: () => DesignSystemImportResult
): DesignSystemImportResult {
  try {
    return body();
  } catch (error) {
    const limit = error instanceof InputLimit;
    return {
      ok: false,
      errors: [
        {
          code: limit ? 'input-limit' : 'invalid-input',
          path: '$',
          message: limit
            ? (error as Error).message
            : error instanceof SyntaxError
              ? 'The text is not JSON.'
              : 'The input could not be read.',
        },
      ],
      warnings: warnings.list,
    };
  }
}

export const failInput = (
  warnings: Warnings,
  message: string,
  code: 'invalid-input' | 'input-limit' = 'invalid-input'
): DesignSystemImportResult => ({
  ok: false,
  errors: [{ code, path: '$', message }],
  warnings: warnings.list,
});

type Converted<T> = { ok: true; value: T } | { ok: false; unsafe: boolean; message: string };
const bad = (message: string, unsafe = false): Converted<never> => ({ ok: false, unsafe, message });
const good = <T>(value: T): Converted<T> => ({ ok: true, value });

const unsafeText = (v: string) => INVISIBLE.test(v) || /[;{}<>\\!]|\/\*|\*\//.test(v);
const round = (n: number, digits = 4) => Number(n.toFixed(digits));
const byte = (n: number) =>
  Math.round(Math.min(255, Math.max(0, n)))
    .toString(16)
    .padStart(2, '0');

/**
 * A color in the document's closed form: hex and canonical `oklch()` are kept
 * as written; `#rgba` becomes `#rrggbbaa`; `rgb()`/`rgba()` and spaced
 * `oklch()` are normalized; DTCG 2025 color objects (`hex`, or `srgb` and
 * `oklch` components) are read. Anything else is refused.
 */
export function toColor(value: Json | undefined): Converted<string> {
  if (isObject(value)) {
    const alpha = typeof value.alpha === 'number' ? Math.min(1, Math.max(0, value.alpha)) : 1;
    const suffix = alpha < 1 ? byte(alpha * 255) : '';
    if (typeof value.hex === 'string' && /^#[0-9a-f]{6}$/i.test(value.hex))
      return good(`${value.hex}${suffix}`);
    const c = value.components;
    if (Array.isArray(c) && c.length === 3 && c.every((n) => typeof n === 'number')) {
      const [a, b, d] = c as [number, number, number];
      if (value.colorSpace === 'srgb')
        return good(`#${byte(a * 255)}${byte(b * 255)}${byte(d * 255)}${suffix}`);
      if (value.colorSpace === 'oklch' && a >= 0 && a <= 1 && b >= 0 && b < 1 && d >= 0 && d < 360)
        return good(
          `oklch(${round(a)} ${round(b)} ${round(d)}${alpha < 1 ? ` / ${round(alpha)}` : ''})`
        );
    }
    return bad('Not a color this importer reads.');
  }
  if (typeof value !== 'string') return bad('Expected a color string.');
  const v = value.trim();
  if (unsafeText(v) || !isSafeCssColor(v) || /url\(/i.test(v))
    return bad('Refused: not a safe CSS color.', true);
  if (DOC_COLOR.test(v)) return good(v);
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
  if (short)
    return good(
      `#${short
        .slice(1)
        .map((c) => c + c)
        .join('')}`
    );
  const oklch =
    /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)(%?)\s*)?\)$/i.exec(v);
  if (oklch) {
    const n = (s: string | undefined) => String(round(Number(s)));
    const text = `oklch(${n(oklch[1])}${oklch[2]} ${n(oklch[3])} ${n(oklch[4])}${oklch[5] ? ` / ${n(oklch[5])}${oklch[6]}` : ''})`;
    return DOC_COLOR.test(text) ? good(text) : bad('The oklch() numbers are out of range.');
  }
  if (/^rgba?\(/i.test(v)) {
    const parsed = parseDsColor(v);
    if (parsed)
      return good(parsed.alpha >= 1 ? parsed.hex : `${parsed.hex}${byte(parsed.alpha * 255)}`);
  }
  return bad('Only hex, rgb() and oklch() colors are read.');
}

/** A length in CSS px: a number, `8px`, `0.5rem`, or a DTCG `{ value, unit }`. */
export function toPx(value: Json | undefined): Converted<number> {
  if (typeof value === 'number') return good(value);
  if (isObject(value) && typeof value.value === 'number') {
    if (value.unit === 'px') return good(value.value);
    if (value.unit === 'rem') return good(round(value.value * 16));
    return bad('Only px and rem dimensions are read.');
  }
  if (typeof value !== 'string') return bad('Expected a dimension.');
  const v = value.trim();
  if (unsafeText(v)) return bad('Refused: not a safe CSS length.', true);
  const m = /^(-?\d{1,5}(?:\.\d{1,6})?)(px|rem)?$/.exec(v);
  if (!m) return bad('Expected a number with px or rem.');
  return good(m[2] === 'rem' ? round(Number(m[1]) * 16) : Number(m[1]));
}

/** A duration in ms: a number, `120ms`, `0.12s`, or a DTCG `{ value, unit }`. */
export function toMs(value: Json | undefined): Converted<number> {
  if (typeof value === 'number') return good(value);
  if (isObject(value) && typeof value.value === 'number') {
    if (value.unit === 'ms') return good(value.value);
    if (value.unit === 's') return good(round(value.value * 1000));
    return bad('Only ms and s durations are read.');
  }
  if (typeof value !== 'string') return bad('Expected a duration.');
  const m = /^(\d{1,5}(?:\.\d{1,6})?)(ms|s)$/.exec(value.trim());
  if (!m) return bad('Expected a number with ms or s.', unsafeText(value));
  return good(m[2] === 's' ? round(Number(m[1]) * 1000) : Number(m[1]));
}

/** A plain number, also from numeric text. */
export function toNumber(value: Json | undefined): Converted<number> {
  if (typeof value === 'number') return good(value);
  if (typeof value === 'string' && /^-?\d{1,6}(?:\.\d{1,6})?$/.test(value.trim()))
    return good(Number(value.trim()));
  return bad('Expected a number.', typeof value === 'string' && unsafeText(value));
}

const WEIGHTS: Readonly<Record<string, number>> = {
  thin: 100,
  hairline: 100,
  extralight: 200,
  ultralight: 200,
  light: 300,
  normal: 400,
  regular: 400,
  book: 400,
  medium: 500,
  semibold: 600,
  demibold: 600,
  bold: 700,
  extrabold: 800,
  ultrabold: 800,
  black: 900,
  heavy: 900,
};

/** A font weight: a number, numeric text or a weight name (`Bold`, `semi-bold`). */
export function toWeight(value: Json | undefined): Converted<number> {
  const n = toNumber(value);
  if (n.ok) return n;
  if (typeof value !== 'string') return n;
  const named = WEIGHTS[value.toLowerCase().replace(/[\s_-]/g, '')];
  return named ? good(named) : bad('Not a font weight.', unsafeText(value));
}

/**
 * Font family names from a list or a CSS font-family string. Names the
 * document cannot hold (injection characters, invisible characters, over 33
 * characters) are refused; a list with none left is refused.
 */
export function toStack(value: Json | undefined): Converted<string[]> & { dropped?: number } {
  const names =
    typeof value === 'string'
      ? splitFontStack(value)
      : Array.isArray(value) && value.every((v) => typeof v === 'string')
        ? (value as string[]).map((v) => v.trim())
        : undefined;
  if (!names) return bad('Expected a font family list.');
  const kept = names.filter((name) => STACK_NAME.test(name) && !INVISIBLE.test(name)).slice(0, 8);
  if (kept.length === 0) return bad('Refused: no safe font family name.', true);
  return { ok: true, value: kept, dropped: names.length - kept.length };
}

/** Text that looks like markup or CSS: never accepted as an imported name or description. */
const MARKUP = /[<>{}\\`]|\b(?:url|expression|image-set)\s*\(|javascript:|\/\*/i;

/**
 * The value as safe document text, or `undefined`: no control, bidi or
 * zero-width characters, nothing that looks like markup or CSS, and (for
 * names, `strict`) no `;`.
 */
export function toText(value: Json | undefined, max: number, strict = false): string | undefined {
  if (typeof value !== 'string') return;
  const v = value.trim();
  if (v === '' || v.length > max || INVISIBLE.test(v) || MARKUP.test(v)) return;
  if (strict && v.includes(';')) return;
  return v;
}

/** A design-system id from any text (`Harbor Labs` → `harbor-labs`). */
export function slugId(text: string | undefined): string | undefined {
  if (!text) return;
  const slug = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/, '');
  return DOC_ID.test(slug) ? slug : undefined;
}

export interface Identity {
  id?: Json | undefined;
  version?: Json | undefined;
  name?: Json | undefined;
  description?: Json | undefined;
}

/**
 * The identity fields of an imported document: options first, then the
 * input's own values when they are safe, then defaults (each default is a
 * `default` warning only when the input offered an unsafe value).
 */
export function identity(
  input: Identity,
  options: DesignSystemImportOptions,
  warnings: Warnings,
  fallbackName: string,
  path = '$'
): { id: string; version: string; name: string; description?: string } {
  const refuse = (key: string, value: Json | undefined) => {
    if (value !== undefined)
      warnings.add('unsafe-value', at(path, key), `Refused ${key}: not safe document text.`);
  };
  const nameText = toText(options.name ?? input.name, 80, true);
  if (!nameText) refuse('name', input.name);
  const name = nameText ?? fallbackName;
  const rawId = options.id ?? input.id;
  const idOk = typeof rawId === 'string' && DOC_ID.test(rawId) && rawId.length <= 64;
  if (!idOk) refuse('id', rawId);
  const id = idOk ? (rawId as string) : (slugId(name) ?? 'imported');
  const rawVersion = options.version ?? input.version;
  const versionOk =
    typeof rawVersion === 'string' && SEMVER.test(rawVersion) && rawVersion.length <= 64;
  if (!versionOk) refuse('version', rawVersion);
  const version = versionOk ? (rawVersion as string) : '1.0.0';
  const description = toText(input.description, 500);
  if (input.description !== undefined && !description) refuse('description', input.description);
  return { id, version, name, ...(description ? { description } : {}) };
}

/** Parse a spec path (`$.a.b[0]["icon-button"]`) into keys. */
export function parsePath(path: string): (string | number)[] | undefined {
  if (!path.startsWith('$')) return;
  const keys: (string | number)[] = [];
  const re = /\.([A-Za-z_$][\w$]*)|\[(\d+)\]|\[("(?:[^"\\]|\\.)*")\]/y;
  re.lastIndex = 1;
  while (re.lastIndex < path.length) {
    const m = re.exec(path);
    if (!m) return;
    keys.push(m[1] ?? (m[2] !== undefined ? Number(m[2]) : (JSON.parse(m[3] as string) as string)));
  }
  return keys;
}

/** Delete the value at `keys` (a list element removes its whole list); empty parents go too. */
function remove(doc: JsonObject, keys: readonly (string | number)[]): boolean {
  const cut = typeof keys[keys.length - 1] === 'number' ? keys.slice(0, -1) : keys;
  if (cut.length === 0) return false;
  const parents: JsonObject[] = [doc];
  let node: Json = doc;
  for (const key of cut.slice(0, -1)) {
    if (!isObject(node) || typeof key !== 'string' || !(key in node)) return false;
    node = node[key] as Json;
    parents.push(node as JsonObject);
  }
  const last = cut[cut.length - 1];
  if (!isObject(node) || typeof last !== 'string' || !Object.hasOwn(node, last)) return false;
  delete node[last];
  for (let i = parents.length - 1; i > 0; i--) {
    const parent = parents[i] as JsonObject;
    if (Object.keys(parent).length > 0) break;
    const owner = parents[i - 1] as JsonObject;
    const key = cut[i - 1] as string;
    delete owner[key];
  }
  return true;
}

const IDENTITY = new Set(['format', 'formatVersion', 'id', 'version', 'name']);

/**
 * Migrate and validate an assembled document. Each invalid optional value is
 * removed with an `invalid-value` warning (the spec's code and message in the
 * text) and the document is validated again, up to 8 rounds; identity
 * failures and anything left is an error result. A missing `color.brand.seed`
 * gets the default seed with a `default` warning.
 */
export function finalize(
  doc: JsonObject,
  warnings: Warnings,
  options: DesignSystemImportOptions
): DesignSystemImportResult {
  const trust = options.trust ?? 'untrusted';
  if (!isObject(doc.color)) doc.color = {};
  const color = doc.color as JsonObject;
  if (!isObject(color.brand)) color.brand = {};
  const brand = color.brand as JsonObject;
  if (brand.seed === undefined) {
    const primary =
      isObject(color.roles) && isObject(color.roles.light) ? color.roles.light.primary : undefined;
    brand.seed =
      typeof primary === 'string' && DOC_COLOR.test(primary) ? primary : DEFAULT_DESIGN_SYSTEM_SEED;
    if (brand.seed === DEFAULT_DESIGN_SYSTEM_SEED)
      warnings.add(
        'default',
        '$.color.brand.seed',
        `No brand color found: using ${DEFAULT_DESIGN_SYSTEM_SEED}.`
      );
  }
  const migrated = migrateDesignSystem(doc);
  if (!migrated.ok) return { ok: false, errors: [...migrated.errors], warnings: warnings.list };
  const current = migrated.document as unknown as JsonObject;
  for (let round = 0; round < 8; round++) {
    const result = validateDesignSystem(current, { trust });
    if (result.ok)
      return { ok: true, document: current as unknown as DesignSystem, warnings: warnings.list };
    let removed = false;
    for (const issue of result.errors) {
      const keys = parsePath(issue.path);
      if (!keys || keys.length === 0 || (keys.length === 1 && IDENTITY.has(String(keys[0]))))
        continue;
      if (keys.join('.') === 'color.brand.seed') continue;
      if (remove(current, keys)) {
        removed = true;
        warnings.add('invalid-value', issue.path, `Dropped (${issue.code}): ${issue.message}`);
      }
    }
    if (!removed) return { ok: false, errors: [...result.errors], warnings: warnings.list };
  }
  const last = validateDesignSystem(current, { trust });
  return last.ok
    ? { ok: true, document: current as unknown as DesignSystem, warnings: warnings.list }
    : { ok: false, errors: [...last.errors], warnings: warnings.list };
}

/** Set `value` at a dotted path inside `target`, creating objects (never reserved keys). */
export function setPath(target: JsonObject, keys: readonly string[], value: Json): void {
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (RESERVED_KEYS.has(key)) return;
    if (!isObject(node[key])) node[key] = {};
    node = node[key] as JsonObject;
  }
  const last = keys[keys.length - 1];
  if (last !== undefined && !RESERVED_KEYS.has(last)) node[last] = value;
}

/** Deep merge `source` into `target` (objects merge, everything else replaces). */
export function mergeInto(target: JsonObject, source: JsonObject): JsonObject {
  for (const key of Object.keys(source)) {
    if (RESERVED_KEYS.has(key)) continue;
    const value = source[key] as Json;
    const current = target[key];
    if (isObject(value) && isObject(current)) mergeInto(current, value);
    else target[key] = isObject(value) ? mergeInto({}, value) : value;
  }
  return target;
}

/** The order identity and sections appear in an imported document. */
const ORDER = [
  'format',
  'formatVersion',
  'id',
  'version',
  'name',
  'description',
  'owner',
  'license',
  'tags',
  'extends',
  'color',
  'typography',
  'shape',
  'space',
  'elevation',
  'surface',
  'motion',
  'layout',
  'icons',
  'components',
  'assets',
  'voice',
  'accessibility',
  'variants',
];

/** A document with its root keys in the vocabulary's order (unknown keys last, for the validator). */
export function ordered(doc: JsonObject): JsonObject {
  const out: JsonObject = {};
  for (const key of ORDER) if (doc[key] !== undefined) out[key] = doc[key] as Json;
  for (const key of Object.keys(doc)) if (!(key in out)) out[key] = doc[key] as Json;
  return out;
}

/** The document root every importer starts from. */
export function documentRoot(id: ReturnType<typeof identity>): JsonObject {
  return {
    format: 'texuli/design-system',
    formatVersion: 1,
    id: id.id,
    version: id.version,
    name: id.name,
    ...(id.description ? { description: id.description } : {}),
  };
}

/** Pretty JSON with object keys sorted at every depth (arrays keep their order). */
export function stableJson(value: unknown): string {
  const sort = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(sort);
    if (node === null || typeof node !== 'object') return node;
    const record = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort())
      if (record[key] !== undefined && !RESERVED_KEYS.has(key)) out[key] = sort(record[key]);
    return out;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}
