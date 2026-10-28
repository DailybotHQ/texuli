import { safeHref, safeImageSrc } from '@texuli/core/url-policy';
import type {
  PropSpec,
  WorkflowError,
  WorkflowErrorCode,
  WorkflowLimits,
  WorkflowScalar,
} from './types.ts';

/** The hard caps. {@link resolveLimits} never lets a host go above them. */
export const WORKFLOW_LIMITS: Readonly<WorkflowLimits> = Object.freeze({
  maxNodes: 500,
  maxEdges: 2000,
  maxGroups: 100,
  maxLabelLength: 200,
  maxTextLength: 2000,
  maxPropsPerNode: 32,
  maxMetadataEntries: 32,
  maxCoordinate: 1_000_000,
  maxOps: 5000,
});

/** Host limits clamped to the hard caps; missing or invalid values take the cap. */
export function resolveLimits(limits: Partial<WorkflowLimits> = {}): WorkflowLimits {
  const resolved = { ...WORKFLOW_LIMITS };
  for (const key of Object.keys(WORKFLOW_LIMITS) as (keyof WorkflowLimits)[]) {
    const value = limits[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      resolved[key] = Math.min(Math.floor(value), WORKFLOW_LIMITS[key]);
    }
  }
  return resolved;
}

export function failure(
  code: WorkflowErrorCode,
  message: string,
  path?: string
): { ok: false; error: WorkflowError } {
  return { ok: false, error: path === undefined ? { code, message } : { code, message, path } };
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const RESERVED_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

/** Node, edge, group, port and type ids: 1–64 safe characters. */
export function isWorkflowId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

/** Prop and metadata names: an identifier, never a prototype key. */
export function isPropName(value: unknown): value is string {
  return typeof value === 'string' && NAME.test(value) && !RESERVED_NAMES.has(value);
}

/**
 * Control characters (other than tab and newlines) and bidi overrides,
 * embeddings and isolates. Labels are rendered as text, but these can still
 * disguise what a label says, so they are refused, not stripped.
 */
export function hasUnsafeText(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
    if (code === 0x7f) return true;
    if ((code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) return true;
  }
  return false;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: WorkflowError };

export function checkText(value: unknown, maxLength: number, what: string): Checked<string> {
  if (typeof value !== 'string') return failure('invalid-value', `${what} must be a string.`);
  if (value.length > maxLength) {
    return failure('limit', `${what} is longer than ${maxLength} characters.`);
  }
  if (hasUnsafeText(value)) {
    return failure('unsafe-text', `${what} holds control or bidi override characters.`);
  }
  return { ok: true, value };
}

export function checkCoordinate(value: unknown, limits: WorkflowLimits): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limits.maxCoordinate
  );
}

/** A plain object whose own keys are all data properties (no getters, no class). */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** A record built with own data properties only, whatever its keys. */
export function defineEntry(
  target: Record<string, WorkflowScalar>,
  key: string,
  value: WorkflowScalar
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/** Validate a prop value against its spec. Returns the value to store. */
export function checkPropValue(
  spec: PropSpec,
  value: unknown,
  name: string,
  limits: WorkflowLimits
): Checked<WorkflowScalar> {
  const what = `Prop "${name}"`;
  switch (spec.kind) {
    case 'text':
      return checkText(
        value,
        Math.min(spec.maxLength ?? limits.maxTextLength, limits.maxTextLength),
        what
      );
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return failure('invalid-value', `${what} must be a finite number.`);
      }
      if (
        (spec.min !== undefined && value < spec.min) ||
        (spec.max !== undefined && value > spec.max)
      ) {
        return failure('invalid-value', `${what} is out of range.`);
      }
      return { ok: true, value: Object.is(value, -0) ? 0 : value };
    case 'boolean':
      return typeof value === 'boolean'
        ? { ok: true, value }
        : failure('invalid-value', `${what} must be a boolean.`);
    case 'enum':
      return typeof value === 'string' && spec.values.includes(value)
        ? { ok: true, value }
        : failure('invalid-value', `${what} must be one of ${spec.values.join(', ')}.`);
    case 'url':
    case 'image': {
      if (typeof value !== 'string' || value.length > limits.maxTextLength) {
        return failure('invalid-value', `${what} must be a URL string.`);
      }
      const safe =
        spec.kind === 'url' ? safeHref(value, 'untrusted') : safeImageSrc(value, 'untrusted');
      return safe === undefined
        ? failure('unsafe-url', `${what} is refused by the URL policy.`)
        : { ok: true, value: safe };
    }
  }
}

/** Validate a metadata record: identifier keys, bounded text, finite numbers. */
export function checkMetadata(
  value: unknown,
  limits: WorkflowLimits
): Checked<Record<string, WorkflowScalar>> {
  if (!isPlainRecord(value)) return failure('invalid-value', 'Metadata must be a plain object.');
  const keys = Object.keys(value);
  if (keys.length > limits.maxMetadataEntries) {
    return failure('limit', `Metadata holds more than ${limits.maxMetadataEntries} entries.`);
  }
  const out: Record<string, WorkflowScalar> = {};
  for (const key of keys) {
    if (!isPropName(key)) return failure('invalid-value', `Metadata key "${key}" is not allowed.`);
    const entry = value[key];
    if (typeof entry === 'string') {
      const text = checkText(entry, limits.maxTextLength, `Metadata "${key}"`);
      if (!text.ok) return text;
    } else if (typeof entry === 'number') {
      if (!Number.isFinite(entry))
        return failure('invalid-value', `Metadata "${key}" must be finite.`);
    } else if (typeof entry !== 'boolean') {
      return failure('invalid-value', `Metadata "${key}" must be a string, number or boolean.`);
    }
    defineEntry(out, key, entry as WorkflowScalar);
  }
  return { ok: true, value: out };
}
