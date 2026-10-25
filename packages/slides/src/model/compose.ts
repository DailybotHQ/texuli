import type { Block, ImageFit } from '@texuli/blocks/core';
import {
  type DeckSlide,
  resolveSlideMaster,
  type SlideMasterId,
  type SlideMasterLayout,
  type SlideMasterSlot,
} from './index.ts';

/** Block types the stage treats as slide media. */
export const SLIDE_MEDIA_TYPES = ['image', 'figure', 'video', 'gallery'] as const;
export type SlideMediaType = (typeof SLIDE_MEDIA_TYPES)[number];

/**
 * How images fit in each region: a media region fills its frame (`cover`,
 * cropping if needed); body and the other content regions never crop
 * (`contain`). A block's own `fit` always wins.
 */
export const SLIDE_REGION_FIT: Readonly<Record<'media' | 'body', ImageFit>> = Object.freeze({
  media: 'cover',
  body: 'contain',
});

/** The master slots that hold blocks; `title` is the slide title itself. */
export type SlideRegionSlot = Exclude<SlideMasterSlot, 'title'>;

/**
 * The content slots of each master, in reading order. On the non-media
 * masters, top-level `divider` blocks separate them: blocks before the first
 * divider fill the first slot, blocks after it the next, and so on. A
 * divider used as a separator is not painted; dividers past the last slot
 * stay ordinary blocks. The media masters keep one `body` slot and take
 * their `media` region from the first media block instead.
 */
export const SLIDE_MASTER_CONTENT_SLOTS: Readonly<
  Record<SlideMasterId, readonly SlideRegionSlot[]>
> = Object.freeze({
  title: Object.freeze(['body', 'footer'] as const),
  section: Object.freeze(['body'] as const),
  content: Object.freeze(['body', 'footer'] as const),
  'two-column': Object.freeze(['contentStart', 'contentEnd', 'footer'] as const),
  'media-left': Object.freeze(['body'] as const),
  'media-right': Object.freeze(['body'] as const),
  quote: Object.freeze(['quote', 'attribution'] as const),
  closing: Object.freeze(['body', 'footer'] as const),
});

export interface SlideRegion {
  slot: SlideRegionSlot;
  blocks: Block[];
}

export interface ComposedSlide {
  master: SlideMasterLayout;
  /** Regions in reading order; the stage never reorders them visually. */
  regions: SlideRegion[];
}

export function isSlideMediaBlock(block: Block): boolean {
  return (SLIDE_MEDIA_TYPES as readonly string[]).includes(block.type);
}

function withFit(block: Block, fit: ImageFit): Block {
  if ((block.type === 'image' || block.type === 'figure') && block.fit === undefined) {
    return { ...block, fit };
  }
  return block;
}

/** Split blocks into a master's content slots at top-level dividers; empty slots are left out. */
function slotRegions(master: SlideMasterId, blocks: readonly Block[]): SlideRegion[] {
  const slots = SLIDE_MASTER_CONTENT_SLOTS[master];
  const regions: SlideRegion[] = slots.map((slot) => ({ slot, blocks: [] }));
  let current = 0;
  for (const block of blocks) {
    if (block.type === 'divider' && current < slots.length - 1) {
      current += 1;
      continue;
    }
    regions[current]?.blocks.push(withFit(block, SLIDE_REGION_FIT.body));
  }
  const filled = regions.filter((region) => region.blocks.length > 0);
  return filled.length > 0 ? filled : [{ slot: slots[0] ?? 'body', blocks: [] }];
}

/**
 * Place a slide's blocks into its master's regions. `media-left` and
 * `media-right` move the first top-level media block into a `media` region,
 * before or after the body in reading order. The other masters split their
 * blocks into the named slots of {@link SLIDE_MASTER_CONTENT_SLOTS} at
 * top-level dividers. Image fit follows {@link SLIDE_REGION_FIT}. The slide
 * is not mutated.
 */
export function composeSlide(slide: Pick<DeckSlide, 'master' | 'blocks'>): ComposedSlide {
  const master = resolveSlideMaster(slide.master);
  const mediaMaster = master.id === 'media-left' || master.id === 'media-right';
  if (!mediaMaster) return { master, regions: slotRegions(master.id, slide.blocks) };
  const mediaIndex = slide.blocks.findIndex(isSlideMediaBlock);
  const body = slide.blocks
    .filter((_block, index) => index !== mediaIndex)
    .map((block) => withFit(block, SLIDE_REGION_FIT.body));
  const bodyRegion: SlideRegion = { slot: 'body', blocks: body };
  if (mediaIndex < 0) return { master, regions: [bodyRegion] };

  const mediaRegion: SlideRegion = {
    slot: 'media',
    blocks: [withFit(slide.blocks[mediaIndex] as Block, SLIDE_REGION_FIT.media)],
  };
  return {
    master,
    regions: master.id === 'media-left' ? [mediaRegion, bodyRegion] : [bodyRegion, mediaRegion],
  };
}
