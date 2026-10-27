import type { LimitDiagnostic, TreeMetrics } from './types.ts';

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Deepest node nesting the walker follows (well past `maxDepth`, far below stack limits). */
const MAX_WALK_DEPTH = 1024;
/** Deepest value nesting the snapshot encodes; deeper values become `null`, like cycles. */
const MAX_SNAPSHOT_DEPTH = 256;
/**
 * Deepest value nesting a tree may carry (mirrors the validator's structural
 * limit). Past it the measurer reports `value-depth-exceeded` so the budget
 * fails and the sink-free renderer is never reached — its prop walk is
 * recursive, so a deep enough value would exhaust the stack.
 */
export const MAX_VALUE_MEASURE_DEPTH = 128;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Canonical JSON for byte budgets: sorted keys, no whitespace, finite numbers only.
 * Cycles, non-JSON values and values nested past the snapshot depth cap are
 * replaced with null so measurement always finishes.
 */
export function canonicalTreeJson(value: unknown, seen = new WeakSet<object>(), depth = 0): string {
  if (value === null) return 'null';
  if (depth > MAX_SNAPSHOT_DEPTH) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return 'null';
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return 'null';
    seen.add(value);
    if (Array.isArray(value)) {
      const parts = value.map((item) => canonicalTreeJson(item, seen, depth + 1));
      return `[${parts.join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => {
      const encodedKey = JSON.stringify(key);
      const encodedValue = canonicalTreeJson(record[key], seen, depth + 1);
      return `${encodedKey}:${encodedValue}`;
    });
    return `{${parts.join(',')}}`;
  }
  return 'null';
}

export function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text).byteLength;
  }
  // Fallback for exotic hosts without TextEncoder.
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

interface WalkState {
  nodes: number;
  depth: number;
  branching: number;
  diagnostics: LimitDiagnostic[];
}

function walkNode(
  value: unknown,
  depth: number,
  path: string,
  state: WalkState,
  /** Hard stop so a malicious tree cannot hang the measurer. */
  hardNodeCap: number
): void {
  if (depth > MAX_WALK_DEPTH) {
    state.diagnostics.push({
      code: 'depth-exceeded',
      path,
      message: `Stopped walking past ${MAX_WALK_DEPTH} levels of nodes.`,
      limit: MAX_WALK_DEPTH,
      observed: depth,
    });
    return;
  }
  if (state.nodes >= hardNodeCap) {
    state.diagnostics.push({
      code: 'nodes-exceeded',
      path,
      message: `Stopped measuring after ${hardNodeCap} nodes (hard cap).`,
      limit: hardNodeCap,
      observed: state.nodes,
    });
    return;
  }

  if (!isPlainObject(value)) {
    state.diagnostics.push({
      code: 'invalid-tree',
      path,
      message: 'Catalog node must be a plain object.',
    });
    return;
  }

  state.nodes += 1;
  if (depth > state.depth) state.depth = depth;

  const id = value.id;
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    // Still count the node for DoS; renderer will diagnose id shape.
    state.diagnostics.push({
      code: 'invalid-tree',
      path,
      message: 'Catalog node "id" must be a kebab-case string when measuring limits.',
    });
  }

  const children = value.children;
  if (children === undefined) return;
  if (!Array.isArray(children)) {
    state.diagnostics.push({
      code: 'invalid-tree',
      path: `${path}.children`,
      message: 'Catalog node "children" must be an array when present.',
    });
    return;
  }

  if (children.length > state.branching) state.branching = children.length;

  for (let i = 0; i < children.length; i += 1) {
    if (state.nodes >= hardNodeCap) break;
    walkNode(children[i], depth + 1, `${path}.children.${i}`, state, hardNodeCap);
  }
}

/**
 * Deepest value nesting in the input, iteratively (so a depth bomb cannot
 * exhaust the stack), with the path that reached it. Each object is expanded
 * per depth: a reference back to an object still on the current path is a
 * cycle (reported, never followed), and a shared value is walked again only
 * when reached deeper than before and within the value-depth limit, so the
 * walk always finishes and sharing never hides depth.
 */
function maxValueDepth(input: unknown): {
  depth: number;
  path: string;
  cyclePath: string | null;
} {
  let max = 0;
  let maxPath = '';
  let cyclePath: string | null = null;
  const onPath = new WeakSet<object>();
  const expandedAt = new WeakMap<object, number>();
  type Frame = { value: unknown; depth: number; path: string; exit?: true };
  const stack: Frame[] = [{ value: input, depth: 0, path: '$' }];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    const { value, depth, path } = current;
    if (value === null || typeof value !== 'object') continue;
    if (current.exit) {
      onPath.delete(value);
      continue;
    }
    if (onPath.has(value)) {
      cyclePath ??= path;
      continue;
    }
    if (depth > max) {
      max = depth;
      maxPath = path;
    }
    const seenAt = expandedAt.get(value);
    if (seenAt !== undefined && (depth <= seenAt || depth > MAX_VALUE_MEASURE_DEPTH)) continue;
    expandedAt.set(value, depth);
    onPath.add(value);
    stack.push({ value, depth, path, exit: true });
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        stack.push({ value: item, depth: depth + 1, path: `${path}[${index}]` });
      });
    } else {
      for (const [key, child] of Object.entries(value)) {
        stack.push({ value: child, depth: depth + 1, path: `${path}.${key}` });
      }
    }
  }
  return { depth: max, path: maxPath, cyclePath };
}

export interface MeasureTreeResult {
  metrics: TreeMetrics;
  diagnostics: readonly LimitDiagnostic[];
  /** Canonical JSON used for the byte budget (empty tree → `[]`). */
  snapshot: string;
}

/**
 * Walk an untrusted catalog tree and compute depth, nodes, branching, roots,
 * and a byte budget snapshot. Does not render.
 *
 * @param hardNodeCap - stop walking after this many nodes (default 10_000) so
 *   measurement itself cannot hang.
 */
export function measureCatalogTree(input: unknown, hardNodeCap = 10_000): MeasureTreeResult {
  const state: WalkState = {
    nodes: 0,
    depth: 0,
    branching: 0,
    diagnostics: [],
  };

  let roots = 0;
  if (input === null || input === undefined) {
    roots = 0;
  } else if (Array.isArray(input)) {
    roots = input.length;
    input.forEach((item, index) => {
      if (state.nodes < hardNodeCap) {
        walkNode(item, 1, String(index), state, hardNodeCap);
      }
    });
  } else {
    roots = 1;
    walkNode(input, 1, '0', state, hardNodeCap);
  }

  const snapshot = canonicalTreeJson(input ?? []);
  const bytes = utf8ByteLength(snapshot);

  // Values nested past the structural limit are refused before rendering:
  // the renderer's prop walk is recursive, so it must never see them.
  const valueDepth = maxValueDepth(input);
  if (valueDepth.depth > MAX_VALUE_MEASURE_DEPTH) {
    state.diagnostics.push({
      code: 'value-depth-exceeded',
      path: valueDepth.path,
      message: `Values nest deeper than ${MAX_VALUE_MEASURE_DEPTH} levels (observed ${valueDepth.depth}).`,
      limit: MAX_VALUE_MEASURE_DEPTH,
      observed: valueDepth.depth,
    });
  }
  // A cycle is unbounded nesting: the renderer's recursive prop walk would
  // never finish, so the budget refuses it (JSON input can never carry one).
  if (valueDepth.cyclePath !== null) {
    state.diagnostics.push({
      code: 'value-cycle',
      path: valueDepth.cyclePath,
      message: 'A value refers back to one of its own ancestors (a cycle).',
    });
  }

  const metrics: TreeMetrics = Object.freeze({
    depth: state.depth,
    nodes: state.nodes,
    bytes,
    branching: state.branching,
    roots,
  });

  return {
    metrics,
    diagnostics: Object.freeze([...state.diagnostics]),
    snapshot,
  };
}
