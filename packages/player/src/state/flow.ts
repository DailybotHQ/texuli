import type { FormulaInputs } from '@texuli/blocks/formula';
import { ENVELOPE_FORMAT } from '@texuli/catalog/envelope';
import { formulaConditions, parseWhen } from '@texuli/catalog/render/conditions';
import type { StateIssue } from './schema.ts';

/**
 * Views and flows (audit G09, player design Phase 4). A blueprint declares
 * up to 16 named views and a closed transition table; `flow-view` nodes hold
 * each view's content and `flow-action` buttons fire the table's events. A
 * transition moves the player's local view only: the host hears
 * `onFlowChange` (and a `flow` message through the frame protocol) and may
 * mirror it into its URL. The player never touches `location` or `history`.
 */

/** Most views one flow may declare. */
export const MAX_FLOW_VIEWS = 16;
/** Most transitions one flow may declare. */
export const MAX_FLOW_TRANSITIONS = 64;
/** A view or event name: a lowercase letter, then letters, digits or `-`, at most 32. */
export const FLOW_NAME = /^[a-z][a-z0-9-]{0,31}$/;

export interface FlowTransition {
  /** A view name, or `*` for any view. */
  from: string;
  to: string;
  /** The event a `flow-action` fires. */
  on: string;
  /** A guard in the `when` condition AST, already parsed; `undefined` always passes. */
  when?: unknown;
}

export interface FlowDeclaration {
  views: readonly string[];
  initial: string;
  transitions: readonly FlowTransition[];
}

export type FlowParse =
  | { ok: true; flow: FlowDeclaration }
  | { ok: false; issues: readonly StateIssue[] };

type Bag = Record<string, unknown>;

function isBag(value: unknown): value is Bag {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read an untrusted flow declaration strictly: closed fields, a bounded set
 * of named views, transitions between declared views only, and guards that
 * `parseWhen` accepts. Any issue refuses the whole blueprint. Never throws.
 */
export function parseFlowDeclaration(input: unknown): FlowParse {
  const issues: StateIssue[] = [];
  const fail = (path: string, message: string) =>
    issues.push({ code: 'flow-shape', path, message });
  if (!isBag(input)) {
    fail('flow', 'flow must be an object with views and transitions.');
    return { ok: false, issues };
  }
  const extra = Object.keys(input).find(
    (key) => !['views', 'initial', 'transitions'].includes(key)
  );
  if (extra) fail(`flow.${extra}`, `flow has an unknown field "${extra}".`);

  const views = input.views;
  if (
    !Array.isArray(views) ||
    views.length === 0 ||
    views.length > MAX_FLOW_VIEWS ||
    !views.every((view) => typeof view === 'string' && FLOW_NAME.test(view)) ||
    new Set(views).size !== views.length
  ) {
    fail('flow.views', `flow.views needs 1–${MAX_FLOW_VIEWS} distinct names like "review".`);
    return { ok: false, issues };
  }
  const names = views as string[];
  const initial = input.initial ?? names[0];
  if (typeof initial !== 'string' || !names.includes(initial)) {
    fail('flow.initial', 'flow.initial must be one of the declared views.');
  }

  const transitions: FlowTransition[] = [];
  const raw = input.transitions;
  if (!Array.isArray(raw) || raw.length > MAX_FLOW_TRANSITIONS) {
    fail('flow.transitions', `flow.transitions needs at most ${MAX_FLOW_TRANSITIONS} entries.`);
  } else {
    raw.forEach((entry, index) => {
      const path = `flow.transitions.${index}`;
      if (!isBag(entry)) {
        fail(path, 'A transition is an object with from, to and on.');
        return;
      }
      const unknown = Object.keys(entry).find((key) => !['from', 'to', 'on', 'when'].includes(key));
      if (unknown) fail(`${path}.${unknown}`, `A transition has an unknown field "${unknown}".`);
      const { from, to, on } = entry;
      if (typeof from !== 'string' || (from !== '*' && !names.includes(from))) {
        fail(`${path}.from`, 'from must be a declared view or "*".');
      }
      if (typeof to !== 'string' || !names.includes(to))
        fail(`${path}.to`, 'to must be a declared view.');
      if (typeof on !== 'string' || !FLOW_NAME.test(on))
        fail(`${path}.on`, 'on must be an event name like "next".');
      let when: unknown;
      if (Object.hasOwn(entry, 'when')) {
        const parsed = parseWhen(entry.when);
        if (parsed.ok) when = parsed.condition;
        else fail(`${path}.when`, parsed.message);
      }
      if (typeof from === 'string' && typeof to === 'string' && typeof on === 'string') {
        transitions.push({ from, to, on, ...(when !== undefined ? { when } : {}) });
      }
    });
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    flow: Object.freeze({
      views: Object.freeze([...names]),
      initial: initial as string,
      transitions: Object.freeze(transitions.map((transition) => Object.freeze(transition))),
    }),
  };
}

/**
 * The view an event leads to from `current`: the first transition from
 * `current` (or `*`) on `event` whose guard holds. A guard that cannot be
 * evaluated does not hold (fail closed). `null` when nothing applies.
 */
export function nextFlowView(
  flow: FlowDeclaration,
  current: string,
  event: string,
  inputs: FormulaInputs
): string | null {
  for (const transition of flow.transitions) {
    if (transition.on !== event) continue;
    if (transition.from !== '*' && transition.from !== current) continue;
    if (
      transition.when !== undefined &&
      formulaConditions.evaluate(transition.when, inputs) !== true
    ) {
      continue;
    }
    return transition.to;
  }
  return null;
}

/**
 * Check every `flow-view` and `flow-action` against the declaration: a view
 * node must name a declared view, an action must fire an event some
 * transition handles, and neither may appear without a flow. Never throws.
 */
export function checkFlowNodes(blueprint: unknown, flow: FlowDeclaration | null): StateIssue[] {
  const issues: StateIssue[] = [];
  const events = new Set(flow?.transitions.map((transition) => transition.on));
  const tree =
    isBag(blueprint) && blueprint.format === ENVELOPE_FORMAT ? blueprint.tree : blueprint;
  const fail = (path: string, message: string) =>
    issues.push({ code: 'flow-binding', path, message });

  function visit(node: unknown, path: string, depth: number): void {
    if (!isBag(node) || depth > 64) return;
    const props = isBag(node.props) ? node.props : {};
    if (node.id === 'flow-view' || node.id === 'flow-action') {
      if (!flow) {
        fail(path, `"${node.id}" needs a declared flow; this blueprint declares none.`);
      } else if (
        node.id === 'flow-view' &&
        (typeof props.name !== 'string' || !flow.views.includes(props.name))
      ) {
        fail(path, '"flow-view" names no declared view.');
      } else if (
        node.id === 'flow-action' &&
        (typeof props.event !== 'string' || !events.has(props.event))
      ) {
        fail(path, '"flow-action" fires an event no transition handles.');
      }
    }
    if (Array.isArray(node.children)) {
      for (const [index, child] of node.children.entries()) {
        visit(child, `${path}.children.${index}`, depth + 1);
      }
    }
  }

  if (Array.isArray(tree)) {
    for (const [index, node] of tree.entries()) visit(node, String(index), 0);
  } else visit(tree, '0', 0);
  return issues;
}
