import { defineExample } from '../registry.ts';

const component = 'texuli/Carousel';

export const carouselExamples = [
  defineExample({
    id: 'ui-carousel',
    title: 'Carousel',
    description:
      'A labelled carousel of fictional destinations with previous and next buttons and a slide picker that roves with the arrow keys.',
    tags: ['ui', 'carousel', 'keyboard'],
    component,
    props: ['items', 'index', 'label', 'children'],
    load: () => import('./CarouselDefaultDemo.svelte'),
  }),
  defineExample({
    id: 'ui-carousel-overlay',
    title: 'Carousel with overlay controls',
    description: 'The previous and next buttons sit on the inline edges of the slides.',
    tags: ['ui', 'carousel', 'variant'],
    component,
    props: ['controls'],
    load: () => import('./CarouselOverlayDemo.svelte'),
  }),
  defineExample({
    id: 'ui-carousel-autoplay',
    title: 'Carousel with autoplay',
    description:
      'Rotates every four seconds with a rotation control first in tab order; hovering pauses it, keyboard focus stops it, and reduced motion keeps it off.',
    tags: ['ui', 'carousel', 'autoplay', 'motion'],
    component,
    props: ['autoplay', 'interval', 'onPlayingChange'],
    load: () => import('./CarouselAutoplayDemo.svelte'),
  }),
  defineExample({
    id: 'ui-carousel-states',
    title: 'Carousel states',
    description:
      'No loop at the first slide, buttons without a picker, a single slide with no controls, and translated labels.',
    tags: ['ui', 'carousel', 'states', 'i18n'],
    component,
    props: ['loop', 'showDots', 'showControls', 'messages'],
    load: () => import('./CarouselStatesDemo.svelte'),
  }),
  defineExample({
    id: 'ui-carousel-rtl',
    title: 'Carousel, right to left',
    description:
      'Arabic labels in a right-to-left layout: the slides, arrows, swipe and edge buttons all follow the inline direction.',
    tags: ['ui', 'carousel', 'rtl', 'i18n'],
    component,
    props: ['messages', 'controls'],
    load: () => import('./CarouselRtlDemo.svelte'),
  }),
  defineExample({
    id: 'ui-carousel-dark',
    title: 'Carousel on a dark surface',
    description: 'The same carousel on a dark color scheme, using only token fallbacks.',
    tags: ['ui', 'carousel', 'dark'],
    component,
    load: () => import('./CarouselDarkDemo.svelte'),
  }),
] as const;
