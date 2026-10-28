/**
 * The built-in free-slide renderer's model: each top-level item checked by the
 * blocks schema at paint (the deck parse already ran the same check; this
 * second pass gives the renderer typed blocks with their defaults), then
 * placed into the slide master's regions exactly like v1 (`composeSlide`),
 * while keeping each item's index so the step context can find its
 * fragments (`['blocks', index]`).
 */
import { type Block, safeParseBlock } from '@texuli/blocks/core';
import type { FreeSlide, SlideComponentItem, SlideItem } from '@texuli/deck/model';
import { stripStepFields } from '@texuli/deck/model';
import {
  isSlideMediaBlock,
  SLIDE_MASTER_CONTENT_SLOTS,
  SLIDE_REGION_FIT,
  type SlideRegionSlot,
} from '../model/compose.ts';
import { resolveSlideMaster, type SlideMasterLayout } from '../model/index.ts';

export type FreeSlideEntry =
  | { kind: 'block'; index: number; block: Block }
  | { kind: 'component'; index: number; item: SlideComponentItem }
  /** A block the paint-time check refused (the deck parse should have caught it). */
  | { kind: 'invalid'; index: number };

export interface FreeSlideRegion {
  slot: SlideRegionSlot;
  entries: FreeSlideEntry[];
}

export interface ComposedFreeSlide {
  master: SlideMasterLayout;
  regions: FreeSlideRegion[];
}

function isComponent(item: SlideItem): item is SlideComponentItem {
  return item.type === 'component';
}

/** One item as the renderer paints it. */
export function freeSlideEntry(item: SlideItem, index: number): FreeSlideEntry {
  if (isComponent(item)) return { kind: 'component', index, item };
  const parsed = safeParseBlock(stripStepFields(item));
  return parsed.success ? { kind: 'block', index, block: parsed.data } : { kind: 'invalid', index };
}

function withFit(entry: FreeSlideEntry, fit: 'cover' | 'contain'): FreeSlideEntry {
  if (entry.kind !== 'block') return entry;
  const block = entry.block;
  if ((block.type === 'image' || block.type === 'figure') && block.fit === undefined) {
    return { ...entry, block: { ...block, fit } };
  }
  return entry;
}

/** Place a free slide's items into its master's regions (v1 `composeSlide` rules). */
export function composeFreeSlide(slide: Pick<FreeSlide, 'master' | 'blocks'>): ComposedFreeSlide {
  const master = resolveSlideMaster(slide.master);
  const entries = slide.blocks.map((item, index) => freeSlideEntry(item, index));
  if (master.id === 'media-left' || master.id === 'media-right') {
    const mediaAt = entries.findIndex(
      (entry) => entry.kind === 'block' && isSlideMediaBlock(entry.block)
    );
    const body: FreeSlideRegion = {
      slot: 'body',
      entries: entries
        .filter((_, i) => i !== mediaAt)
        .map((entry) => withFit(entry, SLIDE_REGION_FIT.body)),
    };
    const media = entries[mediaAt];
    if (!media) return { master, regions: [body] };
    const mediaRegion: FreeSlideRegion = {
      slot: 'media',
      entries: [withFit(media, SLIDE_REGION_FIT.media)],
    };
    return {
      master,
      regions: master.id === 'media-left' ? [mediaRegion, body] : [body, mediaRegion],
    };
  }
  const slots = SLIDE_MASTER_CONTENT_SLOTS[master.id];
  const regions: FreeSlideRegion[] = slots.map((slot) => ({ slot, entries: [] }));
  let current = 0;
  for (const entry of entries) {
    if (entry.kind === 'block' && entry.block.type === 'divider' && current < slots.length - 1) {
      current += 1;
      continue;
    }
    regions[current]?.entries.push(withFit(entry, SLIDE_REGION_FIT.body));
  }
  const filled = regions.filter((region) => region.entries.length > 0);
  return {
    master,
    regions: filled.length > 0 ? filled : [{ slot: slots[0] ?? 'body', entries: [] }],
  };
}
