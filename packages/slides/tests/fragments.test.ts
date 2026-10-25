// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDeckPptx } from '../src/export/index.ts';
import {
  blockFragment,
  checkSlideFragments,
  DECK_MAX_SLIDE_STEPS,
  fragmentView,
  parseDeck,
  slideStepCount,
} from '../src/model/index.ts';
import DeckPrint from '../src/stage/DeckPrint.svelte';
import DeckStage from '../src/stage/DeckStage.svelte';

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('fragment model', () => {
  it('derives one closed fragment kind per top-level block', () => {
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
  });

  it('counts a slide steps from its last fragment', () => {
    const deck = makeDeck();
    expect(deck.slides.map(slideStepCount)).toEqual([0, 3, 0]);
  });

  it('resolves what each fragment shows at a step', () => {
    const items = { kind: 'items', step: 1, lastStep: 3 } as const;
    expect(fragmentView(items, 0)).toEqual({ hidden: true, visibleItems: 0, current: false });
    expect(fragmentView(items, 2)).toEqual({ hidden: false, visibleItems: 2, current: true });
    expect(fragmentView(items, 9)).toEqual({ hidden: false, visibleItems: 3, current: false });
    const enter = { kind: 'enter', step: 2, lastStep: 2 } as const;
    expect(fragmentView(enter, 1).hidden).toBe(true);
    expect(fragmentView(enter, 2)).toEqual({ hidden: false, current: true });
    const emphasis = { kind: 'emphasis', step: 1, lastStep: 1, reveal: 'strike' } as const;
    expect(fragmentView(emphasis, 0)).toEqual({ hidden: false, emphasized: false, current: false });
    expect(fragmentView(emphasis, 1)).toEqual({ hidden: false, emphasized: true, current: true });
    expect(fragmentView({ kind: 'highlights', step: 0, lastStep: 2 }, 1).hostStep).toBe(1);
    expect(fragmentView(null, 0)).toEqual({ hidden: false, current: false });
  });

  it('refuses steps and reveals on nested blocks and slides past the step limit', () => {
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
  });
});

