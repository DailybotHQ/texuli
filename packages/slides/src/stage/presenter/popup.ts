/**
 * The presenter window's document (lazy chunk): builds the empty same-origin
 * window opened by the session with DOM APIs only (never an HTML string),
 * copies the opener's stylesheets, mirrors the stage root's theme, mode,
 * language and direction onto the window's root, and mounts the full
 * presenter view. The view talks to the stage over the presenter protocol
 * transport it is given, never through shared state.
 *
 * Returns the teardown: unmount, stop mirroring, stop watching the window.
 * Closing the window (or leaving the opener page) calls `onClose`.
 */
import type { PresenterTransport } from '@texuli/deck/engine';
import { mount, unmount } from 'svelte';
import DeckPresenterWindow from './DeckPresenterWindow.svelte';
import type { DeckPresenterOpenInput } from './session.svelte.ts';

export interface MountDeckPresenterWindowOptions extends DeckPresenterOpenInput {
  /** The window's end of the presenter link. */
  transport: PresenterTransport;
  /** The opener window. */
  host: Window;
  onClose: () => void;
}

/** Stage root attributes copied to the window root (never the window's own marker). */
const MIRRORED =
  /^(?:lang|dir|data-tx-(?!deck-presenter-window$)[a-z-]+|data-motion|data-theme-status)$/;
const STYLE_SOURCES = 'link[rel~="stylesheet"], style';

/** Copy the opener's stylesheets (link and style elements, nonce included). */
function copyStyles(from: Document, to: Document): void {
  for (const node of from.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(STYLE_SOURCES)) {
    const copy = to.importNode(node, true) as HTMLLinkElement | HTMLStyleElement;
    // Absolute, so the copy never depends on the window's base URL.
    if (node.tagName === 'LINK' && 'href' in node && node.href) {
      (copy as HTMLLinkElement).href = node.href;
    }
    if (node.nonce) copy.nonce = node.nonce;
    to.head.append(copy);
  }
}

/** Mirror the stage root's presentation attributes and `--tx-*` variables onto `target`. */
export function mirrorStageRoot(source: HTMLElement, target: HTMLElement): void {
  for (const attribute of [...target.attributes]) {
    if (MIRRORED.test(attribute.name) && !source.hasAttribute(attribute.name)) {
      target.removeAttribute(attribute.name);
    }
  }
  for (const attribute of [...source.attributes]) {
    if (MIRRORED.test(attribute.name)) target.setAttribute(attribute.name, attribute.value);
  }
  const wanted = new Set<string>();
  for (let i = 0; i < source.style.length; i += 1) {
    const name = source.style.item(i);
    if (!name.startsWith('--tx-')) continue;
    wanted.add(name);
    target.style.setProperty(name, source.style.getPropertyValue(name));
  }
  for (let i = target.style.length - 1; i >= 0; i -= 1) {
    const name = target.style.item(i);
    if (name.startsWith('--tx-') && !wanted.has(name)) target.style.removeProperty(name);
  }
}

export function mountDeckPresenterWindow(
  popup: Window,
  options: MountDeckPresenterWindowOptions
): () => void {
  const { stage, paint, timers, stageRoot, transport, host, onClose } = options;
  const doc = popup.document;
  // A re-used window (same name) starts from an empty document again.
  doc.head.replaceChildren();
  doc.title = stage.t('stage.presenterWindowTitle', { title: stage.deck.meta.title ?? '' });
  doc.documentElement.lang = stage.locale;
  doc.documentElement.dir = stage.dir;
  copyStyles(host.document, doc);
  doc.body.replaceChildren();
  doc.body.style.margin = '0';

  const root = doc.createElement('div');
  root.className = 'tx-deck-stage tx-deck-presenter-window';
  root.setAttribute('data-tx-deck-presenter-window', stage.namespace);
  doc.body.append(root);

  let observer: MutationObserver | null = null;
  if (stageRoot) {
    mirrorStageRoot(stageRoot, root);
    const Observer =
      (host as Window & typeof globalThis).MutationObserver ?? globalThis.MutationObserver;
    if (typeof Observer === 'function') {
      const watcher = new Observer(() => mirrorStageRoot(stageRoot, root));
      watcher.observe(stageRoot, { attributes: true });
      observer = watcher;
    }
  }

  const view = mount(DeckPresenterWindow, {
    target: root,
    props: { stage, paint, timers, transport, onClose },
  });

  let closed = false;
  const gone = () => {
    if (closed) return;
    onClose();
  };
  // The user closed the presenter window, or the opener page goes away.
  popup.addEventListener('pagehide', gone);
  host.addEventListener('pagehide', gone);
  const poll = host.setInterval(() => {
    if (popup.closed) gone();
  }, 1000);

  return () => {
    closed = true;
    host.clearInterval(poll);
    host.removeEventListener('pagehide', gone);
    try {
      popup.removeEventListener('pagehide', gone);
    } catch {
      // The window is already gone.
    }
    observer?.disconnect();
    void unmount(view);
  };
}
