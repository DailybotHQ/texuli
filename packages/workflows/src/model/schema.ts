/**
 * The workflow document: its version, its canonical JSON and its parser.
 * This module is the one place that owns the serialized shape, so the spec
 * lane can adopt it as `schemas/workflow.schema.json` without hunting.
 */
import { findCycleEdge } from './cycles.ts';
import { GraphDraft } from './draft.ts';
import { addGroup, addNode, connect, type WorkflowContext } from './ops.ts';
import type {
  CyclePolicy,
  WorkflowEdge,
  WorkflowError,
  WorkflowGraph,
  WorkflowGroup,
  WorkflowNode,
  WorkflowScalar,
} from './types.ts';
import { checkMetadata, isPlainRecord, resolveLimits, WORKFLOW_LIMITS } from './values.ts';

/** The workflow schema draft this module reads and writes. */
export const WORKFLOW_SCHEMA_VERSION = '0.1';

export interface WorkflowDiagnostic {
  code: WorkflowError['code'];
  message: string;
  /** JSON Pointer into the document. */
  path: string;
}

export type ParsedWorkflow =
  | { ok: true; graph: WorkflowGraph }
  | { ok: false; diagnostics: readonly WorkflowDiagnostic[] };

/** An empty graph. */
export function createWorkflow(
  options: { cycles?: CyclePolicy; metadata?: Record<string, WorkflowScalar> } = {}
): WorkflowGraph {
  return {
    version: WORKFLOW_SCHEMA_VERSION,
    cycles: options.cycles ?? 'forbid',
    nodes: [],
    edges: [],
    groups: [],
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

const TOP_KEYS = new Set(['version', 'cycles', 'nodes', 'edges', 'groups', 'metadata']);

/**
 * Parse a workflow document from untrusted JSON. Counts are checked before
 * anything else, so an oversized document is refused without being walked.
 * Every node, edge and group is rebuilt from known fields through the same
 * checks the ops use, and every problem is reported with its path.
 */
export function parseWorkflow(input: unknown, context: WorkflowContext): ParsedWorkflow {
  const limits = resolveLimits(context.limits);
  const diagnostics: WorkflowDiagnostic[] = [];
  const refuse = (code: WorkflowError['code'], message: string, path: string): ParsedWorkflow => ({
    ok: false,
    diagnostics: [{ code, message, path }],
  });
  if (!isPlainRecord(input)) return refuse('invalid-value', 'A workflow must be an object.', '');
  for (const key of Object.keys(input)) {
    if (!TOP_KEYS.has(key))
      return refuse('invalid-value', `Unknown field "${key.slice(0, 64)}".`, `/${key}`);
  }
  if (input.version !== WORKFLOW_SCHEMA_VERSION) {
    return refuse('invalid-value', `Expected version "${WORKFLOW_SCHEMA_VERSION}".`, '/version');
  }
  const cycles = input.cycles ?? 'forbid';
  if (cycles !== 'allow' && cycles !== 'forbid') {
    return refuse('invalid-value', 'Cycles must be "allow" or "forbid".', '/cycles');
  }
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];
  const groups = input.groups ?? [];
  for (const [name, list, max] of [
    ['nodes', nodes, limits.maxNodes],
    ['edges', edges, limits.maxEdges],
    ['groups', groups, limits.maxGroups],
  ] as const) {
    if (!Array.isArray(list))
      return refuse('invalid-value', `"${name}" must be a list.`, `/${name}`);
    if (list.length > max)
      return refuse('limit', `A workflow holds at most ${max} ${name}.`, `/${name}`);
  }
  const graph = createWorkflow({ cycles });
  if (input.metadata !== undefined) {
    const metadata = checkMetadata(input.metadata, limits);
    if (!metadata.ok)
      diagnostics.push({ ...metadata.error, path: `/metadata${metadata.error.path ?? ''}` });
    else if (Object.keys(metadata.value).length > 0) graph.metadata = metadata.value;
  }

  const draft = new GraphDraft(graph, context.registry, limits);
  const record = (result: { ok: true } | { ok: false; error: WorkflowError }, path: string) => {
    if (!result.ok) {
      diagnostics.push({
        code: result.error.code,
        message: result.error.message,
        path: path + (result.error.path ?? ''),
      });
    }
  };
  for (const [i, group] of (groups as unknown[]).entries()) {
    record(addGroup(draft, group), `/groups/${i}`);
  }
  for (const [i, node] of (nodes as unknown[]).entries())
    record(addNode(draft, node), `/nodes/${i}`);
  // Edges skip the per-edge cycle walk; one pass below finds any cycle.
  for (const [i, edge] of (edges as unknown[]).entries()) {
    record(connect(draft, edge, false), `/edges/${i}`);
  }

  if (cycles === 'forbid') {
    const closing = findCycleEdge(draft.nodes.keys(), draft.edges.values());
    if (closing !== undefined) {
      const index = (edges as unknown[]).findIndex(
        (edge) => isPlainRecord(edge) && edge.id === closing
      );
      diagnostics.push({
        code: 'cycle',
        message: `Edge "${closing}" is part of a cycle, and this workflow forbids cycles.`,
        path: `/edges/${index}`,
      });
    }
  }
  if (diagnostics.length > 0) return { ok: false, diagnostics };
  return { ok: true, graph: draft.toGraph() };
}

// ---------------------------------------------------------------------------
// Canonical JSON.
// ---------------------------------------------------------------------------

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sortedRecord(
  record: Readonly<Record<string, WorkflowScalar>>
): Record<string, WorkflowScalar> {
  const out: Record<string, WorkflowScalar> = {};
  for (const key of Object.keys(record).sort()) {
    const value = record[key] as WorkflowScalar;
    Object.defineProperty(out, key, {
      value: typeof value === 'number' && Object.is(value, -0) ? 0 : value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

const zero = (value: number) => (Object.is(value, -0) ? 0 : value);

/**
 * The canonical form: entities sorted by id, keys in a fixed order, empty
 * optional fields left out, `-0` written as `0`. Two graphs that mean the
 * same thing have the same canonical JSON, whatever order they were built in.
 */
export function toWorkflowJson(graph: WorkflowGraph): WorkflowGraph {
  const groups = [...graph.groups]
    .sort(byId)
    .map((group): WorkflowGroup => ({ id: group.id, label: group.label }));
  const nodes = [...graph.nodes].sort(byId).map((node): WorkflowNode => {
    const out: WorkflowNode = {
      id: node.id,
      type: node.type,
      label: node.label,
      position: { x: zero(node.position.x), y: zero(node.position.y) },
    };
    if (node.group !== undefined) out.group = node.group;
    if (node.props && Object.keys(node.props).length > 0) out.props = sortedRecord(node.props);
    if (node.metadata && Object.keys(node.metadata).length > 0)
      out.metadata = sortedRecord(node.metadata);
    return out;
  });
  const edges = [...graph.edges].sort(byId).map((edge): WorkflowEdge => {
    const out: WorkflowEdge = {
      id: edge.id,
      from: { node: edge.from.node, port: edge.from.port },
      to: { node: edge.to.node, port: edge.to.port },
    };
    if (edge.label !== undefined && edge.label !== '') out.label = edge.label;
    return out;
  });
  const out: WorkflowGraph = { version: graph.version, cycles: graph.cycles, nodes, edges, groups };
  if (graph.metadata && Object.keys(graph.metadata).length > 0)
    out.metadata = sortedRecord(graph.metadata);
  return out;
}

/** The canonical JSON text of a graph (see {@link toWorkflowJson}). */
export function stringifyWorkflow(graph: WorkflowGraph, space?: number): string {
  return JSON.stringify(toWorkflowJson(graph), null, space);
}

// ---------------------------------------------------------------------------
// The draft JSON Schema (2020-12) for the document above.
// ---------------------------------------------------------------------------

const id = { type: 'string', pattern: '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$' } as const;
const label = { type: 'string', maxLength: WORKFLOW_LIMITS.maxLabelLength } as const;
const scalars = {
  type: 'object',
  maxProperties: WORKFLOW_LIMITS.maxMetadataEntries,
  propertyNames: { pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$' },
  additionalProperties: { type: ['string', 'number', 'boolean'] },
} as const;
const coordinate = {
  type: 'number',
  minimum: -WORKFLOW_LIMITS.maxCoordinate,
  maximum: WORKFLOW_LIMITS.maxCoordinate,
} as const;
const portRef = {
  type: 'object',
  required: ['node', 'port'],
  additionalProperties: false,
  properties: { node: id, port: id },
} as const;

/**
 * Structural JSON Schema for a workflow document. Registry rules (known
 * types, ports, prop kinds, compatibility, cardinality, cycles, the URL
 * policy and text safety) are semantic and enforced by {@link parseWorkflow}.
 */
export const WORKFLOW_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://texuli.com/schemas/workflow.schema.json',
  title: 'Texuli workflow',
  type: 'object',
  required: ['version', 'nodes', 'edges'],
  additionalProperties: false,
  properties: {
    version: { const: WORKFLOW_SCHEMA_VERSION },
    cycles: { enum: ['allow', 'forbid'], default: 'forbid' },
    metadata: scalars,
    groups: {
      type: 'array',
      maxItems: WORKFLOW_LIMITS.maxGroups,
      items: {
        type: 'object',
        required: ['id', 'label'],
        additionalProperties: false,
        properties: { id, label },
      },
    },
    nodes: {
      type: 'array',
      maxItems: WORKFLOW_LIMITS.maxNodes,
      items: {
        type: 'object',
        required: ['id', 'type', 'label', 'position'],
        additionalProperties: false,
        properties: {
          id,
          type: id,
          label,
          position: {
            type: 'object',
            required: ['x', 'y'],
            additionalProperties: false,
            properties: { x: coordinate, y: coordinate },
          },
          group: id,
          props: { ...scalars, maxProperties: WORKFLOW_LIMITS.maxPropsPerNode },
          metadata: scalars,
        },
      },
    },
    edges: {
      type: 'array',
      maxItems: WORKFLOW_LIMITS.maxEdges,
      items: {
        type: 'object',
        required: ['id', 'from', 'to'],
        additionalProperties: false,
        properties: { id, from: portRef, to: portRef, label },
      },
    },
  },
} as const;
