import type { PaintNode } from '@texuli/catalog/player';
import type { FlowDeclaration } from './state/flow.ts';
import { initialSnapshot, type StateDeclarations, type StateSnapshot } from './state/schema.ts';

/**
 * Live updates (player design R20, audit G22): the host replaces the
 * blueprint and the player re-validates the whole result, never a fragment,
 * while what the reader did survives where it still fits. Blueprint nodes
 * carry no stable ids yet, so a node is "the same" across an update when the
 * same path holds the same catalog id.
 */

/**
 * The state after an update: every variable the new blueprint declares
 * keeps its live value when that value still fits the new declaration;
 * otherwise the host's `seed` (`initialState`) applies, then the declared
 * initial value. Variables the new blueprint drops are gone.
 */
export function carryStateSnapshot(
  declarations: StateDeclarations,
  live: StateSnapshot,
  seed?: Readonly<Record<string, unknown>>
): StateSnapshot {
  const fromSeed = seed ? initialSnapshot(declarations, seed) : undefined;
  return initialSnapshot(declarations, { ...fromSeed, ...live });
}

/** Whether two snapshots hold the same values. */
export function sameSnapshot(a: StateSnapshot, b: StateSnapshot): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key]);
}

/**
 * The flow view after an update: the host's `view` when it names a declared
 * view, else the live view when the new flow still declares it, else the
 * flow's initial view.
 */
export function carryFlowView(
  flow: FlowDeclaration,
  live: string | null,
  hostView?: string
): string {
  if (typeof hostView === 'string' && flow.views.includes(hostView)) return hostView;
  if (live !== null && flow.views.includes(live)) return live;
  return flow.initial;
}

/** Path → catalog id for every component in a paint plan. */
export function planIdentities(plan: readonly PaintNode[]): ReadonlyMap<string, string> {
  const ids = new Map<string, string>();
  const visit = (node: PaintNode): void => {
    if (node.kind !== 'component') return;
    ids.set(node.path, node.id);
    for (const child of node.children) visit(child);
  };
  for (const node of plan) visit(node);
  return ids;
}

/**
 * The selected paths that still point at the same node after an update. A
 * path whose node changed component (another catalog id now sits there) is
 * dropped. Paths that disappeared are left to the painted-frame pruning,
 * which waits for loads to settle.
 */
export function keepSameNodes(
  selected: readonly string[],
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
): string[] {
  return selected.filter((path) => {
    const was = before.get(path);
    const now = after.get(path);
    return was === undefined || now === undefined || was === now;
  });
}
