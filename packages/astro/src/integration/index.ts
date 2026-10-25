import type { ColorMode } from '@texuli/tokens/modes';
import { COLOR_MODE_NAMES } from '@texuli/tokens/modes';
import { appearanceCacheKey, noFlashScript } from '@texuli/tokens/no-flash';
import type { AstroIntegration } from 'astro';

export type TexuliDensityVariant = 'compact' | 'comfortable' | 'spacious';
export type TexuliRadiusVariant = 'compact' | 'comfortable' | 'rounded';

export interface TexuliAstroOptions {
  /** Namespace shared with the appearance switcher that writes the token cache. */
  namespace?: string;
  /** Mode used without a cached appearance. Defaults to the active system preference. */
  fallbackMode?: ColorMode;
  /** Select a token density variant on the document root before styles paint. */
  density?: TexuliDensityVariant;
  /** Select a token radius scale on the document root before styles paint. */
  radius?: TexuliRadiusVariant;
  /** Use Astro's inline-script injection, or render the exported body with a host nonce. */
  bootstrap?: 'injected' | 'manual';
}

const DENSITIES: readonly TexuliDensityVariant[] = ['compact', 'comfortable', 'spacious'];
const RADII: readonly TexuliRadiusVariant[] = ['compact', 'comfortable', 'rounded'];

