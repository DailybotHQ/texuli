import type {
  FocalPoint,
  ImageFetchPriority,
  ImageFit,
  ImageLoader,
  ImageLoading,
  ImagePlaceholder,
  ImageTrust,
} from './model.ts';

/** `blocked`: the URL policy rejected the source; `error`: the browser failed to load it. */
export type ImageStatus = 'loading' | 'loaded' | 'error' | 'blocked';

/** Translatable strings the component renders itself. */
export interface ImageLabels {
  /** Visible text in the fallback for a blocked or failed image. */
  unavailable: string;
}

export interface ImageProps {
  /** Image URL; untrusted by default (HTTPS or a relative path). */
  src: unknown;
  /** Explicit `srcset`; validated as a whole (one unsafe candidate drops it). */
  srcset?: unknown;
  /** `sizes` for the srcset: media conditions and lengths only. */
  sizes?: unknown;
  /** Generate the srcset from `src` at these widths with `loader`. */
  widths?: readonly number[];
  loader?: ImageLoader;
  /** Required. Describe the image, or pass `""` for a decorative one. */
  alt: string;
  /** Intrinsic size in CSS pixels: reserves the box before the image loads. */
  width?: number;
  height?: number;
  fit?: ImageFit;
  /** Point to keep in view when `fit` crops (0–1 from the top-left). */
  focalPoint?: FocalPoint;
  placeholder?: ImagePlaceholder;
  loading?: ImageLoading;
  fetchPriority?: ImageFetchPriority;
  /** `developer` also allows HTTP, blob and bounded data images. */
  trust?: ImageTrust;
  /** Makes the image a link (through `safeHref`). */
  href?: string;
  /** Makes the image a button. */
  onactivate?: (event: MouseEvent) => void;
  /** Accessible name for the link or button when `alt` is empty or not enough. */
  actionLabel?: string;
  labels?: Partial<ImageLabels>;
  onload?: (event: Event) => void;
  onerror?: (event: Event) => void;
  /** Called with every status change. */
  onstatus?: (status: ImageStatus) => void;
}
