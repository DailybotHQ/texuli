<script lang="ts">
/**
 * Component gallery island: filter by category and tag, search, and a card
 * grid of every catalog component, each with a live preview of the real
 * component (loaded when it scrolls near), a props panel and code.
 * No window/document access at import time.
 */
import { Badge, Chip } from 'texuli/badge';
import { Input } from 'texuli/input';
import { ToggleGroup, ToggleGroupItem } from 'texuli/toggle';
import { stageFor } from '../live/stage-map.ts';
import type { GalleryComponentCard } from './catalog.ts';
import { filterGalleryComponents } from './filter.ts';
import GalleryPreview from './GalleryPreview.svelte';

type Props = {
  cards: readonly GalleryComponentCard[];
  categories: readonly string[];
  tags: readonly string[];
};

let { cards, categories, tags }: Props = $props();

let query = $state('');
let category = $state('');
let tag = $state('');

const isWide = (id: string) => stageFor(id)?.isolate === true;

/** Filtered cards; full-width (page layout) cards follow the others so the grid has no gaps. */
const filtered = $derived(
  filterGalleryComponents(cards, {
    query,
    category: category || undefined,
    tag: tag || undefined,
  }).sort((a, b) => Number(isWide(a.id)) - Number(isWide(b.id)))
);

function onCategory(next: string | string[]): void {
  if (typeof next !== 'string') return;
  category = next === 'all' ? '' : next;
}

function onTag(next: string | string[]): void {
  if (typeof next !== 'string') return;
  tag = next === 'all' ? '' : next;
}

/** Prefer high-signal tags for the chip strip (not every enum value). */
const featuredTags = $derived(
  tags.filter((t) =>
    [
      'app',
      'content',
      'agent-emittable',
      'app-chrome',
      'texuli',
      '@texuli/data',
      '@texuli/charts',
      '@texuli/blocks',
      '@texuli/media',
      'success',
      'warning',
      'info',
      'destructive',
    ].includes(t)
  )
);
</script>

<section class="gallery" aria-labelledby="gallery-components-title" data-tx-component-gallery>
  <header class="intro">
    <h1 id="gallery-components-title">Component gallery</h1>
    <p class="lead">
      Every catalog component, live: each card mounts the real component with fictional data.
      Switch a preview to dark or right to left, edit its props and copy the code. Filter by
      category and tag; open a component's page for keyboard and accessibility notes.
    </p>
    <p class="summary" role="status">
      {cards.length} components · showing {filtered.length}
      {#if category}
        · category <strong>{category}</strong>
      {/if}
      {#if tag}
        · tag <strong>{tag}</strong>
      {/if}
    </p>
  </header>

  <div class="controls">
    <div class="field field--search">
      <label class="label" for="gallery-q">Search</label>
      <Input
        id="gallery-q"
        type="search"
        placeholder="id, label, variant, package…"
        bind:value={query}
        onValueChange={(value) => {
          query = value;
        }}
      />
    </div>

    <div class="field">
      <span class="label" id="gallery-cat-label">Category</span>
      <ToggleGroup
        type="single"
        value={category || 'all'}
        onValueChange={onCategory}
        variant="outline"
        size="sm"
        wrap
        aria-labelledby="gallery-cat-label"
      >
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        {#each categories as cat (cat)}
          <ToggleGroupItem value={cat}>{cat}</ToggleGroupItem>
        {/each}
      </ToggleGroup>
    </div>

    {#if featuredTags.length > 0}
      <div class="field">
        <span class="label" id="gallery-tag-label">Tag</span>
        <ToggleGroup
          type="single"
          value={tag || 'all'}
          onValueChange={onTag}
          variant="outline"
          size="sm"
          wrap
          aria-labelledby="gallery-tag-label"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {#each featuredTags as t (t)}
            <ToggleGroupItem value={t}>{t}</ToggleGroupItem>
          {/each}
        </ToggleGroup>
      </div>
    {/if}
  </div>

  {#if filtered.length === 0}
    <p class="empty" role="status">No components match these filters.</p>
  {:else}
    <ul class="grid">
      {#each filtered as card (card.id)}
        <li class:wide={isWide(card.id)}>
          <article class="card" data-tx-gallery-card={card.id} data-category={card.category}>
            <div class="meta">
              <div class="title-row">
                <h2 class="title">
                  <a href={card.href}>{card.label}</a>
                </h2>
                <Badge variant="secondary">{card.category}</Badge>
              </div>
              <p class="id"><code>{card.id}</code> · {card.package}</p>
            </div>
            <GalleryPreview {card} />
            <div class="meta">
              <p class="summary-text">{card.summary}</p>
              <div class="tags" role="group" aria-label={`Filter by a tag of ${card.label}`}>
                {#each card.tags.slice(0, 5) as t (t)}
                  <Chip label={t} selected={tag === t} onclick={() => (tag = tag === t ? '' : t)} />
                {/each}
              </div>
              <p class="docs">
                <a href={card.href}>Open docs <span class="sr-only">for {card.label}</span></a>
              </p>
            </div>
          </article>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .gallery {
    display: grid;
    /* Shrink below the widest child; wide rows wrap or scroll inside. */
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
  .intro {
    display: grid;
    gap: 0.35rem;
  }
  h1 {
    margin: 0;
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    line-height: 1.15;
    color: var(--tx-foreground, CanvasText);
  }
  .lead {
    margin: 0;
    max-inline-size: 42rem;
    font-size: 1.05rem;
    color: var(--tx-foreground, CanvasText);
  }
  .summary {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--tx-foreground, CanvasText);
  }
  .controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: 1rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-surface, Canvas);
  }
  .field {
    display: grid;
    gap: 0.35rem;
  }
  .field--search {
    max-inline-size: 28rem;
  }
  .label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--tx-foreground, CanvasText);
  }
  .empty {
    margin: 0;
    padding: 1.5rem;
    border: 1px dashed var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    color: var(--tx-foreground, CanvasText);
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  }
  .wide {
    grid-column: 1 / -1;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .card {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 0.75rem;
    block-size: 100%;
    padding: 0.85rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
  }
  .meta {
    display: grid;
    gap: 0.35rem;
  }
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.5rem;
  }
  .title {
    margin: 0;
    font-size: 1.05rem;
    line-height: 1.25;
  }
  .title a {
    /* A 24px target (WCAG 2.5.8); the heading text alone was 20px (T-89). */
    display: inline-flex;
    align-items: center;
    min-block-size: 1.5rem;
    color: inherit;
    text-decoration: none;
  }
  .title a:hover {
    text-decoration: underline;
  }
  .title a:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .id {
    margin: 0;
    font-size: 0.8rem;
    color: var(--tx-foreground, CanvasText);
  }
  .summary-text {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.4;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    /* ≥ 24px targets with gap so adjacent tags stay clear (WCAG 2.5.8). */
    gap: 0.5rem;
    align-items: center;
    margin: 0;
  }
  .docs {
    margin: 0.15rem 0 0;
    font-size: 0.85rem;
  }
  .docs a {
    display: inline-flex;
    align-items: center;
    min-block-size: 1.5rem;
    color: var(--tx-link, Highlight);
  }
  code {
    font-size: 0.9em;
  }
</style>
