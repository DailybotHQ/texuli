/**
 * Slides area content (`/slides-page/`): the live tour, the starter
 * templates, the other registered slides examples and the package docs. Ids
 * are examples registry ids; every one has an `/examples/<id>/` page.
 */

export interface SlidesExampleLink {
  id: string;
  title: string;
  summary: string;
}

/** The deck the page mounts live. */
export const SLIDES_TOUR_ID = 'slides-tour';

export const SLIDES_TEMPLATES: readonly SlidesExampleLink[] = [
  {
    id: 'slides-template-report',
    title: 'Report',
    summary: 'Summary, key numbers, a trend, risks and next steps.',
  },
  {
    id: 'slides-template-pitch',
    title: 'Pitch',
    summary: 'Problem, solution, traction, a customer quote and the ask.',
  },
  {
    id: 'slides-template-review',
    title: 'Review',
    summary: 'Goals, what shipped, a demo, numbers and next work.',
  },
];

export const SLIDES_EXAMPLES: readonly SlidesExampleLink[] = [
  {
    id: 'slides-fragments',
    title: 'Reveal steps',
    summary: 'A slide paused at step 2 of 4: list items, a strike and a hidden callout.',
  },
  {
    id: 'slides-presenter-screen',
    title: 'Presenter screen',
    summary: 'Speaker notes with the step progress and the next step, timer-free.',
  },
  {
    id: 'slides-slot-masters',
    title: 'Slot masters',
    summary: 'Title and closing footers, two columns, a quote and its attribution, as print pages.',
  },
  {
    id: 'slides-media-deck',
    title: 'Media deck',
    summary: 'Media regions with a figure, an image and a gallery, as print pages.',
  },
];

/** Package docs, by repository path: the site does not serve them yet. */
export const SLIDES_DOCS: readonly { path: string; summary: string }[] = [
  { path: 'packages/slides/README.md', summary: 'Install, quick start and subpaths' },
  { path: 'packages/slides/docs/model.md', summary: 'Deck model, slot masters, reveal steps' },
  { path: 'packages/slides/docs/grammar.md', summary: 'Catalog encodings and agent decks' },
  {
    path: 'packages/slides/docs/stage.md',
    summary: 'Stage, keyboard, fullscreen, presenter screen',
  },
  { path: 'packages/slides/docs/export.md', summary: 'Print, PDF and PPTX export' },
  { path: 'packages/slides/docs/templates.md', summary: 'Starter templates' },
  { path: 'packages/slides/docs/styles.md', summary: 'Stylesheet hooks and states' },
];

export const slidesExampleHref = (base: string, id: string): string =>
  `${base.replace(/\/+$/, '')}/examples/${id}/`;
