/**
 * Bounded RFC 6902 JSON Patch for documents (the shape of
 * `@texuli/deck/authoring` `applyDeckPatch`), with an exact inverse patch for
 * undo. Agents edit documents through these patches; `test` operations are
 * encouraged. The input is never mutated, a failure changes nothing, and
 * the result is validated (at the `untrusted` tier by default).
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import type { TexuliDocument } from '../model/types.ts';
import { validateDocument } from '../schema/index.ts';
import type { DocumentDiagnostic } from '../schema/validate.ts';
import { cloneData, equalData, isUnsafeKey } from './clone.ts';

export type DocumentPatchOperation =
  | { op: 'add' | 'replace' | 'test'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'move' | 'copy'; path: string; from: string };

export type DocumentPatch = DocumentPatchOperation[];

/** At most this many operations in one patch (ADR-011). */
export const MAX_PATCH_OPERATIONS = 1_000;

export interface PatchOptions {
  /** Validate the result at this tier (`untrusted` by default), or skip with `false`. */
  validate?: HrefTrust | false;
}

export type PatchResult =
  | {
      ok: true;
      document: TexuliDocument;
      /** Applying it to `document` gives back the input. */
      inverse: DocumentPatch;
      issues: DocumentDiagnostic[];
    }
  | { ok: false; index: number; reason: string; issues: DocumentDiagnostic[] };

class PatchError extends Error {}

type Container = Record<string, unknown> | unknown[];

/** RFC 6901 pointer to path segments; refuses malformed escapes and prototype keys. */
export function parsePointer(value: unknown): string[] {
  if (typeof value !== 'string' || (value !== '' && !value.startsWith('/')))
    throw new PatchError('A JSON Pointer is empty or begins with /.');
  if (value.length > 4_096) throw new PatchError('The JSON Pointer is too long.');
  if (value === '') return [];
  return value
    .slice(1)
    .split('/')
    .map((part) => {
      if (/~(?![01])/u.test(part)) throw new PatchError('Malformed JSON Pointer escape.');
      const decoded = part.replace(/~1/gu, '/').replace(/~0/gu, '~');
      if (isUnsafeKey(decoded)) throw new PatchError('Prototype-related paths are refused.');
      return decoded;
    });
}

