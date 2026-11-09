/**
 * Copy for the Slides landing hero. Facts come from the registry entry and the Slides
 * audit (deck model, JSON and Markdown, stage, presenter view, print, PPTX); the status
 * line is printed by `SolutionHero` from `entry.status`, so the copy never states one.
 * Calls to action point only at routes that exist: the landing's own demo section and
 * the current Slides demo page. The docs link joins once the Slides docs page ships.
 */

import { SOLUTION_SECTION_IDS } from '../../shared/subnav/sections.ts';
import type { SolutionHeroProps } from '../../shared/types.ts';

export const SLIDES_HERO: Omit<SolutionHeroProps, 'entry'> = {
  eyebrow: 'Solution · Slides',
  title: 'Decks written as data, presented on the web.',
  lede: 'Write a deck in JSON or Markdown, check it against one model, then present it with layouts and a presenter view, or print it and export PPTX.',
  ctas: [
    { kind: 'primary', label: 'Try the live deck', href: `#${SOLUTION_SECTION_IDS.demo}` },
    { kind: 'secondary', label: 'See the Slides demo page', href: '/slides-page/' },
  ],
};
