/**
 * Workflow graphs as data (ADR-008): `schemas/workflow.schema.json` checks
 * the shape and the limits, then {@link validateWorkflowGraph} checks what a
 * schema cannot: unique ids, declared types, groups, fields and ports, edge
 * direction and kind, port multiplicity, duplicate edges and the cycle
 * policy. Every pass is linear in nodes plus edges. The Kotlin twin is
 * `native/texuli-spec/.../WorkflowValidator.kt`; both report in this order.
 */

import type { SpecDiagnostic, SpecValidation } from '../generated/typescript/diagnostics.ts';
import { SPEC_LIMITS, SPEC_PATTERNS } from './contract.ts';
import { isRecord, type Schema, validateInstance } from './dialect.ts';

type Bag = Record<string, unknown>;

const bags = (value: unknown): Bag[] =>
  Array.isArray(value) ? value.map((item) => (isRecord(item) ? item : {})) : [];
const text = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const length = (value: string): number => [...value].length;
const WORKFLOW_TEXT = new RegExp(SPEC_PATTERNS.workflowText, 'u');

/**
 * Validate a workflow graph: the schema first (schema issues only, never a
 * cascade), then every graph rule as code `workflow`. Never throws.
 */
export function validateWorkflowGraph(graph: unknown, workflowSchema: Schema): SpecValidation {
  const schemaIssues = validateInstance(workflowSchema, graph);
  if (schemaIssues.length > 0) {
    return {
      ok: false,
      diagnostics: schemaIssues.map((issue) => ({
        code: 'schema',
        path: issue.path,
        message: `${issue.code}: ${issue.message}`,
      })),
    };
  }
  const diagnostics = workflowRules(graph as Bag);
  return { ok: diagnostics.length === 0, diagnostics };
}

interface PortInfo {
  direction: string;
  kind: string | undefined;
  multiple: boolean;
}

interface TypeInfo {
  ports: Map<string, PortInfo>;
  fields: Map<string, Bag>;
  fieldOrder: Bag[];
}

/** The graph rules on a schema-valid graph. */
function workflowRules(graph: Bag): SpecDiagnostic[] {
  const out: SpecDiagnostic[] = [];
  const fail = (path: string, message: string): void => {
    out.push({ code: 'workflow', path, message });
  };

  // Node types: unique ids, unique ports and fields, consistent field rules.
  const types = new Map<string, TypeInfo>();
  bags(graph.nodeTypes).forEach((type, i) => {
    const path = `$.nodeTypes[${i}]`;
    const id = text(type.id) ?? '';
    if (types.has(id)) {
      fail(`${path}.id`, `Node type "${id}" is declared twice.`);
      return;
    }
    const info: TypeInfo = { ports: new Map(), fields: new Map(), fieldOrder: [] };
    bags(type.ports).forEach((port, j) => {
      const portId = text(port.id) ?? '';
      if (info.ports.has(portId)) {
        fail(`${path}.ports[${j}].id`, `Port "${portId}" is declared twice.`);
        return;
      }
      info.ports.set(portId, {
        direction: text(port.direction) ?? '',
        kind: text(port.kind),
        multiple: port.multiple === true,
      });
    });
    bags(type.fields).forEach((field, j) => {
      const here = `${path}.fields[${j}]`;
      const name = text(field.name) ?? '';
      if (info.fields.has(name)) {
        fail(`${here}.name`, `Field "${name}" is declared twice.`);
        return;
      }
      if ((field.kind === 'enum') !== (field.enumValues !== undefined)) {
        fail(here, 'enumValues is required for an enum field and only allowed there.');
        return;
      }
      if (field.maxLength !== undefined && field.kind !== 'string') {
        fail(`${here}.maxLength`, 'maxLength is only allowed on a string field.');
        return;
      }
      if (
        Array.isArray(field.enumValues) &&
        new Set(field.enumValues).size !== field.enumValues.length
      ) {
        fail(`${here}.enumValues`, 'enumValues must be distinct.');
        return;
      }
      info.fields.set(name, field);
      info.fieldOrder.push(field);
    });
    types.set(id, info);
  });

  const groups = new Set<string>();
  bags(graph.groups).forEach((group, i) => {
    const id = text(group.id) ?? '';
    if (groups.has(id)) fail(`$.groups[${i}].id`, `Group "${id}" is declared twice.`);
    groups.add(id);
  });

  // Nodes: unique ids, declared type and group, field values.
  const nodes = new Map<string, TypeInfo | undefined>();
  bags(graph.nodes).forEach((node, i) => {
    const path = `$.nodes[${i}]`;
    const id = text(node.id) ?? '';
    if (nodes.has(id)) {
      fail(`${path}.id`, `Node "${id}" is declared twice.`);
      return;
    }
    const type = types.get(text(node.type) ?? '');
    nodes.set(id, type);
    if (!type) {
      fail(`${path}.type`, `Node type "${String(node.type)}" is not declared.`);
      return;
    }
    if (node.group !== undefined && !groups.has(text(node.group) ?? '')) {
      fail(`${path}.group`, `Group "${String(node.group)}" is not declared.`);
    }
    const data = isRecord(node.data) ? node.data : {};
    for (const [name, value] of Object.entries(data)) {
      const field = type.fields.get(name);
      const here = `${path}.data.${name}`;
      if (!field) fail(here, `"${name}" is not a field of "${String(node.type)}".`);
      else {
        const problem = fieldProblem(field, value);
        if (problem) fail(here, problem);
      }
    }
    for (const field of type.fieldOrder) {
      const name = text(field.name) ?? '';
      if (field.required === true && !Object.hasOwn(data, name)) {
        fail(`${path}.data.${name}`, `"${name}" is required.`);
      }
    }
  });

  // Edges: unique ids, endpoints on declared ports in the right direction,
  // matching kinds, port multiplicity and no duplicate connection.
  const edgeIds = new Set<string>();
  const pairs = new Set<string>();
  const used = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  bags(graph.edges).forEach((edge, i) => {
    const path = `$.edges[${i}]`;
    const id = text(edge.id) ?? '';
    if (edgeIds.has(id)) {
      fail(`${path}.id`, `Edge "${id}" is declared twice.`);
      return;
    }
    edgeIds.add(id);
    const from = endpoint(edge.from, 'out', `${path}.from`, nodes, fail);
    const to = endpoint(edge.to, 'in', `${path}.to`, nodes, fail);
    if (!from || !to) return;
    if (
      from.port.kind !== undefined &&
      to.port.kind !== undefined &&
      from.port.kind !== to.port.kind
    ) {
      fail(path, `A "${from.port.kind}" port cannot connect to a "${to.port.kind}" port.`);
      return;
    }
    const pair = `${from.key}\u0000${to.key}`;
    if (pairs.has(pair)) {
      fail(path, 'These two ports are already connected.');
      return;
    }
    pairs.add(pair);
    for (const [end, label] of [
      [from, 'from'],
      [to, 'to'],
    ] as const) {
      const count = (used.get(end.key) ?? 0) + 1;
      used.set(end.key, count);
      if (!end.port.multiple && count > 1) {
        fail(`${path}.${label}.port`, 'This port takes one edge; set multiple to allow more.');
      }
    }
    const targets = adjacency.get(from.node) ?? [];
    targets.push(to.node);
    adjacency.set(from.node, targets);
  });

  if (graph.cycles === 'forbid' && hasCycle(nodes, adjacency)) {
    fail('$.edges', 'The graph has a cycle, and its cycle policy is "forbid".');
  }
  return out;
}

