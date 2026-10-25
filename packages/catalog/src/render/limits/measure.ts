import type { LimitDiagnostic, TreeMetrics } from './types.ts';

const ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Canonical JSON for byte budgets: sorted keys, no whitespace, finite numbers only.
 * Cycles and non-JSON values are replaced with null so measurement always finishes.
 */
export function canonicalTreeJson(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return 'null';
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
      const parts = value.map((item) => canonicalTreeJson(item, seen));
      return `[${parts.join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => {
      const encodedKey = JSON.stringify(key);
      const encodedValue = canonicalTreeJson(record[key], seen);
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
