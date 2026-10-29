/** Plain-data helpers shared by operations and patches. */

const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);

export class DataError extends Error {}

/** Containers a copy visits at most. */
export const MAX_VALUES = 2_000_000;

/**
 * A deep copy of plain JSON data (objects with the plain prototype, arrays,
 * finite numbers, strings, booleans, null). Anything else, prototype keys
 * and more than `MAX_VALUES` values (a cycle included) throw `DataError`.
 * Iterative, so depth never overflows. Shared references are copied apart.
 */
export function cloneData<T>(value: T): T {
  if (value === null || typeof value !== 'object') return check(value) as T;
  const root: unknown = Array.isArray(value) ? [] : {};
  const stack: [unknown, unknown][] = [[value, root]];
  let visited = 0;
  while (stack.length > 0) {
    const [source, target] = stack.pop() as [unknown, unknown];
    visited += 1;
    if (visited > MAX_VALUES) throw new DataError('The value is too large (or has a cycle).');
    if (Array.isArray(source)) {
      const out = target as unknown[];
      for (let i = 0; i < source.length; i += 1) out.push(copyChild(source[i], stack));
    } else {
      if (
        Object.getPrototypeOf(source) !== Object.prototype &&
        Object.getPrototypeOf(source) !== null
      )
        throw new DataError('Only plain objects are allowed.');
      const out = target as Record<string, unknown>;
      for (const key of Object.keys(source as object)) {
        if (UNSAFE.has(key)) throw new DataError('Prototype-related keys are refused.');
        const descriptor = Object.getOwnPropertyDescriptor(source, key);
        if (!descriptor || !('value' in descriptor)) throw new DataError('Accessors are refused.');
        if (descriptor.value === undefined) continue;
        out[key] = copyChild(descriptor.value, stack);
      }
    }
  }
  return root as T;
}

function check(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new DataError('Only finite plain JSON data is allowed.');
}

function copyChild(value: unknown, stack: [unknown, unknown][]): unknown {
  if (value === null || typeof value !== 'object') return check(value);
  const target: unknown = Array.isArray(value) ? [] : {};
  stack.push([value, target]);
  return target;
}

/** Deep equality of plain JSON data (iterative). */
export function equalData(left: unknown, right: unknown): boolean {
  const stack: [unknown, unknown][] = [[left, right]];
  while (stack.length > 0) {
    const [a, b] = stack.pop() as [unknown, unknown];
    if (Object.is(a, b)) continue;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      const other = b as unknown[];
      if (a.length !== other.length) return false;
      for (let i = 0; i < a.length; i += 1) stack.push([a[i], other[i]]);
      continue;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.hasOwn(b, key)) return false;
      stack.push([(a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]]);
    }
  }
  return true;
}

export const isUnsafeKey = (key: string) => UNSAFE.has(key);
