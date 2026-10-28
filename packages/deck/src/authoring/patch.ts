export type JsonPatchOperation =
  | { op: 'add' | 'replace' | 'test'; path: string; value: unknown }
  | { op: 'remove'; path: string }
  | { op: 'move' | 'copy'; path: string; from: string };
export type JsonPatchResult =
  | { ok: true; value: unknown }
  | { ok: false; index: number; reason: string };
export const MAX_DECK_PATCH_OPERATIONS = 1_000;
const unsafe = new Set(['__proto__', 'prototype', 'constructor']);

/** Apply a bounded RFC 6902 patch to plain JSON data; failures leave input untouched. */
export function applyDeckPatch(
  document: unknown,
  operations: readonly JsonPatchOperation[]
): JsonPatchResult {
  if (!Array.isArray(operations) || operations.length > MAX_DECK_PATCH_OPERATIONS)
    return {
      ok: false,
      index: -1,
      reason: `A patch may contain at most ${MAX_DECK_PATCH_OPERATIONS} operations.`,
    };
  let value: unknown;
  try {
    value = clone(document);
  } catch {
    return { ok: false, index: -1, reason: 'The document must be finite plain JSON data.' };
  }
  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index];
    try {
      if (
        !operation ||
        !['add', 'remove', 'replace', 'move', 'copy', 'test'].includes(operation.op)
      )
        throw new TypeError('Unsupported RFC 6902 operation.');
      const path = pointer(operation.path);
      if (operation.op === 'move' || operation.op === 'copy') {
        const from = pointer(operation.from);
        if (
          operation.op === 'move' &&
          path.length > from.length &&
          from.every((part, i) => path[i] === part)
        )
          throw new TypeError('Cannot move a value into its own descendant.');
        const got = read(value, from);
        if (operation.op === 'move') value = mutate(value, from, 'remove');
        value = mutate(value, path, 'add', clone(got));
      } else if (operation.op === 'test') {
        if (!equal(read(value, path), operation.value))
          throw new TypeError('The test operation failed.');
      } else
        value = mutate(
          value,
          path,
          operation.op,
          operation.op === 'remove' ? undefined : clone(operation.value)
        );
    } catch (error) {
      return {
        ok: false,
        index,
        reason: error instanceof Error ? error.message : 'Patch operation refused.',
      };
    }
  }
  return { ok: true, value };
}

function pointer(value: string): string[] {
  if (typeof value !== 'string' || (value !== '' && !value.startsWith('/')))
    throw new TypeError('A JSON Pointer must be empty or begin with /.');
  const parts =
    value === ''
      ? []
      : value
          .slice(1)
          .split('/')
          .map((part) => {
            if (/~(?![01])/u.test(part)) throw new TypeError('Malformed JSON Pointer escape.');
            const decoded = part.replace(/~1/gu, '/').replace(/~0/gu, '~');
            if (unsafe.has(decoded))
              throw new TypeError('Prototype-related JSON Pointer paths are refused.');
            return decoded;
          });
  return parts;
}
function clone(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (unsafe.has(key)) throw new TypeError('Prototype-related keys are refused.');
      result[key] = clone(child);
    }
    return result;
  }
  throw new TypeError('The document must be finite plain JSON data.');
}
function parentAt(
  root: unknown,
  parts: string[]
): { parent: Record<string, unknown> | unknown[]; key: string } {
  if (!parts.length) throw new TypeError('The document root cannot be used as a parent path.');
  let current = root;
  for (const part of parts.slice(0, -1)) current = child(current, part);
  if (current === null || typeof current !== 'object')
    throw new TypeError('The JSON Pointer parent does not exist.');
  const key = parts.at(-1);
  if (key === undefined) throw new TypeError('The JSON Pointer parent path is empty.');
  return { parent: current as Record<string, unknown> | unknown[], key };
}
function child(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    const index = arrayIndex(key, value.length, false);
    return value[index];
  }
  if (value && typeof value === 'object' && Object.hasOwn(value, key))
    return (value as Record<string, unknown>)[key];
  throw new TypeError('The JSON Pointer does not exist.');
}
function read(root: unknown, parts: string[]): unknown {
  return parts.reduce(child, root);
}
function mutate(
  root: unknown,
  parts: string[],
  operation: 'add' | 'remove' | 'replace',
  next?: unknown
): unknown {
  if (!parts.length) {
    if (operation === 'remove') throw new TypeError('The document root cannot be removed.');
    return next;
  }
  const { parent, key } = parentAt(root, parts);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, operation === 'add');
    if (operation === 'add') parent.splice(index, 0, next);
    else if (operation === 'remove') parent.splice(index, 1);
    else {
      if (index >= parent.length) throw new TypeError('The array index does not exist.');
      parent[index] = next;
    }
  } else if (operation === 'add') (parent as Record<string, unknown>)[key] = next;
  else if (!Object.hasOwn(parent, key)) throw new TypeError('The object property does not exist.');
  else if (operation === 'remove') delete (parent as Record<string, unknown>)[key];
  else (parent as Record<string, unknown>)[key] = next;
  return root;
}
function arrayIndex(value: string, length: number, allowEnd: boolean): number {
  if (value === '-' && allowEnd) return length;
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) throw new TypeError('Invalid array index.');
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index > length || (!allowEnd && index === length))
    throw new TypeError('Array index is out of bounds.');
  return index;
}
function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((value, index) => equal(value, right[index]));
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const a = Object.keys(left);
    const b = Object.keys(right);
    return (
      a.length === b.length &&
      a.every(
        (key) =>
          Object.hasOwn(right, key) &&
          equal((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
      )
    );
  }
  return false;
}
