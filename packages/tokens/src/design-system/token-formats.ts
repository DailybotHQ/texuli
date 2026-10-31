/**
 * W3C DTCG and Tokens Studio, both directions (T-ds-io).
 *
 * **Layout.** A token's path is its document path (`color.roles.light.primary`,
 * `typography.roles.body.size`), with data-viz lists as 1-based groups
 * (`color.dataViz.light.categorical.1`). Only design values are tokens:
 * colors, px dimensions, numbers, font weights, durations and font stacks.
 * Everything else the document holds (identity, enums such as
 * `elevation.style`, component settings, assets, voice, variants) travels in
 * the root `$extensions["com.texuli.design-system"]` as a partial document,
 * so document → file → document is lossless.
 *
 * **Foreign files.** Tokens outside that layout are mapped by name: a
 * semantic role (`primary-foreground`, `card` → `surface`) under a `light` or
 * `dark` group or set becomes a role pin, `brand` the seed, font families by
 * their role (`body` → `sans`), a radius token `shape.radius`. The rest is
 * an `unmapped` warning. Aliases (`{a.b}`) resolve with a depth cap and cycle
 * refusal.
 */

import type { DesignSystem } from '@texuli/spec/design-system';
import { SEMANTIC_ROLES } from '../contract/semantic.ts';
import { formatFontStack } from './from-theme.ts';
import {
  at,
  DESIGN_SYSTEM_IMPORT_LIMITS,
  type DesignSystemImportOptions,
  type DesignSystemImportResult,
  documentRoot,
  failInput,
  finalize,
  guard,
  identity,
  isObject,
  type Json,
  type JsonObject,
  mergeInto,
  ordered,
  readJson,
  setPath,
  toColor,
  toMs,
  toNumber,
  toPx,
  toStack,
  toWeight,
  Warnings,
} from './io.ts';

/** The `$extensions` key that carries the non-token part of the document. */
export const DESIGN_SYSTEM_EXTENSION = 'com.texuli.design-system';

type TokenType = 'color' | 'dimension' | 'number' | 'fontWeight' | 'duration' | 'fontFamily';

const DATA_VIZ_LIST = /^color\.dataViz\.(?:light|dark)\.(?:categorical|sequential|diverging)$/;

/** Document paths that are tokens (lists use their 0-based index here). */
const RULES: readonly [RegExp, TokenType][] = [
  [/^color\.brand\.(?:seed|secondary|accent)$/, 'color'],
  [/^color\.pin\.[a-z]+$/, 'color'],
  [/^color\.roles\.(?:light|dark)\.[A-Za-z]+$/, 'color'],
  [/^color\.status\.[a-z]+$/, 'color'],
  [/^color\.dataViz\.(?:light|dark)\.(?:categorical|sequential|diverging)\.\d$/, 'color'],
  [/^color\.dataViz\.(?:light|dark)\.(?:grid|axis)$/, 'color'],
  [/^typography\.families\.[a-z]+\.stack$/, 'fontFamily'],
  [/^typography\.scale\.base$/, 'dimension'],
  [/^typography\.scale\.ratio$/, 'number'],
  [/^typography\.roles\.[a-z]+\.size$/, 'dimension'],
  [/^typography\.roles\.[a-z]+\.weight$/, 'fontWeight'],
  [/^typography\.roles\.[a-z]+\.(?:line|tracking)$/, 'number'],
  [/^shape\.(?:radius|borderWidth)$/, 'dimension'],
  [/^shape\.radiusScale$/, 'number'],
  [/^space\.base$/, 'dimension'],
  [/^space\.density$/, 'number'],
  [/^surface\.glass\.alpha$/, 'number'],
  [/^surface\.glass\.blur$/, 'dimension'],
  [/^motion\.durations\.[a-z]+$/, 'duration'],
  [/^layout\.(?:contentMax|wideMax)$/, 'dimension'],
  [/^layout\.breakpoints\.[a-z]+$/, 'dimension'],
  [/^layout\.grid\.columns\.[a-z]+$/, 'number'],
  [/^icons\.stroke$/, 'number'],
  [/^icons\.size\.[a-z]+$/, 'dimension'],
  [/^accessibility\.(?:targetMin|focusWidth|focusOffset)$/, 'dimension'],
];

