import { canonicalBlueprintJson } from '@texuli/catalog/edit';
import { validateCatalogTreeLimits } from '@texuli/catalog/render/limits';
import type { CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { BUILDER_MANIFEST_BY_ID } from '../manifest.ts';
import { MAX_BLUEPRINT_BYTES } from '../model.ts';

/**
 * The payload panel's text pipeline (builder design §6): the blueprint as
 * pretty canonical JSON, and a commit that applies all of a text buffer or
 * none of it, with every refusal pointing at a line and column.
 */

/** One JSON path segment: an object key or an array index. */
export type JsonPath = readonly (string | number)[];

export interface TextPosition {
  /** 0-based offset into the text. */
  offset: number;
  /** 1-based line. */
  line: number;
  /** 1-based column, in UTF-16 code units. */
  column: number;
}

export interface PayloadIssue {
  message: string;
  /** Where in the text, when it can be placed. */
  at?: TextPosition;
  path?: JsonPath;
}

export type PayloadCheck =
  | { ok: true; tree: CatalogTreeInput }
  | { ok: false; issues: readonly PayloadIssue[] };

/** The canonical JSON (the catalog build's rule) with a 2-space indent: the panel's view. */
export function prettyBlueprintJson(tree: CatalogTreeInput): string {
  return JSON.stringify(JSON.parse(canonicalBlueprintJson(tree)), null, 2);
}

/** The 1-based line and column of `offset` in `text`. */
export function positionAt(text: string, offset: number): TextPosition {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < clamped; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { offset: clamped, line, column: clamped - lineStart + 1 };
}

/**
 * `positionAt` for many offsets in one text: the line starts are found once,
 * then each offset is a binary search, so placing one issue per node stays
 * linear in the text instead of rescanning it per issue. Same results.
 */
export function positionIndex(text: string): (offset: number) => TextPosition {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return (offset) => {
    const clamped = Math.max(0, Math.min(offset, text.length));
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if ((starts[middle] as number) <= clamped) low = middle;
      else high = middle - 1;
    }
    return { offset: clamped, line: low + 1, column: clamped - (starts[low] as number) + 1 };
  };
}

const pathKey = (path: JsonPath) => JSON.stringify(path);

interface JsonLocations {
  /** Where each value starts, by path. */
  values: Map<string, number>;
  /** Where each object member's key starts, by the member's path. */
  keys: Map<string, number>;
  /** Members whose key repeats an earlier key of the same object. */
  duplicates: { path: JsonPath; offset: number }[];
  /** Where the walk stopped on malformed text, or `null` when it read one whole value. */
  stoppedAt: number | null;
}

/**
 * Walk JSON text and record where every value and key starts. Tolerates
 * malformed text (it stops where it cannot continue), so duplicate keys are
 * found even when `JSON.parse` would keep the last one silently.
 */
