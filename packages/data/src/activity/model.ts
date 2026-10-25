import type { ActivityKind } from '../engines/activity/summary.ts';

/** One emoji reaction summary for the feed UI. */
export interface ReactionChip {
  emoji: string;
  count: number;
  /** Whether the current persona is among the reactors. */
  mine: boolean;
  personaIds: readonly string[];
}

/** Stable emoji order for reaction chips (insertion order of the map keys). */
export function reactionChips(
  reactions: Record<string, readonly string[]> | undefined,
  personaId: string | undefined
): ReactionChip[] {
  if (!reactions) return [];
  const chips: ReactionChip[] = [];
  for (const [emoji, ids] of Object.entries(reactions)) {
    if (!ids.length) continue;
    chips.push({
      emoji,
      count: ids.length,
      mine: personaId !== undefined && ids.includes(personaId),
      personaIds: ids,
    });
  }
  return chips;
}

/** Slice the newest-first feed for progressive pagination. */
export function pageItems<T>(items: readonly T[], visibleCount: number): T[] {
  const count = Math.max(0, Math.floor(visibleCount));
  if (count <= 0) return [];
  return items.slice(0, Math.min(count, items.length));
}

/** Default page size when the host does not set one. */
export const DEFAULT_PAGE_SIZE = 10;

/** Reaction presets shown on each item when reactions are enabled. */
export const DEFAULT_REACTION_EMOJIS = ['👍', '🎉', '❤️', '👀'] as const;

export function kindVerb(kind: ActivityKind): string {
  switch (kind) {
    case 'comment':
      return 'commented';
    case 'create':
      return 'created';
    case 'update':
      return 'updated';
    case 'delete':
      return 'deleted';
    case 'restore':
      return 'restored';
    case 'purge':
      return 'purged';
    case 'import':
      return 'imported';
    default:
      return kind;
  }
}
