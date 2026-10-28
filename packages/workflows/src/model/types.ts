/**
 * Workflow graph types. Everything here is plain JSON data, so a graph, an
 * op and a fragment serialize, travel to a server or a peer, and come back
 * unchanged. Nodes, edges and groups share one id namespace.
 */

/** A prop or metadata value: scalars only, so nothing nests or executes. */
export type WorkflowScalar = string | number | boolean;

export type PortDirection = 'in' | 'out';

/** How many edges a port accepts: exactly one, or any number. */
export type PortCardinality = 'one' | 'many';

/** What a cycle does to a graph: `forbid` refuses the edge that closes one. */
export type CyclePolicy = 'allow' | 'forbid';

export interface Point {
  x: number;
  y: number;
}

/** A typed port declared by a node type. */
export interface PortSpec {
  id: string;
  direction: PortDirection;
  /** Data type name. `any` connects to every type. */
  dataType: string;
  /** Default `many`. */
  cardinality?: PortCardinality;
  label?: string;
}

/**
 * The closed prop kinds. `url` and `image` values pass the core URL policy at
 * the `untrusted` tier, and the stored value is the one the policy returns.
 */
export type PropSpec =
  | { kind: 'text'; label?: string; maxLength?: number; default?: string }
  | { kind: 'number'; label?: string; min?: number; max?: number; default?: number }
  | { kind: 'boolean'; label?: string; default?: boolean }
  | { kind: 'enum'; label?: string; values: readonly string[]; default?: string }
  | { kind: 'url'; label?: string }
  | { kind: 'image'; label?: string };

export type PropKind = PropSpec['kind'];

/** One entry of the closed node-type registry. */
export interface NodeTypeSpec {
  type: string;
  label: string;
  description?: string;
  /** A palette grouping, such as `trigger` or `action`. */
  category?: string;
  ports: readonly PortSpec[];
  /** The props a node of this type may carry; any other prop is refused. */
  props?: Readonly<Record<string, PropSpec>>;
}

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  /** Top-left corner in graph coordinates. */
  position: Point;
  props?: Readonly<Record<string, WorkflowScalar>>;
  /** The id of the group holding this node. */
  group?: string;
  metadata?: Readonly<Record<string, WorkflowScalar>>;
}

export interface PortRef {
  node: string;
  port: string;
}

/** A directed edge from an `out` port to an `in` port. */
export interface WorkflowEdge {
  id: string;
  from: PortRef;
  to: PortRef;
  label?: string;
}

export interface WorkflowGroup {
  id: string;
  label: string;
}

export interface WorkflowGraph {
  /** The workflow schema draft this graph follows. */
  version: string;
  cycles: CyclePolicy;
  nodes: readonly WorkflowNode[];
  edges: readonly WorkflowEdge[];
  groups: readonly WorkflowGroup[];
  metadata?: Readonly<Record<string, WorkflowScalar>>;
}

/** A self-contained piece of a graph: what copy produces and paste consumes. */
export interface WorkflowFragment {
  nodes: readonly WorkflowNode[];
  /** Only edges between the fragment's own nodes. */
  edges: readonly WorkflowEdge[];
  groups: readonly WorkflowGroup[];
}

export interface NodeMove {
  id: string;
  x: number;
  y: number;
}

/**
 * The closed edit vocabulary for a workflow graph, mirroring the catalog's
 * edit ops: plain JSON, applied all or none, each with an exact inverse.
 */
export type WorkflowOp =
  /** Add a node. Its type must be in the registry; its group must exist. */
  | { op: 'addNode'; node: WorkflowNode }
  /** Remove a node and every edge touching it. */
  | { op: 'removeNode'; id: string }
  /** Set absolute positions (a drag step, an auto-layout, a nudge). */
  | { op: 'moveNodes'; moves: readonly NodeMove[] }
  /** Add an edge from an `out` port to an `in` port. */
  | { op: 'connect'; edge: WorkflowEdge }
  /** Remove an edge. */
  | { op: 'disconnect'; id: string }
  /** Move one or both ends of an edge, keeping its id and label. */
  | { op: 'reconnect'; id: string; from?: PortRef; to?: PortRef }
  /**
   * Set the label of a node, edge or group, and set or unset node props.
   * Props apply only to nodes.
   */
  | {
      op: 'setProps';
      id: string;
      label?: string;
      props?: Readonly<Record<string, WorkflowScalar>>;
      unset?: readonly string[];
    }
  /** Create a group holding `nodes` (none may already be grouped). */
  | { op: 'group'; group: WorkflowGroup; nodes: readonly string[] }
  /** Remove a group; its nodes stay, ungrouped. */
  | { op: 'ungroup'; id: string }
  /** Add a fragment whose ids are all new (see `prepareFragment`). */
  | { op: 'paste'; fragment: WorkflowFragment };

export type WorkflowOpKind = WorkflowOp['op'];

/** Why an op or a document was refused. A refused op never changes the graph. */
export type WorkflowErrorCode =
  | 'invalid-op'
  | 'invalid-value'
  | 'unknown-type'
  | 'unknown-id'
  | 'unknown-port'
  | 'duplicate-id'
  | 'port-direction'
  | 'port-type'
  | 'cardinality'
  | 'duplicate-edge'
  | 'cycle'
  | 'limit'
  | 'unsafe-url'
  | 'unsafe-text'
  | 'already-grouped'
  | 'validation-failed';

export interface WorkflowError {
  code: WorkflowErrorCode;
  message: string;
  /** Index of the failing op in a batch. */
  opIndex?: number;
  /** JSON Pointer into the op or document that failed, when known. */
  path?: string;
  /** Diagnostics from a host commit gate, for `validation-failed`. */
  diagnostics?: readonly unknown[];
}

export type WorkflowResult =
  | {
      ok: true;
      graph: WorkflowGraph;
      /** Ops that restore the previous graph, in the order to apply them. */
      inverse: readonly WorkflowOp[];
      /** False when the ops left the graph unchanged. */
      changed: boolean;
    }
  | { ok: false; error: WorkflowError };

/** Size and value limits. Hosts may lower them, never raise them. */
export interface WorkflowLimits {
  maxNodes: number;
  maxEdges: number;
  maxGroups: number;
  maxLabelLength: number;
  maxTextLength: number;
  maxPropsPerNode: number;
  maxMetadataEntries: number;
  /** Largest absolute coordinate. */
  maxCoordinate: number;
  /** Most ops in one batch. */
  maxOps: number;
}
