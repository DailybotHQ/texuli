/**
 * The one adapter between the editor's runtime document (`WORKFLOW_SCHEMA_VERSION`
 * '0.1', see `schema.ts`) and the interchange contract `@texuli/spec`
 * `schemas/workflow.schema.json` (`WorkflowGraph`, version 1).
 *
 * The spec types are mirrored structurally here, so this package does not
 * depend on `@texuli/spec`. Import is safe for untrusted input: the result is
 * built through `parseWorkflow`, so every model check (closed registry, ports,
 * cardinality, cycles, limits, the URL policy, text safety) still applies.
 * What one side cannot express is reported, never silently invented.
 */
import { defineNodeTypes, type NodeTypeRegistry } from './registry.ts';
import { parseWorkflow, WORKFLOW_SCHEMA_VERSION, type WorkflowDiagnostic } from './schema.ts';
import type {
  NodeTypeSpec,
  PortSpec,
  PropSpec,
  WorkflowGraph,
  WorkflowLimits,
  WorkflowNode,
  WorkflowScalar,
} from './types.ts';
import { isPlainRecord } from './values.ts';

export interface SpecWorkflowPort {
  id: string;
  direction: 'in' | 'out';
  label?: string;
  /** Ports with a kind connect only to the same kind; none connects to all. */
  kind?: string;
  /** Takes more than one edge. */
  multiple?: boolean;
}

export interface SpecWorkflowField {
  name: string;
  label?: string;
  kind: 'string' | 'number' | 'boolean' | 'enum';
  required?: boolean;
  enumValues?: string[];
  maxLength?: number;
}

export interface SpecWorkflowNodeType {
  id: string;
  label: string;
  category?: string;
  ports: SpecWorkflowPort[];
  fields?: SpecWorkflowField[];
}

export interface SpecWorkflowNode {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  group?: string;
  data?: Record<string, WorkflowScalar>;
  locked?: boolean;
}

export interface SpecWorkflowEdge {
  id: string;
  from: { node: string; port: string };
  to: { node: string; port: string };
  label?: string;
}

