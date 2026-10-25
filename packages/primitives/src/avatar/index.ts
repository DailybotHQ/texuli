/**
 * Avatar — image with loading status and delayed reveal (T-prim-avatar).
 * Parts: `Avatar.Root`, `Avatar.Image` and `Avatar.Fallback`.
 */

import Fallback from './AvatarFallback.svelte';
import Image from './AvatarImage.svelte';
import Root from './AvatarRoot.svelte';

export const Avatar = {
  Root,
  Image,
  Fallback,
};

export { avatarContext } from './context.ts';
export type {
  AvatarContext,
  AvatarFallbackProps,
  AvatarFallbackProps as FallbackProps,
  AvatarImageLoadingStatus,
  AvatarImageProps,
  AvatarImageProps as ImageProps,
  AvatarRootProps,
  AvatarRootProps as RootProps,
} from './types.ts';