const ruleFor = (docPath: string): TokenType | undefined =>
  RULES.find(([re]) => re.test(docPath))?.[1];

interface Token {
  /** The file path: the document path with 1-based list indexes. */
  path: string[];
  type: TokenType;
  value: Json;
}

/** Split a document into its tokens and the partial document that is not tokens. */
export function splitDocument(doc: DesignSystem): { tokens: Token[]; rest: JsonObject } {
  const tokens: Token[] = [];
  const rest: JsonObject = {};
  const walk = (node: Json, keys: string[]) => {
    const path = keys.join('.');
    if (Array.isArray(node)) {
      if (DATA_VIZ_LIST.test(path)) {
        node.forEach((item, i) => {
          tokens.push({ path: [...keys, String(i + 1)], type: 'color', value: item });
        });
        return;
      }
      const type = ruleFor(path);
      if (type) tokens.push({ path: keys, type, value: node });
      else setPath(rest, keys, node);
      return;
    }
    if (isObject(node) && keys[0] !== 'variants' && Object.keys(node).length > 0) {
      for (const key of Object.keys(node)) walk(node[key] as Json, [...keys, key]);
      return;
    }
    const type = isObject(node) ? undefined : ruleFor(path);
    if (type) tokens.push({ path: keys, type, value: node });
    else setPath(rest, keys, node);
  };
  for (const key of Object.keys(doc)) walk((doc as unknown as JsonObject)[key] as Json, [key]);
  return { tokens, rest };
}

/** Objects with keys sorted at every depth (lists keep their order), for byte-stable output. */
export function sortDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(sortDeep) as T;
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => [key, sortDeep(record[key])])
  ) as T;
}

const dtcgValue = (token: Token): Json => {
  if (token.type === 'dimension') return { value: token.value, unit: 'px' };
  if (token.type === 'duration') return { value: token.value, unit: 'ms' };
  return token.value;
};

/** A W3C DTCG token file (2025.10 dimension and duration objects; colors as written). */
export function emitDtcg(doc: DesignSystem): JsonObject {
  const { tokens, rest } = splitDocument(doc);
  const out: JsonObject = {};
  for (const token of tokens)
    setPath(out, token.path, { $type: token.type, $value: dtcgValue(token) });
  out.$extensions = { [DESIGN_SYSTEM_EXTENSION]: rest };
  return sortDeep(out);
}

/** {@link emitDtcg} as JSON text. */
export function emitDtcgJson(doc: DesignSystem): string {
  return `${JSON.stringify(emitDtcg(doc), null, 2)}\n`;
}

const STUDIO_TYPES: Readonly<Record<TokenType, string>> = {
  color: 'color',
  dimension: 'dimension',
  number: 'number',
  fontWeight: 'fontWeights',
  duration: 'other',
  fontFamily: 'fontFamilies',
};

const studioValue = (token: Token): Json => {
  if (token.type === 'dimension') return `${token.value}px`;
  if (token.type === 'duration') return `${token.value}ms`;
  if (token.type === 'fontFamily') return formatFontStack(token.value as string[]);
  return token.value;
};

/** A Tokens Studio file: sets `global`, `light` and `dark` in that order (legacy `value`/`type`). */
export function emitTokensStudio(doc: DesignSystem): JsonObject {
  const { tokens, rest } = splitDocument(doc);
  const sets: Record<'global' | 'light' | 'dark', JsonObject> = { global: {}, light: {}, dark: {} };
  for (const token of tokens) {
    const mode = token.path[0] === 'color' ? token.path[2] : undefined;
    const set = mode === 'light' || mode === 'dark' ? sets[mode] : sets.global;
    setPath(set, token.path, { type: STUDIO_TYPES[token.type], value: studioValue(token) });
  }
  return {
    ...sortDeep(sets),
    $themes: [],
    $metadata: { tokenSetOrder: ['global', 'light', 'dark'] },
    $extensions: { [DESIGN_SYSTEM_EXTENSION]: sortDeep(rest) },
  };
}

