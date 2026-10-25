import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { texuli, themeBootstrapScript } from '../src/integration/index.ts';

function appearance(mode: 'light' | 'dark', background: string, density = '1') {
  return JSON.stringify({
    v: 1,
    themeId: 'ocean',
    mode,
    vars: {
      '--tx-background': background,
      '--tx-density': density,
      '--tx-radius': '8px',
      '--tx-radius-scale': '1',
      '--tx-radius-step-2': '2px',
    },
  });
}

function runBootstrap(
  script: string,
  seed: Record<string, string> = {},
  dark = false,
  initialDataset: Record<string, string> = {}
) {
  const values = new Map(Object.entries(seed));
  const vars = new Map<string, string>();
  const classes = new Set<string>();
  const mediaListeners = new Map<string, (event: unknown) => void>();
  const mediaMatches = new Map<string, boolean>([
    ['(prefers-color-scheme: dark)', dark],
    ['(prefers-contrast: more)', false],
  ]);
  const windowListeners = new Map<
    string,
    (event: { key: string | null; newValue: string | null }) => void
  >();
  const root = {
    dataset: { ...initialDataset } as Record<string, string>,
    classList: {
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    style: {
      colorScheme: '',
      setProperty(name: string, value: string) {
        vars.set(name, String(value));
      },
      removeProperty(name: string) {
        vars.delete(name);
      },
    },
  };
  const store = {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
  };
  const matchMedia = (query: string) => ({
    matches: mediaMatches.get(query) ?? false,
    addEventListener: (_type: string, listener: (event: unknown) => void) => {
      mediaListeners.set(query, listener);
    },
  });
  const addEventListener = (
    type: string,
    listener: (event: { key: string | null; newValue: string | null }) => void
  ) => windowListeners.set(type, listener);

  new Function('document', 'localStorage', 'matchMedia', 'addEventListener', script)(
    { documentElement: root },
    store,
    matchMedia,
    addEventListener
  );
  return { root, vars, classes, mediaListeners, mediaMatches, windowListeners };
}

describe('Texuli Astro theme integration', () => {
  it('injects a deterministic CSP-hash-compatible bootstrap into the document head', () => {
    let injected: string | undefined;
    const integration = texuli({
      namespace: 'marketing',
      fallbackMode: 'dark',
      density: 'compact',
      radius: 'rounded',
    });
    const hook = integration.hooks['astro:config:setup'];
    if (typeof hook === 'function') {
      hook({
        injectScript: (stage: string, code: string) => {
          expect(stage).toBe('head-inline');
          injected = code;
        },
      } as never);
    }
    expect(injected).toBe(
      themeBootstrapScript({
        namespace: 'marketing',
        fallbackMode: 'dark',
        density: 'compact',
        radius: 'rounded',
      })
    );
    expect(injected).toContain('texuli.marketing.appearance');
    expect(injected).toContain("addEventListener('storage'");
    expect(injected).toContain('txDensity');
    expect(injected).not.toContain('fetch(');
    expect(injected).not.toContain('new Function');
  });

  it('applies cached appearances and same-origin storage updates without reloading', () => {
    const key = 'texuli.docs.appearance';
    const result = runBootstrap(
      themeBootstrapScript({ namespace: 'docs', density: 'compact', radius: 'rounded' }),
      { [key]: appearance('light', '#ffffff') }
    );

    expect(result.root.dataset).toMatchObject({
      txTheme: 'ocean',
      txMode: 'light',
      txDensity: 'compact',
      txRadius: 'rounded',
    });
    expect(result.vars.get('--tx-density')).toBe('0.875');
    expect(result.vars.get('--tx-radius')).toBe('calc(8px * 1.25)');
    expect(result.vars.get('--tx-radius-step-2')).toBe('calc(2px * 1.25)');

    result.windowListeners.get('storage')?.({
      key,
      newValue: appearance('dark', '#101820', '1.1'),
    });
    expect(result.root.dataset.txMode).toBe('dark');
    expect(result.vars.get('--tx-background')).toBe('#101820');
    expect(result.vars.get('--tx-density')).toBe('0.875');
    expect(result.vars.get('--tx-radius')).toBe('calc(8px * 1.25)');

    result.windowListeners.get('storage')?.({ key, newValue: null });
    expect(result.root.dataset.txTheme).toBeUndefined();
    expect(result.root.dataset.txMode).toBe('light');
    expect(result.vars.has('--tx-background')).toBe(false);
  });

  it('follows system color and contrast changes when the cache is absent', () => {
    const result = runBootstrap(themeBootstrapScript({ namespace: 'system' }));
    expect(result.root.dataset.txMode).toBe('light');
    result.mediaMatches.set('(prefers-color-scheme: dark)', true);
    result.mediaListeners.get('(prefers-color-scheme: dark)')?.({});
    expect(result.root.dataset.txMode).toBe('dark');
    result.mediaMatches.set('(prefers-contrast: more)', true);
    result.mediaListeners.get('(prefers-contrast: more)')?.({});
    expect(result.root.dataset.txMode).toBe('high-contrast');
  });

  it('keeps the server-rendered theme when no appearance is cached', () => {
    // ContentLayout renders data-tx-theme on <html>; a fresh visitor has no
    // cached appearance and must keep it (the packed astro-plain consumer
    // asserts exactly this).
    const result = runBootstrap(
      themeBootstrapScript({ namespace: 'site', fallbackMode: 'dark' }),
      {},
      false,
      { txTheme: 'sky' }
    );
    expect(result.root.dataset.txTheme).toBe('sky');
    expect(result.root.dataset.txMode).toBe('dark');
  });

  it('restores the server-rendered theme when the cache is cleared from another tab', () => {
    const key = 'texuli.docs.appearance';
    const result = runBootstrap(
      themeBootstrapScript({ namespace: 'docs' }),
      { [key]: appearance('dark', '#101820') },
      false,
      { txTheme: 'sky' }
    );
    expect(result.root.dataset.txTheme).toBe('ocean');
    result.windowListeners.get('storage')?.({ key, newValue: null });
    expect(result.root.dataset.txTheme).toBe('sky');
    expect(result.root.dataset.txMode).toBe('light');
  });

  it('supports manual nonce placement and validates cache namespace and variants', () => {
    let injected = false;
    const integration = texuli({ namespace: 'docs', bootstrap: 'manual' });
    const hook = integration.hooks['astro:config:setup'];
    if (typeof hook === 'function') {
      hook({ injectScript: () => (injected = true) } as never);
    }
    expect(injected).toBe(false);
    expect(themeBootstrapScript({ namespace: 'docs', bootstrap: 'manual' })).toContain(
      'texuli.docs.appearance'
    );
    expect(() => texuli({ namespace: '' })).toThrow(TypeError);
    expect(() => texuli({ fallbackMode: 'automatic' as never })).toThrow(/fallback mode/i);
    expect(() => texuli({ density: 'dense' as never })).toThrow(/density/i);
    expect(() => texuli({ radius: 'huge' as never })).toThrow(/radius/i);
  });

  it('ships density, radius, forced-colors, and print stylesheet variants', () => {
    const css = readFileSync('packages/astro/src/styles.css', 'utf8');
    expect(css).toContain('@import "@texuli/tokens/forced-colors.css"');
    expect(css).toContain(':root[data-tx-density="compact"]');
    expect(css).toContain(':root[data-tx-density="spacious"]');
    expect(css).toContain(':root[data-tx-radius="rounded"]');
    expect(css).toContain('@media print');
    expect(css).toContain('color-scheme: light');
  });
});
