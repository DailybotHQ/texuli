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

/**
 * Deck model v2 layout examples (T-layouts-backgrounds): one `DeckStage` per
 * catalog layout (the stage's default layout renderers paint it) and the
 * backgrounds gallery. Fictional Harborline and Example Co. content.
 */
export const slidesLayoutTitleHeroExample = defineExample({
  id: 'slides-layout-title-hero',
  title: 'Layout: title-hero',
  description:
    'The cover: title, subtitle and a meta line over decorative accent shapes. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/TitleHeroExample.svelte'),
});

export const slidesLayoutSectionDividerExample = defineExample({
  id: 'slides-layout-section-divider',
  title: 'Layout: section-divider',
  description:
    'A chapter break: an eyebrow and a large title beside an accent rule. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/SectionDividerExample.svelte'),
});

export const slidesLayoutTwoColumnSplitExample = defineExample({
  id: 'slides-layout-two-column-split',
  title: 'Layout: two-column-split',
  description:
    'Two parallel text panels (before and after) under a title. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/TwoColumnSplitExample.svelte'),
});

export const slidesLayoutThreeColumnCardsExample = defineExample({
  id: 'slides-layout-three-column-cards',
  title: 'Layout: three-column-cards',
  description:
    'Three parallel cards with numbered tiles, headings and bodies. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ThreeColumnCardsExample.svelte'),
});

export const slidesLayoutImageLeftExample = defineExample({
  id: 'slides-layout-image-left',
  title: 'Layout: image-left',
  description:
    'A media pane on the inline start with the copy beside it. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ImageLeftExample.svelte'),
});

export const slidesLayoutImageRightExample = defineExample({
  id: 'slides-layout-image-right',
  title: 'Layout: image-right',
  description: 'Copy first, then the media pane on the inline end. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ImageRightExample.svelte'),
});

export const slidesLayoutImageCenteredExample = defineExample({
  id: 'slides-layout-image-centered',
  title: 'Layout: image-centered',
  description:
    'One image is the focus, fitted inside its frame, with a caption. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ImageCenteredExample.svelte'),
});

export const slidesLayoutImageFullBleedExample = defineExample({
  id: 'slides-layout-image-full-bleed',
  title: 'Layout: image-full-bleed',
  description:
    'The image edge to edge with a dark overlay and a caption band. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ImageFullBleedExample.svelte'),
});

export const slidesLayoutQuoteExample = defineExample({
  id: 'slides-layout-quote',
  title: 'Layout: quote',
  description:
    'One pull quote with its attribution and a decorative quote mark. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/QuoteExample.svelte'),
});

export const slidesLayoutCodeWithCalloutExample = defineExample({
  id: 'slides-layout-code-with-callout',
  title: 'Layout: code-with-callout',
  description:
    'A tokenized code block at its first highlight step beside the explanation. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/CodeWithCalloutExample.svelte'),
});

export const slidesLayoutBigStatExample = defineExample({
  id: 'slides-layout-big-stat',
  title: 'Layout: big-stat',
  description: 'One large number with its label, context and source. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/BigStatExample.svelte'),
});

export const slidesLayoutComparisonTableExample = defineExample({
  id: 'slides-layout-comparison-table',
  title: 'Layout: comparison-table',
  description:
    'Three plans across four attributes, with yes, no and empty cells. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ComparisonTableExample.svelte'),
});

export const slidesLayoutProcessStepsExample = defineExample({
  id: 'slides-layout-process-steps',
  title: 'Layout: process-steps',
  description: 'Four numbered, connected steps. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ProcessStepsExample.svelte'),
});

export const slidesLayoutTimelineExample = defineExample({
  id: 'slides-layout-timeline',
  title: 'Layout: timeline',
  description: 'Five dated events on two axis rows. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/TimelineExample.svelte'),
});

export const slidesLayoutTeamAvatarsExample = defineExample({
  id: 'slides-layout-team-avatars',
  title: 'Layout: team-avatars',
  description:
    'Four people with initials (no avatar adapter in the example). DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/TeamAvatarsExample.svelte'),
});

export const slidesLayoutClosingCtaExample = defineExample({
  id: 'slides-layout-closing-cta',
  title: 'Layout: closing-cta',
  description:
    'The last slide with its call-to-action link and a footnote. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ClosingCtaExample.svelte'),
});

export const slidesLayoutVideoCenteredExample = defineExample({
  id: 'slides-layout-video-centered',
  title: 'Layout: video-centered',
  description:
    'One video player is the focus (the example clip path has no file, so the player shows its fallback). DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/VideoCenteredExample.svelte'),
});

export const slidesLayoutVideoLeftExample = defineExample({
  id: 'slides-layout-video-left',
  title: 'Layout: video-left',
  description:
    'A video player on the inline start with the copy beside it. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/VideoLeftExample.svelte'),
});

export const slidesLayoutVideoRightExample = defineExample({
  id: 'slides-layout-video-right',
  title: 'Layout: video-right',
  description: 'Copy first, then the video player on the inline end. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/VideoRightExample.svelte'),
});

export const slidesLayoutChartExample = defineExample({
  id: 'slides-layout-chart',
  title: 'Layout: chart',
  description: 'A bar chart block with its data table beside it. DeckStage, deck model v2.',
  tags: ['slides', 'deck', 'layout'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme', 'renderers'],
  load: () => import('./layouts/ChartExample.svelte'),
});

export const slidesBackgroundsExample = defineExample({
  id: 'slides-backgrounds',
  title: 'Deck backgrounds gallery',
  description:
    'Every background preset (solid, gradient, pattern) and one spec of each kind (hex solid, angled gradient, light and dark image) under a free slide, each with its contrast scrim.',
  tags: ['slides', 'deck', 'backgrounds'],
  component: 'slides/DeckStage',
  props: ['deck', 'tier', 'loadTheme'],
  load: () => import('./BackgroundsGalleryDemo.svelte'),
});
