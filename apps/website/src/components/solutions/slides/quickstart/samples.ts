import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const SLIDES_QUICKSTART_VERIFIED_BY =
  'apps/website/tests/solutions/slides-quickstart.test.ts';

export const SLIDES_INSTALL = 'pnpm add @texuli/deck @texuli/slides';

/** JSON passed to `parseDeck` from `@texuli/deck/model`. */
export const SLIDES_JSON_DECK = {
  formatVersion: 2,
  meta: { title: 'Quarterly update', locale: 'en' },
  style: { theme: 'ocean', transition: 'slide' },
  slides: [
    {
      id: 'opening',
      layout: 'title-hero',
      props: {
        title: 'Quarterly update',
        subtitle: 'Fictional numbers for Northwind',
      },
    },
    {
      id: 'adoption',
      layout: 'big-stat',
      props: { number: '82%', label: 'of releases shipped on the day they merged' },
    },
  ],
} as const;

export const SLIDES_MARKDOWN_DECK = `---
title: Quarterly update
locale: en
theme: ocean
---

<!-- .slide: id=opening layout=title-hero -->

# Quarterly update

Fictional numbers for Northwind
`;

export const SLIDES_PARSE_JSON_SAMPLE = `import { parseDeck } from '@texuli/deck/model';

const result = parseDeck(${JSON.stringify(SLIDES_JSON_DECK, null, 2)});

if (result.ok) {
  console.log(result.deck.slides.length);
}
`;

export const SLIDES_PARSE_MARKDOWN_SAMPLE = `import { parseDeckMarkdown } from '@texuli/deck/markdown';
import { validateDeckBlock } from '@texuli/slides/stage';

const result = parseDeckMarkdown(${JSON.stringify(SLIDES_MARKDOWN_DECK)}, {
  validateBlock: validateDeckBlock,
});

if (result.ok) {
  console.log(result.deck.slides.map((slide) => slide.id));
}
`;

export const SLIDES_STAGE_SAMPLE = `<script lang="ts">
  import '@texuli/slides/styles.css';
  import { DeckStage } from '@texuli/slides/stage';

  const deck = ${JSON.stringify(SLIDES_JSON_DECK, null, 2)};
</script>

<DeckStage {deck} />
`;

export function slidesQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a deck',
    install: { label: 'Install', language: 'bash', code: SLIDES_INSTALL },
    samples: [
      { label: 'Parse a JSON deck', language: 'ts', code: SLIDES_PARSE_JSON_SAMPLE },
      { label: 'Parse a Markdown deck', language: 'ts', code: SLIDES_PARSE_MARKDOWN_SAMPLE },
      { label: 'Present with DeckStage', language: 'svelte', code: SLIDES_STAGE_SAMPLE },
    ],
    verifiedBy: SLIDES_QUICKSTART_VERIFIED_BY,
  };
}
