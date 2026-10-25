// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  isModeChoice,
  isThemeId,
  MODE_CHOICES,
  modePreferenceKey,
  resolveModeChoice,
} from '../../apps/website/src/components/theme-switcher/appearance.ts';
import {
  filterThemeCatalog,
  type ThemeCatalogEntry,
  themeCssVariableNames,
} from '../../apps/website/src/components/theme-switcher/library.ts';

const blankSwatch = {
  background: '#fff',
  foreground: '#111',
  primary: '#000',
  accent: '#666',
  surface: '#f5f5f5',
};

const sample: readonly ThemeCatalogEntry[] = [
  {
    id: 'enterprise-neutral',
    name: 'Enterprise Neutral',
    description: 'Calm corporate greys',
    category: 'builtin',
    collection: 'industry',
    tags: ['neutral', 'aa'],
    swatches: { ...blankSwatch, primary: '#1e3a5f' },
  },
  {
    id: 'violet',
    name: 'Violet',
    description: 'Bold purple accent',
    category: 'builtin',
    collection: 'brand-like',
    tags: ['bold', 'purple'],
    swatches: { ...blankSwatch, primary: '#7c3aed' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Fresh blue technical',
    category: 'builtin',
    collection: 'industry',
    tags: ['fresh', 'blue'],
    swatches: { ...blankSwatch, primary: '#2563eb' },
  },
];

describe('theme-switcher helpers', () => {
  it('filters the catalog by id, name, tag and multi-word query', () => {
    expect(filterThemeCatalog(sample, '').length).toBe(3);
    expect(filterThemeCatalog(sample, 'violet').map((e) => e.id)).toEqual(['violet']);
    expect(filterThemeCatalog(sample, 'industry aa').map((e) => e.id)).toEqual([
      'enterprise-neutral',
    ]);
    expect(filterThemeCatalog(sample, 'no-such-theme')).toEqual([]);
  });

  it('validates theme ids and mode choices', () => {
    expect(isThemeId('enterprise-neutral')).toBe(true);
    expect(isThemeId('Bad_ID')).toBe(false);
    expect(isThemeId('')).toBe(false);
    expect(MODE_CHOICES).toEqual(['light', 'dark', 'high-contrast', 'system']);
    expect(isModeChoice('high-contrast')).toBe(true);
    expect(isModeChoice('sepia')).toBe(false);
  });

  it('resolves system mode from matchMedia preferences', () => {
    const dark = (query: string) => ({
      matches: query.includes('prefers-color-scheme: dark'),
    });
    const contrast = (query: string) => ({
      matches: query.includes('prefers-contrast: more'),
    });
    expect(resolveModeChoice('light')).toBe('light');
    expect(resolveModeChoice('dark')).toBe('dark');
    expect(resolveModeChoice('high-contrast')).toBe('high-contrast');
    expect(resolveModeChoice('system', dark)).toBe('dark');
    expect(resolveModeChoice('system', contrast)).toBe('high-contrast');
  });

  it('exposes a stable mode-preference key and CSS variable name list', () => {
    expect(modePreferenceKey('texuli-site')).toBe('texuli.texuli-site.mode-pref');
    const names = themeCssVariableNames();
    expect(names).toContain('--tx-background');
    expect(names).toContain('--tx-foreground');
    expect(names).toContain('--tx-primary');
    expect(names.every((n) => n.startsWith('--tx-'))).toBe(true);
  });
});