interface RawToken {
  /** The path inside its set (the alias namespace). */
  path: string[];
  /** The JSON path in the input, for warnings. */
  where: string;
  value: Json;
  type?: string;
  mode?: 'light' | 'dark';
}

const isToken = (node: JsonObject, studio: boolean) =>
  '$value' in node || (studio && 'value' in node && typeof node.type === 'string');

function collect(
  tree: JsonObject,
  where: string,
  studio: boolean,
  mode: 'light' | 'dark' | undefined,
  out: RawToken[]
): void {
  const walk = (node: JsonObject, path: string[], at$: string, type: string | undefined) => {
    const inherited = typeof node.$type === 'string' ? node.$type : type;
    for (const key of Object.keys(node)) {
      if (key.startsWith('$')) continue;
      const child = node[key];
      const childWhere = at(at$, key);
      if (!isObject(child)) continue;
      if (isToken(child, studio)) {
        const own = child.$type ?? child.type;
        out.push({
          path: [...path, key],
          where: childWhere,
          value: ('$value' in child ? child.$value : child.value) as Json,
          ...(typeof own === 'string' ? { type: own } : inherited ? { type: inherited } : {}),
          ...(mode ? { mode } : {}),
        });
      } else walk(child, [...path, key], childWhere, inherited);
    }
  };
  walk(tree, [], where, undefined);
}

const ALIAS = /^\{([^{}]+)\}$/;

/** Resolve `{a.b}` aliases through the token namespace; cycles and long chains are refused. */
function resolveAliases(tokens: RawToken[], warnings: Warnings): Map<RawToken, Json> {
  const byPath = new Map<string, RawToken>();
  for (const token of tokens) byPath.set(token.path.join('.'), token);
  const values = new Map<RawToken, Json>();
  for (const token of tokens) {
    let value = token.value;
    const seen = new Set<string>([token.path.join('.')]);
    let ok = true;
    for (let depth = 0; typeof value === 'string' && ALIAS.test(value); depth++) {
      const ref = (ALIAS.exec(value) as RegExpExecArray)[1] as string;
      const target = byPath.get(ref);
      if (!target || seen.has(ref) || depth >= DESIGN_SYSTEM_IMPORT_LIMITS.aliasDepth) {
        warnings.add(
          'alias',
          token.where,
          !target
            ? `The alias {${ref}} names no token.`
            : seen.has(ref)
              ? `The alias {${ref}} is a cycle.`
              : `Alias chains stop at ${DESIGN_SYSTEM_IMPORT_LIMITS.aliasDepth}.`
        );
        ok = false;
        break;
      }
      seen.add(ref);
      value = target.value;
    }
    if (ok && typeof value === 'string' && /\{[\w .-]+\}/.test(value)) {
      warnings.add('alias', token.where, 'Embedded references and math are not read.');
      ok = false;
    }
    if (ok) values.set(token, value);
  }
  return values;
}

const ROLES = new Set<string>(SEMANTIC_ROLES);
const ROLE_ALIASES: Readonly<Record<string, string>> = {
  card: 'surface',
  cardForeground: 'surfaceForeground',
  popover: 'elevated',
  popoverForeground: 'elevatedForeground',
  danger: 'destructive',
  dangerForeground: 'destructiveForeground',
  error: 'destructive',
  errorForeground: 'destructiveForeground',
  page: 'background',
};
const GENERIC = new Set([
  'color',
  'colors',
  'semantic',
  'role',
  'roles',
  'theme',
  'palette',
  'sys',
  'light',
  'dark',
]);
const FAMILIES: Readonly<Record<string, string>> = {
  sans: 'sans',
  body: 'sans',
  base: 'sans',
  default: 'sans',
  text: 'sans',
  primary: 'sans',
  heading: 'heading',
  headings: 'heading',
  display: 'heading',
  title: 'heading',
  mono: 'mono',
  code: 'mono',
  monospace: 'mono',
  serif: 'serif',
};

