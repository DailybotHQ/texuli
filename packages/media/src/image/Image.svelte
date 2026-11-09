<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import type { ClassValue } from 'svelte/elements';
import {
  focalPointPosition,
  intrinsicSize,
  normalizeFit,
  resolveImageSources,
  resolvePlaceholder,
} from './model.ts';
import type { ImageProps, ImageStatus } from './types.ts';

/**
 * Image: responsive `srcset`, focal point, blur-up or color placeholder, lazy
 * loading and the image URL policy on every source. A blocked or failed
 * source shows a labeled fallback instead of a broken image. With `href` it
 * is a link, with `onactivate` a button: both are native, so the keyboard
 * works without extra wiring.
 */
let {
  src,
  srcDark,
  darkMode = 'theme',
  srcset,
  sizes,
  widths,
  loader,
  alt,
  width,
  height,
  fit = 'cover',
  focalPoint,
  placeholder,
  loading = 'lazy',
  fetchPriority = 'auto',
  trust = 'untrusted',
  href,
  onactivate,
  actionLabel,
  labels,
  class: className,
  onload,
  onerror,
  onstatus,
}: ImageProps & { class?: ClassValue } = $props();

const sources = $derived(resolveImageSources({ src, srcset, sizes, widths, loader, trust }));
/**
 * The dark source (D-G-023): the same image policy and trust tier as `src`,
 * plus the loader's widths. A blocked `srcDark` leaves the light image alone.
 */
const darkSources = $derived(
  sources.src && srcDark !== undefined && srcDark !== null && srcDark !== ''
    ? resolveImageSources({ src: srcDark, sizes, widths, loader, trust })
    : undefined
);
const dark = $derived(darkSources?.src ? darkSources : undefined);
/** `theme`: two images, CSS shows the one the theme (or the OS) picks. */
const pair = $derived(dark !== undefined && darkMode !== 'system');
const size = $derived(intrinsicSize(width, height));
const fill = $derived(normalizeFit(fit));
const backdrop = $derived(resolvePlaceholder(placeholder, trust));
// Same trust tier as image sources: developer for app-authored props,
// untrusted (default) for agent or user content.
const link = $derived(href === undefined ? undefined : safeHref(href, trust));
const position = $derived(focalPoint === undefined ? undefined : focalPointPosition(focalPoint));
const unavailable = $derived(labels?.unavailable ?? 'Image unavailable');
/** Sized boxes fill their container up to the intrinsic width. */
const cap = $derived(size ? `min(100%, ${size.width}px)` : undefined);

/** The source a load or error event belongs to, so a new `src` starts over. */
const key = $derived(`${sources.src ?? ''} ${sources.srcset ?? ''} ${dark?.src ?? ''}`);
let loadedKey = $state<string | undefined>();
let failedKey = $state<string | undefined>();
const status: ImageStatus = $derived(
  !sources.src ? 'blocked' : failedKey === key ? 'error' : loadedKey === key ? 'loaded' : 'loading'
);

let element = $state<HTMLImageElement>();
let darkElement = $state<HTMLImageElement>();

function hidden(node: Element): boolean {
  return typeof getComputedStyle === 'function' && getComputedStyle(node).display === 'none';
}

function settle(next: 'loaded' | 'error', event?: Event) {
  // In a theme pair, a failure of the image the theme hides is not shown.
  if (
    next === 'error' &&
    pair &&
    event?.currentTarget instanceof Element &&
    hidden(event.currentTarget)
  ) {
    return;
  }
  if (next === 'loaded') loadedKey = key;
  else failedKey = key;
  if (event) (next === 'loaded' ? onload : onerror)?.(event);
}

// A cached image can finish loading before the listeners attach. Only a
// decoded image counts: `complete` alone is also true for broken requests.
$effect(() => {
  for (const img of [element, darkElement]) {
    if (img?.complete && img.naturalWidth > 0) settle('loaded');
  }
});

$effect(() => {
  onstatus?.(status);
});
</script>

