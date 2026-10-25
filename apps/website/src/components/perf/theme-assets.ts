/**
 * Per-theme assets, fetched lazily from the same origin (T-site-perf).
 *
 * The theme gallery, theme switcher and color explorer used to inline every
 * library theme (CSS for 210 themes, or the explorer payload for all of them)
 * into one HTML page: 1.7 to 12.7 MB. Each theme now has its own static file,
 * built at build time:
 *
 * - `/theme-css/<id>.css`: the theme's light and dark custom properties,
 *   scoped by `[data-tx-theme][data-tx-mode]` exactly as the inlined rules were.
 * - `/theme-data/<id>.json`: the color explorer payload for one theme.
 *
 * Pages load only what is on screen or chosen. Never another origin: the
 * paths are relative to the site base, and ids are checked before use.
 */

/** Library theme ids: lowercase words joined by single hyphens. */
export const THEME_ASSET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function base(): string {
  const value = typeof import.meta.env?.BASE_URL === 'string' ? import.meta.env.BASE_URL : '/';
  return value.endsWith('/') ? value : `${value}/`;
}

/** Same-origin URL of a theme's CSS file, or `null` for an invalid id. */
export function themeCssHref(id: string): string | null {
  return THEME_ASSET_ID.test(id) ? `${base()}theme-css/${id}.css` : null;
}

/** Same-origin URL of a theme's explorer payload, or `null` for an invalid id. */
export function themeDataHref(id: string): string | null {
  return THEME_ASSET_ID.test(id) ? `${base()}theme-data/${id}.json` : null;
}

const cssLoads = new WeakMap<Document, Map<string, Promise<boolean>>>();

/**
 * Adds the theme's stylesheet to the document once and resolves when it has
 * loaded (`true`) or failed (`false`). Repeated calls share one request.
 */
export function ensureThemeCss(id: string, doc: Document = document): Promise<boolean> {
  const href = themeCssHref(id);
  if (!href) return Promise.resolve(false);
  let loads = cssLoads.get(doc);
  if (!loads) {
    loads = new Map();
    cssLoads.set(doc, loads);
  }
  const existing = loads.get(id);
  if (existing) return existing;
  const pending = new Promise<boolean>((resolve) => {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.txThemeCss = id;
    link.addEventListener('load', () => resolve(true), { once: true });
    link.addEventListener(
      'error',
      () => {
        loads?.delete(id);
        link.remove();
        resolve(false);
      },
      { once: true }
    );
    doc.head.append(link);
  });
  loads.set(id, pending);
  return pending;
}

const dataLoads = new Map<string, Promise<unknown>>();

/** Fetches a theme's explorer payload once; `null` when the id or response is invalid. */
export function loadThemeData<T>(id: string, fetchImpl: typeof fetch = fetch): Promise<T | null> {
  const href = themeDataHref(id);
  if (!href) return Promise.resolve(null);
  let pending = dataLoads.get(id);
  if (!pending) {
    pending = fetchImpl(href, { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data) => {
        if (data === null) dataLoads.delete(id);
        return data;
      });
    dataLoads.set(id, pending);
  }
  return pending as Promise<T | null>;
}

/**
 * Loads a theme's CSS when `node` comes near the viewport (an Svelte attach
 * helper for preview cards). Without IntersectionObserver it loads at once.
 */
export function loadThemeCssWhenVisible(id: string) {
  return (node: Element): (() => void) => {
    const view = node.ownerDocument.defaultView;
    if (!view || typeof view.IntersectionObserver !== 'function') {
      void ensureThemeCss(id, node.ownerDocument);
      return () => {};
    }
    const observer = new view.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void ensureThemeCss(id, node.ownerDocument);
        }
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  };
}

/**
 * Whole-library lists the theme pages filter and page through
 * (FIX-site-perf-routes). A page server-renders its first cards from a small
 * prop and fetches the full list from one of these same-origin files after
 * mount, instead of inlining all 210 entries into its HTML:
 *
 * - `/theme-catalog.json`: the switcher's catalog rows.
 * - `/theme-gallery.json`: the gallery's cards with their contrast scores.
 * - `/theme-catalog-dark.json`: each theme's dark swatches, fetched only
 *   while the site paints dark.
 */
export type ThemeListFile = 'theme-catalog' | 'theme-catalog-dark' | 'theme-gallery';

const listLoads = new Map<ThemeListFile, Promise<unknown[] | null>>();

/** Fetches a theme list once; `null` when the response is missing or not a list. */
export function loadThemeList<T>(
  file: ThemeListFile,
  fetchImpl: typeof fetch = fetch
): Promise<readonly T[] | null> {
  let pending = listLoads.get(file);
  if (!pending) {
    pending = fetchImpl(`${base()}${file}.json`, { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null)
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          listLoads.delete(file);
          return null;
        }
        return data;
      });
    listLoads.set(file, pending);
  }
  return pending as Promise<readonly T[] | null>;
}