const camel = (s: string) => s.replace(/[-_ ]+([a-z0-9])/gi, (_, c: string) => c.toUpperCase());

/** A foreign token's document path and type, by name. */
function guess(token: RawToken, value: Json): { path: string; type: TokenType } | undefined {
  const raw = token.path.map((p) => p.trim());
  const lower = raw.map((p) => p.toLowerCase());
  const mode =
    token.mode ?? (lower.includes('dark') ? 'dark' : lower.includes('light') ? 'light' : undefined);
  const segs = raw.filter((p) => !GENERIC.has(p.toLowerCase()));
  const last = segs[segs.length - 1] ?? '';
  const type = token.type?.toLowerCase();
  const isColor = type === 'color' || (type === undefined && toColor(value).ok);
  if (isColor) {
    const names = segs.map((s) => s.toLowerCase());
    if (names.includes('brand') || names.includes('seed')) {
      const role = names[names.length - 1];
      if (role === 'secondary' || role === 'accent')
        return { path: `color.brand.${role}`, type: 'color' };
      if (names.length <= 2) return { path: 'color.brand.seed', type: 'color' };
    }
    const tail = ['default', 'base', 'main'].includes(last.toLowerCase())
      ? segs.slice(0, -1)
      : segs;
    const candidates = [camel(tail.slice(-2).join('-')), camel(tail[tail.length - 1] ?? '')];
    for (const name of candidates) {
      const role = ROLE_ALIASES[name] ?? name;
      if (ROLES.has(role)) return { path: `color.roles.${mode ?? 'light'}.${role}`, type: 'color' };
    }
    return;
  }
  if (type === 'fontfamily' || type === 'fontfamilies') {
    const family = FAMILIES[last.toLowerCase()];
    return family ? { path: `typography.families.${family}.stack`, type: 'fontFamily' } : undefined;
  }
  const radius = lower.some((p) => p.includes('radius')) || type === 'borderradius';
  if (radius && ['radius', 'md', 'base', 'default', 'borderradius'].includes(last.toLowerCase()))
    return { path: 'shape.radius', type: 'dimension' };
  return;
}

const CONVERT: Readonly<Record<TokenType, (value: Json | undefined) => ReturnType<typeof toPx>>> = {
  color: toColor as never,
  dimension: toPx,
  number: toNumber,
  fontWeight: toWeight,
  duration: toMs,
  fontFamily: toStack as never,
};

/** Map resolved tokens into a partial document (lists rebuilt from their indexes). */
function assemble(tokens: RawToken[], values: Map<RawToken, Json>, warnings: Warnings): JsonObject {
  const doc: JsonObject = {};
  const lists = new Map<string, { where: string; items: Json[] }>();
  for (const token of tokens) {
    if (!values.has(token)) continue;
    const value = values.get(token) as Json;
    const path = token.path.join('.');
    const list =
      /^(color\.dataViz\.(?:light|dark)\.(?:categorical|sequential|diverging))\.(\d)$/.exec(path);
    let docPath: string | undefined;
    let type: TokenType | undefined;
    if (list) {
      docPath = path;
      type = 'color';
    } else if (ruleFor(path)) {
      docPath = path;
      type = ruleFor(path);
    } else {
      const guessed = guess(token, value);
      docPath = guessed?.path;
      type = guessed?.type;
    }
    if (!docPath || !type) {
      warnings.add('unmapped', token.where, 'No design-system field takes this token.');
      continue;
    }
    const converted = CONVERT[type](value);
    if (!converted.ok) {
      warnings.add(
        converted.unsafe ? 'unsafe-value' : 'invalid-value',
        token.where,
        converted.message
      );
      continue;
    }
    if (type === 'fontFamily' && (converted as { dropped?: number }).dropped)
      warnings.add('unsafe-value', token.where, 'Refused font family names were dropped.');
    if (list) {
      const key = list[1] as string;
      const entry = lists.get(key) ?? { where: token.where, items: [] };
      entry.items[Number(list[2]) - 1] = converted.value as Json;
      lists.set(key, entry);
    } else setPath(doc, docPath.split('.'), converted.value as Json);
  }
  for (const [key, { where, items }] of lists) {
    if (items.length === 0 || items.some((item) => item === undefined)) {
      warnings.add('invalid-value', where, 'A data-viz list has gaps; it was dropped.');
      continue;
    }
    setPath(doc, key.split('.'), items);
  }
  return doc;
}