export interface SpecWorkflowGroup {
  id: string;
  label: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface SpecWorkflowViewport {
  x: number;
  y: number;
  zoom: number;
}

/** Structural mirror of `@texuli/spec` `WorkflowGraph`. */
export interface SpecWorkflowGraph {
  version: 1;
  nodeTypes: SpecWorkflowNodeType[];
  nodes: SpecWorkflowNode[];
  edges: SpecWorkflowEdge[];
  groups?: SpecWorkflowGroup[];
  cycles?: 'allow' | 'forbid';
  viewport?: SpecWorkflowViewport;
}

/** Spec limits that are tighter than the model's. */
export const SPEC_WORKFLOW_LIMITS = Object.freeze({
  maxNodeTypes: 64,
  maxPorts: 16,
  maxFields: 32,
  maxGroups: 64,
});

const SPEC_KIND = /^[a-z][a-z0-9-]{0,31}$/;
const SPEC_FIELD = /^[a-z][A-Za-z0-9_]{0,31}$/;
// The spec label refuses C0 and C1 controls and bidi overrides or isolates.
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target
const SPEC_UNSAFE = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;

export type ToSpecResult =
  | {
      ok: true;
      graph: SpecWorkflowGraph;
      /** JSON Pointers of model data the spec cannot hold (left out or widened). */
      dropped: string[];
    }
  | { ok: false; diagnostics: WorkflowDiagnostic[] };

export type FromSpecResult =
  | {
      ok: true;
      graph: WorkflowGraph;
      /** The registry the graph was checked against (the host's, or one built from `nodeTypes`). */
      registry: NodeTypeRegistry;
      viewport?: SpecWorkflowViewport;
      dropped: string[];
    }
  | { ok: false; diagnostics: WorkflowDiagnostic[] };

function specField(name: string, prop: PropSpec): { field: SpecWorkflowField; widened: boolean } {
  const label = prop.label === undefined ? {} : { label: prop.label };
  switch (prop.kind) {
    case 'text':
      return {
        field: {
          name,
          kind: 'string',
          ...label,
          ...(prop.maxLength === undefined ? {} : { maxLength: prop.maxLength }),
        },
        widened: false,
      };
    case 'number':
      return {
        field: { name, kind: 'number', ...label },
        widened: prop.min !== undefined || prop.max !== undefined,
      };
    case 'boolean':
      return { field: { name, kind: 'boolean', ...label }, widened: false };
    case 'enum':
      return {
        field: { name, kind: 'enum', ...label, enumValues: [...prop.values] },
        widened: false,
      };
    default:
      // `url` and `image` are strings in the spec; the URL policy is a model rule.
      return { field: { name, kind: 'string', ...label }, widened: true };
  }
}

/**
 * Convert a model graph to the spec `WorkflowGraph`. Node types come from
 * `registry` (every type, or only the used ones when there are more than 64).
 * `metadata.locked`, `metadata.width` and `metadata.height` map to `locked`
 * and `size`; any other metadata, prop ranges and the URL kinds are listed
 * in `dropped`. Values the spec refuses (port data types, prop names,
 * labels) are diagnostics.
 */
export function toSpecWorkflow(
  graph: WorkflowGraph,
  registry: NodeTypeRegistry,
  options: { viewport?: SpecWorkflowViewport } = {}
): ToSpecResult {
  const diagnostics: WorkflowDiagnostic[] = [];
  const dropped: string[] = [];
  const problem = (
    path: string,
    message: string,
    code: WorkflowDiagnostic['code'] = 'invalid-value'
  ) => diagnostics.push({ code, message, path });
  const label = (value: string, path: string, fallback: string): string => {
    if (SPEC_UNSAFE.test(value)) {
      problem(path, 'The spec refuses control characters in labels.', 'unsafe-text');
      return value;
    }
    if (value === '') {
      dropped.push(path);
      return fallback;
    }
    return value;
  };

  const used = new Set(graph.nodes.map((node) => node.type));
  let typeIds = [...registry.types];
  if (typeIds.length > SPEC_WORKFLOW_LIMITS.maxNodeTypes)
    typeIds = typeIds.filter((type) => used.has(type));
  if (typeIds.length > SPEC_WORKFLOW_LIMITS.maxNodeTypes) {
    problem(
      '/nodeTypes',
      `The spec holds at most ${SPEC_WORKFLOW_LIMITS.maxNodeTypes} node types.`,
      'limit'
    );
  }
  const nodeTypes = typeIds.map((id, i): SpecWorkflowNodeType => {
    const spec = registry.get(id) as NodeTypeSpec;
    const path = `/nodeTypes/${i}`;
    if (spec.ports.length > SPEC_WORKFLOW_LIMITS.maxPorts) {
      problem(
        `${path}/ports`,
        `The spec holds at most ${SPEC_WORKFLOW_LIMITS.maxPorts} ports.`,
        'limit'
      );
    }
    const ports = spec.ports.map((port: PortSpec, j): SpecWorkflowPort => {
      const out: SpecWorkflowPort = { id: port.id, direction: port.direction };
      if (port.label !== undefined)
        out.label = label(port.label, `${path}/ports/${j}/label`, port.id);
      if (port.dataType !== 'any') {
        if (!SPEC_KIND.test(port.dataType)) {
          problem(
            `${path}/ports/${j}/kind`,
            `Data type "${port.dataType}" is not a spec port kind.`
          );
        }
        out.kind = port.dataType;
      }
      if (port.cardinality !== 'one') out.multiple = true;
      return out;
    });
    const out: SpecWorkflowNodeType = { id, label: label(spec.label, `${path}/label`, id), ports };
    if (spec.category !== undefined) out.category = label(spec.category, `${path}/category`, id);
    const props = Object.entries(spec.props ?? {});
    if (props.length > SPEC_WORKFLOW_LIMITS.maxFields) {
      problem(
        `${path}/fields`,
        `The spec holds at most ${SPEC_WORKFLOW_LIMITS.maxFields} fields.`,
        'limit'
      );
    }
    if (props.length > 0) {
      out.fields = props.map(([name, prop], j) => {
        if (!SPEC_FIELD.test(name))
          problem(`${path}/fields/${j}/name`, `"${name}" is not a spec field name.`);
        const { field, widened } = specField(name, prop);
        if (widened) dropped.push(`${path}/fields/${j}/kind`);
        return field;
      });
    }
    return out;
  });

  const nodes = graph.nodes.map((node, i): SpecWorkflowNode => {
    const path = `/nodes/${i}`;
    const typeLabel = registry.get(node.type)?.label ?? node.type;
    const out: SpecWorkflowNode = {
      id: node.id,
      type: node.type,
      label: label(node.label, `${path}/label`, typeLabel),
      position: { x: node.position.x, y: node.position.y },
    };
    if (node.group !== undefined) out.group = node.group;
    if (node.props && Object.keys(node.props).length > 0) out.data = { ...node.props };
    const { locked, width, height, ...rest } = node.metadata ?? {};
    if (typeof locked === 'boolean') out.locked = locked;
    if (typeof width === 'number' && typeof height === 'number') out.size = { width, height };
    for (const key of Object.keys(rest)) dropped.push(`${path}/metadata/${key}`);
    return out;
  });
  const edges = graph.edges.map((edge, i): SpecWorkflowEdge => {
    const out: SpecWorkflowEdge = { id: edge.id, from: { ...edge.from }, to: { ...edge.to } };
    if (edge.label) out.label = label(edge.label, `/edges/${i}/label`, edge.id);
    return out;
  });
  if (graph.groups.length > SPEC_WORKFLOW_LIMITS.maxGroups) {
    problem('/groups', `The spec holds at most ${SPEC_WORKFLOW_LIMITS.maxGroups} groups.`, 'limit');
  }
  if (graph.metadata && Object.keys(graph.metadata).length > 0) dropped.push('/metadata');
  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const out: SpecWorkflowGraph = { version: 1, nodeTypes, nodes, edges, cycles: graph.cycles };
  if (graph.groups.length > 0) {
    out.groups = graph.groups.map((group, i) => ({
      id: group.id,
      label: label(group.label, `/groups/${i}/label`, group.id),
    }));
  }
  if (options.viewport) out.viewport = { ...options.viewport };
  return { ok: true, graph: out, dropped };
}

function modelProp(field: Record<string, unknown>): PropSpec | undefined {
  const label = typeof field.label === 'string' ? { label: field.label } : {};
  switch (field.kind) {
    case 'string':
      return {
        kind: 'text',
        ...label,
        ...(typeof field.maxLength === 'number' ? { maxLength: field.maxLength } : {}),
      };
    case 'number':
      return { kind: 'number', ...label };
    case 'boolean':
      return { kind: 'boolean', ...label };
    case 'enum':
      return Array.isArray(field.enumValues) &&
        field.enumValues.every((value) => typeof value === 'string')
        ? { kind: 'enum', ...label, values: field.enumValues as string[] }
        : undefined;
    default:
      return undefined;
  }
}

/** A spec node type as a model type spec (shape-checked; `defineNodeTypes` checks the rest). */
function modelType(
  input: unknown,
  path: string,
  diagnostics: WorkflowDiagnostic[]
): NodeTypeSpec | undefined {
  if (
    !isPlainRecord(input) ||
    typeof input.id !== 'string' ||
    typeof input.label !== 'string' ||
    !Array.isArray(input.ports)
  ) {
    diagnostics.push({
      code: 'invalid-value',
      message: 'A node type needs an id, a label and ports.',
      path,
    });
    return undefined;
  }
  if (input.ports.length > SPEC_WORKFLOW_LIMITS.maxPorts) {
    diagnostics.push({ code: 'limit', message: 'Too many ports.', path: `${path}/ports` });
    return undefined;
  }
  const ports: PortSpec[] = [];
  for (const [j, port] of input.ports.entries()) {
    if (
      !isPlainRecord(port) ||
      typeof port.id !== 'string' ||
      (port.direction !== 'in' && port.direction !== 'out')
    ) {
      diagnostics.push({
        code: 'invalid-value',
        message: 'A port needs an id and a direction.',
        path: `${path}/ports/${j}`,
      });
      return undefined;
    }
    ports.push({
      id: port.id,
      direction: port.direction,
      dataType: typeof port.kind === 'string' ? port.kind : 'any',
      cardinality: port.multiple === true ? 'many' : 'one',
      ...(typeof port.label === 'string' ? { label: port.label } : {}),
    });
  }
  const props: Record<string, PropSpec> = {};
  const fields = Array.isArray(input.fields) ? input.fields : [];
  if (fields.length > SPEC_WORKFLOW_LIMITS.maxFields) {
    diagnostics.push({ code: 'limit', message: 'Too many fields.', path: `${path}/fields` });
    return undefined;
  }
  for (const [j, field] of fields.entries()) {
    const prop =
      isPlainRecord(field) && typeof field.name === 'string' && SPEC_FIELD.test(field.name)
        ? modelProp(field)
        : undefined;
    if (prop === undefined || !isPlainRecord(field)) {
      diagnostics.push({
        code: 'invalid-value',
        message: 'A field needs a name and a known kind.',
        path: `${path}/fields/${j}`,
      });
      return undefined;
    }
    Object.defineProperty(props, field.name as string, { value: prop, enumerable: true });
  }
  return {
    type: input.id,
    label: input.label,
    ports,
    ...(typeof input.category === 'string' ? { category: input.category } : {}),
    ...(fields.length > 0 ? { props } : {}),
  };
}

/** `/nodes/0/props/url` → `$.nodes[0].data.url`, the spec's path style. */
export function toSpecPath(pointer: string): string {
  let out = '$';
  let previous = '';
  for (const part of pointer.split('/').slice(1)) {
    const name = previous !== '' && /^\d+$/.test(previous) && part === 'props' ? 'data' : part;
    out += /^\d+$/.test(name) ? `[${name}]` : `.${name}`;
    previous = part;
  }
  return out;
}

/**
 * Convert a spec `WorkflowGraph` (untrusted JSON) to a model graph. With a
 * host `registry`, the document's own `nodeTypes` are ignored and nodes must
 * use the host's types: the registry stays host-controlled. Without one, a
 * registry is built from `nodeTypes`. Spec `required` fields are checked here,
 * since the model has no required props. Diagnostics use spec paths (`$.nodes[0]…`).
 */
export function fromSpecWorkflow(
  input: unknown,
  options: { registry?: NodeTypeRegistry; limits?: Partial<WorkflowLimits> } = {}
): FromSpecResult {
  const diagnostics: WorkflowDiagnostic[] = [];
  const refuse = (
    path: string,
    message: string,
    code: WorkflowDiagnostic['code'] = 'invalid-value'
  ): FromSpecResult => ({
    ok: false,
    diagnostics: [{ code, message, path }],
  });
  if (!isPlainRecord(input)) return refuse('$', 'A workflow graph must be an object.');
  if (input.version !== 1) return refuse('$.version', 'Expected spec workflow version 1.');
  for (const key of ['nodeTypes', 'nodes', 'edges'] as const) {
    if (!Array.isArray(input[key])) return refuse(`$.${key}`, `"${key}" must be a list.`);
  }
  if (input.groups !== undefined && !Array.isArray(input.groups))
    return refuse('$.groups', '"groups" must be a list.');
  const specTypes = input.nodeTypes as unknown[];
  if (specTypes.length > SPEC_WORKFLOW_LIMITS.maxNodeTypes)
    return refuse('$.nodeTypes', 'Too many node types.', 'limit');
  const groupsIn = (input.groups ?? []) as unknown[];
  if (groupsIn.length > SPEC_WORKFLOW_LIMITS.maxGroups)
    return refuse('$.groups', 'Too many groups.', 'limit');

  let registry = options.registry;
  const required = new Map<string, string[]>();
  if (registry === undefined) {
    const specs: NodeTypeSpec[] = [];
    for (const [i, type] of specTypes.entries()) {
      const spec = modelType(type, `$.nodeTypes[${i}]`, diagnostics);
      if (spec) specs.push(spec);
      if (spec && isPlainRecord(type) && Array.isArray(type.fields)) {
        required.set(
          spec.type,
          type.fields.flatMap((field) =>
            isPlainRecord(field) && field.required === true ? [String(field.name)] : []
          )
        );
      }
    }
    if (diagnostics.length > 0) return { ok: false, diagnostics };
    try {
      registry = defineNodeTypes(specs);
    } catch (error) {
      return refuse('$.nodeTypes', error instanceof Error ? error.message : 'Invalid node types.');
    }
  }

  const dropped: string[] = [];
  const nodes = (input.nodes as unknown[]).map((node, i): unknown => {
    if (!isPlainRecord(node)) return node;
    const { data, size, locked, ...rest } = node;
    const out: Record<string, unknown> = { ...rest };
    if (data !== undefined) out.props = data;
    const metadata: Record<string, WorkflowScalar> = {};
    if (typeof locked === 'boolean') metadata.locked = locked;
    if (isPlainRecord(size) && typeof size.width === 'number' && typeof size.height === 'number') {
      metadata.width = size.width;
      metadata.height = size.height;
    }
    if (Object.keys(metadata).length > 0) out.metadata = metadata;
    for (const name of required.get(String(node.type)) ?? []) {
      if (!isPlainRecord(data) || !Object.hasOwn(data, name)) {
        diagnostics.push({
          code: 'invalid-value',
          message: `"${name}" is required.`,
          path: `$.nodes[${i}].data.${name}`,
        });
      }
    }
    return out;
  });
  const groups = groupsIn.map((group, i) => {
    if (!isPlainRecord(group)) return group;
    const { position, size, ...rest } = group;
    if (position !== undefined || size !== undefined) dropped.push(`$.groups[${i}]`);
    return rest;
  });
  const parsed = parseWorkflow(
    {
      version: WORKFLOW_SCHEMA_VERSION,
      cycles: input.cycles ?? 'allow',
      nodes,
      edges: input.edges,
      groups,
    },
    { registry, ...(options.limits ? { limits: options.limits } : {}) }
  );
  if (!parsed.ok) {
    diagnostics.push(...parsed.diagnostics.map((d) => ({ ...d, path: toSpecPath(d.path) })));
  }
  if (diagnostics.length > 0 || !parsed.ok) return { ok: false, diagnostics };
  const viewport = input.viewport;
  const result: FromSpecResult = { ok: true, graph: parsed.graph, registry, dropped };
  if (
    isPlainRecord(viewport) &&
    typeof viewport.x === 'number' &&
    typeof viewport.y === 'number' &&
    typeof viewport.zoom === 'number' &&
    Number.isFinite(viewport.x + viewport.y + viewport.zoom)
  ) {
    result.viewport = {
      x: viewport.x,
      y: viewport.y,
      zoom: Math.min(4, Math.max(0.1, viewport.zoom)),
    };
  }
  return result;
}

/** A model node's size from `metadata.width/height`, when both are set. */
export function nodeMetadataSize(
  node: WorkflowNode
): { width: number; height: number } | undefined {
  const width = node.metadata?.width;
  const height = node.metadata?.height;
  return typeof width === 'number' && typeof height === 'number' ? { width, height } : undefined;
}