/** Path segments to an RFC 6901 pointer. */
export function toPointer(parts: readonly (string | number)[]): string {
  return parts.map((part) => `/${String(part).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
}

function arrayIndex(value: string, length: number, allowEnd: boolean): number {
  if (value === '-' && allowEnd) return length;
  if (!/^(?:0|[1-9]\d{0,8})$/u.test(value)) throw new PatchError('Invalid array index.');
  const index = Number(value);
  if (index > length || (!allowEnd && index === length))
    throw new PatchError('The array index is out of bounds.');
  return index;
}

function child(value: unknown, key: string): unknown {
  if (Array.isArray(value)) return value[arrayIndex(key, value.length, false)];
  if (value !== null && typeof value === 'object' && Object.hasOwn(value, key))
    return (value as Record<string, unknown>)[key];
  throw new PatchError('The JSON Pointer does not exist.');
}

function read(root: unknown, parts: readonly string[]): unknown {
  let current = root;
  for (const part of parts) current = child(current, part);
  return current;
}

function parentOf(root: unknown, parts: readonly string[]): { parent: Container; key: string } {
  const parent = read(root, parts.slice(0, -1));
  if (parent === null || typeof parent !== 'object')
    throw new PatchError('The JSON Pointer parent does not exist.');
  return { parent: parent as Container, key: parts.at(-1) as string };
}

interface State {
  root: unknown;
}

/** Add `value` at `parts`; returns the operation that undoes it. */
function add(state: State, parts: string[], value: unknown): DocumentPatchOperation {
  if (parts.length === 0) {
    const previous = state.root;
    state.root = value;
    return { op: 'replace', path: '', value: previous };
  }
  const { parent, key } = parentOf(state.root, parts);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, true);
    parent.splice(index, 0, value);
    return { op: 'remove', path: toPointer([...parts.slice(0, -1), index]) };
  }
  const had = Object.hasOwn(parent, key);
  const previous = parent[key];
  parent[key] = value;
  return had
    ? { op: 'replace', path: toPointer(parts), value: previous }
    : { op: 'remove', path: toPointer(parts) };
}

function remove(
  state: State,
  parts: string[]
): { inverse: DocumentPatchOperation; value: unknown } {
  if (parts.length === 0) throw new PatchError('The document root cannot be removed.');
  const { parent, key } = parentOf(state.root, parts);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, false);
    const [value] = parent.splice(index, 1);
    return { inverse: { op: 'add', path: toPointer(parts), value }, value };
  }
  if (!Object.hasOwn(parent, key)) throw new PatchError('The object property does not exist.');
  const value = parent[key];
  delete parent[key];
  return { inverse: { op: 'add', path: toPointer(parts), value }, value };
}

function replace(state: State, parts: string[], value: unknown): DocumentPatchOperation {
  if (parts.length === 0) {
    const previous = state.root;
    state.root = value;
    return { op: 'replace', path: '', value: previous };
  }
  const { parent, key } = parentOf(state.root, parts);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, false);
    const previous = parent[index];
    parent[index] = value;
    return { op: 'replace', path: toPointer(parts), value: previous };
  }
  if (!Object.hasOwn(parent, key)) throw new PatchError('The object property does not exist.');
  const previous = parent[key];
  parent[key] = value;
  return { op: 'replace', path: toPointer(parts), value: previous };
}

/** Resolve `-` and normalize indices so an inverse names concrete positions. */
function concrete(state: State, parts: string[]): string[] {
  if (parts.length === 0) return parts;
  const parent = read(state.root, parts.slice(0, -1));
  if (Array.isArray(parent) && parts.at(-1) === '-')
    return [...parts.slice(0, -1), String(parent.length)];
  return parts;
}

/** Apply one operation; returns the steps that undo it, in the order to apply them. */
function applyOne(state: State, operation: DocumentPatchOperation): DocumentPatchOperation[] {
  if (operation === null || typeof operation !== 'object')
    throw new PatchError('A patch operation is an object.');
  const path = parsePointer(operation.path);
  switch (operation.op) {
    case 'add':
      return [add(state, path, cloneData(operation.value))];
    case 'remove':
      return [remove(state, path).inverse];
    case 'replace':
      return [replace(state, path, cloneData(operation.value))];
    case 'test':
      if (!equalData(read(state.root, path), operation.value))
        throw new PatchError('The test operation failed.');
      return [];
    case 'copy': {
      const from = parsePointer(operation.from);
      return [add(state, path, cloneData(read(state.root, from)))];
    }
    case 'move': {
      const from = parsePointer(operation.from);
      if (path.length > from.length && from.every((part, i) => path[i] === part))
        throw new PatchError('A value cannot move into its own descendant.');
      const removed = remove(state, from);
      const target = concrete(state, path);
      const back = add(state, target, removed.value);
      // Undo: take the value back out of the target, then restore it at the source.
      return [back, removed.inverse];
    }
    default:
      throw new PatchError(
        `Unsupported patch operation "${String((operation as { op?: unknown }).op).slice(0, 16)}".`
      );
  }
}

/**
 * Apply a bounded RFC 6902 patch to a document. Returns the patched,
 * validated copy and its inverse patch, or the failing index and reason.
 */
export function applyDocumentPatch(
  doc: TexuliDocument,
  patch: readonly DocumentPatchOperation[],
  options: PatchOptions = {}
): PatchResult {
  if (!Array.isArray(patch) || patch.length > MAX_PATCH_OPERATIONS)
    return {
      ok: false,
      index: -1,
      reason: `A patch holds at most ${MAX_PATCH_OPERATIONS} operations.`,
      issues: [],
    };
  const state: State = { root: undefined };
  try {
    state.root = cloneData(doc);
  } catch {
    return { ok: false, index: -1, reason: 'The document is not plain JSON data.', issues: [] };
  }
  const undo: DocumentPatchOperation[][] = [];
  for (let index = 0; index < patch.length; index += 1) {
    try {
      undo.push(applyOne(state, patch[index] as DocumentPatchOperation));
    } catch (error) {
      return {
        ok: false,
        index,
        reason: error instanceof PatchError ? error.message : 'The patch operation was refused.',
        issues: [],
      };
    }
  }
  // Undo runs the operations' undo steps from the last operation back.
  // A copy, so the inverse never shares values with the returned document.
  const inverse = cloneData(undo.reverse().flat());
  if (options.validate === false)
    return { ok: true, document: state.root as TexuliDocument, inverse, issues: [] };
  const checked = validateDocument(state.root, { trust: options.validate ?? 'untrusted' });
  if (!checked.ok)
    return {
      ok: false,
      index: -1,
      reason: 'The patched value is not a valid document.',
      issues: checked.issues,
    };
  return { ok: true, document: checked.document, inverse, issues: checked.issues };
}
