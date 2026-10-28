// @vitest-environment happy-dom

import { configure, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { DECK_CONTROLS } from '@texuli/deck/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDeckTooltip,
  placeDeckTooltip,
  TOOLTIP_HOVER_DELAY_MS,
  TOOLTIP_LONG_PRESS_MS,
} from '../src/stage/chrome/tooltip.ts';
import {
  claimFirstRunHint,
  copyDeckText,
  DECK_STAGE_MESSAGES,
  DeckStage,
  deckChromeEnvironment,
  deckPrintLink,
  deckShortcutText,
  deckSlideLink,
  FIRST_RUN_HINT_MS,
  firstRunHintAllowed,
} from '../src/stage/index.ts';
import { createDeckTranslator } from '../src/stage/messages.ts';
import { scenario } from './scenario.ts';

// ---------------------------------------------------------------------------
// Fixtures and helpers

type Bag = Record<string, unknown>;

const SIX = ['opening', 'market', 'plan', 'risks', 'team', 'close'];

function deckOf(extra: Bag = {}) {
  return {
    formatVersion: 2,
    meta: { title: 'Quarterly update' },
    slides: SIX.map((id) => ({
      id,
      title: id[0]?.toUpperCase() + id.slice(1),
      layout: 'free',
      blocks: [{ type: 'text', markdown: `${id}.` }],
    })),
    ...extra,
  };
}

function mockPreferences() {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
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

const active = () =>
  document.querySelector<HTMLElement>('[data-tx-deck-active="true"]') as HTMLElement;
const activeId = () => active()?.dataset.slideId;
const status = () =>
  document.querySelector('.tx-deck-stage [role="status"][aria-live="polite"]')?.textContent ?? '';
const tool = (action: string) =>
  document.querySelector<HTMLButtonElement>(`[data-tx-deck-tool="${action}"]`) as HTMLButtonElement;

async function press(key: string, init: Bag = {}) {
  const target = (document.activeElement as HTMLElement | null) ?? active();
  await fireEvent.keyDown(target === document.body ? active() : target, { key, ...init });
}

function stageWith(props: Bag = {}) {
  mockPreferences();
  const result = render(DeckStage, { props: { deck: deckOf(), loadTheme: null, ...props } });
  active().focus();
  return result;
}

function reset() {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'print');
  Reflect.deleteProperty(document, 'fullscreenEnabled');
  localStorage.clear();
  window.history.replaceState(null, '', window.location.pathname);
}

afterEach(reset);
// Help, laser, the slide list, the hint, the overlay and the tooltip are lazy chunks.
configure({ asyncUtilTimeout: 5000 });

// ---------------------------------------------------------------------------

