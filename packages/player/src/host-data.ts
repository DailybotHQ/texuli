import { ENVELOPE_FORMAT } from '@texuli/catalog/envelope';
import { CONTROL_STATE_TYPES } from './control-manifests.ts';
import {
  coerceStateValue,
  type StateDeclarations,
  type StateIssue,
  type StateSnapshot,
  type StateValue,
} from './state/schema.ts';

/**
 * The host binding channel (host G01, player design Phase 4). A state
 * variable may declare a `source`; the host supplies values for those names
 * through `dataSources` (a prop, `mountPlayer().update()`, or the frame
 * protocol's `data` message). Each value is coerced to the variable's
 * declaration (type and bounds) before it reaches state, and then flows into
 * props through the ordinary `{ "$state": name }` bindings, so it meets the
 * full validation a literal would. The player never fetches; it only reads
 * what the host hands it.
 */

/** Most data sources one update may carry. */
export const MAX_DATA_SOURCES = 64;

/** Host data: source name → plain scalar. Anything else is ignored. */
export type DataSources = Readonly<Record<string, unknown>>;

/** The variables a host owns: every declared variable with a `source`. */
export function hostBoundNames(declarations: StateDeclarations): string[] {
  return Object.entries(declarations)
    .filter(([, declaration]) => declaration.source !== undefined)
    .map(([name]) => name);
}

/**
 * Overlay host data onto a state snapshot: each host-bound variable takes
 * the host's value for its source when that value fits its declaration,
 * and its declared initial value when the host has none or it does not fit.
 * Variables without a source are untouched. Returns the same snapshot when
 * nothing changes.
 */
export function applyHostData(
  declarations: StateDeclarations,
  snapshot: StateSnapshot,
  dataSources: DataSources | undefined
): StateSnapshot {
  let next: Record<string, StateValue> | null = null;
  for (const [name, declaration] of Object.entries(declarations)) {
    const source = declaration.source;
    if (source === undefined) continue;
    const offered =
      dataSources && Object.hasOwn(dataSources, source) ? dataSources[source] : undefined;
    // `coerceStateValue` returns `undefined` for a value that does not fit.
    const value =
      (offered === undefined ? undefined : coerceStateValue(declaration, offered)) ??
      declaration.initial;
    if (snapshot[name] !== value) {
      next ??= { ...snapshot };
      next[name] = value;
    }
  }
  return next ? Object.freeze(next) : snapshot;
}

/**
 * Rebuild host data from untrusted input (a frame message): a plain object
 * of at most {@link MAX_DATA_SOURCES} names to strings, finite numbers or
 * booleans. Other entries are dropped; `null` when the input is not an object.
 */
export function sanitizeDataSources(input: unknown): DataSources | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const out: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [name, value] of Object.entries(input)) {
    if (count >= MAX_DATA_SOURCES) break;
    if (!/^(?=.{1,64}$)[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)*$/.test(name)) continue;
    const ok =
      (typeof value === 'string' && value.length <= 2048) ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value));
    if (!ok) continue;
    Object.defineProperty(out, name, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    count += 1;
  }
  return Object.freeze(out);
}

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A host-bound variable is the host's: a control or a form field that would
 * write one refuses the blueprint. Never throws.
 */
export function checkHostBoundWriters(
  blueprint: unknown,
  declarations: StateDeclarations | null
): StateIssue[] {
  if (!declarations) return [];
  const bound = new Set(hostBoundNames(declarations));
  if (bound.size === 0) return [];
  const issues: StateIssue[] = [];
  const tree =
    isBag(blueprint) && blueprint.format === ENVELOPE_FORMAT ? blueprint.tree : blueprint;
  function visit(node: unknown, path: string, depth: number): void {
    if (!isBag(node) || depth > 64) return;
    const id = typeof node.id === 'string' ? node.id : '';
    const props = isBag(node.props) ? node.props : {};
    const writes = Object.hasOwn(CONTROL_STATE_TYPES, id) || id === 'form-field';
    if (writes && typeof props.state === 'string' && bound.has(props.state)) {
      issues.push({
        code: 'host-binding',
        path,
        message: `"${id}" cannot write "${props.state}": its value comes from the host.`,
      });
    }
    if (Array.isArray(node.children)) {
      for (const [index, child] of node.children.entries())
        visit(child, `${path}.children.${index}`, depth + 1);
    }
  }
  if (Array.isArray(tree)) {
    for (const [index, node] of tree.entries()) visit(node, String(index), 0);
  } else visit(tree, '0', 0);
  return issues;
}
