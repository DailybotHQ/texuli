// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Block } from '@texuli/blocks/core';
import { generateThemeFromSeed } from '@texuli/tokens/generator';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDeckPptx } from '../src/export/index.ts';
import {
  blockFragment,
  checkSlideFragments,
  composeSlide,
  DECK_MAX_SLIDE_STEPS,
  fragmentView,
  parseDeck,
  SLIDE_MASTER_CONTENT_SLOTS,
  SLIDE_REGION_FIT,
  slideStepCount,
} from '../src/model/index.ts';
import DeckPrint from '../src/stage/DeckPrint.svelte';
import DeckStage from '../src/stage/DeckStage.svelte';
import { gateDeckMedia, settleDeckImages } from '../src/stage/media.ts';
import {
  createDeckSync,
  DECK_SYNC_PROTOCOL,
  type DeckSyncChannel,
  parseDeckSyncMessage,
} from '../src/stage/sync.ts';
import { clearDeckHash, scenario } from './scenario.ts';

// Stages write `#/<slide>/<step>`; every test starts without one.
beforeEach(clearDeckHash);

function defineFullscreen(request: (this: Element) => Promise<void>) {
  let element: Element | null = null;
  Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, get: () => true });
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => element,
  });
  Object.defineProperty(document, 'exitFullscreen', {
    configurable: true,
    value: async () => {
      element = null;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
    configurable: true,
    value: async function (this: Element) {
      await request.call(this);
      element = this;
    },
  });
  return { leave: () => (element = null) };
}