describe('chrome helpers', () => {
  it('builds slide and print links, copies with a fallback and reads the page capabilities', async () => {
    // Links keep the page and replace the fragment; the print link keeps other parameters.
    expect(deckSlideLink('https://example.com/deck?x=1#/old/2', 'plan', 3)).toBe(
      'https://example.com/deck?x=1#/plan/3'
    );
    expect(deckSlideLink('https://example.com/deck', 'Bad Id', 0)).toBe(
      'https://example.com/deck#/'
    );
    expect(deckPrintLink('https://example.com/deck?x=1#/old/0', 'plan', 1)).toBe(
      'https://example.com/deck?x=1&print=1#/plan/1'
    );
    expect(deckPrintLink('not a url', 'plan', 0)).toBe('?print=1#/plan/0');

    // The Clipboard API first; a refusal falls back to execCommand; neither is reported honestly.
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    expect(await copyDeckText('a', document)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('a');
    writeText.mockRejectedValueOnce(new Error('denied'));
    const exec = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec });
    expect(await copyDeckText('b', document)).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    writeText.mockRejectedValueOnce(new Error('denied'));
    exec.mockReturnValueOnce(false);
    expect(await copyDeckText('c', document)).toBe(false);
    Reflect.deleteProperty(document, 'execCommand');

    // Capabilities: no window means the defaults without debug; print follows window.print.
    expect(deckChromeEnvironment(null)).toMatchObject({
      fullscreen: true,
      print: true,
      debug: false,
    });
    expect(deckChromeEnvironment(window).print).toBe(false);
    Object.defineProperty(window, 'print', { configurable: true, value: vi.fn() });
    expect(deckChromeEnvironment(window)).toMatchObject({
      print: true,
      clipboard: true,
      debug: false,
    });

    // Shortcut sentences from the registry keys, through the messages.
    const t = createDeckTranslator({ 'stage.shortcut': 'Pulsa {keys}.' });
    const keys = (action: string) => DECK_CONTROLS.find((c) => c.action === action)?.keys ?? [];
    expect(deckShortcutText(keys('presenter'), t, 'en')).toBe('Pulsa S or P.');
    expect(deckShortcutText(keys('laser'), t)).toBe('Pulsa L. (Esc closes it)');
    expect(deckShortcutText(keys('copy-link'), t)).toBeNull();
    expect(deckShortcutText([{ key: 'Escape', label: 'Esc', closes: true }], t)).toBe('Keys: Esc');
    // Every chrome key is a stage key.
    expect(Object.keys(DECK_STAGE_MESSAGES).every((key) => key.startsWith('stage.'))).toBe(true);
  });

  it('first-visit hint rules: once per namespace, storage failures, automation and ?hint', () => {
    const store = new Map<string, string>();
    const storage = () =>
      ({
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      }) as unknown as Storage;
    expect(claimFirstRunHint('deck-a', storage)).toBe(true);
    expect(claimFirstRunHint('deck-a', storage)).toBe(false);
    expect(claimFirstRunHint('deck-b', storage)).toBe(true);
    const throwing = () => {
      throw new Error('denied');
    };
    expect(claimFirstRunHint('deck-c', throwing)).toBe(true);
    expect(claimFirstRunHint('deck-c', () => null)).toBe(true);

    const win = (search: string, webdriver: boolean, visibilityState = 'visible') => ({
      location: { search },
      document: { visibilityState },
      navigator: { webdriver },
    });
    const cases: [ReturnType<typeof win> | null, boolean][] = [
      [win('', false), true],
      [win('', true), false],
      [win('?hint=1', true), true],
      [win('?hint=0', false), false],
      [win('', false, 'hidden'), false],
      [null, false],
    ];
    for (const [input, expected] of cases) {
      expect(firstRunHintAllowed(input), JSON.stringify(input)).toBe(expected);
    }
  });

  it('tooltip: placement, hover delay, focus, long press, Escape and suppression', () => {
    vi.useFakeTimers();
    const view = { width: 800, height: 600 };
    expect(
      placeDeckTooltip({ x: 100, y: 10, width: 40, height: 30 }, { width: 120, height: 50 }, view)
    ).toEqual({
      x: 60,
      y: 48,
    });
    // No room below: above. At the edge: slid inside.
    expect(
      placeDeckTooltip({ x: 760, y: 560, width: 40, height: 30 }, { width: 120, height: 50 }, view)
    ).toEqual({
      x: 672,
      y: 502,
    });

    let suppressed = false;
    const tooltip = createDeckTooltip({ suppressed: () => suppressed });
    const views: (string | null)[] = [];
    tooltip.subscribe((next) => views.push(next ? next.content.title : null));
    const button = document.createElement('button');
    const other = document.createElement('button');
    document.body.append(button, other);
    const detach = [
      tooltip.anchor(() => ({ title: 'Blackout', description: 'Black.', shortcut: 'Press B.' }))(
        button
      ),
      tooltip.anchor(() => ({ title: 'Laser', description: 'Dot.', shortcut: null }))(other),
    ];
    const pointer = (node: Element, type: string, pointerType = 'mouse') =>
      node.dispatchEvent(Object.assign(new Event(type, { bubbles: false }), { pointerType }));

    pointer(button, 'pointerenter');
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS - 1);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    // Moving along the toolbar switches at once.
    pointer(button, 'pointerleave');
    pointer(other, 'pointerenter');
    expect(other.getAttribute('aria-describedby')).toBe(tooltip.id);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    pointer(other, 'pointerleave');
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS * 2);

    // Escape closes only the tooltip: the key never reaches the page.
    button.focus();
    expect(button.getAttribute('aria-describedby')).toBe(tooltip.id);
    const page = vi.fn();
    document.addEventListener('keydown', page);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(page).not.toHaveBeenCalled();
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(page).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', page);
    button.blur();

    // A long press shows it and swallows the click that ends the press; a short tap clicks.
    const clicks = vi.fn();
    other.addEventListener('click', clicks);
    pointer(other, 'pointerdown', 'touch');
    vi.advanceTimersByTime(TOOLTIP_LONG_PRESS_MS);
    pointer(other, 'pointerup', 'touch');
    other.click();
    expect(clicks).not.toHaveBeenCalled();
    expect(other.getAttribute('aria-describedby')).toBe(tooltip.id);
    vi.advanceTimersByTime(2000);
    expect(other.hasAttribute('aria-describedby')).toBe(false);
    pointer(other, 'pointerdown', 'touch');
    pointer(other, 'pointerup', 'touch');
    other.click();
    expect(clicks).toHaveBeenCalledTimes(1);

    // Suppressed (blackout, laser): never shows.
    suppressed = true;
    pointer(button, 'pointerenter');
    vi.advanceTimersByTime(TOOLTIP_HOVER_DELAY_MS);
    expect(button.hasAttribute('aria-describedby')).toBe(false);
    expect(views).toEqual([null, 'Blackout', null, 'Laser', null, 'Blackout', null, 'Laser', null]);
    for (const off of detach) off();
    tooltip.destroy();
    button.remove();
    other.remove();
  });
});

