import { applyColorMode, type ColorMode, type ResolvedColorMode } from '@texuli/tokens/modes';
import {
  appearanceCacheKey,
  cacheAppearance,
  localStorageOrUndefined,
  readCachedAppearance,
} from '@texuli/tokens/no-flash';

/** What the switcher offers: an explicit light or dark mode, or the system preference. */
export type AppearanceChoice = 'light' | 'dark' | 'system';
/** A cached explicit high-contrast mode is reported as is (no option is selected). */
export type StoredAppearanceChoice = AppearanceChoice | 'high-contrast';

export const APPEARANCE_CHOICES: readonly AppearanceChoice[] = Object.freeze([
  'light',
  'dark',
  'system',
]);

export type ApplyAppearanceOptions = {
  /** Element that carries the mode; defaults to the document root. */
  root?: HTMLElement;
  /** Storage that holds the cache; defaults to `localStorage` when available. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Theme id cached when none is cached or on the root; defaults to `default`. */
  themeId?: string;
  /** Mode "system" falls back to; match the integration's `fallbackMode`. */
  fallbackMode?: ColorMode;
  /** Media query function; defaults to the global `matchMedia`. */
  matchMedia?: (query: string) => { matches: boolean };
};

const THEME_ID = /^[a-z][a-z0-9-]{0,79}$/;

/**
 * The window event `applyAppearanceChoice` dispatches after every choice, so
 * every `AppearanceSwitcher` of the namespace on the page (and any host
 * listener) follows a change made in the same tab. Other tabs follow through
 * the `storage` event. Its `detail` is an `AppearanceChangeDetail`.
 */
export const APPEARANCE_CHANGE_EVENT = 'tx-appearance-change';

/** The `detail` of an `APPEARANCE_CHANGE_EVENT`. */
export type AppearanceChangeDetail = {
  namespace: string;
  choice: AppearanceChoice;
};

function announceChange(namespace: string, choice: AppearanceChoice): void {
  const target = globalThis as Partial<Pick<Window, 'dispatchEvent'>>;
  if (typeof target.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  const detail: AppearanceChangeDetail = { namespace, choice };
  target.dispatchEvent(new CustomEvent(APPEARANCE_CHANGE_EVENT, { detail }));
}

/** Read the stored choice for a site namespace; nothing or a malformed cache is `system`. */
export function readAppearanceChoice(
  namespace: string,
  storage: Pick<Storage, 'getItem'> | undefined = localStorageOrUndefined()
): StoredAppearanceChoice {
  return readCachedAppearance(namespace, storage)?.mode ?? 'system';
}

function defaultMatchMedia(): ((query: string) => { matches: boolean }) | undefined {
  return typeof globalThis.matchMedia === 'function'
    ? (query) => globalThis.matchMedia(query)
    : undefined;
}

/**
 * Persist a choice in the namespaced appearance cache (the one the
 * `@texuli/astro` bootstrap reads before paint) and apply it to the root
 * now. Light and dark keep a cached theme id, surface, motion and component
 * styles but drop the cached variables, which belong to the old mode; System
 * removes the cache so the bootstrap's fallback mode applies again. Returns
 * the resolved mode.
 */
export function applyAppearanceChoice(
  namespace: string,
  choice: AppearanceChoice,
  options: ApplyAppearanceOptions = {}
): ResolvedColorMode {
  const root = options.root ?? globalThis.document?.documentElement;
  const storage = options.storage ?? localStorageOrUndefined();
  const key = appearanceCacheKey(namespace);
  const previous = readCachedAppearance(namespace, storage);
  if (root && previous) {
    for (const name of Object.keys(previous.vars)) root.style.removeProperty(name);
  }

  const matchMedia = options.matchMedia ?? defaultMatchMedia();
  if (choice === 'system') {
    try {
      storage?.removeItem(key);
    } catch {
      // Blocked storage: the page still switches for this visit.
    }
    const fallback = options.fallbackMode ?? 'system';
    const resolved = root ? applyColorMode(root, fallback, matchMedia) : 'light';
    announceChange(namespace, choice);
    return resolved;
  }

  const rootTheme = root?.dataset.txTheme;
  const themeId =
    previous?.themeId ??
    (rootTheme && THEME_ID.test(rootTheme) ? rootTheme : undefined) ??
    (options.themeId && THEME_ID.test(options.themeId) ? options.themeId : 'default');
  cacheAppearance(
    namespace,
    {
      themeId,
      mode: choice,
      vars: {},
      ...(previous?.reducedMotion !== undefined ? { reducedMotion: previous.reducedMotion } : {}),
      ...(previous?.surface !== undefined ? { surface: previous.surface } : {}),
      ...(previous?.components !== undefined ? { components: previous.components } : {}),
    },
    storage
  );
  if (root) {
    root.dataset.txTheme = themeId;
    applyColorMode(root, choice, matchMedia);
  }
  announceChange(namespace, choice);
  return choice;
}
