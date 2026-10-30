import { ENVELOPE_FORMAT } from '@texuli/catalog/envelope';
import { DEFAULT_TREE_LIMITS } from '@texuli/catalog/render/limits';
import { DRAFT_TEXT_ALLOWANCE } from '@texuli/catalog/validate';
import {
  checkSourceBinding,
  isSourceBinding,
  type SpecSourceDescriptor,
} from '@texuli/spec/source';
import { sourceShape } from '../sources/shapes.ts';
import { type FlowDeclaration, parseFlowDeclaration } from './flow.ts';
import {
  parseStateDeclarations,
  type StateDeclarations,
  type StateIssue,
  type StateSnapshot,
} from './schema.ts';

/**
 * Format tag of the provisional local-state wrapper (G01). The ADR-003
 * envelope has no state field yet, so a stateful blueprint is
 * `{ format, version: 1, state, flow?, blueprint }` (`flow`: G09 views), where `blueprint` is anything
 * `validateDraft` accepts (a tree or an envelope).
 */
export const LOCAL_STATE_FORMAT = 'texuli-local-state';
export const LOCAL_STATE_VERSION = 1;
/** The binding key: a prop value `{ "$state": "name" }` reads one variable. */
export const STATE_BINDING_KEY = '$state';

/** Deepest prop value the resolver walks; deeper values are refused. */
const MAX_PROP_DEPTH = 32;

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export type StatefulSplit =
  /** Not a local-state wrapper: hand `blueprint` to the player unchanged. */
  | { kind: 'plain'; blueprint: unknown }
  | {
      kind: 'stateful';
      declarations: StateDeclarations;
      blueprint: unknown;
      /** The declared flow (G09), or `null` when the wrapper declares none. */
      flow: FlowDeclaration | null;
    }
  | { kind: 'invalid'; issues: readonly StateIssue[] };

function wrapperIssue(message: string): StatefulSplit {
  return { kind: 'invalid', issues: [{ code: 'state-shape', path: '', message }] };
}

/**
 * Detect and read the local-state wrapper. Text input is parsed under the
 * same byte cap as `validateDraft`; text that is not JSON, or JSON that is
 * not the wrapper, is passed through unchanged so `validateDraft` reports it.
 */
export function splitStatefulBlueprint(input: unknown): StatefulSplit {
  let value = input;
  if (typeof input === 'string') {
    const cap = DEFAULT_TREE_LIMITS.maxBytes + DRAFT_TEXT_ALLOWANCE;
    if (new TextEncoder().encode(input).length > cap) return { kind: 'plain', blueprint: input };
    try {
      value = JSON.parse(input);
    } catch {
      return { kind: 'plain', blueprint: input };
    }
  }
  // Spec 0.3.0 lifts state and flow into the envelope itself; the
  // envelope stays whole (its tree is resolved later, its declarations
  // let `validateDraft` check the names actions use).
  if (
    isBag(value) &&
    value.format === ENVELOPE_FORMAT &&
    (Object.hasOwn(value, 'state') || Object.hasOwn(value, 'flow'))
  ) {
    const parsed = parseStateDeclarations(value.state ?? {});
    if (!parsed.ok) return { kind: 'invalid', issues: parsed.issues };
    let flow: FlowDeclaration | null = null;
    if (Object.hasOwn(value, 'flow')) {
      const declared = parseFlowDeclaration(value.flow);
      if (!declared.ok) return { kind: 'invalid', issues: declared.issues };
      flow = declared.flow;
    }
    return { kind: 'stateful', declarations: parsed.declarations, blueprint: value, flow };
  }
  if (!isBag(value) || value.format !== LOCAL_STATE_FORMAT) {
    return { kind: 'plain', blueprint: input };
  }
  if (value.version !== LOCAL_STATE_VERSION) {
    return wrapperIssue(`Unsupported local-state version (expected ${LOCAL_STATE_VERSION}).`);
  }
  const extra = Object.keys(value).find(
    (key) => !['format', 'version', 'state', 'flow', 'blueprint'].includes(key)
  );
  if (extra) return wrapperIssue(`The local-state wrapper has an unknown field "${extra}".`);
  if (!Object.hasOwn(value, 'blueprint')) return wrapperIssue('The wrapper needs a blueprint.');
  const parsed = parseStateDeclarations(value.state);
  if (!parsed.ok) return { kind: 'invalid', issues: parsed.issues };
  let flow: FlowDeclaration | null = null;
  if (Object.hasOwn(value, 'flow')) {
    const declared = parseFlowDeclaration(value.flow);
    if (!declared.ok) return { kind: 'invalid', issues: declared.issues };
    flow = declared.flow;
  }
  return { kind: 'stateful', declarations: parsed.declarations, blueprint: value.blueprint, flow };
}