describe('DeckStage chrome', () => {
  it('toolbar position: below the slide by default (DOM and Tab order), above with toolbarPosition top', async () => {
    const order = () => {
      const toolbar = screen.getByRole('group', { name: 'Presentation controls' });
      const main = document.querySelector('.tx-deck-stage__main') as HTMLElement;
      const root = document.querySelector('.tx-deck-stage') as HTMLElement;
      const follows = Boolean(
        main.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING
      );
      return { follows, data: root.dataset.txDeckToolbar, parent: toolbar.parentElement === root };
    };
    for (const [props, expected] of [
      [{}, { follows: true, data: 'bottom', parent: true }],
      [{ toolbarPosition: 'bottom' }, { follows: true, data: 'bottom', parent: true }],
      [{ toolbarPosition: 'top' }, { follows: false, data: 'top', parent: true }],
    ] as const) {
      await scenario(`places the toolbar for ${JSON.stringify(props)}`, async () => {
        stageWith(props);
        expect(order()).toEqual(expected);
      });
    }
  });

  it('toolbar: registry groups, message labels, pressed states, capabilities and the tooltip', async () => {
    await scenario(
      'renders every available control in its group with labels from the messages',
      async () => {
        stageWith({
          messages: { 'controls.laser': 'Puntero láser', 'stage.groupPresent': 'Presentar' },
        });
        const toolbar = screen.getByRole('group', { name: 'Presentation controls' });
        const groups = [...toolbar.querySelectorAll(':scope > [role="group"]')].map((group) => [
          group.getAttribute('aria-label'),
          [...group.querySelectorAll('[data-tx-deck-tool]')].map((b) =>
            b.getAttribute('data-tx-deck-tool')
          ),
        ]);
        // happy-dom has no window.print: the print control is left out.
        expect(groups).toEqual([
          ['Navigate', ['prev', 'jump', 'next', 'first', 'last']],
          ['View', ['overview', 'fullscreen']],
          ['Presentar', ['presenter', 'blackout', 'laser']],
          ['Share and print', ['copy-link']],
          ['Help', ['help']],
        ]);
        expect(tool('laser').textContent?.trim()).toBe('Puntero láser');
        expect(tool('jump').getAttribute('aria-label')).toBe('Choose a slide, 1 / 6');
        expect(tool('jump').getAttribute('aria-haspopup')).toBe('listbox');
        expect(tool('help').getAttribute('aria-haspopup')).toBe('dialog');
        expect(tool('next').getAttribute('aria-keyshortcuts')).toBe(
          'ArrowRight ArrowDown PageDown Space Enter'
        );
        expect(tool('prev').getAttribute('aria-disabled')).toBe('true');
        expect(tool('blackout').getAttribute('aria-pressed')).toBe('false');
        // Every tool is guarded chrome: clicks on it never advance the deck.
        expect(toolbar.hasAttribute('data-tx-deck-chrome')).toBe(true);
        await fireEvent.click(tool('last'));
        expect(activeId()).toBe('close');
        expect(tool('next').getAttribute('aria-disabled')).toBe('true');
        await fireEvent.click(tool('first'));
        expect(activeId()).toBe('opening');
      },
      reset
    );
    await scenario(
      'offers print where the page can print, and opens the print route in a new tab',
      async () => {
        const print = vi.fn();
        Object.defineProperty(window, 'print', { configurable: true, value: print });
        const opened = { opener: window as unknown };
        const open = vi.spyOn(window, 'open').mockImplementation(() => opened as Window);
        stageWith();
        await waitFor(() => expect(tool('print')).toBeTruthy());
        await fireEvent.click(tool('next'));
        await fireEvent.click(tool('print'));
        expect(open).toHaveBeenCalledWith(
          expect.stringMatching(/\?print=1#\/market\/0$/),
          '_blank'
        );
        expect(opened.opener).toBeNull();
        expect(print).not.toHaveBeenCalled();
        // A blocked tab prints this page instead.
        open.mockImplementation(() => null);
        await fireEvent.click(tool('print'));
        expect(print).toHaveBeenCalledTimes(1);
        // Ctrl+P stays the browser's own: the stage does not open a tab.
        open.mockClear();
        active().focus();
        await press('p', { ctrlKey: true });
        expect(open).not.toHaveBeenCalled();
      },
      reset
    );
    await scenario(
      'describes a control with its tooltip on keyboard focus, and Escape closes only the tooltip',
      async () => {
        const { container } = stageWith();
        await fireEvent.click(tool('fullscreen'));
        const stage = container.querySelector<HTMLElement>('.tx-deck-stage') as HTMLElement;
        await waitFor(() => expect(stage.dataset.fullscreen).toBe('viewport'));
        tool('blackout').focus();
        await fireEvent.focus(tool('blackout'));
        const tip = await screen.findByRole('tooltip');
        expect(tool('blackout').getAttribute('aria-describedby')).toBe(tip.id);
        expect(tip.textContent).toContain('Turns the screen black.');
        expect(tip.textContent).toContain('Keys: B or . (Esc closes it)');
        await fireEvent.keyDown(tool('blackout'), { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
        expect(stage.dataset.fullscreen).toBe('viewport');
      },
      reset
    );
  });

  it('slide list: the counter opens a listbox of titles, keys move, Enter jumps, Escape returns', async () => {
    await scenario(
      'opens on the current slide and jumps to a chosen title',
      async () => {
        stageWith({ initialSlideId: 'plan' });
        expect(tool('jump').textContent?.trim()).toBe('3 / 6');
        await fireEvent.click(tool('jump'));
        const list = await screen.findByRole('listbox', { name: 'Choose a slide' });
        expect(tool('jump').getAttribute('aria-expanded')).toBe('true');
        expect(tool('jump').getAttribute('aria-controls')).toBe(list.id);
        const options = screen.getAllByRole('option');
        expect(options.map((option) => option.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
          '1. Opening',
          '2. Market',
          '3. Plan',
          '4. Risks',
          '5. Team',
          '6. Close',
        ]);
        await waitFor(() => expect(document.activeElement).toBe(options[2]));
        expect(options[2]?.getAttribute('aria-selected')).toBe('true');
        const moves: [string, number][] = [
          ['ArrowDown', 3],
          ['End', 5],
          ['ArrowDown', 5],
          ['Home', 0],
          ['ArrowUp', 0],
          ['ArrowDown', 1],
        ];
        for (const [key, expected] of moves) {
          await fireEvent.keyDown(document.activeElement as HTMLElement, { key });
          expect(`${key}→${options.indexOf(document.activeElement as HTMLElement)}`).toBe(
            `${key}→${expected}`
          );
        }
        // The deck never saw those keys.
        expect(activeId()).toBe('plan');
        await fireEvent.click(options[4] as HTMLElement);
        expect(activeId()).toBe('team');
        expect(screen.queryByRole('listbox')).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(active()));
      },
      reset
    );
    await scenario(
      'Escape closes the list and returns focus to the counter; a pointer outside closes it',
      async () => {
        stageWith();
        await fireEvent.click(tool('jump'));
        await screen.findByRole('listbox');
        await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
        expect(screen.queryByRole('listbox')).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(tool('jump')));
        await fireEvent.click(tool('jump'));
        await screen.findByRole('listbox');
        await fireEvent.pointerDown(active());
        await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
      },
      reset
    );
  });

  it('blackout: B and . turn it on with a 2 s hint; select, B or Escape bring the slide back', async () => {
    await scenario(
      'keys and the black screen button',
      async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        stageWith();
        for (const [on, off] of [
          ['b', 'click'],
          ['.', 'b'],
          ['b', 'Escape'],
        ] as const) {
          active().focus();
          await press(on);
          const screenButton = await screen.findByRole('button', {
            name: 'Screen blacked out. Press B or select to show the slide.',
          });
          expect(document.activeElement).toBe(screenButton);
          expect(screenButton.dataset.hint).toBe('visible');
          expect(tool('blackout').getAttribute('aria-pressed')).toBe('true');
          vi.advanceTimersByTime(2000);
          await waitFor(() => expect(screenButton.dataset.hint).toBe('hidden'));
          // Arrows do not move the deck under the black screen.
          await fireEvent.keyDown(screenButton, { key: 'ArrowRight' });
          expect(activeId()).toBe('opening');
          if (off === 'click') await fireEvent.click(screenButton);
          else await fireEvent.keyDown(screenButton, { key: off });
          expect(screen.queryByRole('button', { name: /Screen blacked out/ })).toBeNull();
          await waitFor(() => expect(document.activeElement).toBe(active()));
        }
      },
      reset
    );
  });

  it('laser: L shows the dot and its chip, follows the pointer, blocks click-to-advance; Escape order', async () => {
    await scenario(
      'toggles, announces and follows; Escape closes the laser before full screen',
      async () => {
        const { container } = stageWith();
        const stage = container.querySelector<HTMLElement>('.tx-deck-stage') as HTMLElement;
        await press('f');
        await waitFor(() => expect(stage.dataset.fullscreen).toBe('viewport'));
        active().focus();
        await press('l');
        const laser = await waitFor(() => {
          const node = container.querySelector<HTMLElement>('[data-tx-deck-laser]');
          expect(node).toBeTruthy();
          return node as HTMLElement;
        });
        expect(laser.getAttribute('aria-hidden')).toBe('true');
        expect(laser.textContent).toContain('Laser on');
        await waitFor(() => expect(status()).toBe('Laser on'));
        expect(tool('laser').getAttribute('aria-pressed')).toBe('true');
        expect(container.querySelector<HTMLElement>('.tx-deck-stage__viewport')?.style.cursor).toBe(
          'none'
        );
        const dot = () => laser.querySelector<HTMLElement>('.tx-deck-chrome-laser__dot');
        expect(dot()).toBeTruthy();
        await fireEvent.pointerMove(stage, { clientX: 40, clientY: 30 });
        expect(dot()?.style.transform).toBe('translate(40px, 30px)');
        await fireEvent.pointerLeave(stage, { pointerType: 'mouse' });
        expect(dot()).toBeNull();
        // A click on the slide does not advance while the laser is on.
        await fireEvent.pointerDown(container.querySelector('[data-tx-deck-canvas]') as Element);
        await fireEvent.click(container.querySelector('[data-tx-deck-canvas]') as Element);
        expect(activeId()).toBe('opening');
        active().focus();
        await press('Escape');
        await waitFor(() => expect(container.querySelector('[data-tx-deck-laser]')).toBeNull());
        expect(stage.dataset.fullscreen).toBe('viewport');
        expect(container.querySelector<HTMLElement>('.tx-deck-stage__viewport')?.style.cursor).toBe(
          ''
        );
        await waitFor(() => expect(status()).toBe('Laser off'));
        await press('Escape');
        expect(stage.dataset.fullscreen).toBeUndefined();
      },
      reset
    );
  });

  it('help: ? opens a modal guide from the registry, focus is trapped and restored, Escape closes', async () => {
    await scenario(
      'from the keyboard: grouped controls, keys, focus on Close, Tab wraps, Escape returns to the slide',
      async () => {
        stageWith();
        await press('?', { shiftKey: true });
        const dialog = await screen.findByRole('dialog', { name: 'Controls and shortcuts' });
        const close = screen.getByRole('button', { name: 'Close' });
        await waitFor(() => expect(document.activeElement).toBe(close));
        const groups = [...dialog.querySelectorAll('h3')].map((h) => h.textContent);
        expect(groups).toEqual(['Move around', 'View', 'Present', 'Share and print', 'Help']);
        const rows = [...dialog.querySelectorAll<HTMLElement>('[data-tx-deck-help-control]')].map(
          (row) => row.dataset.txDeckHelpControl
        );
        // Filtered by what the page can do: no print without window.print, no debug panel.
        expect(rows).not.toContain('print');
        expect(rows).not.toContain('debug');
        expect(rows).toContain('fullscreen-exit');
        const blackout = dialog.querySelector('[data-tx-deck-help-control="blackout"]');
        expect([...(blackout?.querySelectorAll('kbd') ?? [])].map((k) => k.textContent)).toEqual([
          'B',
          '.',
          'Esc',
        ]);
        expect(
          dialog.querySelector('[data-tx-deck-help-control="copy-link"]')?.textContent
        ).toContain('Button only');
        expect(tool('help').getAttribute('aria-expanded')).toBe('true');
        // Close and the scrollable list are the stops; Tab wraps between them.
        const list = screen.getByRole('region', { name: 'Controls and shortcuts' });
        await fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(list);
        await fireEvent.keyDown(list, { key: 'Tab' });
        expect(document.activeElement).toBe(close);
        // Navigation keys do nothing while the guide is open.
        await fireEvent.keyDown(close, { key: 'ArrowRight' });
        expect(activeId()).toBe('opening');
        await fireEvent.keyDown(close, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(active()));
      },
      reset
    );
    await scenario(
      'from the toolbar: Close and ? close it, focus returns to the help button',
      async () => {
        stageWith();
        await fireEvent.click(tool('help'));
        await screen.findByRole('dialog');
        await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        tool('help').focus();
        await fireEvent.click(tool('help'));
        await screen.findByRole('dialog');
        await fireEvent.keyDown(screen.getByRole('button', { name: 'Close' }), { key: '?' });
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(tool('help')));
      },
      reset
    );
  });

  it('copy link: copies the slide URL and answers in a polite toast, also when it fails', async () => {
    await scenario(
      'success and failure',
      async () => {
        const writeText = vi.fn(async (_text: string) => undefined);
        vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
        const onAction = vi.fn();
        const { container } = stageWith({ initialSlideId: 'plan' });
        container.addEventListener('tx-deck:action', (event) =>
          onAction((event as CustomEvent).detail)
        );
        await fireEvent.click(tool('copy-link'));
        await waitFor(() => expect(status()).toBe('Link to this slide copied.'));
        expect(writeText.mock.calls[0]?.[0]).toMatch(/#\/plan\/0$/);
        expect(onAction).toHaveBeenCalledWith({ action: 'copy-link', source: 'pointer' });
        const toast = container.querySelector<HTMLElement>('.tx-deck-chrome-toast');
        expect(toast?.textContent?.trim()).toBe('Link to this slide copied.');
        expect(toast?.getAttribute('aria-hidden')).toBe('true');
        writeText.mockRejectedValueOnce(new Error('denied'));
        await fireEvent.click(tool('copy-link'));
        await waitFor(() => expect(status()).toBe('Could not copy the link.'));
        expect(container.querySelector<HTMLElement>('.tx-deck-chrome-toast')?.dataset.tone).toBe(
          'error'
        );
      },
      reset
    );
  });

  it('first-visit hint: once per namespace, keys from the registry, leaves after 6 s or on input', async () => {
    await scenario(
      'shows with ?hint=1, never twice for a namespace',
      async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        window.history.replaceState(null, '', `${window.location.pathname}?hint=1`);
        const first = stageWith({ namespace: 'board-deck' });
        const hint = await screen.findByRole('note');
        expect(hint.textContent?.replace(/\s+/g, ' ')).toContain(
          'Use ← → to move, F for full screen, ? for every control.'
        );
        expect([...hint.querySelectorAll('kbd')].map((k) => k.textContent)).toEqual([
          '← →',
          'F',
          '?',
        ]);
        vi.advanceTimersByTime(FIRST_RUN_HINT_MS);
        await waitFor(() => expect(screen.queryByRole('note')).toBeNull());
        first.unmount();
        stageWith({ namespace: 'board-deck' });
        await Promise.resolve();
        vi.advanceTimersByTime(50);
        expect(screen.queryByRole('note')).toBeNull();
      },
      reset
    );
    await scenario(
      'a key or Got it dismisses it; automation without ?hint never shows it',
      async () => {
        window.history.replaceState(null, '', `${window.location.pathname}?hint=1`);
        stageWith({ namespace: 'review-deck' });
        await screen.findByRole('note');
        await press('ArrowRight');
        await waitFor(() => expect(screen.queryByRole('note')).toBeNull());
        expect(activeId()).toBe('market');
        window.history.replaceState(null, '', window.location.pathname);
        localStorage.clear();
        stageWith({ namespace: 'other-deck' });
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(screen.queryByRole('note')).toBeNull();
      },
      reset
    );
  });

  it('full screen overlay: leave, previous, counter and next; fades when idle, wakes on pointer', async () => {
    await scenario(
      'shows on entering full screen and hides the toolbar from the room',
      async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const { container } = stageWith();
        const stage = container.querySelector<HTMLElement>('.tx-deck-stage') as HTMLElement;
        await fireEvent.click(tool('fullscreen'));
        const overlay = await screen.findByRole('group', { name: 'Full screen controls' });
        expect(overlay.dataset.visible).toBe('true');
        expect(overlay.textContent).toContain('1 / 6');
        const [leave, previous, next] = [...overlay.querySelectorAll('button')] as HTMLElement[];
        expect(
          [leave, previous, next].map(
            (b) => b?.textContent?.trim() || b?.getAttribute('aria-label')
          )
        ).toEqual(['Leave full screen', 'Previous step or slide', 'Next step or slide']);
        await fireEvent.click(next as HTMLElement);
        expect(activeId()).toBe('market');
        expect(overlay.textContent).toContain('2 / 6');
        await fireEvent.click(previous as HTMLElement);
        expect(activeId()).toBe('opening');
        vi.advanceTimersByTime(2500);
        await waitFor(() => expect(overlay.dataset.visible).toBe('false'));
        expect(overlay.inert).toBe(true);
        await fireEvent.pointerMove(stage);
        await waitFor(() => expect(overlay.dataset.visible).toBe('true'));
        // Blackout hides it.
        active().focus();
        await press('b');
        await waitFor(() => expect(overlay.dataset.visible).toBe('false'));
        await press('b');
        await fireEvent.pointerMove(stage);
        await fireEvent.click(leave as HTMLElement);
        expect(stage.dataset.fullscreen).toBeUndefined();
        await waitFor(() =>
          expect(screen.queryByRole('group', { name: 'Full screen controls' })).toBeNull()
        );
      },
      reset
    );
  });
});
