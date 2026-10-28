<script lang="ts">
/**
 * The root of every catalog layout. It covers the slide body (the stage's
 * padding box) and is a size container, so the layout type scale follows the
 * virtual canvas through container units and reads well on 16:9, 4:3, 9:16
 * and 1:1. Text inherits the slide's background text color (`--tx-deck-bg-text`,
 * which the background resolver holds at 4.5:1 or more), so a layout never
 * picks a text color the scrim did not account for; accents are decorative.
 * A step marker on the props object itself reveals the whole body.
 */
import type { Snippet } from 'svelte';
import type { DeckFragmentAttributes } from '../stage/steps.ts';

interface Props {
  layout: string;
  /** Fragment attributes of the props root (`steps.at([])`). */
  root?: DeckFragmentAttributes;
  /** `edge` drops the frame padding (full-bleed media). */
  bleed?: 'edge';
  children: Snippet;
}

let { layout, root = {}, bleed, children }: Props = $props();
</script>

<div class="tx-deck-layout" data-tx-deck-design={layout} data-tx-deck-bleed={bleed}>
  <div class="tx-deck-layout__body" {...root}>
    {@render children()}
  </div>
</div>

<style>
  .tx-deck-layout {
    /* Type steps in canvas pixels: clamp(min, share of the canvas width, max). */
    --tx-deck-type-display: clamp(56px, 7.5cqi, 112px);
    --tx-deck-type-stat: clamp(96px, 15cqi, 220px);
    --tx-deck-type-title: clamp(40px, 4.2cqi, 60px);
    --tx-deck-type-quote: clamp(36px, 4.4cqi, 60px);
    --tx-deck-type-lead: clamp(28px, 2.6cqi, 36px);
    --tx-deck-type-body: clamp(24px, 2.1cqi, 28px);
    --tx-deck-type-label: clamp(18px, 1.5cqi, 20px);
    --tx-deck-accent: var(--tx-primary, currentColor);
    --tx-deck-layout-pad-block: clamp(40px, 6cqi, 80px);
    --tx-deck-layout-pad-inline: clamp(40px, 7cqi, 96px);
    --tx-deck-layout-gap: clamp(20px, 2.6cqi, 36px);
    --tx-deck-panel: color-mix(in oklch, currentColor 7%, transparent);
    --tx-deck-panel-border: color-mix(in oklch, currentColor 18%, transparent);
    --tx-deck-layout-radius: var(--tx-deck-radius, 0.625rem);
    position: absolute;
    inset: 0;
    container-type: size;
    overflow: hidden;
    color: inherit;
    font-family: var(--tx-font-sans, inherit);
  }

  .tx-deck-layout__body {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--tx-deck-layout-gap);
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    padding-block: var(--tx-deck-layout-pad-block);
    padding-inline: var(--tx-deck-layout-pad-inline);
  }

  .tx-deck-layout[data-tx-deck-bleed="edge"] .tx-deck-layout__body {
    padding: 0;
  }

  /* Shared type roles; layouts add their own placement. */
  .tx-deck-layout :global(.tx-deck-layout__display),
  .tx-deck-layout :global(.tx-deck-layout__title),
  .tx-deck-layout :global(.tx-deck-layout__quote),
  .tx-deck-layout :global(.tx-deck-layout__stat) {
    margin: 0;
    font-family: var(--tx-font-heading, var(--tx-font-sans, inherit));
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .tx-deck-layout :global(.tx-deck-layout__display) {
    font-size: var(--tx-deck-type-display);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -0.03em;
  }

  .tx-deck-layout :global(.tx-deck-layout__title) {
    font-size: var(--tx-deck-type-title);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }

  .tx-deck-layout :global(.tx-deck-layout__quote) {
    font-size: var(--tx-deck-type-quote);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .tx-deck-layout :global(.tx-deck-layout__stat) {
    font-size: var(--tx-deck-type-stat);
    font-weight: 800;
    line-height: 0.92;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
  }

  .tx-deck-layout :global(.tx-deck-layout__lead) {
    margin: 0;
    font-size: var(--tx-deck-type-lead);
    line-height: 1.3;
  }

  .tx-deck-layout :global(.tx-deck-layout__text) {
    margin: 0;
    font-size: var(--tx-deck-type-body);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .tx-deck-layout :global(.tx-deck-layout__label) {
    margin: 0;
    font-size: var(--tx-deck-type-label);
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .tx-deck-layout :global(.tx-deck-layout__caption) {
    margin: 0;
    font-size: var(--tx-deck-type-label);
    line-height: 1.35;
  }

  /* Line clamps keep long (but valid) text inside its box before fit-text shrinks it. */
  .tx-deck-layout :global([data-clamp]) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tx-deck-layout :global([data-clamp="1"]) {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .tx-deck-layout :global([data-clamp="2"]) {
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .tx-deck-layout :global([data-clamp="3"]) {
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .tx-deck-layout :global([data-clamp="5"]) {
    -webkit-line-clamp: 5;
    line-clamp: 5;
  }

  /* A short accent bar (decorative: never carries text). */
  .tx-deck-layout :global(.tx-deck-layout__accent) {
    display: block;
    flex: none;
    inline-size: clamp(64px, 8cqi, 112px);
    block-size: clamp(6px, 0.7cqi, 10px);
    border-radius: 999px;
    background: var(--tx-deck-accent);
  }

  /* A translucent panel over any background: text keeps the slide's ink. */
  .tx-deck-layout :global(.tx-deck-layout__panel) {
    box-sizing: border-box;
    min-inline-size: 0;
    border: 1px solid var(--tx-deck-panel-border);
    border-radius: calc(var(--tx-deck-layout-radius) * 1.6);
    background: var(--tx-deck-panel);
    padding: clamp(20px, 2.6cqi, 36px);
  }

  /* The refused-media notice and the media frame. */
  .tx-deck-layout :global(.tx-deck-layout__media) {
    position: relative;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
    border-radius: calc(var(--tx-deck-layout-radius) * 1.6);
    background: var(--tx-deck-panel);
  }

  .tx-deck-layout :global(.tx-deck-layout__media .tx-image),
  .tx-deck-layout :global(.tx-deck-layout__media img),
  .tx-deck-layout :global(.tx-deck-layout__media video) {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    max-inline-size: none;
    border-radius: 0;
  }

  .tx-deck-layout :global(.tx-deck-layout__media img),
  .tx-deck-layout :global(.tx-deck-layout__media video) {
    object-fit: cover;
  }

  .tx-deck-layout :global(.tx-deck-layout__media[data-fit="contain"] img),
  .tx-deck-layout :global(.tx-deck-layout__media[data-fit="contain"] video) {
    object-fit: contain;
  }

  .tx-deck-layout :global(.tx-deck-layout__refused) {
    display: grid;
    place-items: center;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: 100%;
    margin: 0;
    padding: 24px;
    border: 2px dashed var(--tx-deck-panel-border);
    border-radius: inherit;
    font-size: var(--tx-deck-type-label);
    text-align: center;
  }

  /* Decorative shapes stay out of forced-colors mode and the accessibility tree. */
  @media (forced-colors: active) {
    .tx-deck-layout :global([data-tx-deck-decor]) {
      display: none;
    }

    .tx-deck-layout :global(.tx-deck-layout__accent) {
      background: CanvasText;
    }

    .tx-deck-layout :global(.tx-deck-layout__panel) {
      border-color: CanvasText;
      background: Canvas;
    }
  }
</style>
