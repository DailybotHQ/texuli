import type { PlayerPaintNode } from './types.ts';

/** Slot names a component never receives as a snippet prop. */
const UNSAFE_SLOT_NAMES = new Set(['__proto__', 'constructor', 'prototype', 'children']);

export interface SlotGroups {
  /** Children of the default slot, in order. */
  defaults: readonly PlayerPaintNode[];
  /** Named slots in first-seen order. */
  names: readonly string[];
  /** Children of each named slot, in order. */
  groups: Readonly<Record<string, readonly PlayerPaintNode[]>>;
}

/**
 * Split painted children by the named slot each one fills (audit G04). The
 * catalog renderer already refused any slot the parent's manifest does not
 * declare; a name that could reach an object prototype, or `children`, is
 * kept in the default slot rather than passed as a prop.
 */
export function groupSlots(children: readonly PlayerPaintNode[]): SlotGroups {
  const defaults: PlayerPaintNode[] = [];
  const names: string[] = [];
  const groups = new Map<string, PlayerPaintNode[]>();
  for (const child of children) {
    const slot = child.slot;
    if (typeof slot !== 'string' || slot === '' || UNSAFE_SLOT_NAMES.has(slot)) {
      defaults.push(child);
      continue;
    }
    let group = groups.get(slot);
    if (!group) {
      group = [];
      groups.set(slot, group);
      names.push(slot);
    }
    group.push(child);
  }
  return { defaults, names, groups: Object.freeze(Object.fromEntries(groups)) };
}
