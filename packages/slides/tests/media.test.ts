// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Block } from '@texuli/blocks/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeSlide, SLIDE_REGION_FIT } from '../src/model/compose.ts';
import { parseDeck } from '../src/model/index.ts';
import DeckPrint from '../src/stage/DeckPrint.svelte';
import DeckStage from '../src/stage/DeckStage.svelte';
import { gateDeckMedia, settleDeckImages } from '../src/stage/media.ts';

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

afterEach(() => {
  vi.restoreAllMocks();
});

function mockMedia() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as unknown as MediaQueryList
  );
}

const image = (src: string, extra: Record<string, unknown> = {}) => ({
  type: 'image',
  src,
  alt: `Photo ${src}`,
  width: 640,
  height: 360,
  ...extra,
});

const fitOf = (block: Block | undefined) => (block as { fit?: string } | undefined)?.fit;

function mediaDeck() {
  const parsed = parseDeck({
    meta: { title: 'Harbor tour' },
    masters: ['media-left', 'media-right', 'content'],
    slides: [
      {
        id: 'dock',
        title: 'The dock',
        master: 'media-left',
        notes: 'Point at the cranes.',
        blocks: [
          { type: 'text', markdown: 'Twelve cranes, one shift.' },
          image('assets/dock.png'),
          image('assets/dock-detail.png', { fit: 'contain' }),
        ],
      },
      {
        id: 'yard',
        title: 'The yard',
        master: 'media-right',
        blocks: [image('assets/yard.png'), { type: 'text', markdown: 'Containers by lane.' }],
      },
      {
        id: 'office',
        title: 'The office',
        master: 'content',
        blocks: [image('assets/office.png')],
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message);
  return parsed.deck;
}

describe('slide composition', () => {
  it('moves the first media block into the media region and sets fit per region', () => {
    const deck = mediaDeck();
    const before = JSON.stringify(deck);
    const [dock, yard, office] = deck.slides;
    if (!dock || !yard || !office) throw new Error('missing slides');

    const left = composeSlide(dock);
    expect(left.master.id).toBe('media-left');
    expect(left.regions.map((region) => region.slot)).toEqual(['media', 'body']);
    expect(left.regions[0]?.blocks).toEqual([{ ...dock.blocks[1], fit: SLIDE_REGION_FIT.media }]);
    expect(left.regions[1]?.blocks.map((block) => block.type)).toEqual(['text', 'image']);
    // An authored fit wins over the region policy.
    expect(fitOf(left.regions[1]?.blocks[1])).toBe('contain');

    expect(composeSlide(yard).regions.map((region) => region.slot)).toEqual(['body', 'media']);
    const content = composeSlide(office);
    expect(content.regions.map((region) => region.slot)).toEqual(['body']);
    expect(fitOf(content.regions[0]?.blocks[0])).toBe('contain');
    expect(JSON.stringify(deck)).toBe(before);
  });

  it('keeps a media master without media as a single body region', () => {
    const composed = composeSlide({ master: 'media-left', blocks: [{ type: 'divider' }] });
    expect(composed.regions.map((region) => region.slot)).toEqual(['body']);
  });
});

describe('media URL policy at paint', () => {
  it('allows relative images at the untrusted tier and data images only for developers', () => {
    const relative = gateDeckMedia(image('assets/a.png') as Block);
    expect(relative.block).not.toBeNull();
    expect(gateDeckMedia(image(PNG) as Block)).toEqual({ block: null, refused: ['src'] });
    expect(gateDeckMedia(image(PNG) as Block, { trust: 'developer' }).refused).toEqual([]);
  });

  it('needs a host avatar adapter whose URL passes the developer policy', () => {
    const avatar = image('avatar:av-007') as Block;
    expect(gateDeckMedia(avatar).block).toBeNull();
    expect(
      gateDeckMedia(avatar, { resolveAvatar: () => 'https://example.com/av-007.png' }).block
    ).toBe(avatar);
    expect(gateDeckMedia(avatar, { resolveAvatar: () => 'javascript:alert(1)' }).block).toBeNull();
  });

  it('refuses video the untrusted policy does not allow, and drops refused gallery items', () => {
    const video = {
      type: 'video',
      src: 'media/clip.mp4',
      label: 'Crane timelapse',
      width: 640,
      height: 360,
    } as Block;
    expect(gateDeckMedia(video)).toEqual({ block: null, refused: ['src'] });
    expect(gateDeckMedia(video, { trust: 'developer' }).block).toBe(video);

    const gallery = {
      type: 'gallery',
      items: [
        { src: 'assets/a.png', alt: 'A', width: 1, height: 1 },
        { src: PNG, alt: 'B', width: 1, height: 1 },
      ],
    } as Block;
    const gated = gateDeckMedia(gallery);
    expect(gated.refused).toEqual(['items[1].src']);
    expect(gated.block).toMatchObject({ items: [{ src: 'assets/a.png' }] });

    const text = { type: 'text', markdown: 'Plain' } as Block;
    expect(gateDeckMedia(text)).toEqual({ block: text, refused: [] });
  });
});

describe('DeckStage media', () => {
  it('lays out media regions and mounts only the active slide media, also in presenter mode', async () => {
    mockMedia();
    render(DeckStage, { props: { deck: mediaDeck(), loadTheme: null, presenter: true } });

    const article = screen.getByRole('article', { name: 'The dock' });
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(2));
    const regions = article.querySelector('.tx-deck-stage__regions');
    expect(regions?.getAttribute('data-arrangement')).toBe('media-start');
    const slots = [...article.querySelectorAll('.tx-deck-stage__region')].map((region) =>
      region.getAttribute('data-slot')
    );
    expect(slots).toEqual(['media', 'body']);
    const mediaImage = article.querySelector('[data-slot="media"] img');
    expect(mediaImage?.getAttribute('src')).toBe('assets/dock.png');
    expect(mediaImage?.closest('figure')?.getAttribute('data-fit')).toBe('cover');
    expect(mediaImage?.getAttribute('loading')).toBe('lazy');
    // The presenter panes show the next slide by title only: no media is loaded for it.
    expect(document.querySelector('img[src="assets/yard.png"]')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    await waitFor(() =>
      expect([...document.querySelectorAll('img')].map((img) => img.getAttribute('src'))).toEqual([
        'assets/yard.png',
      ])
    );

    await fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('shows a notice instead of media the paint policy refuses', async () => {
    mockMedia();
    const parsed = parseDeck({
      meta: { title: 'Agent deck' },
      slides: [{ id: 'one', title: 'One', blocks: [image(PNG), image('avatar:av-001')] }],
    });
    if (!parsed.success) throw new Error('deck');
    render(DeckStage, { props: { deck: parsed.deck, loadTheme: null } });
    const notices = screen.getAllByRole('note');
    expect(notices).toHaveLength(2);
    expect(notices[0]?.getAttribute('data-refused')).toBe('src');
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });
});

describe('DeckPrint media', () => {
  it('loads every slide image eagerly and reports ready only after they settle', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false);
    const onReady = vi.fn();
    render(DeckPrint, { props: { deck: mediaDeck(), loadTheme: null, onReady } });
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(4));
    const images = [...document.querySelectorAll('img')];
    await waitFor(() => expect(images.every((img) => img.loading === 'eager')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onReady).not.toHaveBeenCalled();
    for (const img of images.slice(0, 3)) img.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onReady).not.toHaveBeenCalled();
    images[3]?.dispatchEvent(new Event('error'));
    await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  });

  it('settles after the timeout when an image never loads', async () => {
    const root = document.createElement('div');
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: false });
    root.append(img);
    await expect(settleDeckImages(root, 5)).resolves.toBe(1);
    expect(img.loading).toBe('eager');
  });
});
