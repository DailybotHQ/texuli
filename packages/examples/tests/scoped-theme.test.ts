// @vitest-environment happy-dom
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { describe, expect, it } from 'vitest';
import { scopedTheme } from '../src/scoped-theme.ts';

// Audit P1-02: a hand-built "dark" section kept the page's light soft fills
// under light text. The scope must switch every token, soft fills included.
describe('scopedTheme', () => {
  it('applies the page theme in dark mode, soft fills included, and falls back for an unknown theme', async () => {
    const theme = await loadLibraryTheme('enterprise-neutral');
    applyTheme(document.documentElement, { theme, mode: 'light' });
    const section = document.createElement('section');
    document.body.append(section);
    const action = scopedTheme(section, 'dark');
    await action.ready;
    const root = document.documentElement.style;
    expect(section.dataset.txMode).toBe('dark');
    expect(section.dataset.txTheme).toBe('enterprise-neutral');
    for (const name of ['--tx-background', '--tx-foreground', '--tx-info-soft']) {
      expect(section.style.getPropertyValue(name), name).not.toBe('');
      expect(section.style.getPropertyValue(name), name).not.toBe(root.getPropertyValue(name));
    }
    action.destroy();
    section.remove();

    // An unknown page theme falls back to the default library theme.
    document.documentElement.dataset.txTheme = 'not-a-theme';
    const fallback = document.createElement('section');
    const second = scopedTheme(fallback, 'dark');
    await second.ready;
    expect(fallback.dataset.txTheme).toBe('enterprise-neutral');
  });
});
