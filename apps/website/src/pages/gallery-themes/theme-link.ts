/**
 * Theme-gallery deep links (PLAN_006 T-83, design-punchlist gallery row 2).
 *
 * `?theme=<id>&mode=<light|dark|high-contrast>` carries the painted appearance
 * in the address bar so any gallery view can be shared. The island is
 * untouched: this page-owned module
 *
 * - parses and validates the query against the real library ids (fail closed:
 *   an unknown id or mode is ignored, never painted);
 * - applies a valid link through the same `applySiteAppearance` path the
 *   island uses, preserving the visitor's painted mode when the link names a
 *   theme only;
 * - mirrors what the island writes on `<html>` (`data-tx-theme`,
 *   `data-tx-mode`) back into the query with `history.replaceState`, so every
 *   Apply produces a shareable URL; and
 * - powers the copy-link button through the same status-region contract the
 *   site's other copy controls use.
 *
 * No HTML sink: the only writes are dataset reads, query strings and
 * `textContent`. Pure functions stay DOM-free; the wiring helpers take their
 * browser edges (CSS loading, clipboard, history) as injectables so unit
 * tests run the real logic.
 */

/** Modes a share link may force; `system` never goes in a URL (it resolves per visitor). */
export type ThemeLinkMode = 'light' | 'dark' | 'high-contrast';

const LINK_MODES: readonly ThemeLinkMode[] = ['light', 'dark', 'high-contrast'];

export function isThemeLinkMode(value: string): value is ThemeLinkMode {
  return (LINK_MODES as readonly string[]).includes(value);
}

export interface ThemeLinkParams {
  /** Validated library theme id, or null when the link names no theme. */
  themeId: string | null;
  /** Validated mode, or null when the link names no mode. */
  mode: ThemeLinkMode | null;
}

/**
 * Parse `?theme=` / `?mode=` from a query string. Returns null when the link
 * asks for nothing valid: an unknown theme id or mode is dropped, not painted.
 */
export function parseThemeLink(
  search: string,
  validThemeIds: readonly string[]
): ThemeLinkParams | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const rawTheme = params.get('theme');
  const rawMode = params.get('mode');
  const themeId = rawTheme !== null && validThemeIds.includes(rawTheme) ? rawTheme : null;
  const mode = rawMode !== null && isThemeLinkMode(rawMode) ? rawMode : null;
  if (!themeId && !mode) return null;
  return { themeId, mode };
}

/**
 * The query that represents an applied view: the theme unless it is the site
 * default, the mode unless it is light. Empty string when the URL needs no
 * params at all, so the address bar never carries a redundant `?`.
 */
export function themeLinkSearch(
  themeId: string,
  mode: ThemeLinkMode | null,
  defaultThemeId: string
): string {
  const params = new URLSearchParams();
  if (themeId !== defaultThemeId) params.set('theme', themeId);
  if (mode !== null && mode !== 'light') params.set('mode', mode);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Browser edges the wiring helpers need; unit tests inject all of them. */
export interface ThemeLinkEnv {
  document: Document;
  /** Every library theme id (from the build's card list). */
  validThemeIds: readonly string[];
  defaultThemeId: string;
  /** Current `location.search` (or any stand-in). */
  currentSearch: () => string;
  /** Rewrites the query string; the page binds `history.replaceState`. */
  replaceSearch: (search: string) => void;
  /** Loads a theme's CSS; the page binds `ensureThemeCss`. Resolves false when it never loads. */
  ensureCss: (id: string) => Promise<boolean>;
  /** Applies the appearance; the page closes over `applySiteAppearance` with its var names. */
  apply: (themeId: string, mode: ThemeLinkMode) => void;
}

/** The mode painted on `<html>` (resolved light/dark/high-contrast), or light. */
function paintedMode(root: HTMLElement): ThemeLinkMode {
  const mode = root.dataset.txMode;
  if (mode === 'light' || mode === 'dark' || mode === 'high-contrast') return mode;
  return 'light';
}

/**
 * Apply the appearance a deep link asks for, exactly once, after its CSS is
 * in. A theme-only link keeps the visitor's painted mode; a mode-only link
 * keeps the painted theme. Returns the applied params, or null when the link
 * was empty or its CSS never loaded (no apply, no repaint).
 */
export async function applyThemeFromLink(env: ThemeLinkEnv): Promise<ThemeLinkParams | null> {
  const parsed = parseThemeLink(env.currentSearch(), env.validThemeIds);
  if (!parsed) return null;
  const root = env.document.documentElement;
  if (parsed.themeId) {
    const loaded = await env.ensureCss(parsed.themeId);
    if (!loaded) return null;
  }
  const themeId = parsed.themeId ?? root.dataset.txTheme ?? env.defaultThemeId;
  const mode = parsed.mode ?? paintedMode(root);
  env.apply(themeId, mode);
  return parsed;
}

/** Browser edges for the URL mirror. */
export interface ThemeLinkSyncEnv {
  document: Document;
  defaultThemeId: string;
  currentSearch: () => string;
  replaceSearch: (search: string) => void;
}

/**
 * Mirror the painted appearance into the address bar while the visitor is on
 * the page (Apply clicks, the header's appearance switch). Only mutations
 * trigger writes — never the initial wire, so a fresh deep link is not
 * clobbered while its CSS is still loading. Returns a stop function.
 */
export function wireThemeLinkSync(env: ThemeLinkSyncEnv): () => void {
  const root = env.document.documentElement;
  const sync = (): void => {
    const themeId = root.dataset.txTheme ?? env.defaultThemeId;
    const next = themeLinkSearch(themeId, paintedMode(root), env.defaultThemeId);
    if (next !== env.currentSearch()) env.replaceSearch(next);
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['data-tx-theme', 'data-tx-mode'] });
  return () => observer.disconnect();
}

/** Browser edges for the copy-link button; clipboard is injectable for tests. */
export interface CopyLinkEnv {
  button: HTMLButtonElement;
  /** A `aria-live="polite"` status region (role="status" is owned by the island's summary). */
  status: HTMLElement;
  getHref?: () => string;
  write?: (text: string) => Promise<void>;
}

/**
 * Copy the page's current URL (deep link included) and report through the
 * status region, the same contract as the site's other copy controls.
 */
export function wireCopyLink(env: CopyLinkEnv): void {
  const getHref = env.getHref ?? (() => window.location.href);
  const write = env.write ?? ((text: string) => navigator.clipboard.writeText(text));
  env.button.addEventListener('click', () => {
    write(getHref()).then(
      () => {
        env.status.textContent = 'Link copied.';
      },
      () => {
        env.status.textContent = 'Copy failed: your browser blocked the clipboard.';
      }
    );
  });
}
