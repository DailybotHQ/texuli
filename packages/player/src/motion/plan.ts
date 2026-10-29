/**
 * The player's motion plan (spec 0.6.0, ADR-013): stagger delays and the
 * leaving nodes kept for their exit, as data. Pure and DOM-free, and on the
 * paint path, so it stays small: the keyframes live in `keyframes.ts` and
 * the runtime (`runtime.ts`, on `@texuli/core/motion`) loads only when a
 * painted node declares motion.
 */

import type { BlueprintMotionStagger, BlueprintNodeMotion } from '@texuli/spec/motion';
import type { PlayerPaintNode } from '../types.ts';

/**
 * The offset between entering children, per stagger step: a fifth of the
 * matching duration token (`fast` 30 ms, `base` 40 ms).
 */
export const PLAYER_STAGGER_STEPS: Readonly<Record<BlueprintMotionStagger, number>> = Object.freeze(
  { none: 0, fast: 30, base: 40 }
);

/** The whole stagger spread is held to this (core `MAX_STAGGER_SPAN`). */
export const PLAYER_MAX_STAGGER_SPAN = 1000;

/** Nodes kept for their exit animation at once; past it a leaving node goes at once. */
export const PLAYER_MAX_LEAVING = 64;

/**
 * Delays for `count` entering children at a stagger step, from the first
 * child; the spread never passes {@link PLAYER_MAX_STAGGER_SPAN} (the same
 * rule as core `stagger`).
 */
export function staggerDelays(count: number, step: BlueprintMotionStagger | undefined): number[] {
  const n = Math.max(0, Math.min(10_000, Math.floor(Number.isFinite(count) ? count : 0)));
  const each = step ? (PLAYER_STAGGER_STEPS[step] ?? 0) : 0;
  const reach = n - 1;
  const per = reach > 0 ? Math.min(each, PLAYER_MAX_STAGGER_SPAN / reach) : 0;
  return Array.from({ length: n }, (_, i) => Math.round(i * per * 100) / 100);
}

/**
 * Give the children of a staggering node their delays (only components
 * that enter count). Returns the same array when nothing changes.
 */
export function withStagger(
  children: readonly PlayerPaintNode[],
  motion: Readonly<BlueprintNodeMotion> | undefined
): readonly PlayerPaintNode[] {
  if (!motion?.stagger || motion.stagger === 'none') return children;
  const entering = children.filter((child) => child.kind === 'component' && child.motion?.enter);
  if (entering.length < 2) return children;
  const delays = staggerDelays(entering.length, motion.stagger);
  let index = 0;
  return children.map((child) => {
    if (child.kind !== 'component' || !child.motion?.enter) return child;
    const delay = delays[index] ?? 0;
    index += 1;
    return delay > 0 ? { ...child, motionDelay: delay } : child;
  });
}

type ComponentPaint = Extract<PlayerPaintNode, { kind: 'component' }>;

/**
 * Keep nodes that left the paint plan for their exit animation (an `exit`
 * preset): each one goes back to its previous place among its siblings,
 * marked `leaving`, until `exited` names its path. Only children of a
 * component that is still painted are kept (a removed parent takes its
 * subtree with it, or is kept itself when it has an exit). A node that
 * comes back replaces its leaving copy. Linear in the two plans.
 */
export function retainLeaving(
  next: readonly PlayerPaintNode[],
  previous: readonly PlayerPaintNode[] | null,
  exited: ReadonlySet<string>,
  budget: { left: number } = { left: PLAYER_MAX_LEAVING }
): readonly PlayerPaintNode[] {
  if (!previous || previous.length === 0) return next;
  const present = new Set(next.map((node) => node.path));
  const before = new Map(previous.map((node) => [node.path, node]));
  let changed = false;
  const out: PlayerPaintNode[] = [];
  // Children still present, recursively.
  for (const node of next) {
    const old = before.get(node.path);
    if (node.kind === 'component' && old?.kind === 'component' && old.children.length > 0) {
      const children = retainLeaving(node.children, old.children, exited, budget);
      if (children !== node.children) {
        changed = true;
        out.push({ ...node, children });
        continue;
      }
    }
    out.push(node);
  }
  // Leaving nodes, back at their previous index.
  previous.forEach((old, index) => {
    if (present.has(old.path) || old.kind !== 'component' || !old.motion?.exit) return;
    if (exited.has(old.path) || budget.left <= 0) return;
    budget.left -= 1;
    changed = true;
    const leaving: ComponentPaint = old.leaving ? old : { ...old, leaving: true };
    out.splice(Math.min(index, out.length), 0, leaving);
  });
  return changed ? out : next;
}

/** Forget the exits of nodes that are painted again, so they can leave again later. */
export function pruneExited(nodes: readonly PlayerPaintNode[], exited: Set<string>): void {
  if (exited.size === 0) return;
  for (const node of nodes) {
    exited.delete(node.path);
    if (node.kind === 'component') pruneExited(node.children, exited);
  }
}

/** Whether any node in a plan declares motion. */
export function planHasMotion(nodes: readonly PlayerPaintNode[]): boolean {
  for (const node of nodes) {
    if (node.kind !== 'component') continue;
    if (node.motion || planHasMotion(node.children)) return true;
  }
  return false;
}
