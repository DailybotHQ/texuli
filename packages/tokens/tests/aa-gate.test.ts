// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  AA_TEXT_MINIMUM,
  AA_UI_MINIMUM,
  AAA_TEXT_MINIMUM,
  aaGateReportForWebsite,
  contrastPairId,
  evaluatePalettePairs,
  gatedSemanticRoles,
  runAaGateOnTheme,
  runLibraryAaGate,
  THEME_CONTRAST_PAIRS,
} from '../src/aa-gate/index.ts';
import type { SemanticPalette } from '../src/contract/semantic.ts';
import { SEMANTIC_ROLES } from '../src/contract/semantic.ts';
import { createHighContrastPalette } from '../src/modes/modes.ts';

function solidPalette(background: string, foreground: string): SemanticPalette {
  return Object.fromEntries(
    SEMANTIC_ROLES.map((role) => {
      const isForeground =
        role === 'foreground' ||
        role.endsWith('Foreground') ||
        role === 'link' ||
        role === 'linkVisited' ||
        role === 'ring' ||
        role === 'border' ||
        role === 'borderStrong' ||
        role === 'input' ||
        role === 'shadow';
      const fill = isForeground ? foreground : background;
      return [
        role,
        {
          default: fill,
          hover: fill,
          active: fill,
          focus: fill,
          disabled: fill,
        },
      ];
    })
  ) as SemanticPalette;
}

describe('AA gate pairs and floors', () => {
  it('exposes WCAG 2.x AA/AAA floors and stable pair ids, and 3 related cases', () => {
    // exposes WCAG 2.x AA/AAA floors and stable pair ids
    expect(AA_TEXT_MINIMUM).toBe(4.5);
    expect(AA_UI_MINIMUM).toBe(3);
    expect(AAA_TEXT_MINIMUM).toBe(7);
    expect(THEME_CONTRAST_PAIRS.length).toBeGreaterThan(10);
    expect(gatedSemanticRoles()).toContain('foreground');
    expect(gatedSemanticRoles()).toContain('primary');
    expect(contrastPairId(THEME_CONTRAST_PAIRS[0]!)).toMatch(/^(text|ui):/);
    {
      // passes a high-contrast black-on-white fixture and fails a washed-out one
      const good = runAaGateOnTheme({
        id: 'fixture-good',
        name: 'Good fixture',
        contrastLevel: 'AA',
        light: solidPalette('#ffffff', '#111111'),
        dark: solidPalette('#0a0a0a', '#f5f5f5'),
      });
      expect(good.pass).toBe(true);
      expect(good.modes).toHaveLength(2);
      expect(good.modes.every((mode) => mode.pass)).toBe(true);

      const bad = runAaGateOnTheme({
        id: 'fixture-bad',
        name: 'Bad fixture',
        light: solidPalette('#eeeeee', '#dddddd'),
        dark: solidPalette('#222222', '#333333'),
      });
      expect(bad.pass).toBe(false);
      expect(bad.issueCount).toBeGreaterThan(0);
      expect(bad.modes.some((mode) => mode.issues.length > 0)).toBe(true);
    }
    {
      // skips non-hex system colors under high-contrast without failing
      const report = runAaGateOnTheme({
        id: 'fixture-hc',
        name: 'HC fixture',
        light: solidPalette('#ffffff', '#111111'),
        dark: solidPalette('#0a0a0a', '#f5f5f5'),
        highContrast: createHighContrastPalette(),
      });
      const hc = report.modes.find((mode) => mode.mode === 'high-contrast');
      expect(hc).toBeDefined();
      expect(hc!.skippedCount).toBeGreaterThan(0);
      expect(hc!.pass).toBe(true);
      expect(hc!.pairs.every((pair) => pair.skipped === 'non-hex' || pair.pass)).toBe(true);
    }
    {
      // keeps pass/fail on AA floors and reports AAA shortfalls as enhancedIssues
      // ~4.54:1 — passes AA, below AAA
      const mid = solidPalette('#ffffff', '#767676');
      const aa = runAaGateOnTheme({
        id: 'mid-aa',
        name: 'Mid AA',
        contrastLevel: 'AA',
        light: mid,
        dark: solidPalette('#0a0a0a', '#f5f5f5'),
      });
      const aaa = runAaGateOnTheme({
        id: 'mid-aaa',
        name: 'Mid AAA',
        contrastLevel: 'AAA',
        light: mid,
        dark: solidPalette('#0a0a0a', '#f5f5f5'),
      });
      expect(aa.textMinimum).toBe(4.5);
      expect(aaa.textMinimum).toBe(4.5);
      expect(aa.pass).toBe(true);
      expect(aaa.pass).toBe(true);
      expect(aa.enhancedIssueCount).toBe(0);
      expect(aaa.enhancedTextMinimum).toBe(7);
      expect(aaa.enhancedIssueCount).toBeGreaterThan(0);
    }
  });
});

describe('library AA gate', () => {
  it('runs every library theme light/dark (and high-contrast skip rows) and all pass; evaluatePalettePairs marks system colors as skipped', async () => {
    // runs every library theme light/dark (and high-contrast skip rows) and all pass
    await (async () => {
      const report = await runLibraryAaGate({ includeHighContrast: true, clearCache: true });
      expect(report.themeCount).toBe(64);
      expect(report.uiMinimum).toBe(3);
      expect(report.pass, JSON.stringify(aaGateReportForWebsite(report), null, 2)).toBe(true);
      expect(report.issueCount).toBe(0);

      for (const theme of report.themes) {
        expect(theme.modes.map((m) => m.mode)).toEqual(['light', 'dark', 'high-contrast']);
        expect(theme.modes[0]!.pairCount).toBeGreaterThan(0);
        expect(theme.pass).toBe(true);
      }

      const website = aaGateReportForWebsite(report);
      expect(website.pass).toBe(true);
      expect(website.themes).toHaveLength(64);
      // Website payload omits full pair matrices; only issues travel.
      expect(website.themes[0]).toHaveProperty('modes');
      expect(JSON.parse(JSON.stringify(website))).toEqual(website);
    })();
    {
      // evaluatePalettePairs marks system colors as skipped
      const rows = evaluatePalettePairs(createHighContrastPalette());
      expect(rows.every((row) => row.skipped === 'non-hex')).toBe(true);
    }
  }, 120000);
});

describe('@texuli/tokens/aa-gate entry weight', () => {
  it('keeps component chrome pairs on the components subpath', async () => {
    const gate = await import('../src/aa-gate/index.ts');
    const components = await import('../src/aa-gate/components.ts');
    expect('COMPONENT_CONTRAST_PAIRS' in gate).toBe(false);
    expect(components.COMPONENT_CONTRAST_PAIRS.length).toBeGreaterThan(40);
    expect(components.COMPONENT_CONTRAST_PAIRS.some((pair) => pair.component === 'map')).toBe(true);
  });
});
