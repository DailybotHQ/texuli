import type { HrefTrust } from '@texuli/core/url-policy';
import type { Snippet } from 'svelte';
import type { HTMLAttributes, HTMLImgAttributes } from 'svelte/elements';
import type { ChildSnippet } from '../internal/index.ts';

/** Image loading lifecycle for Avatar.Root / Image / Fallback. */
export type AvatarImageLoadingStatus = 'loading' | 'loaded' | 'error';

export type AvatarRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /**
   * Milliseconds to wait after the image loads before exposing it (and hiding
   * the fallback). Avoids a flash when the network is fast.
   * @default 0
   */
  delayMs?: number;
  /**
   * Controlled loading status. Pass `"loaded"` to skip the loading path when
   * the host already knows the image is available.
   */
  loadingStatus?: AvatarImageLoadingStatus;
  onLoadingStatusChange?: (status: AvatarImageLoadingStatus) => void;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  ref?: HTMLDivElement | null;
};

export type AvatarImageProps = Omit<HTMLImgAttributes, 'children' | 'src'> & {
  /** Image URL; validated with `safeImageSrc` before use. */
  src?: string | null;
  /** Trust level for the URL policy. @default `'untrusted'` */
  srcTrust?: HrefTrust;
  alt?: string;
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  ref?: HTMLImageElement | null;
};

export type AvatarFallbackProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  child?: ChildSnippet<Record<string, unknown>>;
  children?: Snippet;
  ref?: HTMLSpanElement | null;
};

export type AvatarContext = {
  status: () => AvatarImageLoadingStatus;
  setStatus: (status: AvatarImageLoadingStatus) => void;
  delayMs: () => number;
  /** Stable id shared by root and image for a11y wiring. */
  rootId: string;
};
