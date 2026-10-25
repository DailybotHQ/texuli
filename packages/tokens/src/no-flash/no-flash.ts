import type { ColorMode, ResolvedColorMode } from '../modes/modes.ts';

export const APPEARANCE_CACHE_VERSION = 1;

export interface AppliedAppearance {
  themeId: string;
  mode: ResolvedColorMode;
  vars: Record<string, string>;
  reducedMotion?: boolean;
  surface?: 'solid' | 'glass';
  components?: {
    button?: 'pill' | 'square';
    card?: 'glass' | 'bordered';
    focusRing?: 'ring' | 'outline' | 'glow' | 'inset';
  };
}

export interface CachedAppearance extends AppliedAppearance {
  v: typeof APPEARANCE_CACHE_VERSION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isResolvedMode(value: unknown): value is ResolvedColorMode {
  return value === 'light' || value === 'dark' || value === 'high-contrast';
}

function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);
}

function containsControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function isSafeCachedValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 2048 &&
    !/[;{}<>]/.test(value) &&
    !containsControlCharacters(value) &&
    !/(?:url\s*\(|expression\s*\(|var\s*\(|javascript:|@import)/i.test(value)
  );
}

/** Namespaced storage key for the last applied theme and mode. */
export function appearanceCacheKey(namespace: string): string {
  if (typeof namespace !== 'string' || namespace.trim().length === 0 || namespace.length > 128) {
    throw new TypeError('Appearance namespace must be a non-empty string up to 128 characters.');
  }
  return `texuli.${namespace.trim()}.appearance`;
}

/** Read localStorage without throwing in blocked, sandboxed or private contexts. */
export function localStorageOrUndefined(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Cache the already-resolved theme appearance for a later no-flash boot. */
export function cacheAppearance(
  namespace: string,
  applied: AppliedAppearance,
  storage: Pick<Storage, 'setItem'> | undefined = localStorageOrUndefined()
): boolean {
  try {
    if (!storage) return false;
    const payload: CachedAppearance = { v: APPEARANCE_CACHE_VERSION, ...applied };
    storage.setItem(appearanceCacheKey(namespace), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Read and validate a cached appearance; malformed storage is treated as absent. */
export function readCachedAppearance(
  namespace: string,
  storage: Pick<Storage, 'getItem'> | undefined = localStorageOrUndefined()
): CachedAppearance | null {
  try {
    const raw = storage?.getItem(appearanceCacheKey(namespace));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.v !== APPEARANCE_CACHE_VERSION ||
      !isThemeId(parsed.themeId) ||
      !isResolvedMode(parsed.mode) ||
      !isRecord(parsed.vars)
    ) {
      return null;
    }
    const vars: Record<string, string> = {};
    for (const [name, value] of Object.entries(parsed.vars)) {
      if (/^--tx-[a-z0-9-]+$/.test(name) && isSafeCachedValue(value)) vars[name] = value;
    }
    return { ...parsed, vars } as unknown as CachedAppearance;
  } catch {
    return null;
  }
}

function inlineScriptJson(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Generate a deterministic, CSP-hash-friendly script body to replay cached
 * `--tx-*` variables and resolve the mode before stylesheets paint.
 */
export function noFlashScript(namespace: string, fallback: ColorMode = 'system'): string {
  const key = inlineScriptJson(appearanceCacheKey(namespace));
  const initial = inlineScriptJson(
    fallback === 'light' || fallback === 'dark' || fallback === 'high-contrast'
      ? fallback
      : 'system'
  );
  return `(function(){var d=document.documentElement,c=null,m=${initial};try{c=JSON.parse(localStorage.getItem(${key})||'null');}catch(e){}if(c&&c.v===${APPEARANCE_CACHE_VERSION}&&typeof c.themeId==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(c.themeId)&&(c.mode==='light'||c.mode==='dark'||c.mode==='high-contrast')&&c.vars&&typeof c.vars==='object'&&!Array.isArray(c.vars)){for(var k in c.vars){var v=c.vars[k];if(/^--tx-[a-z0-9-]+$/.test(k)&&typeof v==='string'&&v.length<=2048&&!/[;{}<>]/.test(v)&&!/(?:url\\s*\\(|expression\\s*\\(|var\\s*\\(|javascript:|@import)/i.test(v))d.style.setProperty(k,v);}d.dataset.txTheme=c.themeId;m=c.mode;if(c.reducedMotion===true||c.reducedMotion===false)d.dataset.txMotion=c.reducedMotion?'reduce':'full';if(c.surface==='glass'||c.surface==='solid')d.dataset.txSurface=c.surface;var p=c.components||{};if(p.button==='pill'||p.button==='square')d.dataset.txButtonStyle=p.button;if(p.card==='glass'||p.card==='bordered')d.dataset.txCardStyle=p.card;if(/^(ring|outline|glow|inset)$/.test(p.focusRing))d.dataset.txFocusRingStyle=p.focusRing;}if(m==='system'){try{if(matchMedia('(prefers-contrast: more)').matches)m='high-contrast';else m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){m='light';}}d.dataset.txMode=m;d.classList.toggle('dark',m==='dark');d.classList.toggle('light',m==='light');d.style.colorScheme=m==='high-contrast'?'light dark':m;})();`;
}
