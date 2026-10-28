/**
 * The chrome's own state (help dialog, laser, slide list, the toast) and the
 * one place every chrome action runs. `DeckStage` creates the state, feeds
 * `help` and `laser` to the engine's input decisions (so Escape closes the
 * innermost layer, `DECK_ESCAPE_ORDER`) and provides it to the chrome below
 * with `setDeckChromeContext`. A host that replaces the toolbar with the
 * `chrome` snippet reads it with `getDeckChromeContext()` and calls
 * `runDeckChromeAction`, so its buttons do exactly what the keys do.
 */
import type { DeckAction, DeckActionSource } from '@texuli/deck/engine';
import { getContext, setContext } from 'svelte';
import type { DeckStageContext } from '../context.ts';
import { dispatchDeckEvent } from '../events.ts';
import { copyDeckText, deckPrintLink, deckSlideLink } from './links.ts';

const CHROME_CONTEXT = Symbol.for('@texuli/slides/stage/chrome');

export interface DeckChromeNotice {
  /** Increases with every notice, so a repeated text is announced again. */
  id: number;
  text: string;
  tone: 'info' | 'error';
  /** `false`: announced to assistive tech only (the change is already visible). */
  visual: boolean;
}

/** Reactive chrome state (Svelte runes). */
export class DeckChromeState {
  help = $state(false);
  laser = $state(false);
  jump = $state(false);
  notice = $state.raw<DeckChromeNotice | null>(null);
  #sequence = 0;

  /** Show (and announce politely) one feedback message; a new one replaces the current one. */
  notify(text: string, options: { tone?: 'info' | 'error'; visual?: boolean } = {}): void {
    this.#sequence += 1;
    this.notice = {
      id: this.#sequence,
      text,
      tone: options.tone ?? 'info',
      visual: options.visual ?? true,
    };
  }

  /** Close every chrome layer (a new deck, or the stage unmounting). */
  reset(): void {
    this.help = false;
    this.laser = false;
    this.jump = false;
    this.notice = null;
  }
}

export function createDeckChromeState(): DeckChromeState {
  return new DeckChromeState();
}

export function setDeckChromeContext(state: DeckChromeState): DeckChromeState {
  return setContext(CHROME_CONTEXT, state);
}

/** The surrounding stage's chrome state, or `undefined` outside `DeckStage`. */
export function getDeckChromeContext(): DeckChromeState | undefined {
  return getContext<DeckChromeState | undefined>(CHROME_CONTEXT);
}

/** The chrome-owned actions: the engine and the stage core handle the rest. */
const CHROME_ACTIONS: ReadonlySet<DeckAction> = new Set([
  'help',
  'laser',
  'copy-link',
  'jump',
  'print',
]);

async function copyLink(stage: DeckStageContext, chrome: DeckChromeState): Promise<void> {
  const { slideId, step } = stage.state;
  const href = typeof location === 'undefined' ? '' : location.href;
  const ok = await copyDeckText(deckSlideLink(href, slideId, step));
  chrome.notify(stage.t(ok ? 'stage.linkCopied' : 'stage.linkCopyFailed'), {
    tone: ok ? 'info' : 'error',
  });
}

/**
 * Open the print route (`?print=1#/<slide>/<step>`) in a new tab, where the
 * host renders `DeckPrint`; when the tab cannot open, print this page (its
 * print styles hide the chrome).
 */
function openPrint(stage: DeckStageContext): void {
  if (typeof window === 'undefined') return;
  const { slideId, step } = stage.state;
  let opened: Window | null = null;
  try {
    opened = window.open?.(deckPrintLink(window.location.href, slideId, step), '_blank') ?? null;
  } catch {
    opened = null;
  }
  if (opened) {
    try {
      opened.opener = null;
    } catch {
      // A cross-origin or closed window: nothing to cut.
    }
    return;
  }
  window.print?.();
}

/**
 * Run one deck action from the chrome (a button, the overlay, a host
 * control). Keys reach the same state through the engine: navigation,
 * overview and blackout through the controller, and `help`, `laser`,
 * `copy-link`, `jump` through its `action` event. `Ctrl/⌘ + P` from the
 * keyboard stays the browser's own print.
 */
export function runDeckChromeAction(
  stage: DeckStageContext,
  chrome: DeckChromeState,
  action: DeckAction,
  options: { source?: DeckActionSource; root?: EventTarget | null } = {}
): void {
  const source = options.source ?? 'pointer';
  const controller = stage.controller;
  if (options.root && source !== 'keyboard' && CHROME_ACTIONS.has(action)) {
    dispatchDeckEvent(options.root, 'tx-deck:action', { action, source });
  }
  switch (action) {
    case 'next':
      controller.next({ source });
      return;
    case 'prev':
      controller.prev({ source });
      return;
    case 'first':
      controller.first({ source });
      return;
    case 'last':
      controller.last({ source });
      return;
    case 'overview':
      chrome.jump = false;
      controller.setOverview(!stage.state.overview);
      return;
    case 'blackout':
      chrome.jump = false;
      controller.setBlackout(!stage.state.blackout);
      return;
    case 'fullscreen':
    case 'fullscreen-exit':
      if (action === 'fullscreen' || stage.fullscreen !== 'off') stage.toggleFullscreen();
      return;
    case 'presenter':
      stage.setPresenter(!stage.presenter);
      return;
    case 'help':
      chrome.jump = false;
      chrome.help = !chrome.help;
      return;
    case 'laser':
      chrome.laser = !chrome.laser;
      chrome.notify(stage.t(chrome.laser ? 'chrome.laserOn' : 'stage.laserOff'), {
        visual: false,
      });
      return;
    case 'jump':
      chrome.jump = !chrome.jump;
      return;
    case 'copy-link':
      void copyLink(stage, chrome);
      return;
    case 'print':
      if (source !== 'keyboard') openPrint(stage);
      return;
    default:
      return;
  }
}

/** True for the actions `runDeckChromeAction` handles when the engine emits them from a key. */
export function isDeckChromeAction(action: DeckAction): boolean {
  return CHROME_ACTIONS.has(action);
}
