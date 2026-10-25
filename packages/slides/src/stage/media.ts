import type { Block } from '@texuli/blocks/core';
import { type ImageTrust, resolveImageSources } from '@texuli/media/image';
import { resolveVideoSources } from '@texuli/media/video';

/** URL policy tier for deck media at paint. Agent decks use `untrusted`. */
export type DeckMediaTrust = ImageTrust;

export interface DeckMediaGate {
  /** The block to paint, or `null` when the policy left nothing to show. */
  block: Block | null;
  /** JSON paths inside the block whose sources the policy refused. */
  refused: string[];
}

export interface DeckMediaOptions {
  trust?: DeckMediaTrust;
  /** Host adapter for `avatar:` ids; its URLs are checked at the developer tier. */
  resolveAvatar?: (id: string) => string | undefined;
}

const AVATAR = 'avatar:';

/** Wrap a host avatar adapter so only URLs the developer-tier policy keeps reach an `<img>`. */
export function deckAvatarResolver(
  resolveAvatar: ((id: string) => string | undefined) | undefined
): ((id: string) => string | undefined) | undefined {
  if (!resolveAvatar) return undefined;
  return (id) => {
    const url = resolveAvatar(id);
    return url === undefined
      ? undefined
      : resolveImageSources({ src: url, trust: 'developer' }).src;
  };
}

function imageAllowed(src: string, options: DeckMediaOptions): boolean {
  if (src.startsWith(AVATAR)) {
    return deckAvatarResolver(options.resolveAvatar)?.(src.slice(AVATAR.length)) !== undefined;
  }
  return resolveImageSources({ src, trust: options.trust ?? 'untrusted' }).src !== undefined;
}

/**
 * Check a media block's sources with the core URL policy right before it is
 * painted, on top of the block schema's own source rules. Images, figures
 * and posters use `safeImageSrc`, videos `safeMediaSrc` (which refuses `data:`
 * video), and `avatar:` ids must resolve through the host adapter. A refused
 * gallery item is dropped; any other refusal blocks the whole block. Non-media
 * blocks pass through unchanged.
 */
export function gateDeckMedia(block: Block, options: DeckMediaOptions = {}): DeckMediaGate {
  const trust = options.trust ?? 'untrusted';
  switch (block.type) {
    case 'image':
    case 'figure':
      return imageAllowed(block.src, options)
        ? { block, refused: [] }
        : { block: null, refused: ['src'] };
    case 'video': {
      const resolved = resolveVideoSources({ src: block.src, trust });
      const refused: string[] = [];
      if (!resolved.src) refused.push('src');
      if (block.poster !== undefined && !imageAllowed(block.poster, options))
        refused.push('poster');
      return refused.length === 0 ? { block, refused } : { block: null, refused };
    }
    case 'gallery': {
      const refused: string[] = [];
      const items = block.items.filter((item, index) => {
        const ok = imageAllowed(item.src, options);
        if (!ok) refused.push(`items[${index}].src`);
        return ok;
      });
      if (items.length === 0) return { block: null, refused };
      return { block: refused.length === 0 ? block : { ...block, items }, refused };
    }
    default:
      return { block, refused: [] };
  }
}

/**
 * Make every image under `root` load now (print cannot rely on lazy loading)
 * and resolve once each has loaded or failed, or after `timeoutMs`.
 * Resolves to the number of images that were still pending at the timeout.
 */
export function settleDeckImages(root: ParentNode, timeoutMs = 10_000): Promise<number> {
  const pending = [...root.querySelectorAll('img')].filter((image) => {
    image.loading = 'eager';
    return !image.complete;
  });
  if (pending.length === 0) return Promise.resolve(0);
  return new Promise((resolve) => {
    let left = pending.length;
    const timer = setTimeout(() => resolve(left), timeoutMs);
    const done = () => {
      left -= 1;
      if (left === 0) {
        clearTimeout(timer);
        resolve(0);
      }
    };
    for (const image of pending) {
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
    }
  });
}
