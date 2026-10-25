import { defineExample } from '../registry.ts';

/** Slides examples (T-p7-deck-visual): the starter templates, a media deck and reveal steps. */
export const slidesReportExample = defineExample({
  id: 'slides-template-report',
  title: 'Report deck template',
  description:
    'The report starter deck (createDeckFromTemplate) in DeckStage on its media-left trend slide. Fictional Example Co. data.',
  tags: ['slides', 'deck', 'template'],
  component: 'slides/DeckStage',
  props: ['deck', 'initialSlideId', 'loadTheme', 'mediaTrust'],
  load: () => import('./ReportDeckDemo.svelte'),
});

export const slidesPitchExample = defineExample({
  id: 'slides-template-pitch',
  title: 'Pitch deck template',
  description:
    'The pitch starter deck in DeckStage on its media-right solution slide. Fictional Harborline copy.',
  tags: ['slides', 'deck', 'template'],
  component: 'slides/DeckStage',
  props: ['deck', 'initialSlideId', 'loadTheme', 'mediaTrust'],
  load: () => import('./PitchDeckDemo.svelte'),
});

export const slidesReviewExample = defineExample({
  id: 'slides-template-review',
  title: 'Review deck template',
  description:
    'The review starter deck in DeckStage on its media-left demo slide with a code block. Fictional sprint data.',
  tags: ['slides', 'deck', 'template'],
  component: 'slides/DeckStage',
  props: ['deck', 'initialSlideId', 'loadTheme', 'mediaTrust'],
  load: () => import('./ReviewDeckDemo.svelte'),
});

export const slidesMediaDeckExample = defineExample({
  id: 'slides-media-deck',
  title: 'Media deck (print view)',
  description:
    'Every slide of a media deck in DeckPrint: a media-left figure (cover fit), a media-right image and a body gallery. Embedded swatches only.',
  tags: ['slides', 'deck', 'media', 'print'],
  component: 'slides/DeckPrint',
  props: ['deck', 'loadTheme', 'mediaTrust', 'onReady'],
  load: () => import('./MediaDeckDemo.svelte'),
});

export const slidesFragmentsExample = defineExample({
  id: 'slides-fragments',
  title: 'Reveal steps (fragments)',
  description:
    'A DeckStage slide at reveal step 2 of 4: two of three list items shown, a line struck through, and a callout still hidden in its reserved space. Fictional launch plan.',
  tags: ['slides', 'deck', 'fragments'],
  component: 'slides/DeckStage',
  props: ['deck', 'initialSlideId', 'initialStep', 'loadTheme', 'mediaTrust'],
  load: () => import('./FragmentsDeckDemo.svelte'),
});
