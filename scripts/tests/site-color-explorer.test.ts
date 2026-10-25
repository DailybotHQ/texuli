// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildColorExplorerThemes,
  explorerTailwindEntries,
  formatRatio,
} from '../../apps/website/src/components/color-explorer/build.ts';
import {
  buildExportText,
  cssVarsBlock,
  jsonTokenExport,
  tailwindMapExport,
} from '../../apps/website/src/components/color-explorer/export-formats.ts';

describe('color explorer build', () => {
  it('builds themes with scales, roles, pairs and css vars', async () => {
    const themes = await buildColorExplorerThemes();
    expect(themes.length).toBeGreaterThan(10);
    const enterprise = themes.find((t) => t.id === 'enterprise-neutral');
    expect(enterprise).toBeDefined();
    expect(enterprise!.light.roles.length).toBeGreaterThan(20);
    expect(enterprise!.light.pairs.length).toBeGreaterThan(10);
    expect(Object.keys(enterprise!.light.scales.primary)).toContain('500');
    expect(enterprise!.light.cssVars['--tx-background']).toBeTruthy();
    expect(enterprise!.dark.cssVars['--tx-background']).toBeTruthy();
    expect(formatRatio(4.5)).toBe('4.50:1');
  }, 120_000);

  it('formats CSS, JSON and Tailwind exports', async () => {
    const themes = await buildColorExplorerThemes();
    const theme = themes.find((t) => t.id === 'enterprise-neutral') ?? themes[0]!;
    const tw = explorerTailwindEntries();
    const css = cssVarsBlock(theme.id, 'light', theme.light.cssVars);
    expect(css).toContain(`[data-tx-theme='${theme.id}']`);
    expect(css).toContain('--tx-');
    const json = jsonTokenExport(theme, 'dark');
    const parsed = JSON.parse(json) as { mode: string; roles: Record<string, string> };
    expect(parsed.mode).toBe('dark');
    expect(parsed.roles.background).toBeTruthy();
    const map = tailwindMapExport(tw, theme.light.cssVars);
    expect(map).toContain('--color-');
    expect(buildExportText('css', theme, 'light', tw)).toContain('--tx-');
    expect(buildExportText('json', theme, 'light', tw)).toContain('"id"');
    expect(buildExportText('tailwind', theme, 'light', tw)).toContain('theme');
  }, 120_000);
});
