<script lang="ts">
import { filterImageSrcset, safeImageSrc } from '@texuli/core/url-policy';
import { type PrimitiveState, stateAttributes } from '../internal/index.ts';
import { avatarContext } from './context.ts';
import type { AvatarImageProps } from './types.ts';

/**
 * Avatar image: runs `src` through the image URL policy and every `srcset`
 * candidate through `filterImageSrcset` at the same trust (dropping `sizes`
 * when no candidate survives), tracks load/error, and only paints once the
 * root status is `loaded` (after optional delayMs).
 *
 * While loading, the image is rendered but visually hidden (opacity 0, one
 * pixel, out of flow), never `hidden`: a host rule such as
 * `[hidden] { display: none !important }` would stop the browser from
 * rendering, and so from ever fetching, a lazy image (G79). It stays
 * `aria-hidden`, so assistive technology meets the fallback only.
 */
let {
  src = null,
  srcTrust = 'untrusted',
  srcset,
  sizes,
  alt = '',
  ref = $bindable(null),
  class: className,
  style,
  onload,
  onerror,
  ...rest
}: AvatarImageProps = $props();

const avatar = avatarContext.get();
let delayTimer: ReturnType<typeof setTimeout> | undefined;
/** Sentinel so the first `undefined` src still runs the error path. */
const SRC_UNSET = Symbol('avatar-src-unset');
/** Last source we started a load cycle for (avoids resetting after a successful load). */
let trackedSrc: string | undefined | typeof SRC_UNSET = SRC_UNSET;

const safeSrc = $derived(src == null || src === '' ? undefined : safeImageSrc(src, srcTrust));
const safeSrcset = $derived(filterImageSrcset(srcset, srcTrust));
const status = $derived(avatar.status());
const visible = $derived(status === 'loaded');
/**
 * Visually hidden while loading, but rendered and intersecting the viewport,
 * so a lazy image still loads. No `clip-path`: Chromium does not fetch a lazy
 * image clipped to nothing.
 */
const LOADING_STYLE =
  'position:absolute;inline-size:1px;block-size:1px;margin:0;padding:0;border:0;' +
  'opacity:0;pointer-events:none';
const imageStyle = $derived(
  visible ? (style ?? undefined) : style ? `${style};${LOADING_STYLE}` : LOADING_STYLE
);

function clearDelay(): void {
  if (delayTimer !== undefined) {
    clearTimeout(delayTimer);
    delayTimer = undefined;
  }
}

function scheduleLoaded(): void {
  clearDelay();
  const wait = Math.max(0, avatar.delayMs());
  if (wait === 0) {
    avatar.setStatus('loaded');
    return;
  }
  // Keep status at loading until the delay elapses so Fallback stays visible.
  delayTimer = setTimeout(() => {
    delayTimer = undefined;
    avatar.setStatus('loaded');
  }, wait);
}

function handleLoad(event: Event): void {
  if (typeof onload === 'function') {
    // @ts-expect-error HTMLImageElement handler
    onload(event);
  }
  if (event.defaultPrevented) return;
  scheduleLoaded();
}

function handleError(event: Event): void {
  clearDelay();
  if (typeof onerror === 'function') {
    // @ts-expect-error HTMLImageElement handler
    onerror(event);
  }
  if (event.defaultPrevented) return;
  avatar.setStatus('error');
}

// Start a new load cycle only when the validated source changes.
$effect(() => {
  const next = safeSrc;
  if (next === trackedSrc) return;
  trackedSrc = next;
  clearDelay();
  if (next === undefined) {
    avatar.setStatus('error');
    return;
  }
  avatar.setStatus('loading');
  return () => clearDelay();
});

// If the browser already completed the image (cached), promote without a new event.
$effect(() => {
  const node = ref;
  const next = safeSrc;
  if (!node || !next || avatar.status() !== 'loading') return;
  if (node.complete && node.naturalWidth > 0) {
    scheduleLoaded();
  }
});
</script>

{#if safeSrc && status !== 'error'}
  <!--
    Keep the img in the DOM, and rendered, while loading so the browser
    fetches it and fires load/error. Visually hidden until status is loaded
    (after delayMs).
  -->
  <img
    bind:this={ref}
    src={safeSrc}
    {alt}
    class={typeof className === 'string' ? className : undefined}
    {...stateAttributes(status as PrimitiveState)}
    data-tx-avatar-image=""
    aria-hidden={visible ? undefined : true}
    onload={handleLoad}
    onerror={handleError}
    {...rest}
    style={imageStyle}
    srcset={safeSrcset}
    sizes={safeSrcset ? sizes : undefined}
  />
{/if}
