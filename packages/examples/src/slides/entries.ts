import { defineExample } from '../registry.ts';

/**
 * Slides examples (T-p7-deck-visual): the starter templates, a media deck,
 * reveal steps, slot masters and the presenter screen.
 */
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

export const slidesSlotMastersExample = defineExample({
  id: 'slides-slot-masters',
  title: 'Slot masters (print view)',
  description:
    'Every slide of a slot-master deck in DeckPrint: dividers split blocks into a title footer, two columns with a footer, and a quote with its attribution. Fictional Example Co. data.',
  tags: ['slides', 'deck', 'masters', 'print'],
  component: 'slides/DeckPrint',
  props: ['deck', 'loadTheme', 'mediaTrust', 'onReady'],
  load: () => import('./SlotMastersDeckDemo.svelte'),
});

export const slidesPresenterScreenExample = defineExample({
  id: 'slides-presenter-screen',
  title: 'Presenter screen',
  description:
    'DeckStage in presenter mode at reveal step 1 of 4: the slide, speaker notes with the step progress, and the next step. Timer-free, so the view is deterministic.',
  tags: ['slides', 'deck', 'presenter'],
  component: 'slides/DeckStage',
  props: ['deck', 'initialSlideId', 'initialStep', 'presenter', 'loadTheme', 'mediaTrust'],
  load: () => import('./PresenterScreenDemo.svelte'),
});

export const slidesTourExample = defineExample({
  id: 'slides-tour',
  title: 'Slides tour',
  description:
    'One DeckStage deck that tours the stage: slot masters, reveal steps, code highlights, speaker notes for the presenter view, the overview and fullscreen. Fictional Example Co. content.',
  tags: ['slides', 'deck', 'fragments', 'masters', 'presenter'],
  component: 'slides/DeckStage',
  props: ['deck', 'loadTheme', 'mediaTrust'],
  load: () => import('./TourDeckDemo.svelte'),
});