describe('DeckPrint', () => {
  const ocean = generateThemeFromSeed({ seed: '#0e7490', id: 'ocean-test', name: 'Ocean test' });
  const ember = generateThemeFromSeed({ seed: '#c2410c', id: 'ember-test', name: 'Ember test' });

  function makeDeck() {
    const parsed = parseDeck({
      meta: {
        title: 'Board review',
        aspect: '4:3',
        themeRef: { kind: 'catalog', id: 'ocean-test', mode: 'system' },
      },
      slides: [
        {
          id: 'opening',
          title: 'Opening',
          notes: 'Thank the board.\nKeep it short.',
          blocks: [{ type: 'heading', level: 2, text: 'Three priorities' }],
        },
        {
          id: 'risks',
          title: 'Risks',
          themeRef: { kind: 'catalog', id: 'ember-test', mode: 'dark' },
          blocks: [],
        },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  const loadTheme = vi.fn(async (id: string) => {
    if (id === ocean.id) return ocean;
    if (id === ember.id) return ember;
    throw new Error('unknown');
  });

  it('DeckPrint pages, themes, notes appendix, handout and print-only view', async () => {
    await scenario(
      'renders every slide as a page with its content and themes, then reports ready',
      async () => {
        const onReady = vi.fn();
        render(DeckPrint, { props: { deck: makeDeck(), loadTheme, onReady } });
        const root = screen.getByRole('document', { name: 'Print: Board review' });
        expect(root.getAttribute('data-print-ready')).toBe('false');

        await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
        expect(root.getAttribute('data-print-ready')).toBe('true');
        expect(onReady.mock.calls[0]?.[0]).toMatchObject({
          filename: 'Board review.pdf',
          pageSize: { aspect: '4:3', pageName: 'tx-deck-4-3' },
        });

        const opening = screen.getByRole('region', { name: 'Slide 1: Opening' });
        const risks = screen.getByRole('region', { name: 'Slide 2: Risks' });
        expect(opening.getAttribute('data-aspect')).toBe('4:3');
        await waitFor(() => expect(opening.textContent).toContain('Three priorities'));
        // System mode prints light; an explicit slide mode holds.
        expect(opening.getAttribute('data-tx-mode')).toBe('light');
        expect(opening.style.getPropertyValue('--tx-background')).toBe(
          ocean.light.background.default
        );
        expect(risks.getAttribute('data-tx-mode')).toBe('dark');
        expect(risks.style.getPropertyValue('--tx-background')).toBe(ember.dark.background.default);
        expect(screen.queryByRole('region', { name: /^Notes for/ })).toBeNull();
      }
    );
    await scenario(
      'prints a notes appendix as plain text and a handout without slide bodies',
      async () => {
        const appendix = render(DeckPrint, {
          props: { deck: makeDeck(), notes: 'appendix', loadTheme: null },
        });
        const notes = screen.getByRole('region', { name: 'Notes for slide 1: Opening' });
        expect(notes.textContent).toContain('Thank the board.\nKeep it short.');
        expect(notes.querySelector('script, [onclick]')).toBeNull();
        expect(
          screen.getByRole('region', { name: 'Notes for slide 2: Risks' }).textContent
        ).toContain('No notes for this slide.');
        expect(screen.getByRole('region', { name: 'Slide 1: Opening' })).toBeTruthy();
        appendix.unmount();

        render(DeckPrint, { props: { deck: makeDeck(), notes: 'handout', loadTheme: null } });
        expect(screen.queryByRole('region', { name: /^Slide \d/ })).toBeNull();
        expect(screen.getAllByRole('region', { name: /^Notes for/ })).toHaveLength(2);
      }
    );
    await scenario('marks a print-only view for the stylesheet', async () => {
      render(DeckPrint, { props: { deck: makeDeck(), printOnly: true, loadTheme: null } });
      expect(
        screen
          .getByRole('document', { name: 'Print: Board review' })
          .getAttribute('data-print-only')
      ).toBe('true');
    });
  });
});

describe('deck media', () => {
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    vi.restoreAllMocks();
  };
  afterEach(reset);

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

  it('slide composition moves the first media block into the media region with a fit per region', () => {
    // moves the first media block into the media region and sets fit per region
    {
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
    }
    // keeps a media master without media as a single body region
    {
      const composed = composeSlide({ master: 'media-left', blocks: [{ type: 'divider' }] });
      expect(composed.regions.map((region) => region.slot)).toEqual(['body']);
    }
  });

  it('media URL policy at paint: tiers, avatar adapter, video and gallery items', () => {
    // allows relative images at the untrusted tier and data images only for developers
    {
      const relative = gateDeckMedia(image('assets/a.png') as Block);
      expect(relative.block).not.toBeNull();
      expect(gateDeckMedia(image(PNG) as Block)).toEqual({ block: null, refused: ['src'] });
      expect(gateDeckMedia(image(PNG) as Block, { trust: 'developer' }).refused).toEqual([]);
    }
    // needs a host avatar adapter whose URL passes the developer policy
    {
      const avatar = image('avatar:av-007') as Block;
      expect(gateDeckMedia(avatar).block).toBeNull();
      expect(
        gateDeckMedia(avatar, { resolveAvatar: () => 'https://example.com/av-007.png' }).block
      ).toBe(avatar);
      expect(
        gateDeckMedia(avatar, { resolveAvatar: () => 'javascript:alert(1)' }).block
      ).toBeNull();
    }
    // refuses video the untrusted policy does not allow, and drops refused gallery items
    {
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
    }
  });

  it('stage and print media: active-slide mounting, refusal notices, eager print loading and settling', async () => {
    await scenario(
      'lays out media regions and mounts only the windowed slides media, also in presenter mode',
      async () => {
        mockMedia();
        render(DeckStage, { props: { deck: mediaDeck(), loadTheme: null, presenter: true } });

        const slide = screen.getByRole('group', { name: 'The dock' });
        const sources = () =>
          [...document.querySelectorAll('img')].map((img) => img.getAttribute('src')).sort();
        // The active slide and its next neighbour are mounted; the third is not.
        await waitFor(() =>
          expect(sources()).toEqual([
            'assets/dock-detail.png',
            'assets/dock.png',
            'assets/yard.png',
          ])
        );
        const regions = slide.querySelector('.tx-deck-stage__regions');
        expect(regions?.getAttribute('data-arrangement')).toBe('media-start');
        const slots = [...slide.querySelectorAll('.tx-deck-stage__region')].map((region) =>
          region.getAttribute('data-slot')
        );
        expect(slots).toEqual(['media', 'body']);
        const mediaImage = slide.querySelector('[data-slot="media"] img');
        expect(mediaImage?.getAttribute('src')).toBe('assets/dock.png');
        expect(mediaImage?.closest('figure')?.getAttribute('data-fit')).toBe('cover');
        expect(mediaImage?.getAttribute('loading')).toBe('lazy');
        expect(document.querySelector('img[src="assets/office.png"]')).toBeNull();

        await fireEvent.click(screen.getByRole('button', { name: 'Next step or slide' }));
        await fireEvent.click(screen.getByRole('button', { name: 'Next step or slide' }));
        await waitFor(() => expect(sources()).toEqual(['assets/office.png', 'assets/yard.png']));

        await fireEvent.click(screen.getByRole('button', { name: 'Overview of all slides' }));
        expect(document.querySelectorAll('img')).toHaveLength(0);
      },
      reset
    );
    await scenario(
      'shows a notice instead of media the paint policy refuses',
      async () => {
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
      },
      reset
    );
    await scenario(
      'loads every slide image eagerly and reports ready only after they settle',
      async () => {
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
      },
      reset
    );
    await scenario(
      'settles after the timeout when an image never loads',
      async () => {
        const root = document.createElement('div');
        const img = document.createElement('img');
        Object.defineProperty(img, 'complete', { value: false });
        root.append(img);
        await expect(settleDeckImages(root, 5)).resolves.toBe(1);
        expect(img.loading).toBe('eager');
      },
      reset
    );
  });
});

describe('reveal steps (fragments)', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    vi.restoreAllMocks();
  };
  afterEach(reset);

  function mockMediaPreferences({ reduced = false } = {}) {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query.includes('reduced-motion') ? reduced : false,
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

  const STEPPED_SLIDES = [
    { id: 'opening', title: 'Opening', blocks: [{ type: 'heading', level: 2, text: 'Welcome' }] },
    {
      id: 'goals',
      title: 'Goals',
      notes: 'Reveal one goal at a time.',
      blocks: [
        { type: 'heading', level: 3, text: 'This quarter' },
        {
          type: 'list',
          step: 1,
          reveal: 'fade-up',
          items: [{ text: 'Ship the export' }, { text: 'Cut latency' }],
        },
        { type: 'callout', tone: 'info', step: 3, body: 'Both goals met.' },
        { type: 'text', markdown: 'Old plan', reveal: 'strike', step: 3 },
      ],
    },
    { id: 'close', title: 'Close', blocks: [{ type: 'text', markdown: 'Thank you.' }] },
  ];

  function makeDeck(overrides: Record<string, unknown> = {}) {
    const parsed = parseDeck({
      meta: { title: 'Stepped review', aspect: '16:9' },
      slides: STEPPED_SLIDES,
      ...overrides,
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  it('fragment model: kinds, step counts, visibility per step and refused nesting or overflow', () => {
    expect(blockFragment({ type: 'text', markdown: 'Static' })).toBeNull();
    expect(blockFragment({ type: 'text', markdown: 'Zero', step: 0 })).toBeNull();
    expect(blockFragment({ type: 'text', markdown: 'Later', step: 2, reveal: 'grow' })).toEqual({
      kind: 'enter',
      step: 2,
      lastStep: 2,
      reveal: 'grow',
    });
    expect(
      blockFragment({ type: 'list', step: 1, items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] })
    ).toEqual({ kind: 'items', step: 1, lastStep: 3 });
    expect(blockFragment({ type: 'list', items: [{ text: 'a' }, { text: 'b' }] })).toBeNull();
    expect(
      blockFragment({ type: 'code', lang: 'ts', code: 'a\nb', highlights: ['1', '2', '1-2'] })
    ).toEqual({ kind: 'highlights', step: 0, lastStep: 2 });
    expect(blockFragment({ type: 'quote', quote: 'Q', reveal: 'highlight', step: 4 })).toEqual({
      kind: 'emphasis',
      step: 4,
      lastStep: 4,
      reveal: 'highlight',
    });
    // counts a slide steps from its last fragment
    {
      const deck = makeDeck();
      expect(deck.slides.map(slideStepCount)).toEqual([0, 3, 0]);
    }
    // resolves what each fragment shows at a step
    {
      const items = { kind: 'items', step: 1, lastStep: 3 } as const;
      expect(fragmentView(items, 0)).toEqual({ hidden: true, visibleItems: 0, current: false });
      expect(fragmentView(items, 2)).toEqual({ hidden: false, visibleItems: 2, current: true });
      expect(fragmentView(items, 9)).toEqual({ hidden: false, visibleItems: 3, current: false });
      const enter = { kind: 'enter', step: 2, lastStep: 2 } as const;
      expect(fragmentView(enter, 1).hidden).toBe(true);
      expect(fragmentView(enter, 2)).toEqual({ hidden: false, current: true });
      const emphasis = { kind: 'emphasis', step: 1, lastStep: 1, reveal: 'strike' } as const;
      expect(fragmentView(emphasis, 0)).toEqual({
        hidden: false,
        emphasized: false,
        current: false,
      });
      expect(fragmentView(emphasis, 1)).toEqual({ hidden: false, emphasized: true, current: true });
      expect(fragmentView({ kind: 'highlights', step: 0, lastStep: 2 }, 1).hostStep).toBe(1);
      expect(fragmentView(null, 0)).toEqual({ hidden: false, current: false });
    }
    // refuses steps and reveals on nested blocks and slides past the step limit
    {
      const nested = parseDeck({
        meta: { title: 'Nested' },
        slides: [
          {
            id: 'one',
            blocks: [
              {
                type: 'columns',
                columns: [[{ type: 'text', markdown: 'Inner', step: 1 }], []],
              },
            ],
          },
        ],
      });
      expect(nested).toEqual({
        success: false,
        deck: null,
        issues: [
          {
            path: 'slides[0].blocks.0.columns.0.0.step',
            message: 'Reveal steps apply only to top-level slide blocks.',
          },
        ],
      });
      expect(
        checkSlideFragments([
          {
            type: 'columns',
            columns: [[{ type: 'text', markdown: 'Inner', reveal: 'fade' }], []],
          },
        ])?.path
      ).toBe('0.columns.0.0.reveal');

      const overflow = parseDeck({
        meta: { title: 'Overflow' },
        slides: [
          {
            id: 'one',
            blocks: [
              {
                type: 'list',
                step: DECK_MAX_SLIDE_STEPS,
                items: [{ text: 'a' }, { text: 'b' }],
              },
            ],
          },
        ],
      });
      expect(overflow.success).toBe(false);
      expect(overflow.issues[0]).toEqual({
        path: 'slides[0].blocks.0.step',
        message: 'A slide reaches at most 32 reveal steps; this block ends at step 33.',
      });
    }
  });

  describe('DeckStage reveal steps', () => {
    const active = () =>
      document.querySelector<HTMLElement>('[data-tx-deck-active="true"]') as HTMLElement;
    const states = () =>
      [
        ...active().querySelectorAll<HTMLElement>(
          '.tx-deck-stage__fragment[data-tx-deck-fragment]'
        ),
      ].map((element) => ({
        effect: element.dataset.txDeckEffect,
        phase: element.dataset.txDeckFragment,
        items: element.dataset.visibleItems,
      }));
    const announced = () => document.querySelector('.tx-deck-stage__live')?.textContent?.trim();
    const next = () => screen.getByRole('button', { name: 'Next step or slide' });
    const previous = () => screen.getByRole('button', { name: 'Previous step or slide' });

    it('DeckStage reveals step by step in both directions through the key map and initial step', async () => {
      await scenario(
        'reveals forward one step at a time before the next slide, and hides in reverse',
        async () => {
          mockMediaPreferences();
          const onSlideChange = vi.fn();
          render(DeckStage, {
            props: { deck: makeDeck(), initialSlideId: 'goals', onSlideChange },
          });

          expect(announced()).toBe('Slide 2 of 3: Goals, step 0 of 3');
          expect(states()).toEqual([
            { effect: 'fade-up', phase: 'hidden', items: '0' },
            { effect: 'in', phase: 'hidden', items: undefined },
            { effect: 'strike', phase: 'visible', items: undefined },
          ]);
          await fireEvent.click(next());
          expect(announced()).toBe('Slide 2 of 3: Goals, step 1 of 3');
          expect(states()[0]).toEqual({ effect: 'fade-up', phase: 'visible', items: '1' });
          await fireEvent.click(next());
          expect(states()[0]?.items).toBe('2');
          expect(states()[1]?.phase).toBe('hidden');
          await fireEvent.click(next());
          expect(states()).toEqual([
            { effect: 'fade-up', phase: 'visible', items: '2' },
            { effect: 'in', phase: 'visible', items: undefined },
            { effect: 'strike', phase: 'active', items: undefined },
          ]);
          expect(onSlideChange).not.toHaveBeenCalled();

          await fireEvent.click(next());
          expect(screen.getByRole('group', { name: 'Close' })).toBeTruthy();
          expect(onSlideChange).toHaveBeenLastCalledWith({ index: 2, slideId: 'close' });

          // Back into a slide lands on its final step, then each step hides in reverse.
          await fireEvent.click(previous());
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('3');
          await fireEvent.click(previous());
          expect(states()[1]?.phase).toBe('hidden');
          expect(states()[0]?.items).toBe('2');
          await fireEvent.click(previous());
          await fireEvent.click(previous());
          expect(states()[0]).toMatchObject({ phase: 'hidden', items: '0' });
          await fireEvent.click(previous());
          expect(screen.getByRole('group', { name: 'Opening' })).toBeTruthy();
        },
        reset
      );
      await scenario(
        'keeps the key map: Space and Right step, Left and Backspace step back, End shows all',
        async () => {
          mockMediaPreferences();
          render(DeckStage, { props: { deck: makeDeck() } });
          const press = async (key: string) => {
            active().focus();
            await fireEvent.keyDown(active(), { key });
          };
          const at = () => `${active().getAttribute('aria-label')}@${active().dataset.step}`;

          await press('ArrowRight');
          expect(at()).toBe('Goals@0');
          expect(document.activeElement).toBe(active());
          await press(' ');
          await press('PageDown');
          expect(at()).toBe('Goals@2');
          await press('Enter');
          expect(at()).toBe('Goals@3');
          await press('Backspace');
          await press('ArrowLeft');
          expect(at()).toBe('Goals@1');
          await press('PageUp');
          await press('PageUp');
          expect(at()).toBe('Opening@0');
          await press('End');
          expect(at()).toBe('Close@0');
          await press('ArrowLeft');
          expect(at()).toBe('Goals@3');
          await press('Home');
          expect(at()).toBe('Opening@0');
        },
        reset
      );
      await scenario(
        'opens the initial slide at initialStep, clamped to its steps',
        async () => {
          mockMediaPreferences();
          const first = render(DeckStage, {
            props: { deck: makeDeck(), initialSlideId: 'goals', initialStep: 2 },
          });
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('2');
          await fireEvent.click(next());
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('3');
          first.unmount();

          render(DeckStage, {
            props: { deck: makeDeck(), initialSlideId: 'goals', initialStep: 99 },
          });
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('3');
        },
        reset
      );
    });

    it('DeckStage keeps reveal state still under reduced motion and shows presenter progress', async () => {
      await scenario(
        'marks the stage for reduced motion; fragments change state without motion',
        async () => {
          mockMediaPreferences({ reduced: true });
          render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'goals' } });
          const stage = screen.getByRole('region', { name: 'Presentation: Stepped review' });
          await waitFor(() => expect(stage.getAttribute('data-motion')).toBe('reduce'));
          expect(stage.dataset.txDeckMotion).toBe('subtle');
          await fireEvent.click(next());
          expect(states()[0]?.phase).toBe('visible');
        },
        reset
      );
      await scenario(
        'shows reveal progress in the presenter view and keeps it across layout changes',
        async () => {
          mockMediaPreferences();
          render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'goals' } });
          await fireEvent.click(next());
          await fireEvent.click(screen.getByRole('button', { name: 'Presenter view' }));

          const notes = screen.getByRole('complementary', { name: 'Speaker notes' });
          expect(notes.textContent).toContain('Step 1 of 3');
          expect(notes.textContent).toContain('Reveal one goal at a time.');
          const upNext = screen.getByRole('region', { name: 'Up next' });
          expect(upNext.textContent?.replace(/\s+/g, ' ').trim()).toBe(
            'Up next Step 2 of 3 on this slide'
          );
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('1');

          await fireEvent.click(next());
          await fireEvent.click(next());
          expect(upNext.textContent).toContain('Close');
          expect(notes.textContent).toContain('Step 3 of 3');

          // The overview keeps the current slide's progress; another slide opens at step 0.
          await fireEvent.click(screen.getByRole('button', { name: 'Overview of all slides' }));
          await fireEvent.click(screen.getByRole('button', { name: /Goals/ }));
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('3');
          await fireEvent.click(screen.getByRole('button', { name: 'Overview of all slides' }));
          await fireEvent.click(screen.getByRole('button', { name: /Opening/ }));
          await fireEvent.click(next());
          expect(screen.getByRole('group', { name: 'Goals' }).dataset.step).toBe('0');
        },
        reset
      );
    });
  });

  it('fragments print and export to PPTX in their final state', async () => {
    await scenario(
      'prints every slide in its final state',
      async () => {
        render(DeckPrint, { props: { deck: makeDeck(), loadTheme: null } });
        const printed = [...document.querySelectorAll<HTMLElement>('.tx-deck-stage__fragment')];
        expect(
          printed.map((element) => [
            element.dataset.fragmentState,
            element.dataset.visibleItems,
            element.dataset.emphasis,
            element.dataset.reveal,
          ])
        ).toEqual([
          ['shown', '2', undefined, undefined],
          ['shown', undefined, undefined, undefined],
          ['shown', undefined, 'strike', undefined],
        ]);
      },
      reset
    );
    await scenario(
      'writes every fragment to PPTX, flattened to the final state',
      async () => {
        const pkg = buildDeckPptx(makeDeck());
        const xml = pkg.parts.find((part) => part.path === 'ppt/slides/slide2.xml')?.xml ?? '';
        for (const text of ['Ship the export', 'Cut latency', 'Both goals met.', 'Old plan']) {
          expect(xml).toContain(text);
        }
      },
      reset
    );
  });
});

