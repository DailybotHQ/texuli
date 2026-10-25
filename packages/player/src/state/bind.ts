import { ENVELOPE_FORMAT } from '@texuli/catalog/envelope';
import { DEFAULT_TREE_LIMITS } from '@texuli/catalog/render/limits';
import { DRAFT_TEXT_ALLOWANCE } from '@texuli/catalog/validate';
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

function resolveNode(
  node: unknown,
  snapshot: StateSnapshot,
  path: string,
  depth: number,
  issues: StateIssue[]
): unknown {
  // Shape problems are `validateDraft`'s to report; only props are rewritten.
  if (!isBag(node) || depth > DEFAULT_TREE_LIMITS.maxDepth + 1) return node;
  const out: Bag = { ...node };
  if (isBag(node.props)) {
    out.props = resolveValue(node.props, snapshot, `${path}.props`, 0, issues);
  }
  if (Array.isArray(node.children)) {
    out.children = node.children.map((child, index) =>
      resolveNode(child, snapshot, `${path}.children.${index}`, depth + 1, issues)
    );
  }
  return out;
}

/**
 * Replace every `{ "$state": name }` prop value with the variable's current
 * value. Only props are rewritten, never ids or structure. The result is a
 * plain literal tree that the player then validates in full, so a bound
 * value meets the same prop schemas, HTML checks and URL policy as a
 * literal. An unknown name is an issue (the caller refuses the blueprint).
 */
export function resolveStateBindings(
  blueprint: unknown,
  snapshot: StateSnapshot
): { blueprint: unknown; issues: readonly StateIssue[] } {
  const issues: StateIssue[] = [];
  let out: unknown;
  if (isBag(blueprint) && blueprint.format === ENVELOPE_FORMAT) {
    out = { ...blueprint, tree: resolveTree(blueprint.tree, snapshot, issues) };
  } else {
    out = resolveTree(blueprint, snapshot, issues);
  }
  return { blueprint: out, issues };
}

function resolveTree(tree: unknown, snapshot: StateSnapshot, issues: StateIssue[]): unknown {
  return Array.isArray(tree)
    ? tree.map((node, index) => resolveNode(node, snapshot, String(index), 0, issues))
    : resolveNode(tree, snapshot, '0', 0, issues);
}
