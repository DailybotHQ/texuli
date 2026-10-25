/**
 * `@texuli/blocks/media/engine` — Svelte-free media family guards, labels and URL resolve.
 */

import type {
  Block,
  FieldIssue,
  FigureBlock,
  GalleryBlock,
  ImageBlock,
  VideoBlock,
} from '../core/index.ts';
import type { MediaBlockLabelOverrides } from './labels.ts';

export { checkMediaBlock, type MediaBlockCheck } from './check.ts';
export {
  DEFAULT_MEDIA_BLOCK_LABELS,
  type MediaBlockLabelOverrides,
  type MediaBlockLabels,
  resolveMediaBlockLabels,
} from './labels.ts';
export { resolveBlockMediaSrc } from './resolve.ts';

export const MEDIA_BLOCK_TYPES = ['image', 'figure', 'video', 'gallery'] as const;
export type MediaFamilyBlockType = (typeof MEDIA_BLOCK_TYPES)[number];
export type MediaFamilyBlock = ImageBlock | FigureBlock | VideoBlock | GalleryBlock;

export function isMediaFamilyBlock(block: Block): block is MediaFamilyBlock {
  return (MEDIA_BLOCK_TYPES as readonly string[]).includes(block.type);
}

export interface MediaBlockViewProps {
  block: unknown;
  labels?: MediaBlockLabelOverrides;
  resolveAvatar?: (id: string) => string | undefined;
  oninvalid?: (issues: FieldIssue[]) => void;
}
