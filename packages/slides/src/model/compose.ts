import type { Block, ImageFit } from '@texuli/blocks/core';
import {
  type DeckSlide,
  resolveSlideMaster,
  type SlideMasterLayout,
  type SlideMasterSlot,
} from './index.ts';

/** Block types the stage treats as slide media. */
export const SLIDE_MEDIA_TYPES = ['image', 'figure', 'video', 'gallery'] as const;
export type SlideMediaType = (typeof SLIDE_MEDIA_TYPES)[number];

/**
 * How images fit in each region: a media region fills its frame (`cover`,
 * cropping if needed); body regions never crop (`contain`). A block's own
 * `fit` always wins.
 */
export const SLIDE_REGION_FIT: Readonly<Record<'media' | 'body', ImageFit>> = Object.freeze({
  media: 'cover',
  body: 'contain',
});

export interface SlideRegion {
  slot: Extract<SlideMasterSlot, 'media' | 'body'>;
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

/**
 * Place a slide's blocks into its master's regions. `media-left` and
 * `media-right` move the first top-level media block into a `media` region,
 * before or after the body in reading order; every other master keeps one
 * `body` region. Image fit follows {@link SLIDE_REGION_FIT}. The slide is not
 * mutated.
 */
export function composeSlide(slide: Pick<DeckSlide, 'master' | 'blocks'>): ComposedSlide {
  const master = resolveSlideMaster(slide.master);
  const mediaMaster = master.id === 'media-left' || master.id === 'media-right';
  const mediaIndex = mediaMaster ? slide.blocks.findIndex(isSlideMediaBlock) : -1;
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