/** The import tail both formats share: identity from the extension, then tokens over the rest. */
function build(
  root: JsonObject,
  tokens: RawToken[],
  warnings: Warnings,
  options: DesignSystemImportOptions
): DesignSystemImportResult {
  const values = resolveAliases(tokens, warnings);
  const fromTokens = assemble(tokens, values, warnings);
  const extensions = isObject(root.$extensions) ? root.$extensions : {};
  const rest = isObject(extensions[DESIGN_SYSTEM_EXTENSION])
    ? (extensions[DESIGN_SYSTEM_EXTENSION] as JsonObject)
    : {};
  const where = `$.$extensions[${JSON.stringify(DESIGN_SYSTEM_EXTENSION)}]`;
  const id = identity(rest, options, warnings, 'Imported tokens', where);
  const doc = documentRoot(id);
  const { id: _i, version: _v, name: _n, description: _d, ...sections } = rest;
  mergeInto(doc, sections);
  mergeInto(doc, fromTokens);
  return finalize(ordered(doc), warnings, options);
}

/**
 * A W3C DTCG token file (an object or JSON text) as a design-system
 * document. Never throws: unreadable input is `invalid-input`, a file over
 * the caps `input-limit`, and each token it cannot place is a warning.
 */
export function importDtcg(
  input: unknown,
  options: DesignSystemImportOptions = {}
): DesignSystemImportResult {
  const warnings = new Warnings();
  return guard(warnings, () => {
    const root = readJson(input, warnings, options.maxBytes ?? DESIGN_SYSTEM_IMPORT_LIMITS.bytes);
    if (!isObject(root)) return failInput(warnings, 'A DTCG file is a JSON object.');
    const tokens: RawToken[] = [];
    collect(root, '$', false, undefined, tokens);
    return build(root, tokens, warnings, options);
  });
}

const modeOf = (set: string): 'light' | 'dark' | undefined =>
  /(?:^|[/_.\s-])light$/i.test(set) || /^light$/i.test(set)
    ? 'light'
    : /(?:^|[/_.\s-])dark$/i.test(set) || /^dark$/i.test(set)
      ? 'dark'
      : undefined;

/**
 * A Tokens Studio file (sets in `$metadata.tokenSetOrder`, or every root
 * object; legacy `value`/`type` or `$value`/`$type`) as a design-system
 * document. Sets named `light` or `dark` (or ending in `/light`, `-dark`)
 * give their tokens a mode; later sets override earlier ones.
 */
export function importTokensStudio(
  input: unknown,
  options: DesignSystemImportOptions = {}
): DesignSystemImportResult {
  const warnings = new Warnings();
  return guard(warnings, () => {
    const root = readJson(input, warnings, options.maxBytes ?? DESIGN_SYSTEM_IMPORT_LIMITS.bytes);
    if (!isObject(root)) return failInput(warnings, 'A Tokens Studio file is a JSON object.');
    const metadata = isObject(root.$metadata) ? root.$metadata : {};
    const order = Array.isArray(metadata.tokenSetOrder)
      ? metadata.tokenSetOrder.filter((s): s is string => typeof s === 'string')
      : Object.keys(root).filter((key) => !key.startsWith('$'));
    const tokens: RawToken[] = [];
    for (const set of order) {
      const tree = root[set];
      if (!isObject(tree) || set.startsWith('$')) continue;
      collect(tree, at('$', set), true, modeOf(set), tokens);
    }
    return build(root, tokens, warnings, options);
  });
}
