/**
 * The first-visit hint's rules, apart from its component, so the stage
 * decides whether to load the hint at all (`FirstRunHint.svelte` is its own
 * chunk).
 */

/** How long the first-visit hint stays when nobody touches the deck. */
export const FIRST_RUN_HINT_MS = 6000;

/** The `localStorage` key that remembers a namespace has shown its hint. */
export function firstRunHintKey(namespace: string): string {
  return `texuli:deck-hint:${namespace}`;
}

interface HintWindow {
  location: { search: string };
  document: { visibilityState?: string };
  navigator: { webdriver?: boolean };
}

/**
 * Whether the hint may show on this page: never with `?hint=0`, in a hidden
 * document or under automation (screenshots, browser tests); `?hint=1`
 * forces it on (for checks), still once per namespace.
 */
export function firstRunHintAllowed(win: HintWindow | null | undefined): boolean {
  if (!win) return false;
  let flag: string | null = null;
  try {
    flag = new URLSearchParams(win.location.search).get('hint');
  } catch {
    flag = null;
  }
  if (flag === '0') return false;
  if (flag === '1') return true;
  if (win.document.visibilityState === 'hidden') return false;
  return win.navigator.webdriver !== true;
}

/**
 * True once per namespace: reads and records the flag. Storage that throws
 * (private mode, a sandboxed frame) or is missing counts as unseen, and the
 * hint is not retried on that page.
 */
export function claimFirstRunHint(namespace: string, storage: () => Storage | null): boolean {
  const key = firstRunHintKey(namespace);
  try {
    const store = storage();
    if (!store) return true;
    if (store.getItem(key) !== null) return false;
    store.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

/** The page's `localStorage`, or `null` where reading it throws. */
export function deckHintStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