{#snippet img(source: { src?: string; srcset?: string; sizes?: string }, scheme?: 'light' | 'dark')}
  {#if scheme === 'dark'}
    <img
      bind:this={darkElement}
      class="tx-image-img"
      data-scheme="dark"
      src={source.src}
      srcset={source.srcset}
      sizes={source.sizes}
      alt=""
      width={size?.width}
      height={size?.height}
      {loading}
      fetchpriority={fetchPriority}
      decoding="async"
      referrerpolicy={trust === 'untrusted' ? 'no-referrer' : undefined}
      style:object-position={position}
      onload={(event) => settle('loaded', event)}
      onerror={(event) => settle('error', event)}
    />
  {:else}
    <img
      bind:this={element}
      class="tx-image-img"
      data-scheme={scheme}
      src={source.src}
      srcset={source.srcset}
      sizes={source.sizes}
      alt={scheme ? '' : alt}
      width={size?.width}
      height={size?.height}
      {loading}
      fetchpriority={fetchPriority}
      decoding="async"
      referrerpolicy={trust === 'untrusted' ? 'no-referrer' : undefined}
      style:object-position={position}
      onload={(event) => settle('loaded', event)}
      onerror={(event) => settle('error', event)}
    />
  {/if}
{/snippet}

{#snippet picture()}
  <span
    class={['tx-image', className]}
    data-tx-component="media-image"
    data-tx-image=""
    data-status={status}
    data-fit={fill}
    data-sized={size ? '' : undefined}
    style:aspect-ratio={size?.ratio}
    style:max-inline-size={cap}
    style:background-color={backdrop.kind === 'color' && status === 'loading' ? backdrop.color : undefined}
    data-pair={pair ? 'theme' : dark ? 'system' : undefined}
    role={pair && alt && status !== 'blocked' && status !== 'error' ? 'img' : undefined}
    aria-label={pair && alt && status !== 'blocked' && status !== 'error' ? alt : undefined}
  >
    {#if status === 'blocked' || status === 'error'}
      <span
        class="tx-image-fallback"
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : 'true'}
      >
        <span class="tx-image-fallback-text" aria-hidden="true">{unavailable}</span>
      </span>
    {:else}
      {#if pair && dark}
        {@render img(sources, 'light')}
        {@render img(dark, 'dark')}
      {:else if dark}
        <picture>
          <source media="(prefers-color-scheme: dark)" srcset={dark.srcset ?? dark.src} sizes={dark.srcset ? dark.sizes : undefined} />
          {@render img(sources)}
        </picture>
      {:else}
        {@render img(sources)}
      {/if}
      {#if backdrop.kind === 'blur'}
        <img
          class="tx-image-blur"
          class:tx-image-blur-done={status === 'loaded'}
          src={backdrop.src}
          alt=""
          aria-hidden="true"
          decoding="async"
          referrerpolicy={trust === 'untrusted' ? 'no-referrer' : undefined}
          style:object-position={position}
        />
      {/if}
    {/if}
  </span>
{/snippet}

{#if link}
  <a class="tx-image-action" data-tx-component="media-image" href={link} aria-label={actionLabel} data-sized={size ? '' : undefined} style:max-inline-size={cap}
    >{@render picture()}</a
  >
{:else if onactivate}
  <button
    type="button"
    class="tx-image-action"
    data-tx-component="media-image"
    aria-label={actionLabel}
    data-sized={size ? '' : undefined}
    style:max-inline-size={cap}
    onclick={onactivate}>{@render picture()}</button
  >
{:else}
  {@render picture()}
{/if}

<style>
  @layer tx.components {
    .tx-image {
      position: relative;
      display: inline-block;
      overflow: hidden;
      max-inline-size: 100%;
      vertical-align: middle;
      border-radius: inherit;
    }
    .tx-image-img {
      display: block;
      max-inline-size: 100%;
      block-size: auto;
      object-fit: cover;
      border-radius: inherit;
    }
    /* Sized: fill the container up to the intrinsic width (inline max-inline-size). */
    .tx-image[data-sized],
    .tx-image-action[data-sized] {
      inline-size: 100%;
    }
    .tx-image[data-sized] .tx-image-img,
    .tx-image-blur {
      inline-size: 100%;
      block-size: 100%;
    }
    .tx-image[data-fit='contain'] .tx-image-img {
      object-fit: contain;
    }
    .tx-image[data-fit='fill'] .tx-image-img {
      object-fit: fill;
    }
    .tx-image[data-fit='none'] .tx-image-img {
      object-fit: none;
    }
    .tx-image[data-fit='scale-down'] .tx-image-img {
      object-fit: scale-down;
    }
    /*
     * A theme pair (srcDark, darkMode="theme"): both images render and the
     * nearest color-mode scope picks one through two inherited switches. The OS
     * preference sets them on the root; an explicit .dark / .light class or
     * data-tx-mode (as applyColorMode writes) sets them on its own scope and
     * wins, since the nearest ancestor's value is the one inherited.
     */
    .tx-image-img[data-scheme='light'] {
      display: var(--_tx-image-light, block);
    }
    .tx-image-img[data-scheme='dark'] {
      display: var(--_tx-image-dark, none);
    }
    @media (prefers-color-scheme: dark) {
      :global(:where(:root)) {
        --_tx-image-light: none;
        --_tx-image-dark: block;
      }
    }
    :global(:where(.dark, [data-tx-mode='dark'])) {
      --_tx-image-light: none;
      --_tx-image-dark: block;
    }
    :global(:where(.light, [data-tx-mode='light'])) {
      --_tx-image-light: block;
      --_tx-image-dark: none;
    }
    /* Blur-up: the tiny image sits on top and fades away once the full one loads. */
    .tx-image-blur {
      position: absolute;
      inset: 0;
      object-fit: cover;
      filter: blur(1rem);
      transform: scale(1.1);
      transition: opacity var(--tx-motion-base, 200ms) var(--tx-motion-easing, ease-out);
      pointer-events: none;
    }
    .tx-image-blur-done {
      opacity: 0;
    }
    .tx-image-fallback {
      display: grid;
      place-items: center;
      box-sizing: border-box;
      inline-size: 100%;
      block-size: 100%;
      min-block-size: 4rem;
      min-inline-size: 8rem;
      padding: var(--tx-space-3);
      border: var(--tx-border-width-thin) dashed var(--tx-border-strong, currentColor);
      border-radius: inherit;
      background-color: var(--tx-muted, Canvas);
      color: var(--tx-muted-foreground, CanvasText);
      font-size: var(--tx-type-label-size);
      text-align: center;
    }
    .tx-image-action {
      display: inline-block;
      max-inline-size: 100%;
      padding: 0;
      border: 0;
      border-radius: var(--tx-shape-radius-lg);
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .tx-image-action > .tx-image {
      display: block;
    }
    .tx-image-action:focus-visible {
      outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
      outline-offset: var(--tx-focus-ring-offset, 2px);
    }
    @media (prefers-reduced-motion: reduce) {
      .tx-image-blur {
        transition: none;
      }
    }
    @media (forced-colors: active) {
      .tx-image-fallback {
        border-color: CanvasText;
        background-color: Canvas;
        color: CanvasText;
      }
      .tx-image-action:focus-visible {
        outline-color: Highlight;
      }
    }
  }
</style>
