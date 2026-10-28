// @vitest-environment happy-dom
/**
 * /slides-page/ (PLAN_008 T-site-slides): honest copy, fictional data, lazy
 * islands, the flagship deck kept in step with `@texuli/deck` and adapted to
 * same-origin media, galleries and components that validate at the untrusted
 * tier, the keyboard map matching the engine, and the gallery jump list
 * driving its stage.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { DECK_KEY_BINDINGS } from '@texuli/deck/engine';
import { DECK_CATALOG_LAYOUT_IDS } from '@texuli/deck/model';
import { prepareDeck } from '@texuli/slides/stage';
import { afterEach, describe, expect, it } from 'vitest';
import ComponentsShowcase from '../src/components/slides-site/ComponentsShowcase.svelte';
import {
  BACKGROUND_GALLERY,
  backgroundGalleryDeck,
  COMPONENT_GALLERY,
  componentsDeck,
  LAYOUT_GALLERY,
  layoutGalleryDeck,
} from '../src/components/slides-site/decks.ts';
import FlagshipDeck from '../src/components/slides-site/FlagshipDeck.svelte';
import {
  FLAGSHIP_ID,
  FLAGSHIP_IMAGE,
  flagshipDeck,
} from '../src/components/slides-site/flagship.ts';
import LayoutsGallery from '../src/components/slides-site/LayoutsGallery.svelte';
import { SLIDES_KEYS, SLIDES_SECTIONS } from '../src/components/slides-site/page.ts';

const site = (path: string) => resolve('apps/website/src', path);
const read = (path: string) => readFileSync(site(path), 'utf8');
const PAGE = read('pages/slides-page/index.astro');
const SOURCES = [
  'pages/slides-page/index.astro',
  'pages/slides-page/media/texuli-mark.webp.ts',
  'components/slides-site/page.ts',
  'components/slides-site/decks.ts',
  'components/slides-site/flagship.ts',
  'components/slides-site/FlagshipDeck.svelte',
  'components/slides-site/GalleryStage.svelte',
  'components/slides-site/LayoutsGallery.svelte',
  'components/slides-site/BackgroundsGallery.svelte',
  'components/slides-site/ComponentsShowcase.svelte',
].map((path) => [path, read(path)] as const);

type Bag = Record<string, unknown>;

/** Every string under a `src` key, anywhere in a value. */
function sources(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) sources(item, out);
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'src' && typeof item === 'string') out.push(item);
      else sources(item, out);
    }
  }
  return out;
}

afterEach(() => {
  cleanup();
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
});

describe('slides page: copy and safety', () => {
  it('says "in development" and names the 0.4.0 release', () => {
    expect(PAGE).toMatch(/@texuli\/slides · in development/);
    const status = read('components/slides-site/page.ts');
    expect(status).toMatch(/in development and on npm as 0\.4\.0, a pre-1\.0 release/);
    expect(status).toMatch(/@texuli\/slides 0\.3\.0 has the previous deck model/);
  });

  it('renders no HTML from data, and names only fictional example.com addresses', () => {
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML|eval\(|new Function/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
    }
  });

  it('mounts every island lazily and gives every section an anchor', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name)).toEqual([
      'FlagshipDeck',
      'DeckEditorApp',
      'LayoutsGallery',
      'BackgroundsGallery',
      'ComponentsShowcase',
    ]);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    for (const entry of SLIDES_SECTIONS) expect(PAGE).toContain(`id="${entry.id}"`);
    expect(PAGE).toMatch(/<section[^>]*id="editor"[\s\S]*?<DeckEditorApp client:visible/);
  });

  it('lists only keys the engine binds', () => {
    const bound = new Set(DECK_KEY_BINDINGS.flatMap((binding) => binding.keys));
    for (const entry of SLIDES_KEYS)
      for (const key of entry.keys) expect(bound, key).toContain(key);
  });
});

describe('the flagship deck', () => {
  it('is a verbatim copy of the @texuli/deck starter deck', () => {
    const copy = read('components/slides-site/flagship-source.json');
    const original = readFileSync(resolve(`packages/deck/decks/${FLAGSHIP_ID}.json`), 'utf8');
    expect(JSON.parse(copy)).toEqual(JSON.parse(original));
  });

  it('validates, keeps every slide, shows only same-origin media and hides the video slides', () => {
    const deck = flagshipDeck() as Bag & { slides: Bag[] };
    const prepared = prepareDeck(deck);
    expect(prepared.ok, JSON.stringify(prepared.issues.slice(0, 3))).toBe(true);
    expect(deck.slides).toHaveLength(25);
    const hidden = deck.slides
      .filter((slide) => slide.hidden === true)
      .map((slide) => slide.layout);
    expect(hidden).toEqual(['video-centered', 'video-left', 'video-right']);
    const visibleSources = sources(deck.slides.filter((slide) => slide.hidden !== true));
    expect(visibleSources.length).toBeGreaterThan(0);
    expect(new Set(visibleSources)).toEqual(new Set([FLAGSHIP_IMAGE]));
    // The source deck is never mutated.
    expect(sources(flagshipDeck())).toEqual(sources(flagshipDeck()));
  });
});

describe('gallery decks', () => {
  it('validate at the untrusted tier with one slide per entry', () => {
    const layouts = prepareDeck(layoutGalleryDeck());
    expect(layouts.ok, JSON.stringify(layouts.issues.slice(0, 3))).toBe(true);
    expect(LAYOUT_GALLERY).toHaveLength(DECK_CATALOG_LAYOUT_IDS.length);
    const backgrounds = prepareDeck(backgroundGalleryDeck());
    expect(backgrounds.ok, JSON.stringify(backgrounds.issues.slice(0, 3))).toBe(true);
    expect(BACKGROUND_GALLERY).toHaveLength(17);
    for (const [deck, entries] of [
      [layoutGalleryDeck(), LAYOUT_GALLERY],
      [backgroundGalleryDeck(), BACKGROUND_GALLERY],
      [componentsDeck(), COMPONENT_GALLERY],
    ] as const) {
      expect((deck.slides as Bag[]).map((slide) => slide.id)).toEqual(entries.map((e) => e.id));
    }
    for (const src of sources(layoutGalleryDeck())) expect(src).not.toMatch(/^https?:/);
  });

  it('paints the components deck on the stage (the default registry validates it)', async () => {
    const { container } = render(ComponentsShowcase);
    await waitFor(() =>
      expect(container.querySelector('[aria-roledescription="slide"]')).not.toBeNull()
    );
    expect(container.querySelector('[data-tx-deck-invalid]')).toBeNull();
  });

  it('moves the stage from the jump list, and marks the shown slide', async () => {
    const { container } = render(LayoutsGallery);
    const target = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>(
        '[data-slides-gallery-item="layout-quote"]'
      );
      if (!button || button.disabled) throw new Error('the jump list is not ready');
      return button;
    });
    await fireEvent.click(target);
    await waitFor(() => expect(target.getAttribute('aria-current')).toBe('true'));
    expect(
      container.querySelector('[data-tx-deck-active="true"]')?.getAttribute('data-slide-id')
    ).toBe('layout-quote');
  });
});

describe('the flagship island', () => {
  it('shows the stage at the untrusted tier with its export bar', async () => {
    render(FlagshipDeck);
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: /Presentation: Texuli: create anything/ })
      ).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: 'Download PPTX' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Print or save as PDF' }).getAttribute('href')).toBe(
      '?print=1'
    );
  });
});
