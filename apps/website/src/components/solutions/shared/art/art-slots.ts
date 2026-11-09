/**
 * Art slots of the shared Solution landing blocks. Each landing reserves predictable slot
 * ids so artwork can be added later by registering the slot in `src/data/illustrations.json`
 * alone, without touching the landing:
 *
 *   solution-<slug>-hero      the hero plate (from the registry entry)
 *   solution-<slug>-story-<n> the nth story band (1-based)
 *   solution-<slug>-how       the full-width "how it works" band
 *
 * A slot that is not registered yet never fails the build: stories paint the decorative
 * texel mosaic, and the how band renders nothing. `SiteIllustration` refuses unknown slots,
 * so the registered check happens here, before render.
 */
import type { SolutionArtSlot } from '../../../../data/solutions/schema.ts';
import { illustrationFor } from '../../../landing/illustrations.ts';

/** True when `src/data/illustrations.json` registers the slot. */
export function isRegisteredSlot(slot: string): boolean {
  return illustrationFor(slot) !== undefined;
}

/** The reserved slot of the nth story band (`index` is 0-based). */
export function storySlotId(slug: string, index: number): string {
  return `solution-${slug}-story-${index + 1}`;
}

/** The reserved slot of the "how it works" band. */
export function howSlotId(slug: string): string {
  return `solution-${slug}-how`;
}

/** A story's art: its own slot when set, otherwise the reserved story slot. */
export function storyArtSlot(
  slug: string,
  story: Readonly<{ art?: SolutionArtSlot }>,
  index: number
): SolutionArtSlot {
  return story.art ?? { slot: storySlotId(slug, index), variant: 'plate' };
}

/**
 * The how band's art: the explicit slot, or the reserved one, and only when registered;
 * `undefined` means the block renders no band.
 */
export function howArt(
  slug: string,
  art: SolutionArtSlot | undefined,
  isRegistered: (slot: string) => boolean = isRegisteredSlot
): SolutionArtSlot | undefined {
  const resolved = art ?? { slot: howSlotId(slug), variant: 'band' };
  return isRegistered(resolved.slot) ? resolved : undefined;
}
