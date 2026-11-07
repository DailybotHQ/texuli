<script lang="ts">
import type { HrefTrust } from '@texuli/core/url-policy';
import {
  type AvatarImageLoadingStatus,
  Avatar as AvatarPrimitive,
} from '@texuli/primitives/avatar';
import type { HTMLAttributes } from 'svelte/elements';
import { type ClassValue, cx } from '../../internal/cx.ts';
import { avatarInitials, avatarToneIndex } from './initials.ts';
import { avatarSrcset } from './srcset.ts';
import {
  AVATAR_PIXELS,
  type AvatarShape,
  type AvatarSize,
  type AvatarStatus,
  type AvatarTone,
  avatarRootClass,
  avatarStatusClass,
} from './variants.ts';
import './avatar.css';
import { designDefaults } from '../../internal/design-defaults.ts';

type Props = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Display name used for initials, tone and the default accessible name. */
  name: string;
  /** Optional image URL (URL policy via the avatar primitive). */
  src?: string | null;
  /** Trust tier for `src` and every `srcset` candidate. Default `untrusted`. */
  srcTrust?: HrefTrust;
  /**
   * Responsive candidates for the image (`a.webp 1x, b.webp 2x` or width
   * descriptors). Each candidate URL passes the image URL policy at
   * `srcTrust`; refused ones are dropped. Used only with `src`.
   */
  srcset?: string | null;
  /** The `sizes` attribute for width-descriptor candidates. */
  sizes?: string;
  size?: AvatarSize;
  /**
   * Fill the initials surface with a theme tone (`primary`, `success`,
   * `warning`, `destructive`, `info` or `neutral`) instead of the seeded
   * ring: each is a background and foreground pair the AA gate checks.
   */
  tone?: AvatarTone;
  /** `circle` or `square` (the medium shape radius) for this avatar; omit for the theme's avatar radius. */
  shape?: AvatarShape;
  /** Presence indicator. Omit for none. */
  status?: AvatarStatus;
  /**
   * When true the avatar is decorative (next to a visible name): no accessible
   * name and `aria-hidden` on the root.
   */
  decorative?: boolean;
  /** Delay before revealing a loaded image (primitive `delayMs`). */
  delayMs?: number;
  /** Override the computed initials. */
  initials?: string;
  class?: ClassValue;
  /** The rendered root element (bindable). */
  ref?: HTMLElement | null;
};

const txDefaults = designDefaults('avatar');
let {
  name,
  src = null,
  srcTrust = 'untrusted',
  srcset,
  sizes,
  size = txDefaults().size ?? 'md',
  tone,
  shape,
  status,
  decorative = false,
  delayMs = 0,
  initials: initialsProp,
  class: className,
  'aria-label': ariaLabel,
  title,
  ref = $bindable(null),
  ...rest
}: Props = $props();

const statusLabel = $derived(
  status === 'online'
    ? 'Online'
    : status === 'away'
      ? 'Away'
      : status === 'busy'
        ? 'Busy'
        : status === 'offline'
          ? 'Offline'
          : undefined
);
const label = $derived(
  decorative
    ? undefined
    : statusLabel
      ? `${ariaLabel ?? name}, ${statusLabel}`
      : (ariaLabel ?? name)
);
const letters = $derived(initialsProp ?? avatarInitials(name));
const seededTone = $derived(avatarToneIndex(name));
const pixels = $derived(AVATAR_PIXELS[size]);
const safeSrcset = $derived(avatarSrcset(srcset, srcTrust));
/** The primitive's image status: `error` (failed or refused) shows the initials. */
let loadingStatus = $state<AvatarImageLoadingStatus>('loading');
const rootClass = $derived(
  avatarRootClass({
    size,
    class: className,
  })
);
</script>

<div
  bind:this={ref}
  class={rootClass}
  data-tx-avatar
  data-size={size}
  data-status={status}
  data-tone={tone}
  data-shape={shape}
  data-avatar={src && loadingStatus !== 'error' ? 'image' : 'initials'}
  role={decorative ? undefined : 'img'}
  aria-label={label}
  aria-hidden={decorative ? true : undefined}
  title={decorative ? undefined : (title ?? name)}
  {...rest}
>
  <AvatarPrimitive.Root
    class="tx-avatar__surface"
    data-tone={seededTone}
    {delayMs}
    bind:loadingStatus
    aria-hidden="true"
  >
    {#if src}
      <AvatarPrimitive.Image
        {src}
        {srcTrust}
        srcset={safeSrcset}
        sizes={safeSrcset ? sizes : undefined}
        alt=""
        width={pixels}
        height={pixels}
        loading="lazy"
        decoding="async"
        class="tx-avatar__image"
      />
    {/if}
    <AvatarPrimitive.Fallback class="tx-avatar__fallback">{letters}</AvatarPrimitive.Fallback>
  </AvatarPrimitive.Root>
  {#if status}
    <span
      class={avatarStatusClass({ status })}
      data-tx-avatar-status
      aria-hidden="true"
      title={decorative ? undefined : statusLabel}
    ></span>
  {/if}
</div>