function endpoint(
  value: unknown,
  direction: 'in' | 'out',
  path: string,
  nodes: ReadonlyMap<string, TypeInfo | undefined>,
  fail: (path: string, message: string) => void
): { node: string; key: string; port: PortInfo } | null {
  const bag = isRecord(value) ? value : {};
  const node = text(bag.node) ?? '';
  const portId = text(bag.port) ?? '';
  if (!nodes.has(node)) {
    fail(`${path}.node`, `Node "${node}" does not exist.`);
    return null;
  }
  const type = nodes.get(node);
  if (!type) return null;
  const port = type.ports.get(portId);
  if (!port) {
    fail(`${path}.port`, `Node "${node}" has no port "${portId}".`);
    return null;
  }
  if (port.direction !== direction) {
    fail(`${path}.port`, `Port "${portId}" is not an ${direction} port.`);
    return null;
  }
  return { node, key: `${node}\u0000${portId}`, port };
}

/** Why `value` does not fit `field`, or `null`. */
function fieldProblem(field: Bag, value: unknown): string | null {
  switch (field.kind) {
    case 'string': {
      if (typeof value !== 'string') return 'Must be a string.';
      const max =
        typeof field.maxLength === 'number' ? field.maxLength : SPEC_LIMITS.workflowStringLength;
      if (length(value) > max) return `At most ${max} characters.`;
      if (!WORKFLOW_TEXT.test(value))
        return 'Control and bidirectional characters are not allowed.';
      return null;
    }
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : 'Must be a finite number.';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Must be a boolean.';
    case 'enum':
      return typeof value === 'string' &&
        Array.isArray(field.enumValues) &&
        field.enumValues.includes(value)
        ? null
        : "Must be one of the field's enumValues.";
    default:
      return 'Unknown field kind.';
  }
}

/** Kahn's algorithm over node ids; a self-loop is a cycle. */
function hasCycle(
  nodes: ReadonlyMap<string, unknown>,
  adjacency: ReadonlyMap<string, readonly string[]>
): boolean {
  const indegree = new Map<string, number>();
  for (const id of nodes.keys()) indegree.set(id, 0);
  for (const targets of adjacency.values()) {
    for (const target of targets) indegree.set(target, (indegree.get(target) ?? 0) + 1);
  }
  const queue: string[] = [];
  for (const [id, degree] of indegree) if (degree === 0) queue.push(id);
  let seen = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head] as string;
    seen += 1;
    for (const target of adjacency.get(id) ?? []) {
      const degree = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, degree);
      if (degree === 0) queue.push(target);
    }
  }
  return seen < indegree.size;
}
