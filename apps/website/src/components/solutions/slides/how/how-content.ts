/**
 * Copy for the Slides "How it works" section. Five steps follow a deck from source to
 * output: author → parse and validate → navigate → present → print and export. Each step
 * names the registry package that does it. `SLIDES_HOW_TRACE` records, per step, the
 * subpath export and the registry capability it rests on, so the test can check every claim
 * against `entries/slides.ts` and the package manifests.
 *
 * Facts come from the deck and slides READMEs (`packages/deck/README.md`,
 * `packages/slides/README.md`): one model written as JSON or Markdown, `parseDeck` reports
 * every issue and never throws, the engine's navigation and presenter protocol, the stage's
 * scaling canvas, input, overview, presenter window and layouts, print to PDF through the
 * browser and a local PPTX export. No counts are stated, so nothing drifts.
 */
import type { SolutionHowProps } from '../../shared/types.ts';

export const SLIDES_HOW: Omit<SolutionHowProps, 'entry'> = {
  title: 'From a text file to a presented deck.',
  steps: [
    {
      title: 'Author',
      body: 'Write the deck as JSON, or in the closed deck Markdown dialect. Both sources produce the same deck, and Markdown round-trips back.',
      package: '@texuli/deck',
    },
    {
      title: 'Parse and validate',
      body: 'One model checks every slide and reports every issue at once, each with a code, a path and a fix. It never throws.',
      package: '@texuli/deck',
    },
    {
      title: 'Navigate',
      body: 'A framework-free engine runs slides and steps, vertical stacks, hash routes and the presenter protocol, with no DOM.',
      package: '@texuli/deck',
    },
    {
      title: 'Present',
      body: 'The Svelte stage scales a fixed canvas to any screen, with keyboard and touch input, an overview, a presenter window and built-in layouts.',
      package: '@texuli/slides',
    },
    {
      title: 'Print and export',
      body: 'Print one page per slide and save it as PDF from the browser, or export an editable PPTX locally, with a report of what it leaves out.',
      package: '@texuli/slides',
    },
  ],
};

/** Per step (same order): the subpath export it uses and the capability it demonstrates. */
export const SLIDES_HOW_TRACE: readonly Readonly<{ subpath: string; capability: string }>[] = [
  { subpath: './markdown', capability: 'deck-model' },
  { subpath: './model', capability: 'deck-model' },
  { subpath: './engine', capability: 'present' },
  { subpath: './stage', capability: 'present' },
  { subpath: './export', capability: 'export' },
];
