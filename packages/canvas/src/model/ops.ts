/**
 * Typed canvas operations and the op log. `applyCanvasOps` applies a batch
 * all or none to a copy, validates the result at the tier, and returns the
 * inverse batch, which is what undo applies. Every editor gesture is a
 * batch of these; so are pastes and agent edits. Total: it never throws.
 */
import type { HrefTrust } from '@texuli/core/url-policy';
import { isContainer, subtreeIds } from './document.ts';
import { CANVAS_LIMITS } from './limits.ts';
import { type CanvasDiagnostic, validateCanvas } from './schema.ts';
import type {
  CanvasConnector,
  CanvasDocument,
  CanvasMeta,
  CanvasShape,
  ContainerShape,
} from './types.ts';

/** Fields `update` may set; `null` clears an optional field. */
export type CanvasPatch = { [field: string]: unknown };

export type CanvasOperation =
  /** Insert a shape (with its children) under `parent` (default the top level) at `index` (default on top). */
  | { op: 'add'; shape: CanvasShape; parent?: string | null; index?: number }
  /** Remove a shape (its children, connectors attached to any of them, and a group it leaves empty) or a connector. */
  | { op: 'remove'; id: string }
  /** Set fields of a shape or connector. `id`, `type` and `children` never change. */
  | { op: 'update'; id: string; set: CanvasPatch }
  /** Move a shape to `index` under `parent` (`null`: the top level); z-order and reparenting. */
  | { op: 'move'; id: string; parent: string | null; index: number }
  /** Insert a connector at `index` (default last). */
  | { op: 'connect'; connector: CanvasConnector; index?: number }
  /** Set canvas metadata and the grid; `null` clears a field. */
  | { op: 'meta'; set: { [K in keyof CanvasMeta | 'grid']?: unknown } };

export interface CanvasOpError {
  code:
    | 'invalid-op'
    | 'unknown-id'
    | 'duplicate-id'
    | 'cycle'
    | 'locked'
    | 'limit'
    | 'invalid-result';
  message: string;
  /** The operation that failed (`-1` for the result check). */
  index: number;
  issues?: CanvasDiagnostic[];
}

export type CanvasApplyResult =
  | { ok: true; doc: CanvasDocument; inverse: CanvasOperation[] }
  | { ok: false; error: CanvasOpError };

export interface ApplyCanvasOptions {
  /** URL tier the result is validated at. Default `untrusted`. */
  trust?: HrefTrust;
  /** Refuse edits that change a locked shape (default false: the model leaves locks to the editor). */
  respectLocks?: boolean;
}

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const FIXED = new Set(['id', 'type', 'children']);
const META_KEYS = new Set(['title', 'locale', 'description', 'grid']);