describe('DeckStage reveal steps', () => {
  const fragments = () => [...document.querySelectorAll<HTMLElement>('.tx-deck-stage__fragment')];
  const states = () =>
    fragments().map((element) => ({
      kind: element.dataset.fragment,
      state: element.dataset.fragmentState,
      items: element.dataset.visibleItems,
      emphasis: element.dataset.emphasis,
    }));
  const progress = () =>
    document.querySelector('.tx-deck-stage__progress')?.textContent?.replace(/\s+/g, ' ').trim();

  it('reveals forward one step at a time before the next slide, and hides in reverse', async () => {
    mockMediaPreferences();
    const onSlideChange = vi.fn();
    render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'goals', onSlideChange } });

    expect(progress()).toBe('Slide 2 of 3: Goals, 0 of 3 revealed');
    expect(states()).toEqual([
      { kind: 'items', state: 'hidden', items: '0', emphasis: undefined },
      { kind: 'enter', state: 'hidden', items: undefined, emphasis: undefined },
      { kind: 'emphasis', state: 'shown', items: undefined, emphasis: undefined },
    ]);
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeTruthy();

    const nextButton = screen.getByRole('button', { name: 'Next step' });
    await fireEvent.click(nextButton);
    expect(progress()).toBe('Slide 2 of 3: Goals, 1 of 3 revealed');
    expect(states()[0]).toMatchObject({ state: 'shown', items: '1' });
    await fireEvent.click(nextButton);
    expect(states()[0]).toMatchObject({ state: 'shown', items: '2' });
    expect(states()[1]?.state).toBe('hidden');
    await fireEvent.click(nextButton);
    expect(states()).toEqual([
      { kind: 'items', state: 'shown', items: '2', emphasis: undefined },
      { kind: 'enter', state: 'shown', items: undefined, emphasis: undefined },
      { kind: 'emphasis', state: 'shown', items: undefined, emphasis: 'strike' },
    ]);
    expect(screen.getByRole('button', { name: 'Next slide' })).toBe(nextButton);
    expect(onSlideChange).not.toHaveBeenCalled();

    await fireEvent.click(nextButton);
    expect(screen.getByRole('article', { name: 'Close' })).toBeTruthy();
    expect(onSlideChange).toHaveBeenLastCalledWith({ index: 2, slideId: 'close' });

    // Back into a slide lands on its final step, then each step hides in reverse.
    await fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('3');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(states()[1]?.state).toBe('hidden');
    expect(states()[0]?.items).toBe('2');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(states()[0]).toMatchObject({ state: 'hidden', items: '0' });
    await fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }));
    expect(screen.getByRole('article', { name: 'Opening' })).toBeTruthy();
  });

  it('keeps the key map: Space and Right step, Left and Backspace step back, End shows all', async () => {
    mockMediaPreferences();
    render(DeckStage, { props: { deck: makeDeck() } });
    const press = async (key: string) => {
      const article = screen.getByRole('article');
      article.focus();
      await fireEvent.keyDown(article, { key });
    };
    const at = () => {
      const article = screen.getByRole('article');
      return `${article.getAttribute('aria-label')}@${article.dataset.step}`;
    };

    await press('ArrowRight');
    expect(at()).toBe('Goals@0');
    expect(document.activeElement).toBe(screen.getByRole('article'));
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
  });

  it('animates only forward reveals, with the block reveal or the slide transition', async () => {
    mockMediaPreferences();
    const deck = makeDeck();
    render(DeckStage, { props: { deck, initialSlideId: 'goals' } });
    const revealOf = (index: number) => fragments()[index]?.dataset.reveal;
    await waitFor(() => expect(document.querySelector('[data-transition]')).toBeTruthy());

    expect(revealOf(0)).toBeUndefined();
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(revealOf(0)).toBe('fade-up');
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(revealOf(0)).toBe('fade-up');
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(revealOf(0)).toBeUndefined();
    // No block reveal: the slide transition (the deck default, fade) animates it.
    expect(revealOf(1)).toBe('fade');
    expect(revealOf(2)).toBe('fade');
    await fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(fragments().every((element) => element.dataset.reveal === undefined)).toBe(true);
  });

  it('cuts every reveal under reduced motion', async () => {
    mockMediaPreferences({ reduced: true });
    render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'goals' } });
    const stage = screen.getByRole('region', { name: 'Presentation: Stepped review' });
    await waitFor(() => expect(stage.getAttribute('data-motion')).toBe('reduce'));
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(fragments()[0]?.dataset.fragmentState).toBe('shown');
    expect(fragments()[0]?.dataset.reveal).toBeUndefined();
  });

  it('shows reveal progress in the presenter view and keeps it across layout changes', async () => {
    mockMediaPreferences();
    render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'goals' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Presenter' }));

    const notes = screen.getByRole('complementary', { name: 'Speaker notes' });
    expect(notes.textContent).toContain('Reveal step 1 of 3');
    const upNext = screen.getByRole('region', { name: 'Up next' });
    expect(upNext.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Up next Reveal step 2 of 3 on this slide'
    );
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('1');

    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(upNext.textContent).toContain('Close');
    expect(notes.textContent).toContain('Reveal step 3 of 3');

    // The overview keeps the current slide's progress; another slide opens at step 0.
    await fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await fireEvent.click(screen.getByRole('button', { name: /Goals/ }));
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('3');
    await fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await fireEvent.click(screen.getByRole('button', { name: /Opening/ }));
    await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('0');
  });

  it('opens the initial slide at initialStep, clamped to its steps', async () => {
    mockMediaPreferences();
    const first = render(DeckStage, {
      props: { deck: makeDeck(), initialSlideId: 'goals', initialStep: 2 },
    });
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('2');
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('3');
    first.unmount();

    render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'goals', initialStep: 99 } });
    expect(screen.getByRole('article', { name: 'Goals' }).dataset.step).toBe('3');
  });

  it('drives code highlight steps through the block family host step', async () => {
    mockMediaPreferences();
    const parsed = parseDeck({
      meta: { title: 'Code walk' },
      slides: [
        {
          id: 'walk',
          title: 'Walkthrough',
          blocks: [
            {
              type: 'code',
              lang: 'ts',
              code: 'const a = 1;\nconst b = 2;',
              highlights: ['1', '2'],
            },
          ],
        },
      ],
    });
    if (!parsed.success) throw new Error(parsed.issues[0]?.message);
    const { container } = render(DeckStage, { props: { deck: parsed.deck } });
    const step = () =>
      container.querySelector('[data-highlight-step]')?.getAttribute('data-highlight-step');
    await waitFor(() => expect(step()).toBe('0'));
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    await waitFor(() => expect(step()).toBe('1'));
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeTruthy();
  });
});

describe('fragments in print and PPTX', () => {
  it('prints every slide in its final state', async () => {
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
  });

  it('writes every fragment to PPTX, flattened to the final state', () => {
    const pkg = buildDeckPptx(makeDeck());
    const xml = pkg.parts.find((part) => part.path === 'ppt/slides/slide2.xml')?.xml ?? '';
    for (const text of ['Ship the export', 'Cut latency', 'Both goals met.', 'Old plan']) {
      expect(xml).toContain(text);
    }
  });
});
