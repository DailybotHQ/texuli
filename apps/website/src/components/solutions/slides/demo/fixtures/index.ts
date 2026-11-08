import { createDeckController, type SchedulerClock } from '@texuli/deck/engine';
import { type Deck, getDeckLayout, parseDeck } from '@texuli/deck/model';

export const SLIDES_DEMO_SCENARIOS = [
  { id: 'texuli-in-motion', label: 'Texuli in motion' },
  { id: 'investor-pitch', label: 'Investor pitch' },
  { id: 'data-report', label: 'Data report' },
  { id: 'product-walkthrough', label: 'Product walkthrough' },
] as const;

export type SlidesDemoScenarioId = (typeof SLIDES_DEMO_SCENARIOS)[number]['id'];

const DEMO_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPgK5nwHwADuAISVL3raQAAAABJRU5ErkJggg==';

type LayoutId =
  | 'title-hero'
  | 'two-column-split'
  | 'chart'
  | 'image-centered'
  | 'process-steps'
  | 'three-column-cards'
  | 'big-stat'
  | 'closing-cta'
  | 'quote'
  | 'section-divider';

function layoutSample(id: LayoutId): Record<string, unknown> {
  const entry = getDeckLayout(id);
  if (entry?.kind !== 'props') throw new Error(`Missing deck layout sample: ${id}`);
  return JSON.parse(JSON.stringify(entry.sample)) as Record<string, unknown>;
}

function makeSlide(id: string, layout: LayoutId, overrides: Record<string, unknown> = {}) {
  const props = { ...layoutSample(layout), ...overrides };
  if (layout === 'image-centered') {
    const image = props.image;
    if (image && typeof image === 'object' && !Array.isArray(image)) {
      props.image = {
        ...image,
        src: DEMO_IMAGE,
        alt: 'A small grid of connected interface pieces',
      };
    }
  }
  return { id, layout, props };
}