function optionJson(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function validateOptions(
  options: TexuliAstroOptions
): Required<Pick<TexuliAstroOptions, 'namespace' | 'fallbackMode' | 'bootstrap'>> &
  Pick<TexuliAstroOptions, 'density' | 'radius'> {
  const namespace = options.namespace ?? 'site';
  const fallbackMode = options.fallbackMode ?? 'system';
  const bootstrap = options.bootstrap ?? 'injected';

  // Keep validation aligned with the token cache's namespaced contract.
  appearanceCacheKey(namespace);
  noFlashScript(namespace, fallbackMode);
  if (!(COLOR_MODE_NAMES as readonly string[]).includes(fallbackMode)) {
    throw new TypeError('Fallback mode must be a supported Texuli color mode.');
  }
  if (options.density !== undefined && !DENSITIES.includes(options.density)) {
    throw new TypeError('Density must be compact, comfortable, or spacious.');
  }
  if (options.radius !== undefined && !RADII.includes(options.radius)) {
    throw new TypeError('Radius must be compact, comfortable, or rounded.');
  }
  if (bootstrap !== 'injected' && bootstrap !== 'manual') {
    throw new TypeError('Bootstrap must be injected or manual.');
  }
  return { namespace, fallbackMode, bootstrap, density: options.density, radius: options.radius };
}

/**
 * Return the deterministic inline theme bootstrap body. One self-contained
 * IIFE applies everything before paint (Astro injects it head-inline): the
 * cached appearance, the mode (system-aware when uncached), density and
 * radius variants, and same-origin storage updates without a reload or
 * network request. When no appearance is cached the document keeps the
 * server-rendered `data-tx-theme` (the static theme ContentLayout
 * rendered); a cache overrides it and clearing the cache restores it.
 */
export function themeBootstrapScript(options: TexuliAstroOptions = {}): string {
  const { namespace, fallbackMode, density, radius } = validateOptions(options);
  const key = optionJson(appearanceCacheKey(namespace));
  const densityJson = density ? optionJson(density) : 'null';
  const radiusJson = radius ? optionJson(radius) : 'null';
  const sync =
    // t0 captures the server-rendered theme so apply(null) can restore it
    // instead of leaving the document without a theme name.
    `(function(){var d=document.documentElement,t0=d.dataset.txTheme,k=${key},f=${optionJson(fallbackMode)},dv=${densityJson},rv=${radiusJson},applied=[];` +
    `function validValue(v){return typeof v==='string'&&v.length<=2048&&!/[;{}<>]/.test(v)&&!/[\\x00-\\x1f\\x7f]/.test(v)&&!/(?:url\\s*\\(|expression\\s*\\(|var\\s*\\(|javascript:|@import)/i.test(v);}` +
    `function read(raw){try{var c=JSON.parse(raw||'null');if(!c||c.v!==1||typeof c.themeId!=='string'||!/^[a-z][a-z0-9-]{0,79}$/.test(c.themeId)||(c.mode!=='light'&&c.mode!=='dark'&&c.mode!=='high-contrast')||!c.vars||typeof c.vars!=='object'||Array.isArray(c.vars))return null;var vars={};for(var n in c.vars){if(Object.prototype.hasOwnProperty.call(c.vars,n)&&/^--tx-[a-z0-9-]+$/.test(n)&&validValue(c.vars[n]))vars[n]=c.vars[n];}return {themeId:c.themeId,mode:c.mode,vars:vars,reducedMotion:c.reducedMotion,surface:c.surface,components:c.components||{}};}catch(e){return null;}}` +
    `function modeFromSystem(){try{if(matchMedia('(prefers-contrast: more)').matches)return 'high-contrast';return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){return 'light';}}` +
    `function setMode(m){d.dataset.txMode=m;d.classList.toggle('dark',m==='dark');d.classList.toggle('light',m==='light');d.style.colorScheme=m==='high-contrast'?'light dark':m;}` +
    `function setVariant(){if(dv)d.dataset.txDensity=dv;else delete d.dataset.txDensity;if(rv)d.dataset.txRadius=rv;else delete d.dataset.txRadius;}` +
    `function apply(c){for(var i=0;i<applied.length;i++)d.style.removeProperty(applied[i]);applied=[];if(!c){if(t0===undefined)delete d.dataset.txTheme;else d.dataset.txTheme=t0;delete d.dataset.txMotion;delete d.dataset.txSurface;delete d.dataset.txButtonStyle;delete d.dataset.txCardStyle;delete d.dataset.txFocusRingStyle;setMode(f==='system'?modeFromSystem():f);return;}d.dataset.txTheme=c.themeId;for(var n in c.vars){var v=c.vars[n];if(dv&&n==='--tx-density')v=String(${density === 'compact' ? '0.875' : density === 'spacious' ? '1.125' : '1'});if(rv&&n==='--tx-radius-scale')v=String(${radius === 'compact' ? '0.75' : radius === 'rounded' ? '1.25' : '1'});if(rv&&(n==='--tx-radius'||/^--tx-radius-step-[0-9]+$/.test(n)))v='calc('+v+' * '+(${radius === 'compact' ? '0.75' : radius === 'rounded' ? '1.25' : '1'})+')';d.style.setProperty(n,v);applied.push(n);}if(dv&&!c.vars['--tx-density']){d.style.setProperty('--tx-density',${density === 'compact' ? "'0.875'" : density === 'spacious' ? "'1.125'" : "'1'"});applied.push('--tx-density');}if(rv&&!c.vars['--tx-radius-scale']){d.style.setProperty('--tx-radius-scale',${radius === 'compact' ? "'0.75'" : radius === 'rounded' ? "'1.25'" : "'1'"});applied.push('--tx-radius-scale');}if(c.reducedMotion===true||c.reducedMotion===false)d.dataset.txMotion=c.reducedMotion?'reduce':'full';else delete d.dataset.txMotion;if(c.surface==='glass'||c.surface==='solid')d.dataset.txSurface=c.surface;else delete d.dataset.txSurface;var p=c.components;if(p.button==='pill'||p.button==='square')d.dataset.txButtonStyle=p.button;else delete d.dataset.txButtonStyle;if(p.card==='glass'||p.card==='bordered')d.dataset.txCardStyle=p.card;else delete d.dataset.txCardStyle;if(p.focusRing==='ring'||p.focusRing==='outline'||p.focusRing==='glow'||p.focusRing==='inset')d.dataset.txFocusRingStyle=p.focusRing;else delete d.dataset.txFocusRingStyle;setMode(c.mode);}` +
    `function current(){try{return read(localStorage.getItem(k));}catch(e){return null;}}` +
    `function syncSystem(){if(f==='system'&&!current())setMode(modeFromSystem());}` +
    `var boot=current();if(boot)for(var name in boot.vars)if(/^--tx-[a-z0-9-]+$/.test(name)&&validValue(boot.vars[name]))applied.push(name);setVariant();apply(boot);if(typeof addEventListener==='function')addEventListener('storage',function(e){if(e.key===k)apply(read(e.newValue));});` +
    `if(f==='system'&&typeof matchMedia==='function'){var q1=matchMedia('(prefers-color-scheme: dark)'),q2=matchMedia('(prefers-contrast: more)');if(q1.addEventListener)q1.addEventListener('change',syncSystem);else if(q1.addListener)q1.addListener(syncSystem);if(q2.addEventListener)q2.addEventListener('change',syncSystem);else if(q2.addListener)q2.addListener(syncSystem);}` +
    `})();`;
  return sync;
}

/** Install the deterministic, CSP-compatible early theme bootstrap for Astro. */
export function texuli(options: TexuliAstroOptions = {}): AstroIntegration {
  const normalized = validateOptions(options);
  const script = themeBootstrapScript(normalized);

  return {
    name: '@texuli/astro',
    hooks: {
      'astro:config:setup': ({ injectScript }) => {
        if (normalized.bootstrap === 'injected') injectScript('head-inline', script);
      },
    },
  };
}
