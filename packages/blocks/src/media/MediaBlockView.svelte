<script lang="ts">
import { onMount } from 'svelte';
import { checkMediaBlock } from './check.ts';
import type { MediaBlockViewProps } from './family.ts';
import { resolveMediaBlockLabels } from './labels.ts';
import { resolveBlockMediaSrc } from './resolve.ts';

/**
 * Media family renderer: image, figure, video and gallery. Untrusted data
 * passes `checkMediaBlock` before anything renders; rejected blocks become an
 * inert notice. Sources use the block media classifier (no remote URLs).
 */
let { block, labels, resolveAvatar, oninvalid }: MediaBlockViewProps = $props();

const check = $derived(checkMediaBlock(block));
const text = $derived(resolveMediaBlockLabels(labels));

let reducedMotion = $state(false);
let motionKnown = $state(false);

onMount(() => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => {
    reducedMotion = query.matches;
  };
  update();
  motionKnown = true;
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
});

$effect(() => {
  if (!check.ok) oninvalid?.(check.issues);
});

function imageAlt(decorative: boolean | undefined, alt: string | undefined): string {
  return decorative === true ? '' : (alt ?? '');
}
</script>

{#if !check.ok}
  <p class="tx-block tx-block-invalid" role="note" data-tx-block="invalid">{text.invalid}</p>
{:else}
  {@const b = check.block}
  {#if b.type === 'image' || b.type === 'figure'}
    {@const src = resolveBlockMediaSrc(b.src, 'image', resolveAvatar)}
    <figure
      class="tx-block tx-media-figure"
      data-tx-block={b.type}
      data-tone={b.tone}
      data-fit={b.fit ?? 'cover'}
    >
      {#if src}
        <img
          {src}
          alt={imageAlt(b.decorative, b.alt)}
          width={b.width}
          height={b.height}
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          class="tx-media-img"
          data-tx-media-img
        />
      {:else}
        <span class="tx-media-fallback" role="img" aria-label={imageAlt(b.decorative, b.alt) || text.galleryFallback}
          >{text.galleryFallback}</span
        >
      {/if}
      {#if b.caption || b.credit}
        <figcaption class="tx-media-caption" data-tx-media-caption>
          {#if b.caption}<span class="tx-media-caption-text">{b.caption}</span>{/if}
          {#if b.credit}
            <span class="tx-media-credit">{b.caption ? ` · ${b.credit}` : b.credit}</span>
          {/if}
        </figcaption>
      {/if}
    </figure>
  {:else if b.type === 'video'}
    {@const src = resolveBlockMediaSrc(b.src, 'video')}
    {@const poster = b.poster ? resolveBlockMediaSrc(b.poster, 'image', resolveAvatar) : undefined}
    {@const canAutoplay = b.autoplay === true && b.muted === true && motionKnown && !reducedMotion}
    <figure class="tx-block tx-media-figure" data-tx-block="video" data-tone={b.tone}>
      {#if src}
        <video
          {src}
          {poster}
          width={b.width}
          height={b.height}
          aria-label={b.label}
          controls={b.controls !== false}
          playsinline
          muted={b.muted === true || canAutoplay}
          loop={b.loop === true}
          autoplay={canAutoplay}
          preload="metadata"
          class="tx-media-video"
          data-tx-media-video
        ></video>
      {:else}
        <span class="tx-media-fallback" role="img" aria-label={b.label}>{text.galleryFallback}</span>
      {/if}
      {#if b.caption}
        <figcaption class="tx-media-caption" data-tx-media-caption>{b.caption}</figcaption>
      {/if}
    </figure>
  {:else}
    {@const columns = b.columns ?? 3}
    <section
      class="tx-block tx-media-gallery"
      data-tx-block="gallery"
      data-tone={b.tone}
      data-columns={columns}
      aria-label={b.title}
      style={`--tx-gallery-cols: ${columns}`}
    >
      {#if b.title}
        <h3 class="tx-media-gallery-title" data-tx-media-gallery-title>{b.title}</h3>
      {/if}
      <ul class="tx-media-gallery-list" data-tx-media-gallery-list>
        {#each b.items as item, i (i)}
          {@const src = resolveBlockMediaSrc(item.src, 'image', resolveAvatar)}
          <li class="tx-media-gallery-item">
            <figure class="tx-media-gallery-figure">
              {#if src}
                <img
                  {src}
                  alt={imageAlt(item.decorative, item.alt)}
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                  class="tx-media-img"
                  data-tx-media-img
                />
              {:else}
                <span
                  class="tx-media-fallback"
                  role="img"
                  aria-label={imageAlt(item.decorative, item.alt) || text.galleryFallback}
                  >{text.galleryFallback}</span
                >
              {/if}
              {#if item.caption}
                <figcaption class="tx-media-caption" data-tx-media-caption>{item.caption}</figcaption>
              {/if}
            </figure>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/if}

<style>
  .tx-block {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--tx-foreground, CanvasText);
  }

  .tx-media-figure,
  .tx-media-gallery-figure {
    display: grid;
    gap: var(--tx-space-2);
    margin: 0;
  }

  .tx-media-img,
  .tx-media-video {
    display: block;
    max-inline-size: 100%;
    block-size: auto;
    border-radius: var(--tx-shape-radius-md);
    border: var(--tx-border-width-thin) solid var(--tx-border, currentColor);
    background-color: var(--tx-muted, Canvas);
  }

  .tx-media-figure[data-fit='contain'] .tx-media-img {
    object-fit: contain;
  }

  .tx-media-figure[data-fit='cover'] .tx-media-img,
  .tx-media-gallery-figure .tx-media-img {
    object-fit: cover;
  }

  .tx-media-video {
    inline-size: 100%;
  }

  .tx-media-caption {
    margin: 0;
    font-size: var(--tx-type-label-size);
    color: var(--tx-muted-foreground, GrayText);
  }

  .tx-media-credit {
    font-style: normal;
  }

  .tx-media-fallback {
    display: grid;
    place-items: center;
    min-block-size: 6rem;
    padding: var(--tx-space-3);
    border: var(--tx-border-width-thin) dashed var(--tx-border, currentColor);
    border-radius: var(--tx-shape-radius-md);
    background-color: var(--tx-muted, Canvas);
    color: var(--tx-muted-foreground, GrayText);
    font-size: var(--tx-type-label-size);
    text-align: center;
  }

  .tx-media-gallery {
    display: grid;
    gap: var(--tx-space-3);
  }

  .tx-media-gallery-title {
    margin: 0;
    font-size: var(--tx-type-body-size);
    font-weight: var(--tx-type-heading-weight);
  }

  .tx-media-gallery-list {
    display: grid;
    gap: var(--tx-space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    grid-template-columns: repeat(
      auto-fit,
      minmax(min(100%, calc(100% / var(--tx-gallery-cols, 3) - 0.5rem)), 1fr)
    );
  }

  .tx-media-gallery-item {
    margin: 0;
    min-inline-size: 0;
  }

  .tx-block-invalid {
    padding: 0.5em 0.75em;
    border: var(--tx-border-width-thin) dashed currentColor;
    border-radius: 0.375em;
    font-size: 0.875em;
  }

  @media (forced-colors: active) {
    .tx-media-img,
    .tx-media-video,
    .tx-media-fallback {
      border-color: ButtonText;
    }
  }
</style>
