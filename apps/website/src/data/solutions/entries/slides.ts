import type { SolutionEntry } from '../schema.ts';

/** Slides: the deck model plus the presentation stage (facts F-22; sol-creative.md). */
export const slides: SolutionEntry = {
  slug: 'slides',
  name: 'Slides',
  status: 'in development',
  tagline: 'Write decks as JSON or Markdown and present them in the browser.',
  summary:
    'A validated deck model with JSON and Markdown codecs, navigation and templates, and a Svelte stage with layouts, presenter view, print and PPTX export.',
  route: '/solutions/slides/',
  docs: '/guides/solutions/slides/',
  replaces: '/slides-page/',
  packages: [
    {
      name: '@texuli/deck',
      subpaths: ['./model', './engine', './markdown', './authoring', './templates'],
      role: 'Framework-free deck model, codecs, navigation engine and authoring',
    },
    {
      name: '@texuli/slides',
      subpaths: ['./stage', './layouts', './export'],
      role: 'Presentation stage, layouts, print and PPTX export',
    },
  ],
  capabilities: [
    {
      id: 'deck-model',
      title: 'Deck model',
      summary: 'Parse and validate a deck from JSON or Markdown.',
      status: 'in development',
    },
    {
      id: 'present',
      title: 'Present',
      summary: 'Step through slides with the keyboard, with a presenter view.',
      status: 'in development',
    },
    {
      id: 'layouts',
      title: 'Layouts and templates',
      summary: 'Lay slides out with built-in layouts and start from templates.',
      status: 'in development',
    },
    {
      id: 'export',
      title: 'Print and PPTX',
      summary: 'Print a deck or export it as a PPTX file.',
      status: 'in development',
    },
  ],
  platforms: [
    { platform: 'web', status: 'in development', evidence: [] },
    { platform: 'compose-desktop', status: 'planned', evidence: [] },
    { platform: 'android', status: 'planned', evidence: [] },
    { platform: 'ios', status: 'planned', evidence: [] },
  ],
  demo: {
    id: 'slides',
    title: 'Present a deck',
    scenarios: ['texuli-in-motion', 'investor-pitch', 'data-report', 'product-walkthrough'],
    limits: ['Runs in the browser on fixture decks only; nothing is saved.'],
  },
  art: { hero: { slot: 'solution-slides-hero', variant: 'plate' } },
  limits: [
    'Pre-1.0 and in development: a new minor version may break the API.',
    'No hosted editor or deck storage; the host app keeps the deck data.',
    'Native rendering is planned, not built.',
  ],
  links: [
    { label: 'Read the docs', href: '/guides/solutions/slides/' },
    { label: 'Current demo page', href: '/slides-page/' },
    { label: '@texuli/slides on npm', href: 'https://www.npmjs.com/package/@texuli/slides' },
  ],
};