export function locateJson(text: string): JsonLocations {
  const out: JsonLocations = {
    values: new Map(),
    keys: new Map(),
    duplicates: [],
    stoppedAt: null,
  };
  let index = 0;
  const space = () => {
    while (index < text.length && /\s/.test(text[index] as string)) index += 1;
  };
  const string = (): string | null => {
    const start = index;
    if (text[index] !== '"') return null;
    index += 1;
    while (index < text.length) {
      const char = text[index];
      if (char === '\\') index += 2;
      else {
        index += 1;
        if (char === '"') {
          try {
            return JSON.parse(text.slice(start, index)) as string;
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };
  const value = (path: JsonPath, depth: number): boolean => {
    space();
    if (depth > 256) return false;
    out.values.set(pathKey(path), index);
    const char = text[index];
    if (char === '{') {
      index += 1;
      const seen = new Set<string>();
      space();
      if (text[index] === '}') {
        index += 1;
        return true;
      }
      while (index < text.length) {
        space();
        const keyAt = index;
        const key = string();
        if (key === null) return false;
        const member = [...path, key];
        if (seen.has(key)) out.duplicates.push({ path: member, offset: keyAt });
        else out.keys.set(pathKey(member), keyAt);
        seen.add(key);
        space();
        if (text[index] !== ':') return false;
        index += 1;
        if (!value(member, depth + 1)) return false;
        space();
        if (text[index] === ',') {
          index += 1;
          continue;
        }
        if (text[index] === '}') {
          index += 1;
          return true;
        }
        return false;
      }
      return false;
    }
    if (char === '[') {
      index += 1;
      space();
      if (text[index] === ']') {
        index += 1;
        return true;
      }
      for (let item = 0; index < text.length; item += 1) {
        if (!value([...path, item], depth + 1)) return false;
        space();
        if (text[index] === ',') {
          index += 1;
          continue;
        }
        if (text[index] === ']') {
          index += 1;
          return true;
        }
        return false;
      }
      return false;
    }
    if (char === '"') return string() !== null;
    const start = index;
    while (index < text.length && !/[\s,}\]]/.test(text[index] as string)) index += 1;
    return index > start;
  };
  const ok = value([], 0);
  space();
  if (!ok || index < text.length) out.stoppedAt = Math.min(index, text.length);
  return out;
}

/**
 * Where `JSON.parse` failed, from its message. Engines word it differently:
 * "(line 3 column 5)", "at line 3 column 5" or "at position 42". Without one,
 * `fallback` (where the locating walk stopped) is used, else `undefined`.
 */
export function parseErrorPosition(
  text: string,
  message: string,
  fallback?: number | null
): TextPosition | undefined {
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) {
    const line = Number(lineColumn[1]);
    const column = Number(lineColumn[2]);
    let offset = 0;
    for (let current = 1; current < line && offset < text.length; offset += 1) {
      if (text.charCodeAt(offset) === 10) current += 1;
    }
    return positionAt(text, offset + column - 1);
  }
  const position = /position (\d+)/i.exec(message);
  if (position) return positionAt(text, Number(position[1]));
  if (/unexpected end/i.test(message)) return positionAt(text, text.length);
  return fallback === undefined || fallback === null ? undefined : positionAt(text, fallback);
}

/**
 * Why a value is not a builder tree: the same closed rules as the builder's
 * history validator (palette ids, manifest prop names, no `class`, `style` or
 * `on*`, tree limits), each with the JSON path it is about.
 */
export function builderTreeIssues(value: unknown): { path: JsonPath; message: string }[] {
  const issues: { path: JsonPath; message: string }[] = [];
  const node = (raw: unknown, path: JsonPath): void => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      issues.push({ path, message: 'A node must be an object with an "id".' });
      return;
    }
    const record = raw as Record<string, unknown>;
    const manifest =
      typeof record.id === 'string' ? BUILDER_MANIFEST_BY_ID.get(record.id) : undefined;
    if (typeof record.id !== 'string') {
      issues.push({ path: [...path, 'id'], message: 'A node needs an "id" string.' });
    } else if (!manifest) {
      issues.push({
        path: [...path, 'id'],
        message: `"${record.id}" is not a component the builder can place.`,
      });
    }
    for (const key of Object.keys(record)) {
      if (!['id', 'props', 'children'].includes(key)) {
        issues.push({
          path: [...path, key],
          message: `"${key}" is not a node field (id, props, children).`,
        });
      }
    }
    if (record.props !== undefined) {
      const props = record.props;
      if (typeof props !== 'object' || props === null || Array.isArray(props)) {
        issues.push({ path: [...path, 'props'], message: '"props" must be an object.' });
      } else if (manifest) {
        const allowed = new Set(manifest.props.map((prop) => prop.name));
        for (const name of Object.keys(props)) {
          if (name === 'class' || name === 'style' || name.startsWith('on')) {
            issues.push({
              path: [...path, 'props', name],
              message: `"${name}" is never accepted from a blueprint.`,
            });
          } else if (!allowed.has(name)) {
            issues.push({
              path: [...path, 'props', name],
              message: `"${manifest.id}" has no "${name}" prop.`,
            });
          }
        }
      }
    }
    if (record.children !== undefined) {
      if (!Array.isArray(record.children)) {
        issues.push({ path: [...path, 'children'], message: '"children" must be an array.' });
      } else {
        record.children.forEach((child, index) => {
          node(child, [...path, 'children', index]);
        });
      }
    }
  };
  node(value, []);
  if (issues.length === 0) {
    for (const diagnostic of validateCatalogTreeLimits(value).diagnostics) {
      issues.push({ path: limitPath(diagnostic.path), message: diagnostic.message });
    }
  }
  return issues;
}

/** A limits path (`0.children.1`, `$.children[1]`) as JSON path segments under the root. */
function limitPath(path: string): JsonPath {
  const segments = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((part) => part !== '' && part !== '$');
  if (segments[0] === '0' || segments[0] === 'tree') segments.shift();
  return segments.map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

/** The best text position for a JSON path: the member key, else the value, else the nearest parent. */
function placePath(
  at: (offset: number) => TextPosition,
  locations: JsonLocations,
  path: JsonPath
): TextPosition | undefined {
  for (let length = path.length; length >= 0; length -= 1) {
    const key = pathKey(path.slice(0, length));
    const offset =
      length === path.length
        ? (locations.keys.get(key) ?? locations.values.get(key))
        : locations.values.get(key);
    if (offset !== undefined) return at(offset);
  }
  return undefined;
}

/**
 * Check a text buffer for commit, in the design's order: byte cap, duplicate
 * keys, `JSON.parse`, then the closed builder rules. Any issue refuses the
 * whole text; nothing is applied piecemeal.
 */
export function checkPayloadText(text: string): PayloadCheck {
  if (new TextEncoder().encode(text).byteLength > MAX_BLUEPRINT_BYTES) {
    return {
      ok: false,
      issues: [{ message: `JSON exceeds the ${MAX_BLUEPRINT_BYTES}-byte limit.` }],
    };
  }
  const locations = locateJson(text);
  const at = positionIndex(text);
  if (locations.duplicates.length > 0) {
    return {
      ok: false,
      issues: locations.duplicates.map(({ path, offset }) => ({
        message: `Duplicate JSON keys: "${path.join('.')}" appears more than once; JSON would keep only the last.`,
        at: at(offset),
        path,
      })),
    };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unreadable JSON';
    // Some engines name no place; the locating walk stops on the same character.
    const place = parseErrorPosition(text, message, locations.stoppedAt);
    return {
      ok: false,
      issues: [{ message: `JSON parse failed: ${message}`, ...(place ? { at: place } : {}) }],
    };
  }
  const issues = builderTreeIssues(value);
  if (issues.length > 0) {
    return {
      ok: false,
      issues: issues.map(({ path, message }) => {
        const place = placePath(at, locations, path);
        return { message, path, ...(place ? { at: place } : {}) };
      }),
    };
  }
  return { ok: true, tree: value as CatalogTreeInput };
}

/** "Line 3, column 5: message", or the message alone when it has no place. */
export function describeIssue(issue: PayloadIssue): string {
  return issue.at
    ? `Line ${issue.at.line}, column ${issue.at.column}: ${issue.message}`
    : issue.message;
}
