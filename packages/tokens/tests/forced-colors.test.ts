// @vitest-environment node
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE_SEMANTIC_ROLES, SEMANTIC_ROLES } from '../src/contract/semantic.ts';
import {
  checkForcedColorsCoverage,
  compileForcedColorsCss,
  createForcedColorsPalette,
  FORCED_COLORS_ROLE_MAP,
  FORCED_COLORS_VISIBILITY_ROLES,
  forcedColorsCssVariables,
  isSystemColorKeyword,
} from '../src/forced-colors/index.ts';

describe('forced-colors role map', () => {
  it('covers every semantic role with a CSS system color keyword, and 2 related cases', () => {
    // covers every semantic role with a CSS system color keyword
    expect(Object.keys(FORCED_COLORS_ROLE_MAP).sort()).toEqual([...SEMANTIC_ROLES].sort());
    expect(checkForcedColorsCoverage()).toEqual([]);
    for (const role of SEMANTIC_ROLES) {
      expect(isSystemColorKeyword(FORCED_COLORS_ROLE_MAP[role])).toBe(true);
    }
    // keeps focus, borders and selection on visible system colors
    expect(FORCED_COLORS_ROLE_MAP.ring).toBe('Highlight');
    expect(FORCED_COLORS_ROLE_MAP.border).toBe('ButtonBorder');
    expect(FORCED_COLORS_ROLE_MAP.borderStrong).toBe('CanvasText');
    expect(FORCED_COLORS_ROLE_MAP.selection).toBe('Highlight');
    expect(FORCED_COLORS_ROLE_MAP.selectionForeground).toBe('HighlightText');
    for (const role of FORCED_COLORS_VISIBILITY_ROLES) {
      expect(FORCED_COLORS_ROLE_MAP[role]).not.toBe('Canvas');
    }
    expect(FORCED_COLORS_ROLE_MAP.background).toBe('Canvas');
    expect(FORCED_COLORS_ROLE_MAP.foreground).toBe('CanvasText');
    {
      // builds a palette with interactive disabled/focus states for components
      const palette = createForcedColorsPalette();
      expect(Object.keys(palette)).toEqual([...SEMANTIC_ROLES]);
      for (const role of INTERACTIVE_SEMANTIC_ROLES) {
        expect(palette[role].disabled).toBe('GrayText');
        expect(palette[role].focus).toBe('Highlight');
        expect(palette[role].hover).toBeDefined();
        expect(palette[role].active).toBeDefined();
      }
      const vars = forcedColorsCssVariables(palette);
      expect(vars['--tx-ring']).toBe('Highlight');
      expect(vars['--tx-primary-disabled']).toBe('GrayText');
      expect(vars['--tx-selection']).toBe('Highlight');
      for (const role of SEMANTIC_ROLES) {
        expect(Object.values(vars)).toContain(FORCED_COLORS_ROLE_MAP[role]);
      }
      expect(Object.keys(vars).length).toBeGreaterThan(SEMANTIC_ROLES.length);
    }
  });
});

describe('compileForcedColorsCss', () => {
  it('emits forced-colors and prefers-contrast rules with all token variables, and 2 related cases', () => {
    {
      // emits forced-colors and prefers-contrast rules with all token variables
      const css = compileForcedColorsCss();
      expect(css).toContain('@media (forced-colors: active)');
      expect(css).toContain('@media (prefers-contrast: more)');
      expect(css).toContain('@layer tx.base');
      expect(css).toContain(':focus-visible');
      expect(css).toContain('::selection');
      expect(css).toContain('--tx-ring: Highlight');
      expect(css).toContain('--tx-border: ButtonBorder');
      expect(css).toContain('--tx-selection: Highlight');
      expect(css).toContain('--tx-focus-ring-width: 3px');
      for (const role of SEMANTIC_ROLES) {
        expect(css).toContain(FORCED_COLORS_ROLE_MAP[role]);
      }
    }
    {
      // anchors critical tokens to system colors when more contrast is requested
      const css = compileForcedColorsCss();
      const contrastBlock = css.split('@media (prefers-contrast: more)')[1];

      expect(contrastBlock).toContain('--tx-border: CanvasText;');
      expect(contrastBlock).toContain('--tx-border-strong: CanvasText;');
      expect(contrastBlock).toContain('--tx-ring: Highlight;');
      expect(contrastBlock).toContain('--tx-selection: Highlight;');
      expect(contrastBlock).toContain('--tx-selection-foreground: HighlightText;');
      expect(contrastBlock).not.toMatch(
        /--tx-(?:border|border-strong|ring|selection|selection-foreground): var\(--tx-/
      );
    }
    {
      // matches the shipped forced-colors.css file and stays under the CSS budget
      const compiled = compileForcedColorsCss();
      const shipped = readFileSync('packages/tokens/src/forced-colors/forced-colors.css', 'utf8');
      expect(shipped).toBe(compiled);
      const gzip = gzipSync(compiled, { level: 9 }).byteLength;
      // Task budget: base CSS ≤ 6 KB gzip; this sheet is a small additive layer.
      expect(gzip).toBeLessThanOrEqual(6 * 1024);
      expect(gzip).toBeLessThan(1500);
    }
  });
});

describe('component token audit hook', () => {
  it('reports missing roles when the map is incomplete', () => {
    const incomplete = { ...FORCED_COLORS_ROLE_MAP } as Record<string, string>;
    delete incomplete.ring;
    incomplete.border = 'not-a-system-color';
    incomplete.selection = 'Canvas';
    const issues = checkForcedColorsCoverage(incomplete);
    expect(issues.some((i) => i.kind === 'missing-role' && i.role === 'ring')).toBe(true);
    expect(issues.some((i) => i.kind === 'invalid-system-color' && i.role === 'border')).toBe(true);
    expect(issues.some((i) => i.kind === 'invisible-role' && i.role === 'selection')).toBe(true);
  });
});
