/**
 * Apply and persist theme + color mode for texuli.com.
 * Uses `@texuli/tokens` no-flash cache so the bootstrap script replays the
 * choice before paint on every page. No DOM is touched at import time.
 */

import { forcedColorsCssVariables } from '@texuli/tokens/forced-colors';
import {
  applyColorMode,
  type ColorMode,
  type ResolvedColorMode,
  resolveColorMode,
} from '@texuli/tokens/modes';
import {
  appearanceCacheKey,
  cacheAppearance,
  localStorageOrUndefined,
  readCachedAppearance,
} from '@texuli/tokens/no-flash';
import { APPEARANCE_NAMESPACE, SITE_THEME } from '../foundation/site.ts';

export const MODE_CHOICES = ['light', 'dark', 'high-contrast', 'system'] as const;
export type ModeChoice = (typeof MODE_CHOICES)[number];

/** Separate key so "system" can be remembered while the appearance cache holds a resolved mode. */
export function modePreferenceKey(namespace: string = APPEARANCE_NAMESPACE): string {
  return `texuli.${namespace}.mode-pref`;
}

export function isModeChoice(value: unknown): value is ModeChoice {
  return value === 'light' || value === 'dark' || value === 'high-contrast' || value === 'system';
}

export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);
}

/** Read the last theme id from the appearance cache, or the site default. */
export function readCachedThemeId(
  namespace: string = APPEARANCE_NAMESPACE,
  fallback: string = SITE_THEME
): string {
  const cached = readCachedAppearance(namespace);
  return cached && isThemeId(cached.themeId) ? cached.themeId : fallback;
}

/** Read the mode preference (including system), defaulting to system. */
export function readModePreference(namespace: string = APPEARANCE_NAMESPACE): ModeChoice {
  try {
    const raw = localStorageOrUndefined()?.getItem(modePreferenceKey(namespace));
    if (isModeChoice(raw)) return raw;
  } catch {
    // Storage blocked.
  }
  const cached = readCachedAppearance(namespace);
  if (cached?.mode === 'light' || cached?.mode === 'dark' || cached?.mode === 'high-contrast') {
    return cached.mode;
  }
  return 'system';
}

export function writeModePreference(
  choice: ModeChoice,
  namespace: string = APPEARANCE_NAMESPACE
): void {
  try {
    const storage = localStorageOrUndefined();
    if (!storage) return;
    // Always store the preference, including "system", so reloads restore it.
    storage.setItem(modePreferenceKey(namespace), choice);
  } catch {
    // Storage blocked.
  }
}

/** Clear inline `--tx-*` properties previously written for caching. */
export function clearInlineThemeVars(target: HTMLElement, names: readonly string[]): void {
  for (const name of names) target.style.removeProperty(name);
}

/** Capture computed `--tx-*` values for the no-flash cache. */
export function captureThemeVars(
  target: HTMLElement,
  names: readonly string[]
): Record<string, string> {
  const style = getComputedStyle(target);
  const vars: Record<string, string> = {};
  for (const name of names) {
    const value = style.getPropertyValue(name).trim();
    if (value && value.length <= 2048 && !/[;{}<>]/.test(value)) vars[name] = value;
  }
  return vars;
}

/** Apply high-contrast system-color variables as inline styles. */
export function applyHighContrastVars(target: HTMLElement): Record<string, string> {
  const vars = forcedColorsCssVariables();
  for (const [name, value] of Object.entries(vars)) {
    target.style.setProperty(name, value);
  }
  return vars;
}

export interface ApplySiteAppearanceInput {
  themeId: string;
  mode: ModeChoice;
  /** Variable names to capture after CSS applies (light/dark). */
  varNames: readonly string[];
  namespace?: string;
  root?: HTMLElement;
  matchMedia?: (query: string) => { matches: boolean };
}

export interface ApplySiteAppearanceResult {
  themeId: string;
  modeChoice: ModeChoice;
  resolvedMode: ResolvedColorMode;
  vars: Record<string, string>;
}

/**
 * Set `data-tx-theme` / mode on the root, capture or inject vars, and cache
 * for the no-flash bootstrap. Safe to call only in the browser after mount.
 */
export function applySiteAppearance(input: ApplySiteAppearanceInput): ApplySiteAppearanceResult {
  const namespace = input.namespace ?? APPEARANCE_NAMESPACE;
  const root = input.root ?? document.documentElement;
  const themeId = isThemeId(input.themeId) ? input.themeId : SITE_THEME;
  const modeChoice: ModeChoice = isModeChoice(input.mode) ? input.mode : 'system';

  clearInlineThemeVars(root, input.varNames);
  root.dataset.txTheme = themeId;

  const resolvedMode = applyColorMode(
    root,
    modeChoice as ColorMode,
    input.matchMedia
  ) as ResolvedColorMode;

  let vars: Record<string, string>;
  if (resolvedMode === 'high-contrast') {
    vars = applyHighContrastVars(root);
  } else {
    // Light/dark: theme CSS rules drive the cascade; capture for other pages.
    vars = captureThemeVars(root, input.varNames);
  }

  writeModePreference(modeChoice, namespace);

  if (modeChoice === 'system') {
    // Keep theme + current resolution so no-flash still paints the right theme;
    // mode-pref absence means the island will re-follow the OS after load.
    cacheAppearance(namespace, { themeId, mode: resolvedMode, vars });
  } else {
    cacheAppearance(namespace, { themeId, mode: resolvedMode, vars });
  }

  return { themeId, modeChoice, resolvedMode, vars };
}

/** Drop the appearance cache (theme falls back to the layout default). */
export function clearSiteAppearance(namespace: string = APPEARANCE_NAMESPACE): void {
  try {
    localStorageOrUndefined()?.removeItem(appearanceCacheKey(namespace));
    localStorageOrUndefined()?.removeItem(modePreferenceKey(namespace));
  } catch {
    // ignore
  }
}

/** Resolve a mode choice against matchMedia without touching the DOM. */
export function resolveModeChoice(
  choice: ModeChoice,
  matchMedia?: (query: string) => { matches: boolean }
): ResolvedColorMode {
  return resolveColorMode(choice as ColorMode, matchMedia);
}
