/**
 * /slides-page/ copy: the hero pieces, the page sections and the keyboard
 * map shown beside the flagship deck. Plain data, so the page and its unit
 * test read the same strings. The keys match the stage's controls registry
 * (`DECK_CONTROLS` in `@texuli/deck/engine`); the unit test checks that.
 */

export interface SlidesPiece {
  name: string;
  role: string;
}

/** What `@texuli/deck` and `@texuli/slides` are made of. */
export const SLIDES_PIECES: readonly SlidesPiece[] = [
  { name: 'model', role: 'one validated deck, every issue with its JSON path' },
  { name: 'markdown', role: 'Markdown to deck and back, math included' },
  { name: 'layouts', role: '20 layouts with limits and pacing' },
  { name: 'backgrounds', role: 'presets with a 4.5:1 contrast scrim' },
  { name: 'engine', role: 'navigation, steps, hash routes, presenter protocol' },
  { name: 'stage', role: 'canvas fit, chrome, overview, presenter view' },
  { name: 'components', role: 'charts, data, workflows and more on a slide' },
  { name: 'export', role: 'print, PDF and PPTX' },
];

export interface SlidesSection {
  id: string;
  title: string;
  summary: string;
}

export const SLIDES_SECTIONS: readonly SlidesSection[] = [
  {
    id: 'deck',
    title: 'The flagship deck',
    summary:
      'Twenty-five fictional slides on the new stage, painted at the untrusted tier like any deck an agent writes. The address bar follows the slide and step, so a link opens the same place.',
  },
  {
    id: 'editor',
    title: 'Write a deck in JSON or Markdown',
    summary:
      'Both editors feed one validated model. Every problem shows its JSON path or its line and column; an invalid deck never paints, and the preview says so.',
  },
  {
    id: 'layouts',
    title: 'Layouts',
    summary:
      'Each catalog layout with its own sample. Layouts have strict props and limits, and every step marker reveals a part of the layout.',
  },
  {
    id: 'backgrounds',
    title: 'Backgrounds',
    summary:
      'Solid, gradient and pattern presets and media backgrounds. Body text stays at 4.5:1 or more on every one: a scrim is added at the lowest strength that reaches it.',
  },
  {
    id: 'components',
    title: 'Components on slides',
    summary:
      'Any catalog component can sit on a slide. These four are painted by the player at the untrusted tier and load only when a slide needs them.',
  },
  {
    id: 'export',
    title: 'Print, PDF and PPTX',
    summary:
      'The flagship’s export bar downloads a PPTX file built in the browser, or opens the print view, where the browser saves a PDF.',
  },
];

export interface SlidesKey {
  keys: readonly string[];
  action: string;
}

/** The stage's main keys (the help dialog, `?`, lists them all). */
export const SLIDES_KEYS: readonly SlidesKey[] = [
  { keys: ['→', 'Space'], action: 'next step, then the next slide' },
  { keys: ['←'], action: 'previous step, then the previous slide' },
  { keys: ['Home', 'End'], action: 'first or last slide' },
  { keys: ['O'], action: 'overview' },
  { keys: ['F'], action: 'fullscreen' },
  { keys: ['P'], action: 'presenter view' },
  { keys: ['B'], action: 'blackout' },
  { keys: ['L'], action: 'laser pointer' },
  { keys: ['?'], action: 'every key' },
  { keys: ['Esc'], action: 'close the top layer' },
];

/** Honest status line (the 0.4.0 model is in the repository only). */
export const SLIDES_STATUS =
  'The 0.4.0 slides stage and @texuli/deck are in development and in the repository only; @texuli/slides 0.3.0 on npm has the previous deck model.';
