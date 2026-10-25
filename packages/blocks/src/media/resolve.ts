import { classifyMediaSource, type MediaKind } from '../core/safety.ts';

/**
 * Resolve a block media `src` after schema validation. Avatars need a host
 * adapter (not shipped here); data and relative sources pass through.
 */
export function resolveBlockMediaSrc(
  src: string,
  kind: MediaKind,
  resolveAvatar?: (id: string) => string | undefined
): string | undefined {
  const result = classifyMediaSource(src, kind);
  if (!result.ok) return undefined;
  if (result.kind === 'avatar') {
    const id = src.slice('avatar:'.length);
    return resolveAvatar?.(id);
  }
  return src;
}
