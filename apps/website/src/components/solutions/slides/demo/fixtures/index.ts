import { createDeckController, type SchedulerClock } from '@texuli/deck/engine';
import { type Deck, getDeckLayout, parseDeck } from '@texuli/deck/model';

/**
 * The Slides landing demo decks. Each scenario shows a different side of the deck model:
 * its own library theme, per-slide backgrounds, real images and the richer layouts (charts,
 * timelines, comparisons, code with callouts). Texuli facts are real and dated; every other
 * name and number is fictional and says so.
 *
 * Images are the site's own illustrations, copied at 960 px to
 * `public/solutions/slides/demo-media/` and referenced as relative paths
 * (`demo-media/<name>.webp`), which resolve next to the landing at
 * `/solutions/slides/demo-media/`. Site-authored decks paint at the `developer` tier.
 */
export const SLIDES_DEMO_SCENARIOS = [
  { id: 'texuli-in-motion', label: 'Texuli launch keynote' },
  { id: 'investor-pitch', label: 'Investor pitch' },
  { id: 'data-report', label: 'Quarterly business review' },
  { id: 'product-walkthrough', label: 'Product walkthrough' },
  { id: 'engineering-deep-dive', label: 'Engineering deep dive' },
] as const;

export type SlidesDemoScenarioId = (typeof SLIDES_DEMO_SCENARIOS)[number]['id'];

/** The folder of demo images, relative to the landing page. */
export const SLIDES_DEMO_MEDIA = 'demo-media';

type LayoutId =
  | 'title-hero'
  | 'section-divider'
  | 'two-column-split'
  | 'three-column-cards'
  | 'image-left'
  | 'image-right'
  | 'image-centered'
  | 'quote'
  | 'code-with-callout'
  | 'big-stat'
  | 'comparison-table'
  | 'process-steps'
  | 'timeline'
  | 'closing-cta'
  | 'chart';

type Background =
  | { kind: 'gradient'; gradient: 'brand' | 'dusk' | 'dawn' | 'forest' | 'mist'; angle?: number }
  | { kind: 'pattern'; pattern: 'dots' | 'grid' }
  | {
      kind: 'solid';
      token?: 'background' | 'surface' | 'primary' | 'accent' | 'muted' | 'inverse';
    };

interface SlideOptions {
  background?: Background;
  notes?: string;
}

/** The demo images: file name, size and alt text. */
const IMAGES = {
  pieces: {
    file: 'texuli-pieces.webp',
    width: 960,
    height: 800,
    alt: 'Violet and orange cubes assembling into a dashboard window',
  },
  agents: {
    file: 'texuli-agents.webp',
    width: 960,
    height: 600,
    alt: 'An agent orb sending interface tiles through a validation gate',
  },
  webNative: {
    file: 'texuli-web-native.webp',
    width: 960,
    height: 600,
    alt: 'One blueprint branching into a browser window and a phone',
  },
  slides: {
    file: 'slides.webp',
    width: 960,
    height: 800,
    alt: 'A presentation window with charts and a slide strip built from cubes',
  },
  documents: {
    file: 'documents.webp',
    width: 960,
    height: 800,
    alt: 'Stacked document pages with a checklist and an image block',
  },
  workflows: {
    file: 'workflows.webp',
    width: 960,
    height: 600,
    alt: 'Workflow steps joined by arrows, with an approval check',
  },
  canvas: {
    file: 'canvas.webp',
    width: 960,
    height: 800,
    alt: 'A whiteboard with sticky notes, a framed image and connectors',
  },
  sheets: {
    file: 'sheets.webp',
    width: 960,
    height: 800,
    alt: 'A spreadsheet window with a formula bar and a bar chart card',
  },
  designSystems: {
    file: 'design-systems.webp',
    width: 960,
    height: 800,
    alt: 'A locked design system document guarding themed component cubes',
  },
  review: {
    file: 'review.webp',
    width: 960,
    height: 600,
    alt: 'Draft slides flowing through a check into a finished deck',
  },
} as const;

type ImageKey = keyof typeof IMAGES;

function image(key: ImageKey) {
  const { file, ...rest } = IMAGES[key];
  return { src: `${SLIDES_DEMO_MEDIA}/${file}`, ...rest };
}

function layoutSample(id: LayoutId): Record<string, unknown> {
  const entry = getDeckLayout(id);
  if (entry?.kind !== 'props') throw new Error(`Missing deck layout sample: ${id}`);
  return JSON.parse(JSON.stringify(entry.sample)) as Record<string, unknown>;
}

