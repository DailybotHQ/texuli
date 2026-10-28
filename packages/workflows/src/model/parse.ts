import type { WorkflowError, WorkflowOp, WorkflowOpKind } from './types.ts';
import { isPlainRecord } from './values.ts';

type Shape = { readonly [key: string]: Shape | 'value' | 'list' | readonly [Shape] };

const REF: Shape = { node: 'value', port: 'value' };
const NODE: Shape = {
  id: 'value',
  type: 'value',
  label: 'value',
  position: { x: 'value', y: 'value' },
  props: 'value',
  group: 'value',
  metadata: 'value',
};
const EDGE: Shape = { id: 'value', from: REF, to: REF, label: 'value' };
const GROUP: Shape = { id: 'value', label: 'value' };
const MOVE: Shape = { id: 'value', x: 'value', y: 'value' };

/**
 * The keys each op may carry. `value` leaves type checks to the op itself;
 * nested shapes and `[shape]` lists are checked for unknown keys here.
 */
const OPS: Readonly<Record<WorkflowOpKind, Shape>> = {
  addNode: { op: 'value', node: NODE },
  removeNode: { op: 'value', id: 'value' },
  moveNodes: { op: 'value', moves: [MOVE] },
  connect: { op: 'value', edge: EDGE },
  disconnect: { op: 'value', id: 'value' },
  reconnect: { op: 'value', id: 'value', from: REF, to: REF },
  setProps: { op: 'value', id: 'value', label: 'value', props: 'value', unset: 'list' },
  group: { op: 'value', group: GROUP, nodes: 'list' },
  ungroup: { op: 'value', id: 'value' },
  paste: { op: 'value', fragment: { nodes: [NODE], edges: [EDGE], groups: [GROUP] } },
};

function check(value: unknown, shape: Shape, path: string): WorkflowError | undefined {
  if (!isPlainRecord(value)) return { code: 'invalid-op', message: 'Expected an object.', path };
  for (const key of Object.keys(value)) {
    const rule = Object.hasOwn(shape, key) ? shape[key] : undefined;
    const at = `${path}/${key}`;
    if (rule === undefined)
      return { code: 'invalid-op', message: `Unknown field "${key.slice(0, 64)}".`, path: at };
    const field = value[key];
    if (rule === 'value') continue;
    if (rule === 'list') {
      if (!Array.isArray(field))
        return { code: 'invalid-op', message: 'Expected a list.', path: at };
      continue;
    }
    if (Array.isArray(rule)) {
      if (!Array.isArray(field))
        return { code: 'invalid-op', message: 'Expected a list.', path: at };
      for (let i = 0; i < field.length; i++) {
        const error = check(field[i], rule[0] as Shape, `${at}/${i}`);
        if (error) return error;
      }
      continue;
    }
    const error = check(field, rule as Shape, at);
    if (error) return error;
  }
  return undefined;
}

export type ParsedOp = { ok: true; op: WorkflowOp } | { ok: false; error: WorkflowError };

/**
 * Check the shape of one op from untrusted JSON (an agent patch, a peer, a
 * clipboard): a known kind and no unknown fields at any depth. Values are
 * checked when the op is applied, against the registry and the graph.
 */
export function parseWorkflowOp(input: unknown): ParsedOp {
  if (!isPlainRecord(input) || typeof input.op !== 'string' || !Object.hasOwn(OPS, input.op)) {
    return {
      ok: false,
      error: { code: 'invalid-op', message: 'Unknown or missing op kind.', path: '/op' },
    };
  }
  const error = check(input, OPS[input.op as WorkflowOpKind], '');
  return error ? { ok: false, error } : { ok: true, op: input as WorkflowOp };
}

export type ParsedOps = { ok: true; ops: WorkflowOp[] } | { ok: false; error: WorkflowError };

/** Check a list of ops; the first bad op is reported with its index. */
export function parseWorkflowOps(input: unknown, maxOps = 5000): ParsedOps {
  if (!Array.isArray(input) || input.length > maxOps) {
    return {
      ok: false,
      error: { code: 'invalid-op', message: `Expected a list of at most ${maxOps} ops.` },
    };
  }
  const ops: WorkflowOp[] = [];
  for (let i = 0; i < input.length; i++) {
    const parsed = parseWorkflowOp(input[i]);
    if (!parsed.ok) return { ok: false, error: { ...parsed.error, opIndex: i } };
    ops.push(parsed.op);
  }
  return { ok: true, ops };
}
