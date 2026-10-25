// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeSlide, parseDeck, SLIDE_MASTER_CONTENT_SLOTS } from '../src/model/index.ts';
import DeckPrint from '../src/stage/DeckPrint.svelte';
import DeckStage from '../src/stage/DeckStage.svelte';
import {
  createDeckSync,
  DECK_SYNC_PROTOCOL,
  type DeckSyncChannel,
  parseDeckSyncMessage,
} from '../src/stage/sync.ts';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const name of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) {
    Reflect.deleteProperty(document, name);
  }
  Reflect.deleteProperty(HTMLElement.prototype, 'requestFullscreen');
});

/** happy-dom has no Fullscreen API; define the parts a test needs. */
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
  it('declares a closed slot list per master', () => {
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
  });

  const slots = (master: string, blocks: unknown[]) =>
    composeSlide({ master: master as never, blocks: blocks as never }).regions.map((region) => [
      region.slot,
      region.blocks.map((block) => (block.type === 'text' ? block.markdown : block.type)),
    ]);

  it('splits blocks into named slots at top-level dividers, dropping separators', () => {
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
  });

  it('keeps dividers past the last slot, leaves out empty slots and keeps one region when empty', () => {
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
  });

  it('leaves the media masters as they were and never crops images outside the media region', () => {
    const image = {
      type: 'image',
      src: 'photo.png',
      alt: 'A harbor',
      width: 640,
      height: 360,
    } as const;
    const composed = composeSlide({ master: 'media-left', blocks: [image, divider, text('b')] });
    expect(composed.regions.map((region) => region.slot)).toEqual(['media', 'body']);
    expect(composed.regions[1]?.blocks.map((block) => block.type)).toEqual(['divider', 'text']);
    const footerImage = composeSlide({ master: 'two-column', blocks: [text('a'), divider, image] })
      .regions[1]?.blocks[0];
    expect(footerImage).toMatchObject({ type: 'image', fit: 'contain' });
  });

  it('paints the slots in reading order on the stage and in print, with fragments inside them', async () => {
    mockMediaPreferences();
    render(DeckStage, { props: { deck: makeDeck(), initialSlideId: 'compare', loadTheme: null } });
    const regions = document.querySelector<HTMLElement>('.tx-deck-stage__regions');
    expect(regions?.dataset.arrangement).toBe('split');
    expect(regions?.dataset.slots).toBe('contentStart contentEnd footer');
    expect(
      [...document.querySelectorAll<HTMLElement>('.tx-deck-stage__region')].map(
        (region) => region.dataset.slot
      )
    ).toEqual(['contentStart', 'contentEnd', 'footer']);
    expect(
      document.querySelector('[data-slot="contentEnd"] .tx-deck-stage__fragment')
    ).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Before and after' }).dataset.arrangement).toBe(
      'split'
    );

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
  });
});

describe('fullscreen', () => {
  it('falls back visibly to filling the window when the Fullscreen API is missing, and Escape exits', async () => {
    mockMediaPreferences();
    const onFullscreenChange = vi.fn();
    render(DeckStage, { props: { deck: makeDeck(), loadTheme: null, onFullscreenChange } });
    const stage = screen.getByRole('region', { name: 'Presentation: Board update' });
    const button = screen.getByRole('button', { name: 'Fullscreen' });

    await fireEvent.click(button);
    await waitFor(() => expect(stage.dataset.fullscreen).toBe('viewport'));
    expect(onFullscreenChange).toHaveBeenLastCalledWith('viewport');
    expect(document.querySelector('.tx-deck-stage__fullscreen-note')?.textContent).toBe(
      'Fullscreen is not available here, so the presentation fills the window. Press Escape to exit.'
    );
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent?.trim()).toBe('Exit fullscreen');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('article')));

    await fireEvent.keyDown(screen.getByRole('article'), { key: 'Escape' });
    expect(stage.dataset.fullscreen).toBeUndefined();
    expect(onFullscreenChange).toHaveBeenLastCalledWith('off');
    expect(screen.queryByText(/fills the window/)).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('keeps focus inside the stage while it fills the window', async () => {
    mockMediaPreferences();
    const outside = document.createElement('button');
    outside.textContent = 'Outside';
    document.body.append(outside);
    render(DeckStage, { props: { deck: makeDeck(), loadTheme: null } });
    const article = screen.getByRole('article');
    article.focus();
    await fireEvent.keyDown(article, { key: 'f' });
    const stage = screen.getByRole('region', { name: 'Presentation: Board update' });
    await waitFor(() => expect(stage.dataset.fullscreen).toBe('viewport'));

    await fireEvent.focusOut(screen.getByRole('article'), { relatedTarget: outside });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('article')));
    outside.remove();
  });

  it('uses native fullscreen when available and follows the browser leaving it', async () => {
    mockMediaPreferences();
    const request = vi.fn(async () => undefined);
    const api = defineFullscreen(request);
    render(DeckStage, { props: { deck: makeDeck(), loadTheme: null } });
    const stage = screen.getByRole('region', { name: 'Presentation: Board update' });

    await fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    await waitFor(() => expect(stage.dataset.fullscreen).toBe('native'));
    expect(request).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.tx-deck-stage__fullscreen-note')).toBeNull();

    api.leave();
    document.dispatchEvent(new Event('fullscreenchange'));
    await waitFor(() => expect(stage.dataset.fullscreen).toBeUndefined());
  });

  it('says so when the browser refuses native fullscreen', async () => {
    mockMediaPreferences();
    defineFullscreen(async () => {
      throw new Error('denied');
    });
    render(DeckStage, { props: { deck: makeDeck(), loadTheme: null } });
    await fireEvent.click(screen.getByRole('button', { name: 'Fullscreen' }));
    await waitFor(() =>
      expect(document.querySelector('.tx-deck-stage__fullscreen-note')?.textContent).toContain(
        'The browser refused fullscreen'
      )
    );
  });
});

