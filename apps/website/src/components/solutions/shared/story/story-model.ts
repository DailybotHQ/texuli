/**
 * Pure helpers for the Solution stories block (`SolutionStories.astro`): which side the art
 * sits on, which capabilities a story's chips name (resolved from the registry entry, never
 * typed copy), which status badge a story shows, and which art the band paints. Kept out of
 * the component so the composition rules are unit-tested.
 */
import type {
  SolutionArtSlot,
  SolutionCapability,
  SolutionEntry,
  SolutionStatus,
} from '../../../../data/solutions/schema.ts';
import type { SolutionStory } from '../types.ts';

export type StorySide = 'start' | 'end';

/** Bands alternate: the first story puts its art at the inline end, the next at the start. */
export function storySide(index: number): StorySide {
  return index % 2 === 0 ? 'end' : 'start';
}

/**
 * The story's capability chips, in the story's order, resolved from `entry.capabilities`.
 * Unknown ids are dropped here; `checkLandingContent` already reports them as issues.
 */
export function storyCapabilities(
  entry: Pick<SolutionEntry, 'capabilities'>,
  story: Pick<SolutionStory, 'capabilities'>
): SolutionCapability[] {
  const byId = new Map(entry.capabilities.map((capability) => [capability.id, capability]));
  const seen = new Set<string>();
  const resolved: SolutionCapability[] = [];
  for (const id of story.capabilities) {
    const capability = byId.get(id);
    if (!capability || seen.has(id)) continue;
    seen.add(id);
    resolved.push(capability);
  }
  return resolved;
}

/**
 * The status badge a story shows: its own `status` when set; otherwise, when every
 * capability it names shares one status that differs from the Solution's, that status
 * (so a planned feature never reads as part of an available Solution). `undefined` means
 * no badge: the story simply has the Solution's status.
 */
export function storyStatus(
  entry: Pick<SolutionEntry, 'status'>,
  story: Pick<SolutionStory, 'status'>,
  capabilities: readonly SolutionCapability[]
): SolutionStatus | undefined {
  if (story.status) return story.status;
  const statuses = new Set(capabilities.map((capability) => capability.status));
  if (statuses.size !== 1) return undefined;
  const [only] = statuses;
  return only !== entry.status ? only : undefined;
}

/** A chip shows its capability's status only when it differs from the badge or the Solution. */
export function chipStatus(
  capability: SolutionCapability,
  shown: SolutionStatus
): SolutionStatus | undefined {
  return capability.status === shown ? undefined : capability.status;
}

/**
 * The art the band paints: the story's slot when it is registered in the illustrations
 * manifest; otherwise `undefined`, and the band paints the decorative texel mosaic.
 * (`SiteIllustration` refuses unknown slots, so the check happens here, not at render.)
 */
export function storyArt(
  story: Pick<SolutionStory, 'art'>,
  isRegistered: (slot: string) => boolean
): SolutionArtSlot | undefined {
  return story.art && isRegistered(story.art.slot) ? story.art : undefined;
}

/** 0 (quiet) to 4 (strong) tones for the fallback mosaic, seeded by the story id. */
export function mosaicTones(seedText: string, count = 24): number[] {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  return Array.from({ length: count }, (_, index) => {
    seed = Math.imul(seed ^ (index + 1), 2654435761) >>> 0;
    const roll = seed % 100;
    return roll < 46 ? 0 : roll < 72 ? 1 : roll < 88 ? 2 : roll < 96 ? 3 : 4;
  });
}

/** Stable, unique heading ids for the section and each story. */
export function storyIds(slug: string, stories: readonly Pick<SolutionStory, 'id'>[]) {
  return {
    section: `solution-${slug}-stories-title`,
    story: stories.map((story) => `solution-${slug}-story-${story.id}`),
  };
}
