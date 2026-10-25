import type { CatalogTreeInput } from '../render/renderer/types.ts';
import type { EditError, EditOp, NodePath } from './types.ts';

/** Deepest path an op may name (well past the default tree `maxDepth`). */
export const MAX_PATH_LENGTH = 64;
/** Most ops one batch may carry. */
export const MAX_BATCH_OPS = 256;
/** Deepest node or value the shape checks walk before refusing. */
const MAX_DATA_DEPTH = 256;

const PROP_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const NODE_KEYS = new Set(['id', 'props', 'children', 'slot', 'when']);

const OP_FIELDS: Readonly<Record<EditOp['op'], readonly string[]>> = {
  insert: ['op', 'parent', 'index', 'node'],
  remove: ['op', 'path'],
  move: ['op', 'path', 'parent', 'index'],
  setProp: ['op', 'path', 'name', 'value'],
  unsetProp: ['op', 'path', 'name'],
  replace: ['op', 'path', 'node'],
  replaceAll: ['op', 'tree'],
};

export type ParseOpResult = { ok: true; op: EditOp } | { ok: false; error: EditError };
export type ParseOpsResult = { ok: true; ops: readonly EditOp[] } | { ok: false; error: EditError };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

/** True for data JSON can carry exactly: no functions, cycles, NaN or class instances. */
export function isPlainJson(value: unknown, depth = 0): boolean {
  if (depth > MAX_DATA_DEPTH) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isPlainJson(item, depth + 1));
  if (isPlainObject(value)) {
    return Object.values(value).every((field) => isPlainJson(field, depth + 1));
  }
  return false;
}

/** A prop name an op may set: camelCase or kebab-case, no `__proto__` tricks. */
export function isPropName(name: unknown): name is string {
  return typeof name === 'string' && PROP_NAME.test(name);
}

/**
 * Shape check for a tree node: only `id`, `props`, `children`, `slot` and
 * `when`; plain JSON props and condition, a string slot, nested nodes.
 * Catalog membership, slot names, condition syntax and tiers are the commit
 * gate's job.
 */
export function isTreeNode(value: unknown, depth = 0): value is CatalogTreeInput {
  if (depth > MAX_DATA_DEPTH || !isPlainObject(value)) return false;
  if (!Object.keys(value).every((key) => NODE_KEYS.has(key))) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (value.props !== undefined) {
    if (!isPlainObject(value.props) || !isPlainJson(value.props, depth + 1)) return false;
  }
  if (value.children !== undefined) {
    if (!Array.isArray(value.children)) return false;
    if (!value.children.every((child) => isTreeNode(child, depth + 1))) return false;
  }
  if (value.slot !== undefined && typeof value.slot !== 'string') return false;
  if (value.when !== undefined && !isPlainJson(value.when, depth + 1)) return false;
  return true;
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPath(value: unknown): value is NodePath {
  return Array.isArray(value) && value.length <= MAX_PATH_LENGTH && value.every(isIndex);
}

function refuse(message: string, code: EditError['code'] = 'invalid-op'): ParseOpResult {
  return { ok: false, error: { code, message } };
}

/**
 * Validate untrusted input (an agent patch, a stored op log) as one closed
 * {@link EditOp}. Unknown kinds, extra fields and non-JSON values are refused.
 */
export function parseEditOp(value: unknown): ParseOpResult {
  if (!isPlainObject(value)) return refuse('An edit op must be a plain object.');
  const kind = value.op;
  if (typeof kind !== 'string' || !Object.hasOwn(OP_FIELDS, kind)) {
    return refuse(`Unknown edit op: ${JSON.stringify(kind)}.`);
  }
  const fields = OP_FIELDS[kind as EditOp['op']];
  const extra = Object.keys(value).find((key) => !fields.includes(key));
  if (extra !== undefined) return refuse(`"${kind}" does not take a "${extra}" field.`);

  if (fields.includes('path') && !isPath(value.path)) {
    return refuse(`"${kind}" needs a path of child indexes.`);
  }
  if (fields.includes('parent') && !isPath(value.parent)) {
    return refuse(`"${kind}" needs a parent path of child indexes.`);
  }
  if (fields.includes('index') && !isIndex(value.index)) {
    return refuse(`"${kind}" needs a non-negative integer index.`);
  }
  if (fields.includes('name') && !isPropName(value.name)) {
    return refuse(`"${kind}" needs a prop name such as "title".`);
  }
  if (fields.includes('node') && !isTreeNode(value.node)) {
    return refuse(
      `"${kind}" needs a catalog node: id, props, children, slot and when only.`,
      'invalid-node'
    );
  }
  if (kind === 'replaceAll' && !isTreeNode(value.tree)) {
    return refuse(
      '"replaceAll" needs a catalog tree: id, props, children, slot and when only.',
      'invalid-node'
    );
  }
  if (kind === 'setProp' && (value.value === undefined || !isPlainJson(value.value))) {
    return refuse(
      '"setProp" needs a plain JSON value; use "unsetProp" to remove.',
      'invalid-value'
    );
  }
  return { ok: true, op: value as unknown as EditOp };
}

/** Validate a batch of ops (an agent patch). The first refusal names its index. */
export function parseEditOps(value: unknown): ParseOpsResult {
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: { code: 'invalid-op', message: 'A patch must be an array of ops.' },
    };
  }
  if (value.length > MAX_BATCH_OPS) {
    return {
      ok: false,
      error: { code: 'invalid-op', message: `A patch may carry at most ${MAX_BATCH_OPS} ops.` },
    };
  }
  const ops: EditOp[] = [];
  for (const [index, item] of value.entries()) {
    const parsed = parseEditOp(item);
    if (!parsed.ok) return { ok: false, error: { ...parsed.error, opIndex: index } };
    ops.push(parsed.op);
  }
  return { ok: true, ops };
}
