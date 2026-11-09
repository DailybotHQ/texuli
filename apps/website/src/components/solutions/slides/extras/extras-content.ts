/**
 * Closing copy for the Slides landing: recipes, agents, platforms and next steps.
 * Agent surfaces are MCP, catalog and skill ids that exist in this repository.
 * Recipe links are only routes or package pages that exist today. The docs href
 * is required on next steps (`entry.docs`); that page ships with the Slides docs task.
 */
import type {
  SolutionAgentsProps,
  SolutionNextStepsProps,
  SolutionPlatformsProps,
  SolutionRecipesProps,
} from '../../shared/types.ts';

export const SLIDES_RECIPES: Omit<SolutionRecipesProps, 'entry'> = {
  title: 'Recipes',
  recipes: [
    {
      title: 'Present a deck in the browser',
      summary: 'Mount DeckStage on the current Slides demo page with a fixture deck.',
      href: '/slides-page/',
    },
    {
      title: 'Install the packages',
      summary: 'Add @texuli/deck and @texuli/slides from npm (pre-1.0, in development).',
      href: 'https://www.npmjs.com/package/@texuli/slides',
    },
  ],
};

export const SLIDES_AGENTS: Omit<SolutionAgentsProps, 'entry'> = {
  title: 'For agents',
  body: 'Agents write a deck as JSON or Markdown, check it with the deck model, and present it with DeckStage. The packages are in development.',
  surfaces: [
    {
      label: 'deck.run',
      detail: 'MCP operation: lint, inspect and convert a deck on the shared v2 model.',
      status: 'in development',
    },
    {
      label: 'layout-deck',
      detail: 'Catalog layout for an agent-emitted deck (the main landmark).',
      status: 'in development',
    },
    {
      label: 'deck-slide',
      detail: 'Catalog layout for one slide inside a deck.',
      status: 'in development',
    },
    {
      label: 'skills/texuli/build-ui/references/decks.md',
      detail: 'Skill reference for JSON and Markdown decks, DeckStage, print and PPTX.',
      status: 'in development',
    },
  ],
};

export const SLIDES_PLATFORMS: Omit<SolutionPlatformsProps, 'entry'> = {
  title: 'Platforms',
};

export const SLIDES_NEXT: Omit<SolutionNextStepsProps, 'entry'> = {
  links: [
    { label: 'Read the docs', href: '/guides/solutions/slides/' },
    { label: 'Current demo page', href: '/slides-page/' },
    { label: '@texuli/slides on npm', href: 'https://www.npmjs.com/package/@texuli/slides' },
  ],
};
