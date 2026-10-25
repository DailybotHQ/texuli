import { A2UI_RESERVED_KEYS, type A2uiDiagnostic } from './types.ts';

/** Keys that could reach an object's prototype when copied. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** A Texuli or A2UI component id: kebab-case, like the catalog renderer's. */
export const COMPONENT_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Whether a prop value would mean something other than a literal to an A2UI
 * client: a data binding (`{ path }`) or a function call (`{ call }`).
 */
function isDynamic(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  const keys = Object.keys(value);
  return (
    (keys.length === 1 && typeof value.path === 'string') ||
    (typeof value.call === 'string' &&
      keys.every((k) => ['call', 'args', 'returnType'].includes(k)))
  );
}

/** Check that `value` is plain JSON data with no prototype-reaching keys. */
function checkJson(value: unknown, path: string, out: A2uiDiagnostic[]): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      out.push({ code: 'not-json', path, message: 'Numbers must be finite.' });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      checkJson(item, `${path}[${i}]`, out);
    });
    return;
  }
  if (!isPlainRecord(value)) {
    out.push({ code: 'not-json', path, message: `A ${typeof value} is not JSON data.` });
    return;
  }
  for (const key of Object.keys(value)) {
    if (UNSAFE_KEYS.has(key)) {
      out.push({
        code: 'unsafe-key',
        path: `${path}.${key}`,
        message: `"${key}" is never copied.`,
      });
    } else {
      checkJson(value[key], `${path}.${key}`, out);
    }
  }
}

/**
 * Copy the props of one node into a fresh object, or report why they cannot
 * travel: reserved structure keys, prototype keys, non-JSON values, and
 * bindings or function calls (this adapter carries literals only).
 */
export function copyProps(
  source: Readonly<Record<string, unknown>>,
  skip: readonly string[],
  path: string,
  reservedCode: 'reserved-prop' | null,
  out: A2uiDiagnostic[]
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    if (skip.includes(key)) continue;
    const at = `${path}.${key}`;
    if (UNSAFE_KEYS.has(key)) {
      out.push({ code: 'unsafe-key', path: at, message: `"${key}" is never copied.` });
      continue;
    }
    if (reservedCode && A2UI_RESERVED_KEYS.includes(key)) {
      out.push({
        code: reservedCode,
        path: at,
        message: `"${key}" is A2UI structure, so a prop cannot use that name.`,
      });
      continue;
    }
    const value = source[key];
    if (isDynamic(value)) {
      out.push({
        code: 'binding',
        path: at,
        message: 'Data bindings and function calls are not supported; pass a literal value.',
      });
      continue;
    }
    const before = out.length;
    checkJson(value, at, out);
    if (out.length === before) props[key] = structuredClone(value);
  }
  return props;
}
