/**
 * Chrome helpers without Svelte: the slide link, the print link, the
 * clipboard with its fallback, the control environment and the shortcut
 * sentence of the tooltips. Every one is safe without a DOM (SSR, tests) and
 * never throws.
 */
import {
  DEFAULT_DECK_CONTROL_ENVIRONMENT,
  type DeckControlEnvironment,
  type DeckControlKey,
  formatDeckHash,
} from '@texuli/deck/engine';
import type { DeckTranslate } from '../messages.ts';

/** `href` without its fragment, plus `#/<slide>/<step>`: the link "Copy link" copies. */
export function deckSlideLink(href: string, slideId: string, step = 0): string {
  const base = String(href ?? '').split('#')[0] ?? '';
  return `${base}${formatDeckHash(slideId, step)}`;
}

/**
 * The print route of the current page: `?print=1` added to the query (other
 * parameters kept) and the slide hash. The host page renders `DeckPrint`
 * when `parseDeckRoute(location.hash, location.search).flags.print` is set.
 */
export function deckPrintLink(href: string, slideId: string, step = 0): string {
  try {
    const url = new URL(href);
    url.searchParams.set('print', '1');
    url.hash = formatDeckHash(slideId, step);
    return url.href;
  } catch {
    return `?print=1${formatDeckHash(slideId, step)}`;
  }
}

/**
 * Copy `text`: the async Clipboard API first, then a hidden-textarea
 * `execCommand('copy')` fallback (insecure origins, older browsers). Resolves
 * `false` when neither works, so the caller can say so instead of claiming
 * success.
 */
export async function copyDeckText(text: string, doc?: Document): Promise<boolean> {
  const target = doc ?? (typeof document === 'undefined' ? undefined : document);
  if (!target) return false;
  try {
    const clipboard = target.defaultView?.navigator.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused (permission, insecure context): try the legacy path.
  }
  try {
    if (typeof target.execCommand !== 'function') return false;
    const area = target.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    const active = target.activeElement as HTMLElement | null;
    target.body.append(area);
    area.select();
    const ok = target.execCommand('copy') === true;
    area.remove();
    active?.focus?.({ preventScroll: true });
    return ok;
  } catch {
    return false;
  }
}

/**
 * What this page can offer (`DeckControlEnvironment`): full screen always
 * (the stage falls back to filling the window), the clipboard when either
 * copy path exists, print and popups when the window has them. Debug stays
 * off: the stage has no debug panel.
 */
export function deckChromeEnvironment(win?: Window | null): DeckControlEnvironment {
  if (!win) return { ...DEFAULT_DECK_CONTROL_ENVIRONMENT, debug: false };
  let clipboard = false;
  try {
    clipboard =
      typeof win.navigator?.clipboard?.writeText === 'function' ||
      typeof win.document?.execCommand === 'function';
  } catch {
    clipboard = false;
  }
  return {
    fullscreen: true,
    popup: typeof win.open === 'function',
    clipboard,
    print: typeof win.print === 'function',
    debug: false,
  };
}

function listOr(items: readonly string[], locale: string): string {
  if (items.length <= 1) return items[0] ?? '';
  try {
    return new Intl.ListFormat(locale, { type: 'disjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

/** The tooltip's shortcut line for a control's keys, or `null` for a button-only control. */
export function deckShortcutText(
  keys: readonly DeckControlKey[],
  t: DeckTranslate,
  locale = 'en'
): string | null {
  const opens = keys.filter((key) => !key.closes).map((key) => key.label);
  const closes = keys.some((key) => key.closes);
  if (opens.length === 0) return closes ? t('stage.shortcutEscape') : null;
  const sentence = t('stage.shortcut', { keys: listOr(opens, locale) });
  return closes ? `${sentence} ${t('stage.shortcutCloses')}` : sentence;
}