function makeSlide(
  id: string,
  layout: LayoutId,
  overrides: Record<string, unknown> = {},
  options: SlideOptions = {}
) {
  return {
    id,
    layout,
    props: { ...layoutSample(layout), ...overrides },
    ...(options.background ? { background: options.background } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
  };
}

const series = (id: string, label: string, values: readonly [string, number][]) => ({
  id,
  label,
  points: values.map(([x, y]) => ({ x, y })),
});

const definitions: Record<
  SlidesDemoScenarioId,
  { title: string; theme: string; slides: unknown[] }
> = {
  'texuli-in-motion': {
    title: 'Texuli launch keynote',
    theme: 'violet',
    slides: [
      makeSlide(
        'pieces',
        'title-hero',
        {
          title: 'Small pieces. Infinite possibilities.',
          subtitle: 'An open-source interface library, owned end to end, for humans and agents.',
          meta: 'Texuli · Open source · MIT',
        },
        { background: { kind: 'gradient', gradient: 'brand', angle: 135 } }
      ),
      makeSlide('compare', 'image-right', {
        title: 'From a texel to a complete product',
        image: image('pieces'),
        heading: 'Every layer is yours',
        body: 'Framework-free behaviors compose into owned primitives, styled components, and complete Solutions such as decks, documents and sheets.',
      }),
      makeSlide(
        'packages',
        'big-stat',
        {
          number: '26',
          label: 'packages on npm, released together',
          context: 'Every package ships the same version, with exact pins between them.',
          source: 'npm, November 2026 (0.17 line)',
        },
        { background: { kind: 'pattern', pattern: 'dots' } }
      ),
      makeSlide('layers', 'three-column-cards', {
        title: 'Three ideas behind the library',
        cards: [
          {
            icon: 'layers',
            heading: 'Owned primitives',
            body: '42 headless primitives on WAI-ARIA patterns, with no other component library underneath.',
          },
          {
            icon: 'palette',
            heading: 'Themes as data',
            body: '210 themes and one JSON document per brand, compiled with contrast guarantees.',
          },
          {
            icon: 'bot',
            heading: 'Safe for agents',
            body: 'A closed catalog of 199 components renders agent output without HTML sinks.',
          },
        ],
      }),
      makeSlide('history', 'timeline', {
        title: 'Three weeks of public releases',
        events: [
          { time: 'Oct 25', text: 'First public preview on npm' },
          { time: 'Oct 31', text: 'Design systems: one document per brand (0.10.0)' },
          { time: 'Nov 9', text: 'Locked design systems and the kit (0.15.0, 0.16.0)' },
          { time: 'Nov 10', text: 'Blueprint spec 0.15.0 and the 0.17 line' },
        ],
      }),
      makeSlide('agents', 'image-left', {
        title: 'Built for humans and agents',
        image: image('agents'),
        heading: 'Validated before it paints',
        body: 'Agents emit blueprints against a closed catalog. Texuli validates them, then each renderer paints only what it supports.',
      }),
      makeSlide(
        'close',
        'closing-cta',
        {
          title: 'Build your next interface',
          text: 'Start with one package, or a complete Solution.',
          cta: { label: 'Explore the Solutions', href: 'https://texuli.com/solutions/' },
          footnote: 'Counts from texuli.com and npm, November 2026.',
        },
        { background: { kind: 'gradient', gradient: 'dusk', angle: 160 } }
      ),
    ],
  },
  'investor-pitch': {
    title: 'Investor pitch',
    theme: 'aurora-analytics',
    slides: [
      makeSlide(
        'opening',
        'title-hero',
        {
          title: 'Harborline: weekly reviews in minutes',
          subtitle: 'A fictional seed pitch, written as a structured deck.',
          meta: 'Harborline (fictional) · Seed round · 2026',
        },
        { background: { kind: 'gradient', gradient: 'mist', angle: 120 } }
      ),
      makeSlide('problem', 'big-stat', {
        number: '6 hrs',
        label: 'a week spent assembling one status update',
        context: 'Fictional survey of 40 example teams',
        source: 'example.com research (fictional)',
      }),
      makeSlide('solution', 'image-right', {
        title: 'One deck, generated from the work',
        image: image('review'),
        heading: 'Drafts check themselves',
        body: 'Harborline turns the week’s changes into a validated deck: every chart, quote and number traced to its source.',
      }),
      makeSlide('traction', 'chart', {
        title: 'Weekly active teams',
        spec: {
          kind: 'area',
          title: 'Weekly active teams (fictional)',
          description: 'Active teams grew from 12 in January to 148 in June.',
          series: [
            series('teams', 'Active teams', [
              ['Jan', 12],
              ['Feb', 24],
              ['Mar', 41],
              ['Apr', 67],
              ['May', 102],
              ['Jun', 148],
            ]),
          ],
        },
        height: 'lg',
        showTable: false,
      }),
      makeSlide('market', 'comparison-table', {
        title: 'Why teams switch',
        columns: ['Slides by hand', 'Harborline'],
        rows: [
          { label: 'Time per update', values: ['6 hours', '20 minutes'] },
          { label: 'Numbers traced to source', values: [false, true] },
          { label: 'Accessible by default', values: [false, true] },
          { label: 'Export to PDF and PPTX', values: [true, true] },
        ],
      }),
      makeSlide('plan', 'process-steps', {
        title: 'Use of funds',
        steps: [
          { title: 'Build', body: 'Two engineers on the importers.' },
          { title: 'Launch', body: 'Open beta with 200 teams.' },
          { title: 'Grow', body: 'Self-serve plans by Q4.' },
        ],
      }),
      makeSlide(
        'close',
        'closing-cta',
        {
          title: 'Make the next review easier',
          text: 'Harborline is a fictional company; this deck is example data.',
          cta: { label: 'See the deck model', href: 'https://texuli.com/solutions/slides/' },
        },
        { background: { kind: 'gradient', gradient: 'dawn', angle: 135 } }
      ),
    ],
  },
  'data-report': {
    title: 'Quarterly business review',
    theme: 'ocean',
    slides: [
      makeSlide(
        'opening',
        'title-hero',
        {
          title: 'Q3 business review',
          subtitle: 'Northwind Analytics (fictional), July to September',
          meta: 'Finance · Example data',
        },
        { background: { kind: 'gradient', gradient: 'brand', angle: 200 } }
      ),
      makeSlide('trend', 'chart', {
        title: 'Revenue against plan',
        spec: {
          kind: 'line',
          title: 'Monthly revenue, thousands (fictional)',
          description: 'Revenue passed plan in August and closed September at 412 against 380.',
          series: [
            series('revenue', 'Revenue', [
              ['Apr', 290],
              ['May', 305],
              ['Jun', 322],
              ['Jul', 341],
              ['Aug', 377],
              ['Sep', 412],
            ]),
            series('plan', 'Plan', [
              ['Apr', 300],
              ['May', 315],
              ['Jun', 330],
              ['Jul', 345],
              ['Aug', 362],
              ['Sep', 380],
            ]),
          ],
        },
        height: 'lg',
        showTable: false,
      }),
      makeSlide(
        'headline',
        'big-stat',
        {
          number: '+18%',
          label: 'revenue, quarter over quarter',
          context: 'Driven by the self-serve plan launched in July',
          source: 'Fictional sample metric',
        },
        { background: { kind: 'pattern', pattern: 'grid' } }
      ),
      makeSlide('regions', 'chart', {
        title: 'Revenue by region',
        spec: {
          kind: 'stacked-bar',
          title: 'Quarterly revenue by region, thousands (fictional)',
          description: 'Every region grew; the Americas grew most, from 410 to 520.',
          series: [
            series('americas', 'Americas', [
              ['Q1', 380],
              ['Q2', 410],
              ['Q3', 520],
            ]),
            series('emea', 'EMEA', [
              ['Q1', 240],
              ['Q2', 265],
              ['Q3', 298],
            ]),
            series('apac', 'APAC', [
              ['Q1', 120],
              ['Q2', 150],
              ['Q3', 182],
            ]),
          ],
        },
        height: 'lg',
        showTable: false,
      }),
      makeSlide('readout', 'comparison-table', {
        title: 'Q2 against Q3',
        columns: ['Q2', 'Q3'],
        rows: [
          { label: 'Revenue', values: ['$825k', '$1.0M'] },
          { label: 'Gross margin', values: ['71%', '74%'] },
          { label: 'Net retention', values: ['104%', '109%'] },
          { label: 'On plan', values: [false, true] },
        ],
      }),
      makeSlide('next', 'process-steps', {
        title: 'Q4 priorities',
        steps: [
          { title: 'Retain', body: 'Annual plans for the top 50 accounts.' },
          { title: 'Expand', body: 'Launch in two new regions.' },
          { title: 'Measure', body: 'Weekly revenue review, one deck.' },
        ],
      }),
      makeSlide('close', 'closing-cta', {
        title: 'Questions and next steps',
        text: 'Every figure in this deck is fictional sample data.',
        cta: { label: 'Open the report notes', href: 'https://example.com/q3-notes' },
      }),
    ],
  },
  'product-walkthrough': {
    title: 'Product walkthrough',
    theme: 'emerald',
    slides: [
      makeSlide(
        'opening',
        'title-hero',
        {
          title: 'Complete systems, built from small pieces',
          subtitle: 'A walkthrough of four Texuli Solutions.',
          meta: 'Texuli Solutions · Product tour',
        },
        { background: { kind: 'gradient', gradient: 'forest', angle: 140 } }
      ),
      makeSlide('documents', 'image-right', {
        title: 'Documents',
        image: image('documents'),
        heading: 'Edit, read and export one model',
        body: 'Every change is a typed operation with undo. The same document exports to Markdown, DOCX and PDF.',
      }),
      makeSlide('workflows', 'image-left', {
        title: 'Workflows',
        image: image('workflows'),
        heading: 'Graphs that refuse invalid changes',
        body: 'Typed nodes and ports, a deterministic layout and a keyboard outline for every step.',
      }),
      makeSlide('canvas', 'image-right', {
        title: 'Canvas',
        image: image('canvas'),
        heading: 'Give every idea room to connect',
        body: 'Shapes, notes, frames and connectors, moved by keyboard and exported to SVG or PNG.',
      }),
      makeSlide('sheets', 'image-left', {
        title: 'Sheets',
        image: image('sheets'),
        heading: 'Formulas built to recalculate',
        body: 'An owned formula engine, a keyboard grid, and CSV that never injects formulas.',
      }),
      makeSlide(
        'voice',
        'quote',
        {
          quote:
            'We embedded a complete editor in an afternoon, and it already passed our accessibility review.',
          cite: 'A fictional product lead at Example Co.',
        },
        { background: { kind: 'solid', token: 'muted' } }
      ),
      makeSlide('close', 'closing-cta', {
        title: 'Pick a Solution and start',
        text: 'Every Solution is a set of npm packages you install and own.',
        cta: { label: 'See all Solutions', href: 'https://texuli.com/solutions/' },
      }),
    ],
  },
  'engineering-deep-dive': {
    title: 'Engineering deep dive',
    theme: 'midnight-ops',
    slides: [
      makeSlide(
        'opening',
        'section-divider',
        { eyebrow: 'Engineering deep dive', title: 'Decks are data, checked before they paint' },
        { background: { kind: 'gradient', gradient: 'dusk', angle: 150 } }
      ),
      makeSlide('parse', 'code-with-callout', {
        title: 'Parse, then present',
        code: {
          lang: 'ts',
          source:
            "import { parseDeck } from '@texuli/deck/model';\n\nconst result = parseDeck(json);\nif (!result.ok) {\n  result.issues.forEach(report);\n} else {\n  present(result.deck);\n}",
          highlights: ['3', '5'],
        },
        heading: 'Every issue at once',
        bullets: [
          'The parser never throws on input',
          'Each issue carries a path and a fix',
          'Agents correct the deck before anyone presents it',
        ],
      }),
      makeSlide('pipeline', 'process-steps', {
        title: 'From JSON to the stage',
        steps: [
          { title: 'Parse', body: 'JSON or the Markdown dialect, one model.' },
          { title: 'Validate', body: 'Layouts, blocks and media checked.' },
          { title: 'Resolve', body: 'Theme, density and transitions.' },
          { title: 'Paint', body: 'The stage scales a fixed canvas.' },
        ],
      }),
      makeSlide('trust', 'comparison-table', {
        title: 'Two paint tiers',
        columns: ['Developer', 'Untrusted'],
        rows: [
          { label: 'Who writes the deck', values: ['Your app', 'Agents and users'] },
          { label: 'Relative media paths', values: [true, false] },
          { label: 'HTML in text', values: [false, false] },
          { label: 'URL policy at paint', values: [true, true] },
        ],
      }),
      makeSlide('systems', 'image-right', {
        title: 'Themes from one brand document',
        image: image('designSystems'),
        heading: 'Locked design systems',
        body: 'A deck can name any of 210 library themes or a brand’s own design system, compiled with contrast guarantees.',
      }),
      makeSlide('portable', 'image-left', {
        title: 'One blueprint, many renderers',
        image: image('webNative'),
        heading: 'Web today, native in development',
        body: 'The same validated contract feeds the web player and the Compose renderer in development.',
      }),
      makeSlide(
        'close',
        'closing-cta',
        {
          title: 'Read the deck model',
          text: 'The format, the parser and the stage are documented and open source.',
          cta: {
            label: 'Open the Slides guide',
            href: 'https://texuli.com/guides/solutions/slides/',
          },
        },
        { background: { kind: 'gradient', gradient: 'dusk', angle: 200 } }
      ),
    ],
  },
};

export function getSlidesDemoFixture(id: SlidesDemoScenarioId): Deck {
  const definition = definitions[id];
  const parsed = parseDeck({
    formatVersion: 2,
    meta: {
      title: definition.title,
      description: 'A deterministic Texuli slides demo with fictional example data.',
    },
    style: {
      theme: definition.theme,
      aspect: '16:9',
      transition: 'slide',
      progress: 'bottom',
    },
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
