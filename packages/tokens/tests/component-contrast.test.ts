// @vitest-environment node
/**
 * Every Button / Badge / Toggle variant pair must stay AA across the full
 * 210-theme library (light, dark) and the shared high-contrast palette.
 * Pairs come from CSS role usage — never per-theme patches.
 */
import { describe, expect, it } from 'vitest';
import { COMPONENT_CONTRAST_PAIRS, type ComponentContrastPair } from '../src/aa-gate/components.ts';
import { AA_TEXT_MINIMUM, AA_UI_MINIMUM } from '../src/aa-gate/index.ts';
import type { SemanticPalette, SemanticRole } from '../src/contract/semantic.ts';
import { getFullThemeLibraryMeta, loadFullLibraryTheme } from '../src/library-expand/registry.ts';
import { createHighContrastPalette } from '../src/modes/modes.ts';
import { contrastRatio, parseHex } from '../src/palette/contrast.ts';

function backgroundColor(
  palette: SemanticPalette,
  role: SemanticRole,
  state: 'default' | 'hover' | 'active' = 'default'
): string | undefined {
  const value = palette[role];
  if (!value) return undefined;
  if (state === 'default') return value.default;
  return value[state] ?? value.default;
}

/**
 * Backgrounds to test for one pair.
 * Solid fills → own role (+ hover state). Transparent/outline → each surface.
 */
function backgroundsFor(pair: ComponentContrastPair): {
  role: SemanticRole;
  state: 'default' | 'hover' | 'active';
}[] {
  const multiSurface =
    pair.surfaces &&
    pair.surfaces.length > 0 &&
    pair.state !== 'hover' &&
    pair.state !== 'on' &&
    (pair.variant === 'ghost' ||
      pair.variant === 'link' ||
      pair.variant === 'outline' ||
      pair.variant.includes('outline') ||
      pair.id === 'button.focus-ring' ||
      pair.id.startsWith('toast.body') ||
      pair.id.startsWith('toast.description') ||
      pair.component === 'map' ||
      (pair.component === 'toggle' && pair.state === 'default'));

  if (multiSurface) {
    return pair.surfaces!.map((role) => ({ role, state: 'default' as const }));
  }
  if (
    pair.state === 'hover' &&
    pair.surfaces &&
    (pair.variant === 'ghost' ||
      pair.variant === 'outline' ||
      pair.variant.includes('outline') ||
      pair.component === 'toggle')
  ) {
    return [{ role: pair.background, state: pair.backgroundState ?? 'default' }];
  }
  return [{ role: pair.background, state: pair.backgroundState ?? 'default' }];
}

function checkPalette(themeId: string, mode: string, palette: SemanticPalette): string[] {
  const fails: string[] = [];
  for (const pair of COMPONENT_CONTRAST_PAIRS) {
    const fg = palette[pair.foreground]?.default;
    if (!fg || !parseHex(fg)) continue;
    const required = pair.kind === 'ui' ? AA_UI_MINIMUM : AA_TEXT_MINIMUM;
    for (const target of backgroundsFor(pair)) {
      const bg = backgroundColor(palette, target.role, target.state);
      if (!bg || !parseHex(bg)) continue;
      const ratio = contrastRatio(fg, bg);
      if (ratio < required) {
        fails.push(
          `${themeId}/${mode}/${pair.id}@${target.role}.${target.state} ${ratio.toFixed(2)} < ${required} (${fg} on ${bg})`
        );
      }
    }
  }
  return fails;
}

describe('component variant contrast (Button, Badge, Toggle, Alert, Callout, Toast)', () => {
  it('exports a non-empty pair matrix covering soft tone variants', () => {
    expect(COMPONENT_CONTRAST_PAIRS.length).toBeGreaterThan(40);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.variant === 'secondary')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.variant === 'ghost')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.variant === 'outline')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.component === 'badge')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.component === 'toggle')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.component === 'alert')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.component === 'callout')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.component === 'toast')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.component === 'map')).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.id.startsWith('map.marker.'))).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.variant.includes('soft-title'))).toBe(true);
    expect(COMPONENT_CONTRAST_PAIRS.some((p) => p.foreground === 'warningSoftForeground')).toBe(
      true
    );
  });

  it('passes AA for every library theme (210) × light/dark and high-contrast hex pairs', async () => {
    const meta = await getFullThemeLibraryMeta();
    expect(meta.length).toBe(210);

    const fails: string[] = [];
    for (const entry of meta) {
      const theme = await loadFullLibraryTheme(entry.id);
      fails.push(...checkPalette(entry.id, 'light', theme.light));
      fails.push(...checkPalette(entry.id, 'dark', theme.dark));
    }
    fails.push(...checkPalette('system', 'high-contrast', createHighContrastPalette()));

    expect(fails, fails.slice(0, 40).join('\n')).toEqual([]);
  }, 180_000);
});
