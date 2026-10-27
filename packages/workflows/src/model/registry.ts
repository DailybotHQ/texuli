import type { NodeTypeSpec, PortDirection, PortSpec, PropSpec } from './types.ts';
import { hasUnsafeText, isPropName, isWorkflowId } from './values.ts';

/** The data type that connects to every other type. */
export const ANY_DATA_TYPE = 'any';

const DATA_TYPE = /^[A-Za-z][A-Za-z0-9_.-]{0,31}$/;
const MAX_NODE_TYPES = 200;
const MAX_PORTS = 32;

export interface NodeTypeRegistryOptions {
  /**
   * Extra compatibility: `{ int: ['number'] }` lets an `int` output feed a
   * `number` input. Equal types and `any` always connect.
   */
  compatibility?: Readonly<Record<string, readonly string[]>>;
}

/** The closed set of node types a graph may use. Frozen once defined. */
export interface NodeTypeRegistry {
  /** Type names in definition order. */
  readonly types: readonly string[];
  get(type: string): NodeTypeSpec | undefined;
  has(type: string): boolean;
  port(type: string, port: string): PortSpec | undefined;
  /** Can a value of `from` flow into a port that takes `to`? */
  compatible(from: string, to: string): boolean;
}

function invalid(message: string): never {
  throw new TypeError(`defineNodeTypes: ${message}`);
}

function checkLabel(value: unknown, where: string): void {
  if (typeof value !== 'string' || value.length > 200 || hasUnsafeText(value)) {
    invalid(`${where} needs a plain text label.`);
  }
}

function checkProp(name: string, spec: PropSpec, where: string): void {
  if (!isPropName(name)) invalid(`${where} prop "${name}" is not an identifier.`);
  const kinds = ['text', 'number', 'boolean', 'enum', 'url', 'image'];
  if (!kinds.includes(spec.kind)) invalid(`${where} prop "${name}" has an unknown kind.`);
  if (spec.kind === 'enum' && (!Array.isArray(spec.values) || spec.values.length === 0)) {
    invalid(`${where} enum prop "${name}" needs values.`);
  }
}

function freezePort(port: PortSpec, where: string): PortSpec {
  if (!isWorkflowId(port.id)) invalid(`${where} has a port with an invalid id.`);
  if (port.direction !== 'in' && port.direction !== 'out') {
    invalid(`${where} port "${port.id}" needs direction "in" or "out".`);
  }
  if (typeof port.dataType !== 'string' || !DATA_TYPE.test(port.dataType)) {
    invalid(`${where} port "${port.id}" has an invalid data type.`);
  }
  if (port.cardinality !== undefined && port.cardinality !== 'one' && port.cardinality !== 'many') {
    invalid(`${where} port "${port.id}" has an invalid cardinality.`);
  }
  if (port.label !== undefined) checkLabel(port.label, `${where} port "${port.id}"`);
  return Object.freeze({ ...port });
}

/**
 * Declare the closed node-type registry. Specs are developer configuration,
 * so a malformed one throws here instead of surfacing later as a refused op.
 */
export function defineNodeTypes(
  specs: readonly NodeTypeSpec[],
  options: NodeTypeRegistryOptions = {}
): NodeTypeRegistry {
  if (specs.length > MAX_NODE_TYPES) invalid(`more than ${MAX_NODE_TYPES} node types.`);
  const byType = new Map<string, NodeTypeSpec>();
  const ports = new Map<string, Map<string, PortSpec>>();
  for (const spec of specs) {
    if (!isWorkflowId(spec.type)) invalid(`type "${String(spec.type)}" is not a valid id.`);
    if (byType.has(spec.type)) invalid(`type "${spec.type}" is declared twice.`);
    const where = `type "${spec.type}"`;
    checkLabel(spec.label, where);
    if (spec.ports.length > MAX_PORTS) invalid(`${where} has more than ${MAX_PORTS} ports.`);
    const portMap = new Map<string, PortSpec>();
    for (const port of spec.ports) {
      if (portMap.has(port.id)) invalid(`${where} declares port "${port.id}" twice.`);
      portMap.set(port.id, freezePort(port, where));
    }
    let props: Readonly<Record<string, PropSpec>> | undefined;
    if (spec.props !== undefined) {
      const copy: Record<string, PropSpec> = {};
      for (const [name, prop] of Object.entries(spec.props)) {
        checkProp(name, prop, where);
        Object.defineProperty(copy, name, { value: Object.freeze({ ...prop }), enumerable: true });
      }
      props = Object.freeze(copy);
    }
    const frozen: NodeTypeSpec = Object.freeze({
      ...spec,
      ports: Object.freeze([...portMap.values()]),
      ...(props === undefined ? {} : { props }),
    });
    byType.set(spec.type, frozen);
    ports.set(spec.type, portMap);
  }

  const extra = new Map<string, Set<string>>();
  for (const [from, targets] of Object.entries(options.compatibility ?? {})) {
    extra.set(from, new Set(targets));
  }
  const types = Object.freeze([...byType.keys()]);

  return Object.freeze({
    types,
    get: (type: string) => byType.get(type),
    has: (type: string) => byType.has(type),
    port: (type: string, port: string) => ports.get(type)?.get(port),
    compatible: (from: string, to: string) =>
      from === to ||
      from === ANY_DATA_TYPE ||
      to === ANY_DATA_TYPE ||
      (extra.get(from)?.has(to) ?? false),
  });
}

/** The ports of a type facing one direction, in declaration order. */
export function portsOf(
  registry: NodeTypeRegistry,
  type: string,
  direction: PortDirection
): readonly PortSpec[] {
  return registry.get(type)?.ports.filter((port) => port.direction === direction) ?? [];
}
