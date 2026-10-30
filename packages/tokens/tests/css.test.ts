import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SemanticPaletteInput } from '../src/contract/index.ts';
import {
  applyTheme,
  clearTheme,
  compileThemeCss,
  defineTheme,
  SEMANTIC_ROLES,
  themeVariables,
} from '../src/index.ts';

function palette(background: string, foreground: string): SemanticPaletteInput {
  const value = {} as SemanticPaletteInput;
  for (const role of SEMANTIC_ROLES) value[role] = background;
  value.background = background;
  value.foreground = foreground;
  value.primary = {
    default: '#6d28d9',
    hover: '#5b21b6',
    active: '#4c1d95',
    disabled: '#c4b5fd',
  };
  return value;
}

function theme() {
  return defineTheme({
    id: 'scoped-demo',
    name: 'Scoped demo',
    light: palette('#ffffff', '#111827'),
    dark: palette('#111827', '#f9fafb'),
  });
}

describe('theme CSS', () => {
  it('ships an importable, Tailwind-free base stylesheet in the declared layers, and 5 related cases', () => {
    {
      // ships an importable, Tailwind-free base stylesheet in the declared layers
      const baseCss = readFileSync('packages/tokens/src/css/base.css', 'utf8');
      expect(baseCss).toContain('@layer tx.base, tx.components;');
      expect(baseCss).toContain('@layer tx.base {');
      expect(baseCss).not.toContain('@theme');
      expect(baseCss).not.toContain('@utility');
      expect(baseCss).not.toContain('@import "tailwindcss"');
    }
    {
      // maps validated semantic and style tokens to Texuli custom properties
      const vars = themeVariables({
        theme: theme(),
        mode: 'light',
        density: 0.9,
        reducedMotion: true,
      });

      expect(vars['--tx-background']).toBe('#ffffff');
      expect(vars['--tx-primary-hover']).toBe('#5b21b6');
      expect(vars['--tx-font-sans']).toContain('system-ui');
      expect(vars['--tx-density']).toBe('0.9');
      expect(vars['--tx-motion-fast']).toBe('0ms');
    }
    {
      // compiles separately scoped light and dark rules inside the base layer
      const css = compileThemeCss(theme());

      expect(css.startsWith('@layer tx.base, tx.components;')).toBe(true);
      expect(css).toContain("[data-tx-theme='scoped-demo'][data-tx-mode='light']");
      expect(css).toContain("[data-tx-theme='scoped-demo'][data-tx-mode='dark']");
      expect(css).toContain('--tx-background: #ffffff;');
      expect(css).toContain('--tx-background: #111827;');
      expect(css).not.toContain('--py-');
      expect(css).not.toContain('@theme');
    }
    {
      // rejects unsafe theme values instead of serializing CSS injection
      const unsafe = {
        ...theme(),
        light: { ...palette('#ffffff', '#111827'), primary: 'red; } body { display:none' },
      };

      expect(() => compileThemeCss(unsafe as unknown as ReturnType<typeof theme>)).toThrow(
        /Invalid theme/
      );
    }
    // rejects an unsupported runtime mode
    expect(() => themeVariables({ theme: theme(), mode: 'system' as unknown as 'light' })).toThrow(
      'Theme mode must be light or dark'
    );
    {
      // applies and clears a theme on a nested element without changing the document root
      const root = document.createElement('main');
      const preview = document.createElement('section');
      root.append(preview);

      const applied = applyTheme(preview, { theme: theme(), mode: 'dark' });
      expect(applied.themeId).toBe('scoped-demo');
      expect(preview.dataset.txTheme).toBe('scoped-demo');
      expect(preview.dataset.txMode).toBe('dark');
      expect(preview.style.getPropertyValue('--tx-background')).toBe('#111827');
      expect(root.dataset.txTheme).toBeUndefined();
      // ADR-023: the element is a token scope that overlay portals follow.
      expect(preview.getAttribute('data-tx-scope')).toBe('');
      expect(root.hasAttribute('data-tx-scope')).toBe(false);

      clearTheme(preview);
      expect(preview.hasAttribute('data-tx-scope')).toBe(false);
      expect(preview.dataset.txTheme).toBeUndefined();
      expect(preview.dataset.txMode).toBeUndefined();
      expect(preview.style.getPropertyValue('--tx-background')).toBe('');

      // A host-named scope keeps its value through apply and clear.
      const named = document.createElement('section');
      named.setAttribute('data-tx-scope', 'studio-preview');
      applyTheme(named, { theme: theme(), mode: 'light' });
      expect(named.getAttribute('data-tx-scope')).toBe('studio-preview');
      clearTheme(named);
      expect(named.getAttribute('data-tx-scope')).toBe('studio-preview');
    }
  });
});
