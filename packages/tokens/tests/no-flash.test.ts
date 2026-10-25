import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_CACHE_VERSION,
  type AppliedAppearance,
  appearanceCacheKey,
  cacheAppearance,
  noFlashScript,
  readCachedAppearance,
} from '../src/no-flash/index.ts';

function storage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

function root() {
  const classes = new Set<string>();
  const data: Record<string, string> = {};
  const variables = new Map<string, string>();
  const style = {
    colorScheme: '',
    setProperty: (name: string, value: string) => variables.set(name, value),
  };
  return {
    classList: {
      toggle(name: string, force: boolean) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    },
    dataset: data,
    style,
    classes,
    variables,
  };
}

function execute(
  script: string,
  documentRoot: ReturnType<typeof root>,
  localStorage: unknown,
  matchMedia: unknown
) {
  new Function('document', 'localStorage', 'matchMedia', script)(
    {
      documentElement: documentRoot,
    },
    localStorage,
    matchMedia
  );
}

const applied: AppliedAppearance = {
  themeId: 'ocean',
  mode: 'dark',
  vars: { '--tx-background': '#101820', '--tx-primary': '#33aacc' },
  reducedMotion: true,
  surface: 'glass',
  components: { button: 'pill', card: 'bordered', focusRing: 'outline' },
};

describe('no-flash cache', () => {
  it('round-trips a resolved appearance with an application namespace', () => {
    const store = storage();
    expect(cacheAppearance(' billing ', applied, store)).toBe(true);
    expect(appearanceCacheKey('billing')).toBe('texuli.billing.appearance');
    expect(readCachedAppearance('billing', store)).toEqual({
      v: APPEARANCE_CACHE_VERSION,
      ...applied,
    });
  });

  it('returns false or null when storage is unavailable, throws, or contains invalid JSON', () => {
    const unavailable = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(cacheAppearance('demo', applied, unavailable)).toBe(false);
    expect(readCachedAppearance('demo', unavailable)).toBeNull();
    expect(readCachedAppearance('demo', undefined)).toBeNull();
    expect(readCachedAppearance('demo', storage({ [appearanceCacheKey('demo')]: '{bad' }))).toBe(
      null
    );
  });

  it('rejects wrong versions and incomplete cache records', () => {
    for (const value of [
      { v: 2, ...applied },
      { v: APPEARANCE_CACHE_VERSION, ...applied, themeId: '../bad' },
      { v: APPEARANCE_CACHE_VERSION, ...applied, mode: 'system' },
      { v: APPEARANCE_CACHE_VERSION, ...applied, vars: [] },
    ]) {
      const store = storage({ [appearanceCacheKey('demo')]: JSON.stringify(value) });
      expect(readCachedAppearance('demo', store)).toBeNull();
    }
  });

  it('validates namespace limits and escapes values embedded in an inline script', () => {
    expect(() => appearanceCacheKey(' ')).toThrow(/namespace/i);
    expect(() => noFlashScript('x'.repeat(129))).toThrow(/namespace/i);
    const script = noFlashScript('</script>&tenant');
    expect(script).not.toContain('</script>');
    expect(script).toContain('\\u003c/script\\u003e\\u0026tenant');
    expect(script).not.toContain('<script');
    expect(noFlashScript('</script>&tenant')).toBe(script);
  });

  it('replays stored theme tokens, metadata and mode before application code runs', () => {
    const store = storage();
    expect(cacheAppearance('demo', applied, store)).toBe(true);
    const documentRoot = root();
    execute(noFlashScript('demo'), documentRoot, store, () => ({ matches: false }));

    expect(documentRoot.variables.get('--tx-background')).toBe('#101820');
    expect(documentRoot.variables.get('--tx-primary')).toBe('#33aacc');
    expect(documentRoot.dataset).toEqual({
      txTheme: 'ocean',
      txMotion: 'reduce',
      txSurface: 'glass',
      txButtonStyle: 'pill',
      txCardStyle: 'bordered',
      txFocusRingStyle: 'outline',
      txMode: 'dark',
    });
    expect(documentRoot.classes.has('dark')).toBe(true);
    expect(documentRoot.style.colorScheme).toBe('dark');
  });

  it('ignores tampered property names and unsafe values while resolving system contrast', () => {
    const store = storage({
      [appearanceCacheKey('demo')]: JSON.stringify({
        v: APPEARANCE_CACHE_VERSION,
        themeId: 'ocean',
        mode: 'light',
        vars: {
          color: 'red',
          '--tx-primary': '#123456',
          '--tx-injected': 'red; color: blue',
          '--tx-angle': '<svg>',
          '--tx-image': 'url(https://example.org/pixel)',
        },
      }),
    });
    const documentRoot = root();
    execute(noFlashScript('demo', 'system'), documentRoot, store, (query: string) => ({
      matches: query === '(prefers-contrast: more)',
    }));

    expect(documentRoot.variables.get('color')).toBeUndefined();
    expect(documentRoot.variables.get('--tx-primary')).toBe('#123456');
    expect(documentRoot.variables.has('--tx-injected')).toBe(false);
    expect(documentRoot.variables.has('--tx-angle')).toBe(false);
    expect(documentRoot.variables.has('--tx-image')).toBe(false);
    expect(documentRoot.dataset.txMode).toBe('light');
    expect(documentRoot.style.colorScheme).toBe('light');
  });

  it('falls back to the configured or system mode when storage is blocked', () => {
    for (const [fallback, expected] of [
      ['light', 'light'],
      ['dark', 'dark'],
      ['high-contrast', 'high-contrast'],
      ['system', 'dark'],
    ] as const) {
      const documentRoot = root();
      execute(
        noFlashScript('demo', fallback),
        documentRoot,
        {
          getItem: () => {
            throw new Error('SecurityError');
          },
        },
        (query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
        })
      );
      expect(documentRoot.dataset.txMode).toBe(expected);
    }
  });

  it('uses system high contrast when there is no valid cached appearance', () => {
    const documentRoot = root();
    execute(noFlashScript('demo', 'system'), documentRoot, storage(), (query: string) => ({
      matches: query === '(prefers-contrast: more)',
    }));
    expect(documentRoot.dataset.txMode).toBe('high-contrast');
    expect(documentRoot.style.colorScheme).toBe('light dark');
  });
});
