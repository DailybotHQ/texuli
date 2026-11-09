/**
 * The Slides landing content (ADR-027, ADR-030): the per-section copy the Slides blocks
 * already own, gathered into the `SolutionLandingContent` that `SolutionLayout` checks
 * against the registry entry. The underscore keeps this module out of Astro's routes.
 */

import type {
  SolutionDemoFrameProps,
  SolutionLandingContent,
} from '../../../components/solutions/shared/types.ts';
import {
  SLIDES_AGENTS,
  SLIDES_NEXT,
  SLIDES_PLATFORMS,
  SLIDES_RECIPES,
} from '../../../components/solutions/slides/extras/extras-content.ts';
import { SLIDES_HERO } from '../../../components/solutions/slides/hero/hero-content.ts';
import { SLIDES_HOW } from '../../../components/solutions/slides/how/how-content.ts';
import { slidesQuickstart } from '../../../components/solutions/slides/quickstart/samples.ts';
import { SLIDES_STORIES } from '../../../components/solutions/slides/stories/stories-content.ts';
import { getSolution } from '../../../data/solutions/index.ts';

export const SLIDES_ENTRY = getSolution('slides');

export const SLIDES_DEMO: Omit<SolutionDemoFrameProps, 'entry'> = {
  title: 'Present a real deck',
  label: 'Slides demo',
  tryThis: [
    'Start the demo, then step through with the arrow keys or the Next button.',
    'Switch the scenario to load another fixture deck.',
    'Change the theme, play the deck, or open View source to read the deck as data.',
  ],
};

const { entry: _entry, ...quickstart } = slidesQuickstart(SLIDES_ENTRY);

export const SLIDES_LANDING: SolutionLandingContent = {
  hero: SLIDES_HERO,
  demo: SLIDES_DEMO,
  stories: SLIDES_STORIES,
  how: SLIDES_HOW,
  quickstart,
  recipes: SLIDES_RECIPES,
  agents: SLIDES_AGENTS,
  platforms: SLIDES_PLATFORMS,
  next: SLIDES_NEXT,
};
