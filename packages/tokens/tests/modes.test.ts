import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SemanticPalette } from '../src/contract/semantic.ts';
import { SEMANTIC_ROLES } from '../src/contract/semantic.ts';
import type { Theme } from '../src/contract/types.ts';
import {
  applyColorMode,
  COLOR_MODE_NAMES,
  clearColorMode,
  colorModeBootstrapScript,
  colorModeStorageKey,
  colorSchemeValue,
  createHighContrastPalette,
  getSystemPreferences,
  resolveColorMode,
  resolveSemanticPalette,
} from '../src/index.ts';

function palette(color: string): SemanticPalette {
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => [role, { default: color }])
  ) as SemanticPalette;
}

const theme: Pick<Theme, 'light' | 'dark'> = {
  light: palette('#eeeeee'),
  dark: palette('#111111'),
};

function mediaPreferences(matches: Readonly<Record<string, boolean>>) {
  return vi.fn((query: string) => ({ matches: matches[query] ?? false }));
}

describe('color mode resolution', () => {
  it('exposes explicit modes and resolves system color and contrast preferences', () => {
    expect(COLOR_MODE_NAMES).toEqual(['light', 'dark', 'high-contrast', 'system']);
    const dark = mediaPreferences({ '(prefers-color-scheme: dark)': true });
    const contrast = mediaPreferences({
      '(prefers-color-scheme: dark)': true,
      '(prefers-contrast: more)': true,
    });

    expect(getSystemPreferences(dark)).toEqual({ colorScheme: 'dark', contrast: 'no-preference' });
    expect(resolveColorMode('system', dark)).toBe('dark');
    expect(resolveColorMode('system', contrast)).toBe('high-contrast');
    expect(resolveColorMode('system', mediaPreferences({}))).toBe('light');
    expect(resolveColorMode('light', contrast)).toBe('light');
    expect(resolveColorMode('high-contrast', dark)).toBe('high-contrast');
  });

  it('fails safely when matchMedia is missing or throws', () => {
    expect(
      getSystemPreferences(() => {
        throw new Error('unavailable');
      })
    ).toEqual({ colorScheme: 'light', contrast: 'no-preference' });
    expect(
      resolveColorMode('system', () => {
        throw new Error('unavailable');
      })
    ).toBe('light');
  });
});

describe('high contrast palette', () => {
  it('maps every semantic role to a platform system color and includes interaction states', () => {
    const palette = createHighContrastPalette();
    expect(Object.keys(palette)).toEqual(SEMANTIC_ROLES);
    expect(palette.background.default).toBe('Canvas');
    expect(palette.foreground.default).toBe('CanvasText');
    expect(palette.primary.default).toBe('Highlight');
    expect(palette.primaryForeground.default).toBe('HighlightText');
    expect(palette.link.default).toBe('LinkText');
    expect(palette.primary.disabled).toBe('GrayText');
    expect(palette.primary.focus).toBe('Highlight');
    expect(createHighContrastPalette()).not.toBe(palette);
  });

  it('selects authored palettes for light and dark, and system colors for high contrast', () => {
    expect(resolveSemanticPalette(theme, 'light')).toBe(theme.light);
    expect(resolveSemanticPalette(theme, 'dark')).toBe(theme.dark);
    expect(resolveSemanticPalette(theme, 'high-contrast').background.default).toBe('Canvas');
    expect(colorSchemeValue('light')).toBe('light');
    expect(colorSchemeValue('dark')).toBe('dark');
    expect(colorSchemeValue('high-contrast')).toBe('light dark');
  });
});

describe('mode application and first-paint bootstrap', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-tx-mode');
    document.documentElement.style.removeProperty('color-scheme');
  });

  it('applies explicit and system modes to an element and clears only mode state', () => {
    const root = document.createElement('div');
    root.classList.add('custom');
    expect(
      applyColorMode(root, 'system', mediaPreferences({ '(prefers-contrast: more)': true }))
    ).toBe('high-contrast');
    expect(root.dataset.txMode).toBe('high-contrast');
    expect(root.style.colorScheme).toBe('light dark');
    expect(root.className).toBe('custom');

    applyColorMode(root, 'dark');
    expect(root.dataset.txMode).toBe('dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');
    clearColorMode(root);
    expect(root.dataset.txMode).toBeUndefined();
    expect(root.className).toBe('custom');
    expect(root.style.colorScheme).toBe('');
  });

  it('generates a namespace-specific inline script that validates storage and resolves system contrast', () => {
    const script = colorModeBootstrapScript('billing', 'system');
    expect(script).toContain('texuli.billing.mode');
    expect(script).toContain("m==='system'");
    expect(script).toContain('prefers-contrast: more');
    expect(script).toContain('prefers-color-scheme: dark');
    expect(script).toContain('dataset.txMode');
    expect(script).not.toContain('<script');
  });

  it('escapes script delimiters in a namespace and rejects an empty namespace', () => {
    const script = colorModeBootstrapScript('</script>&tenant');
    expect(script).not.toContain('</script>');
    expect(script).toContain('\\u003c/script\\u003e\\u0026tenant');
    expect(colorModeStorageKey(' billing ')).toBe('texuli.billing.mode');
    expect(() => colorModeBootstrapScript('  ')).toThrow(/namespace/i);
    expect(() => colorModeStorageKey('')).toThrow(/namespace/i);
    expect(() => colorModeBootstrapScript('x'.repeat(129))).toThrow(/namespace/i);
  });

  it('uses system mode when a runtime caller passes an unknown fallback', () => {
    expect(colorModeBootstrapScript('dashboard', 'invalid' as never)).toContain('m="system"');
  });
});