describe('step reporting', () => {
  it('reports every slide and step change with onStepChange, keeping onSlideChange for slides', async () => {
    mockMediaPreferences();
    const onStepChange = vi.fn();
    const onSlideChange = vi.fn();
    render(DeckStage, {
      props: { deck: makeDeck(), loadTheme: null, onStepChange, onSlideChange },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Previous step' }));
    expect(onStepChange.mock.calls.map(([intent]) => intent)).toEqual([
      { index: 1, slideId: 'compare', step: 0, stepCount: 2 },
      { index: 1, slideId: 'compare', step: 1, stepCount: 2 },
      { index: 1, slideId: 'compare', step: 2, stepCount: 2 },
      { index: 1, slideId: 'compare', step: 1, stepCount: 2 },
    ]);
    expect(onSlideChange.mock.calls).toEqual([[{ index: 1, slideId: 'compare' }]]);
  });
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

describe('presenter screen link', () => {
  it('accepts only the closed message shapes for its deck', () => {
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
      parseDeckSyncMessage({ protocol: DECK_SYNC_PROTOCOL, kind: 'hello', deck: 'board' }, 'board')
    ).toEqual({ protocol: DECK_SYNC_PROTOCOL, kind: 'hello', deck: 'board' });
  });

  it('returns null when the browser has no BroadcastChannel or the deck key is unusable', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    expect(createDeckSync({ deck: 'board' })).toBeNull();
    expect(createDeckSync({ deck: 'bad key!', open: createHub().open })).toBeNull();
  });

  it('keeps an audience stage and a presenter screen on the same slide and step, without echoes', async () => {
    mockMediaPreferences();
    const hub = createHub();
    const audienceLink = createDeckSync({ deck: 'board', open: hub.open });
    const presenterLink = createDeckSync({ deck: 'board', open: hub.open });
    const audience = document.createElement('div');
    const presenterHost = document.createElement('div');
    document.body.append(audience, presenterHost);

    render(DeckStage, {
      target: audience,
      props: { deck: makeDeck(), loadTheme: null, sync: audienceLink, initialSlideId: 'compare' },
    });
    // The presenter screen opens later and asks where the deck is.
    render(DeckStage, {
      target: presenterHost,
      props: { deck: makeDeck(), loadTheme: null, sync: presenterLink, presenter: true },
    });
    const articleIn = (host: HTMLElement) => host.querySelector<HTMLElement>('article');
    await waitFor(() => expect(articleIn(presenterHost)?.dataset.slideId).toBe('compare'));

    const nextIn = (host: HTMLElement) =>
      host.querySelector<HTMLButtonElement>('.tx-deck-stage__control:nth-of-type(2)');
    await fireEvent.click(nextIn(audience) as HTMLButtonElement);
    await waitFor(() => expect(articleIn(presenterHost)?.dataset.step).toBe('1'));
    expect(presenterHost.querySelector('.tx-deck-stage__step-progress')?.textContent).toContain(
      'Reveal step 1 of 2'
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
  });
});
