/**
 * Copy for the Design systems landing hero (PLAN_017 story.md §1). Every claim is published
 * in Texuli 0.16.1: one data-only JSON document per brand, `texuli ds generate`, the kit,
 * `texuli ds approve` and the locked checks. The status line is printed by `SolutionHero`
 * from `entry.status`. Approval is a reviewed commit: the CLI cannot prove who approved.
 */
import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const DESIGN_SYSTEMS_GUIDE = '/guides/solutions/design-systems/';

export const DESIGN_SYSTEMS_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Design systems',
  title: 'Your brand, locked in one file.',
  lede: 'Generate a design system from what you already have, review every component it allows, approve it in a commit, and check that every prototype stays inside it. One JSON document, enforced contrast, no CSS to hand-copy.',
  ctas: [
    { kind: 'primary', label: 'See it on a sample brand', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'Read the guide', href: DESIGN_SYSTEMS_GUIDE },
  ],
};