const definitions: Record<SlidesDemoScenarioId, { title: string; slides: unknown[] }> = {
  'texuli-in-motion': {
    title: 'Texuli in motion',
    slides: [
      makeSlide('pieces', 'title-hero', {
        title: 'Presentations, built from pieces',
        subtitle: 'A fictional product story, assembled with the Texuli deck model.',
        meta: 'Texuli demo · Example data',
      }),
      makeSlide('compare', 'two-column-split', {
        title: 'From static pages to live interfaces',
        left: { heading: 'Before', body: 'One fixed layout, copied by hand for each update.' },
        right: {
          heading: 'With Texuli',
          body: 'Structured slides that combine reusable layouts and components.',
        },
      }),
      makeSlide('signal', 'chart', {
        title: 'A small fictional release trend',
        spec: {
          kind: 'bar',
          title: 'Example releases',
          description: 'Fictional monthly releases from Example Co.',
          series: [
            {
              id: 'releases',
              label: 'Releases',
              points: [
                { x: 'Jan', y: 8 },
                { x: 'Feb', y: 13 },
                { x: 'Mar', y: 18 },
              ],
            },
          ],
        },
      }),
      makeSlide('picture', 'image-centered', {
        title: 'One safe, local image fixture',
        caption: 'A bundled data image keeps this example network-free.',
      }),
      makeSlide('process', 'process-steps', {
        title: 'From model to stage',
        steps: [
          { title: 'Describe', body: 'Write a deck as structured data.' },
          { title: 'Validate', body: 'Check the model before it paints.' },
          { title: 'Present', body: 'Navigate it on the Texuli stage.' },
        ],
      }),
      makeSlide('composable', 'three-column-cards', {
        title: 'One deck, composed from parts',
        cards: [
          {
            icon: 'layers',
            heading: 'Layouts',
            body: 'Choose a tested arrangement for each idea.',
          },
          { icon: 'chart', heading: 'Components', body: 'Place real data views beside the story.' },
          { icon: 'repeat', heading: 'Models', body: 'Keep content structured and reusable.' },
        ],
      }),
      makeSlide('close', 'closing-cta', {
        title: 'Build your next presentation',
        text: 'Explore the deck model and the stage that renders it.',
        cta: { label: 'Read the deck guide', href: 'https://example.com/deck-guide' },
        footnote: 'Fictional example content.',
      }),
    ],
  },
  'investor-pitch': {
    title: 'Investor pitch',
    slides: [
      makeSlide('opening', 'title-hero', {
        title: 'A clearer weekly review',
        subtitle: 'A fictional investor pitch from Harborline',
        meta: 'Example Co. · 2026',
      }),
      makeSlide('problem', 'big-stat', {
        number: '6 hrs',
        label: 'spent assembling one weekly update',
        context: 'Fictional team survey',
        source: 'example.com',
      }),
      makeSlide('solution', 'three-column-cards', { title: 'A simpler workflow' }),
      makeSlide('plan', 'process-steps', { title: 'A three-step rollout' }),
      makeSlide('close', 'closing-cta', {
        title: 'Make the next review easier',
        text: 'Start with one structured deck.',
        cta: { label: 'See the example', href: 'https://example.com/pitch' },
      }),
    ],
  },
  'data-report': {
    title: 'Data report',
    slides: [
      makeSlide('opening', 'title-hero', {
        title: 'Quarterly signals',
        subtitle: 'A fictional report for Example Co.',
      }),
      makeSlide('trend', 'chart', { title: 'Monthly activity' }),
      makeSlide('headline', 'big-stat', {
        number: '18%',
        label: 'example quarter-over-quarter change',
        context: 'Fictional sample metric',
        source: 'example.com',
      }),
      makeSlide('readout', 'two-column-split', {
        title: 'What changed',
        left: { heading: 'Signal', body: 'Activity rose steadily across the sample period.' },
        right: { heading: 'Next step', body: 'Review the inputs before changing the forecast.' },
      }),
      makeSlide('close', 'closing-cta', {
        title: 'Review the assumptions',
        text: 'All figures in this fixture are fictional.',
        cta: { label: 'Open report notes', href: 'https://example.com/report' },
      }),
    ],
  },
  'product-walkthrough': {
    title: 'Product walkthrough',
    slides: [
      makeSlide('opening', 'title-hero', {
        title: 'A product, one step at a time',
        subtitle: 'A fictional Example Co. walkthrough',
      }),
      makeSlide('context', 'section-divider', {
        title: 'Start with the task',
        eyebrow: 'Walkthrough',
      }),
      makeSlide('screen', 'image-centered', {
        title: 'See the main workspace',
        caption: 'The embedded fixture image is local data.',
      }),
      makeSlide('flow', 'process-steps', { title: 'Three steps to a result' }),
      makeSlide('voice', 'quote', {
        quote: 'The next action is clear, and the review stays in context.',
        cite: 'A fictional Example Co. teammate',
      }),
      makeSlide('close', 'closing-cta', {
        title: 'Continue exploring',
        text: 'Use the demo controls to move through this deck.',
        cta: { label: 'Read the guide', href: 'https://example.com/walkthrough' },
      }),
    ],
  },
};

export function getSlidesDemoFixture(id: SlidesDemoScenarioId): Deck {
  const definition = definitions[id];
  const parsed = parseDeck({
    formatVersion: 2,
    meta: {
      title: definition.title,
      description: 'A deterministic, fictional Texuli slides demo.',
    },
    style: { theme: 'ocean', aspect: '16:9', transition: 'fade' },
    navigation: { start: definition.slides[0] && (definition.slides[0] as { id: string }).id },
    slides: definition.slides,
  });
  if (!parsed.ok || !parsed.deck) {
    throw new Error(
      parsed.issues.map(({ message }) => message).join('; ') || `Invalid fixture: ${id}`
    );
  }
  return parsed.deck;
}

export function createSlidesDemoController(deck: Deck, clock?: SchedulerClock) {
  const controller = createDeckController(deck, {
    autoSlideMs: 5_000,
    autoSlidePaused: true,
    clock,
  });
  // The public controller's paused flag and scheduler must agree before Play can resume.
  controller.pause();
  return controller;
}
