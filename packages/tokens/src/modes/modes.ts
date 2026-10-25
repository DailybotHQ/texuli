import type { SemanticPalette, SemanticRole } from '../contract/semantic.ts';
import { INTERACTIVE_SEMANTIC_ROLES, SEMANTIC_ROLES } from '../contract/semantic.ts';
import type { Theme } from '../contract/types.ts';

export const COLOR_MODE_NAMES = ['light', 'dark', 'high-contrast', 'system'] as const;
export type ColorMode = (typeof COLOR_MODE_NAMES)[number];
export type ResolvedColorMode = Exclude<ColorMode, 'system'>;
export type ColorSchemePreference = 'light' | 'dark';
export type ContrastPreference = 'no-preference' | 'more' | 'less' | 'custom';

export interface SystemPreferences {
  colorScheme: ColorSchemePreference;
  contrast: ContrastPreference;
}

export type MatchMedia = (query: string) => { matches: boolean };

const SYSTEM_HIGH_CONTRAST_COLORS: Record<SemanticRole, string> = {
  background: 'Canvas',
  foreground: 'CanvasText',
  surface: 'Canvas',
  surfaceForeground: 'CanvasText',
  elevated: 'Canvas',
  elevatedForeground: 'CanvasText',
  muted: 'Canvas',
  mutedForeground: 'CanvasText',
  subtle: 'Canvas',
  subtleForeground: 'CanvasText',
  border: 'CanvasText',
  borderStrong: 'CanvasText',
  input: 'Field',
  ring: 'Highlight',
  primary: 'Highlight',
  primaryForeground: 'HighlightText',
  primarySoft: 'Canvas',
  primarySoftForeground: 'Highlight',
  secondary: 'ButtonFace',
  secondaryForeground: 'ButtonText',
  accent: 'Highlight',
  accentForeground: 'HighlightText',
  destructive: 'Mark',
  destructiveForeground: 'MarkText',
  destructiveSoft: 'Canvas',
  destructiveSoftForeground: 'Mark',
  success: 'Mark',
  successForeground: 'MarkText',
  successSoft: 'Canvas',
  successSoftForeground: 'Mark',
  warning: 'Mark',
  warningForeground: 'MarkText',
  warningSoft: 'Canvas',
  warningSoftForeground: 'Mark',
  info: 'Highlight',
  infoForeground: 'HighlightText',
  infoSoft: 'Canvas',
  infoSoftForeground: 'Highlight',
  sidebar: 'Canvas',
  sidebarForeground: 'CanvasText',
  sidebarBorder: 'CanvasText',
  sidebarPrimary: 'Highlight',
  overlay: 'Canvas',
  scrim: 'Canvas',
  shadow: 'CanvasText',
  link: 'LinkText',
  linkVisited: 'VisitedText',
  selection: 'Highlight',
  selectionForeground: 'HighlightText',
  canvas: 'Canvas',
};

function defaultMatchMedia(): MatchMedia | undefined {
  try {
    return globalThis.matchMedia?.bind(globalThis);
  } catch {
    return undefined;
  }
}

function matches(query: string, matchMedia: MatchMedia | undefined): boolean {
  try {
    return matchMedia?.(query).matches ?? false;
  } catch {
    return false;
  }
}

/** Read color-scheme and contrast preferences safely, including in SSR. */
export function getSystemPreferences(matchMedia = defaultMatchMedia()): SystemPreferences {
  const colorScheme = matches('(prefers-color-scheme: dark)', matchMedia) ? 'dark' : 'light';
  let contrast: ContrastPreference = 'no-preference';
  if (matches('(prefers-contrast: more)', matchMedia)) contrast = 'more';
  else if (matches('(prefers-contrast: less)', matchMedia)) contrast = 'less';
  else if (matches('(prefers-contrast: custom)', matchMedia)) contrast = 'custom';
  return { colorScheme, contrast };
}

/** Resolve an explicit mode or the user's color-scheme and contrast preferences. */
export function resolveColorMode(
  mode: ColorMode,
  matchMedia = defaultMatchMedia()
): ResolvedColorMode {
  if (mode !== 'system') return mode;
  const preferences = getSystemPreferences(matchMedia);
  if (preferences.contrast === 'more') return 'high-contrast';
  return preferences.colorScheme;
}

/** Produce a fresh system-color palette for the explicit high-contrast mode. */
export function createHighContrastPalette(): SemanticPalette {
  const interactive = new Set<SemanticRole>(INTERACTIVE_SEMANTIC_ROLES);
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => {
      const color = SYSTEM_HIGH_CONTRAST_COLORS[role];
      return [
        role,
        interactive.has(role)
          ? {
              default: color,
              hover: color,
              active: color,
              focus: 'Highlight',
              disabled: 'GrayText',
            }
          : { default: color },
      ];
    })
  ) as SemanticPalette;
}

/** Select a theme's authored light/dark palette or the system high-contrast palette. */
export function resolveSemanticPalette(
  theme: Pick<Theme, 'light' | 'dark'>,
  mode: ResolvedColorMode
): SemanticPalette {
  if (mode === 'high-contrast') return createHighContrastPalette();
  return theme[mode];
}

/** CSS `color-scheme` value for browser controls and built-in widgets. */
export function colorSchemeValue(mode: ResolvedColorMode): 'light' | 'dark' | 'light dark' {
  return mode === 'high-contrast' ? 'light dark' : mode;
}

/** Apply the resolved mode to a root or scoped element. No DOM is read at import time. */
export function applyColorMode(
  target: HTMLElement,
  mode: ColorMode,
  matchMedia?: MatchMedia
): ResolvedColorMode {
  const resolved = resolveColorMode(mode, matchMedia ?? defaultMatchMedia());
  target.dataset.txMode = resolved;
  target.classList.toggle('dark', resolved === 'dark');
  target.classList.toggle('light', resolved === 'light');
  target.style.colorScheme = colorSchemeValue(resolved);
  return resolved;
}

/** Remove the attributes and compatibility classes written by {@link applyColorMode}. */
export function clearColorMode(target: HTMLElement): void {
  delete target.dataset.txMode;
  target.classList.remove('dark', 'light');
  target.style.removeProperty('color-scheme');
}

function inlineScriptJson(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Storage key for a user's selected color mode within an application namespace. */
export function colorModeStorageKey(namespace: string): string {
  if (typeof namespace !== 'string' || namespace.trim().length === 0 || namespace.length > 128) {
    throw new TypeError('Color mode namespace must be a non-empty string up to 128 characters.');
  }
  return `texuli.${namespace.trim()}.mode`;
}

/**
 * Return a CSP-hash-friendly inline script body that resolves the selected
 * mode from `texuli.<namespace>.mode` before first paint.
 */
export function colorModeBootstrapScript(
  namespace: string,
  fallback: ColorMode = 'system'
): string {
  const key = inlineScriptJson(colorModeStorageKey(namespace));
  const initial = inlineScriptJson(
    (COLOR_MODE_NAMES as readonly string[]).includes(fallback) ? fallback : 'system'
  );
  const modes = inlineScriptJson(COLOR_MODE_NAMES.join('|'));
  return `(function(){var d=document.documentElement,m=${initial};try{var s=localStorage.getItem(${key});if(s&&${modes}.split('|').indexOf(s)!==-1)m=s;}catch(e){}if(m==='system'){try{if(matchMedia('(prefers-contrast: more)').matches)m='high-contrast';else m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){m='light';}}d.dataset.txMode=m;d.classList.toggle('dark',m==='dark');d.classList.toggle('light',m==='light');d.style.colorScheme=m==='high-contrast'?'light dark':m;})();`;
}
