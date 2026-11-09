/**
 * The Slides signature stories and the evidence behind every claim. Copy comes from the
 * `@texuli/deck` and `@texuli/slides` READMEs and docs and the Slides audit; each story
 * names capability ids from `entries/slides.ts`, and each claim cites a repository file
 * that contains the named marker (a README, a doc, a test or the demo fixture). The test
 * checks that every cited file exists and contains its marker.
 */
import type { SolutionStoriesProps } from '../../shared/types.ts';

export const SLIDES_STORIES: Omit<SolutionStoriesProps, 'entry'> = {
  title: 'What a deck can do',
  stories: [
    {
      id: 'decks-as-data',
      title: 'A deck is data you can check',
      body: 'Write slides as JSON or in a Markdown dialect, and both land in one validated model. Every issue comes back at once, with its path and a fix, so people and agents can correct a deck before anyone presents it.',
      capabilities: ['deck-model'],
    },
    {
      id: 'present',
      title: 'Present from any screen',
      body: 'The stage scales a fixed canvas to the screen, gives every slide and step its own URL, and follows the keyboard and touch. An overview and a presenter window keep your notes and the next slide in view.',
      capabilities: ['present'],
      art: { slot: 'page-slides', variant: 'banner' },
    },
    {
      id: 'layouts',
      title: 'Layouts that keep text readable',
      body: 'Pick a catalog layout per slide, set backgrounds that keep text contrast, or start from a finished, fictional starter deck and change what you need.',
      capabilities: ['layouts'],
    },
    {
      id: 'export',
      title: 'Print it or take it to PPTX',
      body: 'The same deck prints to PDF through the browser, one page per visible slide, and exports to PPTX locally.',
      capabilities: ['export'],
    },
  ],
};

export interface StoryClaim {
  /** The claim in plain words, as the story makes it. */
  readonly claim: string;
  /** A repository path, relative to the repository root. */
  readonly source: string;
  /** Text the source must contain for the claim to hold. */
  readonly marker: string;
}

export const SLIDES_STORY_EVIDENCE: Readonly<Record<string, readonly StoryClaim[]>> = {
  'decks-as-data': [
    {
      claim: 'JSON decks parse into the validated model',
      source: 'packages/deck/README.md',
      marker: 'parseDeck',
    },
    {
      claim: 'Markdown decks parse into the same model',
      source: 'packages/deck/tests/markdown-parse.test.ts',
      marker: 'parseDeckMarkdown',
    },
    {
      claim: 'Validation reports every issue with a path and a fix',
      source: 'packages/deck/README.md',
      marker: 'reports every issue at once',
    },
    {
      claim: 'The landing demo decks go through the same parser',
      source: 'apps/website/src/components/solutions/slides/demo/fixtures/index.ts',
      marker: 'parseDeck',
    },
  ],
  present: [
    {
      claim: 'A fixed canvas that scales to any screen',
      source: 'packages/slides/README.md',
      marker: 'a fixed canvas that scales to any screen',
    },
    {
      claim: 'URL routes for every slide and step',
      source: 'packages/slides/README.md',
      marker: 'URL routes for every slide and step',
    },
    {
      claim: 'Keyboard and touch input',
      source: 'packages/slides/README.md',
      marker: 'keyboard and touch input',
    },
    {
      claim: 'An overview',
      source: 'packages/slides/tests/stage-overview.test.ts',
      marker: 'overview',
    },
    {
      claim: 'A presenter window with notes and the next slide',
      source: 'packages/slides/tests/stage-presenter.test.ts',
      marker: 'presenter',
    },
    {
      claim: 'Presenter layout shows notes and up next',
      source: 'packages/slides/README.md',
      marker: 'notes, up next',
    },
  ],
  layouts: [
    {
      claim: 'Catalog layouts per slide',
      source: 'packages/slides/tests/layouts.test.ts',
      marker: 'layout',
    },
    {
      claim: 'Backgrounds keep text contrast',
      source: 'packages/deck/tests/model-backgrounds.test.ts',
      marker: 'contrast',
    },
    {
      claim: 'Finished, fictional starter decks',
      source: 'packages/deck/docs/templates.md',
      marker: 'fictional starter decks',
    },
  ],
  export: [
    {
      claim: 'Prints to PDF through the browser',
      source: 'packages/slides/README.md',
      marker: 'prints to PDF through the browser',
    },
    {
      claim: 'One page per visible slide',
      source: 'packages/slides/README.md',
      marker: 'one page per visible slide',
    },
    {
      claim: 'Exports to PPTX locally',
      source: 'packages/slides/README.md',
      marker: 'exports to PPTX',
    },
    {
      claim: 'PPTX export is tested on deck model v2',
      source: 'packages/slides/tests/export-v2.test.ts',
      marker: 'PPTX',
    },
  ],
};