describe('slot masters, fullscreen and the presenter screen', () => {
  /** Runs after every test and between the scenarios of a grouped test. */
  const reset = () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const name of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
      Reflect.deleteProperty(document, name);
    }
    Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
  };
  afterEach(reset);

  function mockMediaPreferences() {
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

  const text = (markdown: string) => ({ type: 'text', markdown }) as const;
  const divider = { type: 'divider' } as const;

  function makeDeck() {
    const parsed = parseDeck({
      meta: { title: 'Board update', aspect: '16:9' },
      masters: ['title', 'two-column', 'quote', 'closing', 'content'],
      slides: [
        {
          id: 'cover',
          title: 'Board update',
          master: 'title',
          blocks: [text('Example Co.'), divider, text('Fictional data')],
        },
        {
          id: 'compare',
          title: 'Before and after',
          master: 'two-column',
          notes: 'Left is last quarter.',
          blocks: [
            text('Before'),
            divider,
            { type: 'list', step: 1, items: [{ text: 'After one' }, { text: 'After two' }] },
            divider,
            text('Source: example.com'),
          ],
        },
        {
          id: 'voice',
          title: 'Customer voice',
          master: 'quote',
          blocks: [{ type: 'quote', quote: 'It just works.' }, divider, text('Ops lead')],
        },
        { id: 'end', title: 'Thanks', master: 'closing', blocks: [text('Questions?')] },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    return parsed.deck;
  }

  describe('slot masters', () => {
    it('slot masters: closed slots, divider splitting, media masters and painting in reading order', async () => {
      await scenario(
        'declares a closed slot list per master',
        async () => {
          expect(SLIDE_MASTER_CONTENT_SLOTS).toEqual({
            title: ['body', 'footer'],
            section: ['body'],
            content: ['body', 'footer'],
            'two-column': ['contentStart', 'contentEnd', 'footer'],
            'media-left': ['body'],
            'media-right': ['body'],
            quote: ['quote', 'attribution'],
            closing: ['body', 'footer'],
          });
        },
        reset
      );
      await scenario(
        'splits blocks into named slots at top-level dividers, dropping separators',
        async () => {
          expect(
            slots('two-column', [text('a'), divider, text('b'), text('c'), divider, text('d')])
          ).toEqual([
            ['contentStart', ['a']],
            ['contentEnd', ['b', 'c']],
            ['footer', ['d']],
          ]);
          expect(slots('quote', [text('q'), divider, text('who')])).toEqual([
            ['quote', ['q']],
            ['attribution', ['who']],
          ]);
          expect(slots('title', [text('hero'), divider, text('small print')])).toEqual([
            ['body', ['hero']],
            ['footer', ['small print']],
          ]);
        },
        reset
      );
      await scenario(
        'keeps dividers past the last slot, leaves out empty slots and keeps one region when empty',
        async () => {
          expect(slots('closing', [text('a'), divider, text('b'), divider, text('c')])).toEqual([
            ['body', ['a']],
            ['footer', ['b', 'divider', 'c']],
          ]);
          expect(slots('two-column', [text('only')])).toEqual([['contentStart', ['only']]]);
          expect(slots('two-column', [divider, text('end')])).toEqual([['contentEnd', ['end']]]);
          expect(slots('section', [text('a'), divider, text('b')])).toEqual([
            ['body', ['a', 'divider', 'b']],
          ]);
          expect(slots('quote', [])).toEqual([['quote', []]]);
        },
        reset
      );
      await scenario(
        'leaves the media masters as they were and never crops images outside the media region',
        async () => {
          const image = {
            type: 'image',
            src: 'photo.png',
            alt: 'A harbor',
            width: 640,
            height: 360,
          } as const;
          const composed = composeSlide({
            master: 'media-left',
            blocks: [image, divider, text('b')],
          });
          expect(composed.regions.map((region) => region.slot)).toEqual(['media', 'body']);
          expect(composed.regions[1]?.blocks.map((block) => block.type)).toEqual([
            'divider',
            'text',
          ]);
          const footerImage = composeSlide({
            master: 'two-column',
            blocks: [text('a'), divider, image],
          }).regions[1]?.blocks[0];
          expect(footerImage).toMatchObject({ type: 'image', fit: 'contain' });
        },
        reset
      );
      await scenario(
        'paints the slots in reading order on the stage and in print, with fragments inside them',
        async () => {
          mockMediaPreferences();
          render(DeckStage, {
            props: { deck: makeDeck(), initialSlideId: 'compare', loadTheme: null },
          });
          const slide = screen.getByRole('group', { name: 'Before and after' });
          const regions = slide.querySelector<HTMLElement>('.tx-deck-stage__regions');
          expect(regions?.dataset.arrangement).toBe('split');
          expect(regions?.dataset.slots).toBe('contentStart contentEnd footer');
          expect(
            [...slide.querySelectorAll<HTMLElement>('.tx-deck-stage__region')].map(
              (region) => region.dataset.slot
            )
          ).toEqual(['contentStart', 'contentEnd', 'footer']);
          expect(
            slide.querySelector(
              '[data-slot="contentEnd"] .tx-deck-stage__fragment[data-tx-deck-fragment]'
            )
          ).toBeTruthy();

          document.body.innerHTML = '';
          render(DeckPrint, { props: { deck: makeDeck(), loadTheme: null } });
          const pages = [...document.querySelectorAll<HTMLElement>('.tx-deck-print__slide')];
          expect(pages.map((page) => page.dataset.arrangement)).toEqual([
            'centered',
            'split',
            'quotation',
            'centered',
          ]);
          expect(
            [...(pages[2]?.querySelectorAll<HTMLElement>('.tx-deck-stage__region') ?? [])].map(
              (region) => region.dataset.slot
            )
          ).toEqual(['quote', 'attribution']);
        },
        reset
      );
    });

    const slots = (master: string, blocks: unknown[]) =>
      composeSlide({ master: master as never, blocks: blocks as never }).regions.map((region) => [
        region.slot,
        region.blocks.map((block) => (block.type === 'text' ? block.markdown : block.type)),
      ]);
  });

  it('fullscreen: window fallback with Escape, focus containment, native mode and refusal', async () => {
    await scenario(
      'falls back visibly to filling the window when the Fullscreen API is missing, and Escape exits',
      async () => {
        mockMediaPreferences();
        const onFullscreenChange = vi.fn();
        render(DeckStage, { props: { deck: makeDeck(), loadTheme: null, onFullscreenChange } });
        const stage = screen.getByRole('region', { name: 'Presentation: Board update' });
        const button = screen.getByRole('button', { name: 'Full screen' });
        const slide = () => document.querySelector<HTMLElement>('[data-tx-deck-active="true"]');

        await fireEvent.click(button);
        await waitFor(() => expect(stage.dataset.fullscreen).toBe('viewport'));
        expect(onFullscreenChange).toHaveBeenLastCalledWith('viewport');
        expect(document.querySelector('.tx-deck-stage__fullscreen-note')?.textContent).toBe(
          'Full screen is not available here, so the presentation fills the window. Press Escape to leave.'
        );
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.textContent?.trim()).toBe('Leave full screen');
        await waitFor(() => expect(document.activeElement).toBe(slide()));

        await fireEvent.keyDown(slide() as HTMLElement, { key: 'Escape' });
        expect(stage.dataset.fullscreen).toBeUndefined();
        expect(onFullscreenChange).toHaveBeenLastCalledWith('off');
        expect(screen.queryByText(/fills the window/)).toBeNull();
        // Focus stays on the slide, so the key map keeps working.
        await waitFor(() => expect(document.activeElement).toBe(slide()));
      },
      reset
    );
    await scenario(
      'keeps focus inside the stage while it fills the window',
      async () => {
        mockMediaPreferences();
        const outside = document.createElement('button');
        outside.textContent = 'Outside';
        document.body.append(outside);
        render(DeckStage, { props: { deck: makeDeck(), loadTheme: null } });
        const slide = () =>
          document.querySelector<HTMLElement>('[data-tx-deck-active="true"]') as HTMLElement;
        slide().focus();
        await fireEvent.keyDown(slide(), { key: 'f' });
        const stage = screen.getByRole('region', { name: 'Presentation: Board update' });
        await waitFor(() => expect(stage.dataset.fullscreen).toBe('viewport'));

        await fireEvent.focusOut(slide(), { relatedTarget: outside });
        await waitFor(() => expect(document.activeElement).toBe(slide()));
        outside.remove();
      },
      reset
    );
    await scenario(
      'uses native fullscreen when available and follows the browser leaving it',
      async () => {
        mockMediaPreferences();
        const request = vi.fn(async () => undefined);
        const api = defineFullscreen(request);
        render(DeckStage, { props: { deck: makeDeck(), loadTheme: null } });
        const stage = screen.getByRole('region', { name: 'Presentation: Board update' });

        await fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
        await waitFor(() => expect(stage.dataset.fullscreen).toBe('native'));
        expect(request).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.tx-deck-stage__fullscreen-note')).toBeNull();

        api.leave();
        document.dispatchEvent(new Event('fullscreenchange'));
        await waitFor(() => expect(stage.dataset.fullscreen).toBeUndefined());
      },
      reset
    );
    await scenario(
      'says so when the browser refuses native fullscreen',
      async () => {
        mockMediaPreferences();
        defineFullscreen(async () => {
          throw new Error('denied');
        });
        render(DeckStage, { props: { deck: makeDeck(), loadTheme: null } });
        await fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
        await waitFor(() =>
          expect(document.querySelector('.tx-deck-stage__fullscreen-note')?.textContent).toContain(
            'The browser refused full screen'
          )
        );
      },
      reset
    );
  });

  it('reports every slide and step change with onStepChange, keeping onSlideChange for slides', async () => {
    mockMediaPreferences();
    const onStepChange = vi.fn();
    const onSlideChange = vi.fn();
    render(DeckStage, {
      props: { deck: makeDeck(), loadTheme: null, onStepChange, onSlideChange },
    });
    const next = screen.getByRole('button', { name: 'Next step or slide' });
    await fireEvent.click(next);
    await fireEvent.click(next);
    await fireEvent.click(next);
    await fireEvent.click(screen.getByRole('button', { name: 'Previous step or slide' }));
    expect(onStepChange.mock.calls.map(([intent]) => intent)).toEqual([
      { index: 1, slideId: 'compare', step: 0, stepCount: 2 },
      { index: 1, slideId: 'compare', step: 1, stepCount: 2 },
      { index: 1, slideId: 'compare', step: 2, stepCount: 2 },
      { index: 1, slideId: 'compare', step: 1, stepCount: 2 },
    ]);
    expect(onSlideChange.mock.calls).toEqual([[{ index: 1, slideId: 'compare' }]]);
  });

  /**
   * An in-memory channel hub: every port sees the others' messages, never its
   * own, delivered on a later task like BroadcastChannel.
   */
  function createHub() {
    const ports = new Set<{ deliver: (data: unknown) => void }>();
    const sent: unknown[] = [];
    const open = (): DeckSyncChannel => {
      const listeners = new Set<(event: MessageEvent) => void>();
      const port = {
        deliver: (data: unknown) => {
          for (const listener of listeners) listener({ data } as MessageEvent);
        },
      };
      ports.add(port);
      return {
        postMessage(message) {
          sent.push(message);
          const copy = structuredClone(message);
          setTimeout(() => {
            for (const other of ports) if (other !== port) other.deliver(copy);
          }, 0);
        },
        addEventListener: (_type, listener) => listeners.add(listener),
        removeEventListener: (_type, listener) => listeners.delete(listener),
        close: () => ports.delete(port),
      };
    };
    return { open, sent };
  }

  it('presenter screen link: closed message shapes, missing BroadcastChannel and synced stages', async () => {
    await scenario(
      'accepts only the closed message shapes for its deck',
      async () => {
        const position = {
          protocol: DECK_SYNC_PROTOCOL,
          kind: 'position',
          deck: 'board',
          slideId: 'compare',
          step: 1,
        };
        expect(parseDeckSyncMessage(position, 'board')).toEqual(position);
        expect(parseDeckSyncMessage({ ...position, deck: 'other' }, 'board')).toBeNull();
        expect(parseDeckSyncMessage({ ...position, step: 33 }, 'board')).toBeNull();
        expect(parseDeckSyncMessage({ ...position, step: 1.5 }, 'board')).toBeNull();
        expect(parseDeckSyncMessage({ ...position, slideId: '<b>' }, 'board')).toBeNull();
        expect(parseDeckSyncMessage({ ...position, extra: true }, 'board')).toBeNull();
        expect(parseDeckSyncMessage({ ...position, kind: 'navigate' }, 'board')).toBeNull();
        expect(parseDeckSyncMessage('hello', 'board')).toBeNull();
        expect(
          parseDeckSyncMessage(
            { protocol: DECK_SYNC_PROTOCOL, kind: 'hello', deck: 'board' },
            'board'
          )
        ).toEqual({ protocol: DECK_SYNC_PROTOCOL, kind: 'hello', deck: 'board' });
      },
      reset
    );
    await scenario(
      'returns null when the browser has no BroadcastChannel or the deck key is unusable',
      async () => {
        vi.stubGlobal('BroadcastChannel', undefined);
        expect(createDeckSync({ deck: 'board' })).toBeNull();
        expect(createDeckSync({ deck: 'bad key!', open: createHub().open })).toBeNull();
      },
      reset
    );
    await scenario(
      'keeps an audience stage and a presenter screen on the same slide and step, without echoes',
      async () => {
        mockMediaPreferences();
        const hub = createHub();
        const audienceLink = createDeckSync({ deck: 'board', open: hub.open });
        const presenterLink = createDeckSync({ deck: 'board', open: hub.open });
        const audience = document.createElement('div');
        const presenterHost = document.createElement('div');
        document.body.append(audience, presenterHost);

        render(DeckStage, {
          target: audience,
          props: {
            deck: makeDeck(),
            loadTheme: null,
            sync: audienceLink,
            initialSlideId: 'compare',
          },
        });
        // The presenter screen opens later and asks where the deck is.
        render(DeckStage, {
          target: presenterHost,
          props: { deck: makeDeck(), loadTheme: null, sync: presenterLink, presenter: true },
        });
        const articleIn = (host: HTMLElement) =>
          host.querySelector<HTMLElement>('[data-tx-deck-active="true"]');
        await waitFor(() => expect(articleIn(presenterHost)?.dataset.slideId).toBe('compare'));

        const nextIn = (host: HTMLElement) =>
          [...host.querySelectorAll<HTMLButtonElement>('.tx-deck-stage__control')].find(
            (button) => button.textContent?.trim() === 'Next step or slide'
          );
        await fireEvent.click(nextIn(audience) as HTMLButtonElement);
        await waitFor(() => expect(articleIn(presenterHost)?.dataset.step).toBe('1'));
        expect(presenterHost.querySelector('.tx-deck-stage__step-progress')?.textContent).toContain(
          'Step 1 of 2'
        );

        // The presenter drives too, and the audience follows.
        await fireEvent.click(nextIn(presenterHost) as HTMLButtonElement);
        await fireEvent.click(nextIn(presenterHost) as HTMLButtonElement);
        await waitFor(() => expect(articleIn(audience)?.dataset.slideId).toBe('voice'));
        expect(articleIn(presenterHost)?.dataset.slideId).toBe('voice');

        const positions = hub.sent.filter(
          (message) => (message as { kind?: string }).kind === 'position'
        );
        const count = positions.length;
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(
          hub.sent.filter((message) => (message as { kind?: string }).kind === 'position')
        ).toHaveLength(count);
        audienceLink?.close();
        presenterLink?.close();
        audience.remove();
        presenterHost.remove();
      },
      reset
    );
  });
});
