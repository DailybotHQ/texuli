import type { SemanticPalette, SemanticRole } from '../contract/semantic.ts';
import type { ColorModeName, Theme } from '../contract/types.ts';
import { contrastRatio, parseHex } from '../palette/contrast.ts';

/**
 * The WCAG 2.x pairs a generated theme guarantees. `text` pairs need the
 * text minimum (4.5:1 for AA, 7:1 for AAA); `ui` pairs are non-text
 * boundaries (WCAG 1.4.11) and need 3:1. `states` checks the background's
 * hover and active states against the same foreground.
 */
export interface ContrastPair {
  foreground: SemanticRole;
  background: SemanticRole;
  kind: 'text' | 'ui';
  states?: boolean;
}

const text = (foreground: SemanticRole, backgrounds: SemanticRole[], states = false) =>
  backgrounds.map((background): ContrastPair => ({ foreground, background, kind: 'text', states }));
const ui = (foreground: SemanticRole, backgrounds: SemanticRole[]) =>
  backgrounds.map((background): ContrastPair => ({ foreground, background, kind: 'ui' }));

export const THEME_CONTRAST_PAIRS: readonly ContrastPair[] = [
  ...text('foreground', ['canvas', 'background', 'surface', 'elevated', 'muted', 'subtle']),
  ...text('surfaceForeground', ['surface']),
  ...text('elevatedForeground', ['elevated']),
  ...text('mutedForeground', ['background', 'surface', 'muted', 'elevated']),
  ...text('subtleForeground', ['background', 'subtle']),
  ...text('primaryForeground', ['primary', 'sidebarPrimary'], true),
  ...text('primarySoftForeground', ['primarySoft']),
  ...text('foreground', ['primarySoft']),
  ...text('secondaryForeground', ['secondary'], true),
  ...text('accentForeground', ['accent'], true),
  ...text('destructiveForeground', ['destructive'], true),
  ...text('destructiveSoftForeground', ['destructiveSoft']),
  ...text('foreground', ['destructiveSoft']),
  ...text('successForeground', ['success'], true),
  ...text('successSoftForeground', ['successSoft']),
  ...text('foreground', ['successSoft']),
  ...text('warningForeground', ['warning'], true),
  ...text('warningSoftForeground', ['warningSoft']),
  ...text('foreground', ['warningSoft']),
  ...text('infoForeground', ['info'], true),
  ...text('infoSoftForeground', ['infoSoft']),
  ...text('foreground', ['infoSoft']),
  // Outline ink (solid tone-as-text on page surfaces) is gated in
  // COMPONENT_CONTRAST_PAIRS — solid fills stay dual-purpose without forcing
  // every fixture palette to paint fills as body ink.
  ...text('sidebarForeground', ['sidebar']),
  ...text('link', ['background', 'surface', 'muted', 'elevated']),
  ...text('linkVisited', ['background', 'surface', 'muted', 'elevated']),
  ...text('selectionForeground', ['selection']),
  ...ui('borderStrong', ['background', 'surface']),
  ...ui('input', ['background', 'surface']),
  ...ui('ring', ['background', 'surface']),
];

export interface ContrastIssue {
  mode?: ColorModeName;
  foreground: SemanticRole;
  background: SemanticRole;
  /** The background state that failed (`default`, `hover` or `active`). */
  state: 'default' | 'hover' | 'active';
  ratio: number;
  required: number;
}

/**
 * Every guaranteed pair of one palette that misses its minimum. Pairs whose
 * colors are not hex (translucent overlays) are outside these checks.
 */
export function checkPaletteContrast(
  palette: SemanticPalette,
  options: { textMinimum?: number } = {}
): ContrastIssue[] {
  const textMinimum = options.textMinimum ?? 4.5;
  const issues: ContrastIssue[] = [];
  for (const pair of THEME_CONTRAST_PAIRS) {
    const foreground = palette[pair.foreground].default;
    const background = palette[pair.background];
    const required = pair.kind === 'text' ? textMinimum : 3;
    const states = pair.states ? (['default', 'hover', 'active'] as const) : (['default'] as const);
    for (const state of states) {
      const color = background[state];
      if (!color || !parseHex(foreground) || !parseHex(color)) continue;
      const ratio = contrastRatio(foreground, color);
      if (ratio < required) {
        issues.push({
          foreground: pair.foreground,
          background: pair.background,
          state,
          ratio,
          required,
        });
      }
    }
  }
  return issues;
}

/** `checkPaletteContrast` for both modes of a theme, each issue tagged with its mode. */
export function checkThemeContrast(
  theme: Theme,
  options: { textMinimum?: number } = {}
): ContrastIssue[] {
  return (['light', 'dark'] as const).flatMap((mode) =>
    checkPaletteContrast(theme[mode], options).map((issue) => ({ ...issue, mode }))
  );
}