function bindingName(value: Bag): string | null {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === STATE_BINDING_KEY && typeof value.$state === 'string'
    ? value.$state
    : null;
}

function resolveValue(
  value: unknown,
  snapshot: StateSnapshot,
  path: string,
  depth: number,
  issues: StateIssue[]
): unknown {
  if (depth > MAX_PROP_DEPTH) {
    issues.push({ code: 'binding-depth', path, message: 'Prop value nests too deeply.' });
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      resolveValue(entry, snapshot, `${path}.${index}`, depth + 1, issues)
    );
  }
  if (!isBag(value)) return value;
  if (isSourceBinding(value)) {
    issues.push({
      code: 'source',
      path,
      message: 'A data-source binding reads only a whole top-level prop.',
    });
    return value;
  }
  const name = bindingName(value);
  if (name !== null) {
    if (Object.hasOwn(snapshot, name)) return snapshot[name];
    issues.push({ code: 'unknown-state', path, message: `No state variable named "${name}".` });
    return value;
  }
  const out: Bag = {};
  for (const [key, entry] of Object.entries(value)) {
    // defineProperty: a parsed "__proto__" key stays an own data property for
    // the renderer to refuse, instead of becoming the object's prototype.
    Object.defineProperty(out, key, {
      value: resolveValue(entry, snapshot, `${path}.${key}`, depth + 1, issues),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return out;
}

/** What a node binds and handles, by node path (`0.children.1`), for dispatch. */
export interface NodeInteraction {
  id: string;
  /** Bindable prop → the variable it reads and writes. */
  bind?: Readonly<Record<string, string>>;
  /** Event → the raw action list (checked by `validateDraft`, run by the player). */
  on?: Readonly<Record<string, readonly unknown[]>>;
  /** For a `reorder` container: the bound list variable and its reorder options. */
  reorder?: Readonly<Record<string, unknown>> & { list: string };
  /** Props read from a host data source (spec 0.8.0): prop → the checked binding. */
  sources?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

/**
 * The host's data sources as the resolver sees them (spec 0.8.0): their
 * descriptors, to check each `$source` binding, and the items a bound prop
 * shows now (an empty list until its rows arrive).
 */
export interface SourceResolver {
  readonly descriptors: readonly SpecSourceDescriptor[];
  rows(path: string, prop: string, binding: Readonly<Record<string, unknown>>): readonly unknown[];
}

export interface ResolveOptions {
  /** Host data for `{"$data": name}` props: name → scalar. */
  dataSources?: Readonly<Record<string, unknown>>;
  /** Bindable props by catalog id (`bind` on anything else is refused). */
  bindable?: (id: string) => readonly string[] | undefined;
  /** Whether a variable may be written (declared and not host-bound). */
  writable?: (name: string) => boolean;
  /** Sourceable props by catalog id (`$source` on anything else is refused). */
  sourceable?: (id: string) => readonly string[] | undefined;
  /** The host's data sources. Without them every `$source` binding is refused. */
  sources?: SourceResolver;
}

interface ResolveContext {
  snapshot: StateSnapshot;
  issues: StateIssue[];
  options: ResolveOptions;
  interactions: Map<string, NodeInteraction>;
}

function dataValue(value: unknown, options: ResolveOptions): unknown {
  if (!isBag(value) || Object.keys(value).length !== 1 || typeof value.$data !== 'string')
    return undefined;
  const sources = options.dataSources;
  if (!sources || !Object.hasOwn(sources, value.$data)) return null;
  const data = sources[value.$data];
  return typeof data === 'string' ||
    typeof data === 'boolean' ||
    (typeof data === 'number' && Number.isFinite(data))
    ? data
    : null;
}

/** Why a `$source` prop cannot read its source; empty when it can. Fails closed. */
function sourceIssues(
  id: string,
  prop: string,
  binding: Record<string, unknown>,
  options: ResolveOptions
): StateIssue[] {
  const shape = sourceShape(id, prop);
  if (!shape || !(options.sourceable?.(id) ?? []).includes(prop)) {
    return [
      { code: 'source', path: '', message: `"${prop}" of "${id}" cannot read a data source.` },
    ];
  }
  return checkSourceBinding(binding, {
    ...(options.sources ? { sources: options.sources.descriptors } : {}),
    itemFields: shape.fields,
  }).map((issue) => ({ code: issue.code, path: issue.at, message: issue.message }));
}

function resolveNode(node: unknown, path: string, depth: number, context: ResolveContext): unknown {
  // Shape problems are `validateDraft`'s to report; only props are rewritten.
  if (!isBag(node) || depth > DEFAULT_TREE_LIMITS.maxDepth + 1) return node;
  const { snapshot, issues, options } = context;
  const out: Bag = { ...node };
  const interaction: {
    id: string;
    bind?: Record<string, string>;
    on?: Record<string, readonly unknown[]>;
    reorder?: NodeInteraction['reorder'];
    sources?: Record<string, Readonly<Record<string, unknown>>>;
  } = {
    id: typeof node.id === 'string' ? node.id : '',
  };
  if (isBag(node.props)) {
    const props: Bag = {};
    for (const [key, entry] of Object.entries(node.props)) {
      const here = `${path}.props.${key}`;
      let value: unknown;
      const data = isSourceBinding(entry) ? undefined : dataValue(entry, options);
      if (isSourceBinding(entry)) {
        // Spec 0.8.0: a whole sourceable prop shows the rows the host's source returned.
        const problems = sourceIssues(interaction.id, key, entry, options);
        if (problems.length > 0) {
          for (const problem of problems)
            issues.push({ ...problem, path: `${here}${problem.path}` });
          value = [];
        } else {
          value = options.sources?.rows(path, key, entry) ?? [];
          interaction.sources = {
            ...(interaction.sources ?? {}),
            [key]: Object.freeze({ ...entry }),
          };
        }
      } else if (data !== undefined) {
        // `$data`: a whole top-level scalar from the host; absent data leaves the prop out.
        if (data === null) continue;
        value = data;
      } else if (
        key === 'reorder' &&
        isBag(entry) &&
        isBag(entry.bind) &&
        typeof entry.bind.$state === 'string'
      ) {
        // Drag as data: the container keeps naming its list; the painter reads it from state.
        const list = entry.bind.$state;
        if (!Object.hasOwn(snapshot, list) || !Array.isArray(snapshot[list])) {
          issues.push({
            code: 'unknown-state',
            path: here,
            message: `No list variable named "${list}".`,
          });
        } else {
          interaction.reorder = Object.freeze({ ...entry, list });
        }
        value = entry;
      } else {
        value = resolveValue(entry, snapshot, here, 0, issues);
      }
      Object.defineProperty(props, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    out.props = props;
  }
  if (node.bind !== undefined) {
    // Two-way bindings paint the variable's current value; writes go back through dispatch.
    const bindable = options.bindable?.(interaction.id) ?? [];
    const props: Bag = isBag(out.props) ? { ...out.props } : {};
    const bind: Record<string, string> = {};
    for (const [prop, entry] of Object.entries(isBag(node.bind) ? node.bind : {})) {
      const name = isBag(entry) && Object.keys(entry).length === 1 ? entry.$state : undefined;
      const here = `${path}.bind.${prop}`;
      if (typeof name !== 'string' || !bindable.includes(prop) || Object.hasOwn(props, prop)) {
        issues.push({ code: 'binding', path: here, message: `"${prop}" cannot be bound here.` });
      } else if (!Object.hasOwn(snapshot, name)) {
        issues.push({
          code: 'unknown-state',
          path: here,
          message: `No state variable named "${name}".`,
        });
      } else if (options.writable && !options.writable(name)) {
        issues.push({
          code: 'host-binding',
          path: here,
          message: `"${name}" is host data and cannot be bound.`,
        });
      } else {
        bind[prop] = name;
        Object.defineProperty(props, prop, {
          value: snapshot[name],
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    out.props = props;
    delete out.bind;
    interaction.bind = Object.freeze(bind);
  }
  if (isBag(node.on)) {
    const on: Record<string, readonly unknown[]> = {};
    for (const [event, actions] of Object.entries(node.on)) {
      if (Array.isArray(actions)) on[event] = Object.freeze([...actions]);
    }
    interaction.on = Object.freeze(on);
  }
  if (interaction.bind || interaction.on || interaction.reorder || interaction.sources) {
    context.interactions.set(path, Object.freeze(interaction));
  }
  if (Array.isArray(node.children)) {
    out.children = node.children.map((child, index) =>
      resolveNode(child, `${path}.children.${index}`, depth + 1, context)
    );
  }
  return out;
}

/**
 * Replace every `{ "$state": name }` prop value with the variable's current
 * value, `{ "$data": name }` with the host's scalar, and node `bind` with
 * the bound variable's value. Only props are rewritten, never ids or
 * structure. The result is a plain literal tree that the player then
 * validates in full, so a bound value meets the same prop schemas, HTML
 * checks and URL policy as a literal. An unknown name is an issue (the
 * caller refuses the blueprint). `interactions` maps each node path to what
 * it binds and handles.
 */
export function resolveStateBindings(
  blueprint: unknown,
  snapshot: StateSnapshot,
  options: ResolveOptions = {}
): {
  blueprint: unknown;
  issues: readonly StateIssue[];
  interactions: ReadonlyMap<string, NodeInteraction>;
} {
  const context: ResolveContext = { snapshot, issues: [], options, interactions: new Map() };
  let out: unknown;
  if (isBag(blueprint) && blueprint.format === ENVELOPE_FORMAT) {
    out = { ...blueprint, tree: resolveTree(blueprint.tree, context) };
  } else {
    out = resolveTree(blueprint, context);
  }
  return { blueprint: out, issues: context.issues, interactions: context.interactions };
}

function resolveTree(tree: unknown, context: ResolveContext): unknown {
  return Array.isArray(tree)
    ? tree.map((node, index) => resolveNode(node, String(index), 0, context))
    : resolveNode(tree, '0', 0, context);
}

/**
 * Lift a provisional `texuli-local-state` wrapper (G01) into a spec 0.3.0
 * envelope that carries `state` and `flow` itself. A wrapped envelope keeps
 * its fields and gains `spec`, `state` and `flow`; a wrapped bare tree is
 * returned as `null` (it needs an envelope's id and catalog binding first).
 * Anything that is not a wrapper comes back unchanged. Pure: the input is
 * never mutated, and nothing is validated here (`validateDraft` does that).
 */
export function liftLocalState(input: unknown): unknown {
  if (!isBag(input) || input.format !== LOCAL_STATE_FORMAT) return input;
  const inner = input.blueprint;
  if (!isBag(inner) || inner.format !== ENVELOPE_FORMAT) return null;
  return {
    ...inner,
    spec: '0.3.0',
    ...(Object.hasOwn(input, 'state') ? { state: input.state } : {}),
    ...(Object.hasOwn(input, 'flow') ? { flow: input.flow } : {}),
  };
}