class OpFailure extends Error {
  readonly code: CanvasOpError['code'];
  constructor(code: CanvasOpError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

const fail = (code: CanvasOpError['code'], message: string): never => {
  throw new OpFailure(code, message);
};

interface Located {
  shape: CanvasShape;
  parent: ContainerShape | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** A JSON copy (operations carry plain data; this also drops accessors and prototypes). */
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Apply operations all or none. Returns the new document (a copy; the input
 * is not changed) and the inverse batch, or the first error. Work is linear
 * in the canvas plus the batch (one copy, one index, one validation), plus
 * the siblings each operation touches.
 */
export function applyCanvasOps(
  doc: CanvasDocument,
  ops: readonly CanvasOperation[],
  options: ApplyCanvasOptions = {}
): CanvasApplyResult {
  if (!Array.isArray(ops))
    return {
      ok: false,
      error: { code: 'invalid-op', message: 'Operations are a list.', index: 0 },
    };
  if (ops.length > CANVAS_LIMITS.ops)
    return {
      ok: false,
      error: {
        code: 'limit',
        message: `At most ${CANVAS_LIMITS.ops} operations per batch.`,
        index: CANVAS_LIMITS.ops,
      },
    };
  let next: CanvasDocument;
  try {
    next = copy(doc);
  } catch {
    return {
      ok: false,
      error: { code: 'invalid-op', message: 'The canvas is not JSON.', index: -1 },
    };
  }
  const shapes = new Map<string, Located>();
  const index = (list: CanvasShape[], parent: ContainerShape | null) => {
    const stack: [CanvasShape[], ContainerShape | null][] = [[list, parent]];
    while (stack.length > 0) {
      const [items, owner] = stack.pop() as [CanvasShape[], ContainerShape | null];
      for (const shape of items) {
        if (shapes.has(shape.id)) fail('duplicate-id', `The id "${shape.id}" is used twice.`);
        shapes.set(shape.id, { shape, parent: owner });
        if (isContainer(shape)) stack.push([shape.children, shape]);
      }
    }
  };
  const inverse: CanvasOperation[][] = [];
  let at = 0;
  try {
    index(next.shapes, null);
    const connectorIds = new Set(next.connectors.map((c) => c.id));
    const listOf = (parent: ContainerShape | null) => (parent ? parent.children : next.shapes);
    const container = (id: string | null | undefined): ContainerShape | null => {
      if (id === null || id === undefined) return null;
      const found = shapes.get(id);
      if (!found) return fail('unknown-id', `No shape "${id}".`);
      if (!isContainer(found.shape)) return fail('invalid-op', `"${id}" holds no shapes.`);
      return found.shape;
    };
    const clampIndex = (value: unknown, length: number) =>
      typeof value === 'number' && Number.isInteger(value)
        ? Math.max(0, Math.min(length, value))
        : length;
    const checkLock = (shape: CanvasShape) => {
      if (options.respectLocks && shape.locked) fail('locked', `"${shape.id}" is locked.`);
    };
    const usedId = (id: string) => shapes.has(id) || connectorIds.has(id);

    /** Detach a shape; returns the operations that restore it, in the order to apply them. */
    const removeShape = (id: string): CanvasOperation[] => {
      const found = shapes.get(id) as Located;
      checkLock(found.shape);
      const list = listOf(found.parent);
      const position = list.indexOf(found.shape);
      list.splice(position, 1);
      const gone = new Set(subtreeIds(found.shape));
      for (const each of gone) shapes.delete(each);
      const restore: CanvasOperation[] = [
        { op: 'add', shape: copy(found.shape), parent: found.parent?.id ?? null, index: position },
      ];
      // Connectors attached to anything removed go with it; ascending indexes restore their order.
      const kept: CanvasConnector[] = [];
      next.connectors.forEach((connector, i) => {
        const attached =
          ('shape' in connector.from && gone.has(connector.from.shape)) ||
          ('shape' in connector.to && gone.has(connector.to.shape));
        if (attached) {
          connectorIds.delete(connector.id);
          restore.push({ op: 'connect', connector: copy(connector), index: i });
        } else kept.push(connector);
      });
      next.connectors = kept;
      // A group left empty is removed with it (and restored first).
      if (found.parent?.type === 'group' && found.parent.children.length === 0)
        return [...removeShape(found.parent.id), ...restore];
      return restore;
    };

    for (at = 0; at < ops.length; at += 1) {
      const op = ops[at] as CanvasOperation;
      if (!isRecord(op)) fail('invalid-op', 'An operation is an object.');
      let undo: CanvasOperation[] = [];
      switch (op.op) {
        case 'add': {
          if (!isRecord(op.shape) || typeof op.shape.id !== 'string')
            fail('invalid-op', 'add needs a shape with an id.');
          const shape = copy(op.shape);
          const parent = container(op.parent);
          if (parent) checkLock(parent);
          const before = shapes.size;
          for (const id of subtreeIds(shape))
            if (usedId(id)) fail('duplicate-id', `The id "${id}" is already used.`);
          const list = listOf(parent);
          list.splice(clampIndex(op.index, list.length), 0, shape);
          index([shape], parent);
          if (shapes.size - before > CANVAS_LIMITS.shapes)
            fail('limit', `At most ${CANVAS_LIMITS.shapes} shapes.`);
          undo.push({ op: 'remove', id: shape.id });
          break;
        }
        case 'remove': {
          if (typeof op.id !== 'string') fail('invalid-op', 'remove needs an id.');
          if (shapes.has(op.id)) undo = removeShape(op.id);
          else if (connectorIds.has(op.id)) {
            const i = next.connectors.findIndex((c) => c.id === op.id);
            const [connector] = next.connectors.splice(i, 1);
            connectorIds.delete(op.id);
            undo.push({ op: 'connect', connector: connector as CanvasConnector, index: i });
          } else fail('unknown-id', `No shape or connector "${op.id}".`);
          break;
        }
        case 'update': {
          if (typeof op.id !== 'string' || !isRecord(op.set))
            fail('invalid-op', 'update needs an id and a set object.');
          const target: Record<string, unknown> | undefined = shapes.has(op.id)
            ? ((shapes.get(op.id) as Located).shape as unknown as Record<string, unknown>)
            : (next.connectors.find((c) => c.id === op.id) as unknown as
                | Record<string, unknown>
                | undefined);
          if (!target) fail('unknown-id', `No shape or connector "${op.id}".`);
          const record = target as Record<string, unknown>;
          if (shapes.has(op.id)) {
            const shape = (shapes.get(op.id) as Located).shape;
            // Unlocking is always allowed; every other change to a locked shape is not.
            if (!(Object.keys(op.set).length === 1 && op.set.locked !== undefined))
              checkLock(shape);
          }
          const previous: CanvasPatch = {};
          for (const [key, value] of Object.entries(op.set)) {
            if (UNSAFE.has(key) || FIXED.has(key)) fail('invalid-op', `"${key}" cannot be set.`);
            previous[key] = Object.hasOwn(record, key) ? copy(record[key]) : null;
            if (value === null || value === undefined) delete record[key];
            else record[key] = copy(value);
          }
          undo.push({ op: 'update', id: op.id, set: previous });
          break;
        }
        case 'move': {
          if (typeof op.id !== 'string') fail('invalid-op', 'move needs an id.');
          const found = shapes.get(op.id);
          if (!found) return fail('unknown-id', `No shape "${op.id}".`);
          checkLock(found.shape);
          const parent = container(op.parent);
          if (parent && subtreeIds(found.shape).includes(parent.id))
            fail('cycle', 'A shape cannot move inside itself.');
          const from = listOf(found.parent);
          const position = from.indexOf(found.shape);
          const oldParent = found.parent;
          from.splice(position, 1);
          const to = listOf(parent);
          to.splice(clampIndex(op.index, to.length), 0, found.shape);
          found.parent = parent;
          const back: CanvasOperation = {
            op: 'move',
            id: op.id,
            parent: oldParent?.id ?? null,
            index: position,
          };
          // A group left empty is removed, and restored before the shape moves back.
          undo =
            oldParent?.type === 'group' && oldParent.children.length === 0
              ? [...removeShape(oldParent.id), back]
              : [back];
          break;
        }
        case 'connect': {
          if (!isRecord(op.connector) || typeof op.connector.id !== 'string')
            fail('invalid-op', 'connect needs a connector with an id.');
          if (usedId(op.connector.id))
            fail('duplicate-id', `The id "${op.connector.id}" is already used.`);
          if (next.connectors.length >= CANVAS_LIMITS.connectors)
            fail('limit', `At most ${CANVAS_LIMITS.connectors} connectors.`);
          const connector = copy(op.connector);
          next.connectors.splice(clampIndex(op.index, next.connectors.length), 0, connector);
          connectorIds.add(connector.id);
          undo.push({ op: 'remove', id: connector.id });
          break;
        }
        case 'meta': {
          if (!isRecord(op.set)) fail('invalid-op', 'meta needs a set object.');
          const previous: Record<string, unknown> = {};
          const meta: Record<string, unknown> = { ...(next.meta ?? {}) };
          for (const [key, value] of Object.entries(op.set)) {
            if (!META_KEYS.has(key)) fail('invalid-op', `"${key}" is not canvas metadata.`);
            if (key === 'grid') {
              previous.grid = next.grid ?? null;
              if (value === null || value === undefined) delete next.grid;
              else next.grid = value as number;
              continue;
            }
            previous[key] = meta[key] ?? null;
            if (value === null || value === undefined) delete meta[key];
            else meta[key] = value;
          }
          if (Object.keys(meta).length > 0) next.meta = meta as CanvasMeta;
          else delete next.meta;
          undo.push({ op: 'meta', set: previous });
          break;
        }
        default:
          fail('invalid-op', `Unknown operation "${String((op as { op?: unknown }).op)}".`);
      }
      inverse.push(undo);
    }
  } catch (error) {
    if (error instanceof OpFailure)
      return { ok: false, error: { code: error.code, message: error.message, index: at } };
    return {
      ok: false,
      error: { code: 'invalid-op', message: 'The operation failed.', index: at },
    };
  }
  const checked = validateCanvas(next, { trust: options.trust });
  if (!checked.ok)
    return {
      ok: false,
      error: {
        code: 'invalid-result',
        message: checked.issues[0]?.message ?? 'The result is not a valid canvas.',
        index: -1,
        issues: checked.issues,
      },
    };
  return { ok: true, doc: checked.canvas, inverse: inverse.reverse().flat() };
}
