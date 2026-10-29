import { checkActionNodes } from '../actions.ts';
import { checkHostBoundWriters } from '../host-data.ts';
import {
  type NodeInteraction,
  type ResolveOptions,
  resolveStateBindings,
  type StatefulSplit,
} from './bind.ts';
import { checkControlBindings } from './controls.ts';
import { checkFlowNodes } from './flow.ts';
import type { StateIssue, StateSnapshot } from './schema.ts';

/** A split blueprint with its bindings resolved and the player's state rules checked. */
export interface ResolvedBlueprint {
  /** What the player core validates and paints (`null` for a refused split). */
  blueprint: unknown;
  /** State, control, flow, action and host-data issues: any one refuses the paint. */
  issues: readonly StateIssue[];
  interactions: ReadonlyMap<string, NodeInteraction>;
}

const NO_STATE: StateSnapshot = Object.freeze({});
const NO_INTERACTIONS: ReadonlyMap<string, NodeInteraction> = new Map();

/** The resolve options the player uses: `bind` only on bindable props, writes only to local variables. */
export function playerResolveOptions(
  split: StatefulSplit,
  bindable: (id: string) => readonly string[] | undefined,
  dataSources?: Readonly<Record<string, unknown>>
): ResolveOptions {
  return {
    ...(dataSources ? { dataSources } : {}),
    bindable,
    writable: (name) =>
      split.kind === 'stateful' &&
      Object.hasOwn(split.declarations, name) &&
      split.declarations[name]?.source === undefined,
  };
}

/**
 * The player's state pipeline (G01, G06, G09, G17, host G01), shared by the
 * paint and the streaming node checks so both apply the same rules:
 * state-only controls name declared variables of their type, flow nodes
 * name declared views and events, action nodes sit in forms and bind
 * declared fields, and nothing writes a host-bound variable.
 */
export function resolveSplitBlueprint(
  split: StatefulSplit,
  values: StateSnapshot,
  options: ResolveOptions
): ResolvedBlueprint {
  if (split.kind === 'invalid') {
    return { blueprint: null, issues: split.issues, interactions: NO_INTERACTIONS };
  }
  if (split.kind === 'plain') {
    // A plain tree still reads host data and may run actions that need no state.
    const plain = resolveStateBindings(split.blueprint, NO_STATE, options);
    return {
      blueprint: plain.blueprint,
      interactions: plain.interactions,
      issues: [
        ...plain.issues,
        ...checkControlBindings(split.blueprint, null),
        ...checkFlowNodes(split.blueprint, null),
        ...checkActionNodes(split.blueprint, null),
      ],
    };
  }
  const bound = resolveStateBindings(split.blueprint, values, options);
  const controls = [
    ...checkControlBindings(split.blueprint, split.declarations),
    ...checkFlowNodes(split.blueprint, split.flow),
    ...checkActionNodes(split.blueprint, split.declarations),
    ...checkHostBoundWriters(split.blueprint, split.declarations),
  ];
  return controls.length > 0
    ? {
        blueprint: bound.blueprint,
        issues: [...bound.issues, ...controls],
        interactions: bound.interactions,
      }
    : bound;
}
