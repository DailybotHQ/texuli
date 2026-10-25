import type { SemanticRole } from '../contract/semantic.ts';
import { type ContrastPair, THEME_CONTRAST_PAIRS } from '../generator/contrast.ts';

/**
 * Re-export the guaranteed role pairs the AA gate evaluates.
 * Text pairs need 4.5:1 (7:1 when a theme declares AAA); UI pairs need 3:1
 * (WCAG 1.4.11). Interactive fill pairs also check hover and active states.
 */
export type { ContrastPair };
export { THEME_CONTRAST_PAIRS };

/** WCAG 2.x AA floors used when a theme does not declare a higher level. */
export const AA_TEXT_MINIMUM = 4.5;
export const AA_UI_MINIMUM = 3;
/** WCAG 2.x AAA text floor (enhanced contrast themes). */
export const AAA_TEXT_MINIMUM = 7;

export type AaContrastLevel = 'AA' | 'AAA';

export function textMinimumForLevel(level: AaContrastLevel = 'AA'): number {
  return level === 'AAA' ? AAA_TEXT_MINIMUM : AA_TEXT_MINIMUM;
}

/** Stable id for one pair, used by website theme pages and tests. */
export function contrastPairId(pair: ContrastPair): string {
  return `${pair.kind}:${pair.foreground}/${pair.background}${pair.states ? '+states' : ''}`;
}

/** Every foreground and background role the gate touches (for docs and audits). */
export function gatedSemanticRoles(): readonly SemanticRole[] {
  const roles = new Set<SemanticRole>();
  for (const pair of THEME_CONTRAST_PAIRS) {
    roles.add(pair.foreground);
    roles.add(pair.background);
  }
  return [...roles].sort();
}
