import {
  type Deck,
  type DeckAspect,
  type DeckThemeReference,
  parseDeck,
  type SlideMasterId,
} from '../model/index.ts';

/**
 * Starter decks: plain deck data built from the existing model, masters and
 * block types, so they validate, render, print and export like any deck.
 * Every slide inherits the deck theme, so one `themeRef` rebrands a deck.
 */
export const DECK_TEMPLATE_IDS = ['report', 'pitch', 'review'] as const;
export type DeckTemplateId = (typeof DECK_TEMPLATE_IDS)[number];

/** An image the template places in a media slot; replace the placeholder paths with real assets. */
export interface DeckTemplateImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface DeckTemplateOptions {
  title?: string;
  /** Catalog theme id or reference; replaces the template default for every slide. */
  themeRef?: string | DeckThemeReference;
  aspect?: DeckAspect;
  /** Language tag such as en or en-GB. */
  locale?: string;
  /** Images by template slot name (see each template's `imageSlots`). */
  images?: Readonly<Record<string, DeckTemplateImage>>;
}

export interface DeckTemplate {
  id: DeckTemplateId;
  label: string;
  description: string;
  /** Default catalog theme id from the token theme library. */
  themeId: string;
  /** Slot names whose images `options.images` can replace, with their placeholder paths. */
  imageSlots: Readonly<Record<string, string>>;
  create(options?: DeckTemplateOptions): Deck;
}

type TemplateSlide = {
  id: string;
  title: string;
  master: SlideMasterId;
  notes?: string;
  blocks: unknown[];
};

function placeholder(path: string, alt: string): DeckTemplateImage {
  return { src: path, alt, width: 1280, height: 720 };
}

function imageBlock(image: DeckTemplateImage, caption?: string) {
  return {
    type: caption ? 'figure' : 'image',
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
    ...(caption ? { caption } : {}),
  };
}

function build(
  template: Pick<DeckTemplate, 'id' | 'themeId'>,
  defaultTitle: string,
  slides: TemplateSlide[],
  options: DeckTemplateOptions
): Deck {
  const masters = [...new Set(slides.map((slide) => slide.master))];
  const parsed = parseDeck({
    meta: {
      title: options.title ?? defaultTitle,
      aspect: options.aspect ?? '16:9',
      themeRef: options.themeRef ?? template.themeId,
      ...(options.locale !== undefined ? { locale: options.locale } : {}),
    },
    masters,
    settings: { startIndex: 0, loop: false, showProgress: true, defaultTransition: 'fade' },
    slides,
  });
  if (!parsed.success) {
    const issue = parsed.issues[0];
    throw new TypeError(
      `The ${template.id} template is invalid with these options: ${issue?.path} ${issue?.message}`
    );
  }
  return parsed.deck;
}

const REPORT_IMAGES = { chart: 'images/report-trend.png' } as const;
const PITCH_IMAGES = { product: 'images/pitch-product.png' } as const;
const REVIEW_IMAGES = { demo: 'images/review-demo.png' } as const;

function images(
  slots: Readonly<Record<string, string>>,
  options: DeckTemplateOptions,
  alts: Readonly<Record<string, string>>
): Record<string, DeckTemplateImage> {
  return Object.fromEntries(
    Object.entries(slots).map(([slot, path]) => [
      slot,
      options.images?.[slot] ?? placeholder(path, alts[slot] ?? slot),
    ])
  );
}

const report: DeckTemplate = {
  id: 'report',
  label: 'Report',
  description: 'A periodic report: summary, key numbers, a trend, risks and next steps.',
  themeId: 'enterprise-neutral',
  imageSlots: REPORT_IMAGES,
  create(options = {}) {
    const img = images(REPORT_IMAGES, options, { chart: 'Trend chart for the period' });
    return build(
      report,
      'Quarterly report',
      [
        {
          id: 'cover',
          title: options.title ?? 'Quarterly report',
          master: 'title',
          blocks: [{ type: 'heading', level: 2, text: 'Example Co. · Q3' }],
        },
        {
          id: 'summary',
          title: 'Summary',
          master: 'content',
          notes: 'One sentence per bullet; keep the headline number first.',
          blocks: [
            {
              type: 'list',
              items: [
                { text: 'Revenue grew 12% quarter over quarter' },
                { text: 'Churn fell to 2.1%' },
                { text: 'Two launches shipped on schedule' },
              ],
            },
          ],
        },
        {
          id: 'numbers',
          title: 'Key numbers',
          master: 'content',
          blocks: [
            {
              type: 'kpi',
              items: [
                { label: 'Revenue', value: '$1.2M', hint: 'Q3' },
                { label: 'Active teams', value: '480', hint: '+35' },
                { label: 'NPS', value: '54', hint: '90 days' },
              ],
            },
          ],
        },
        {
          id: 'trend',
          title: 'Trend',
          master: 'media-left',
          blocks: [
            imageBlock(img.chart as DeckTemplateImage, 'Monthly revenue, fictional data'),
            { type: 'text', markdown: 'Growth held in every month of the quarter.' },
          ],
        },
        {
          id: 'risks',
          title: 'Risks',
          master: 'content',
          blocks: [
            {
              type: 'callout',
              tone: 'warning',
              title: 'Hiring',
              body: 'Two open roles are slowing the mobile roadmap.',
            },
          ],
        },
        {
          id: 'next',
          title: 'Next steps',
          master: 'closing',
          blocks: [
            {
              type: 'list',
              items: [{ text: 'Close both roles' }, { text: 'Ship offline mode' }],
            },
          ],
        },
      ],
      options
    );
  },
};

const pitch: DeckTemplate = {
  id: 'pitch',
  label: 'Pitch',
  description: 'A product pitch: problem, solution, proof, a customer quote and the ask.',
  themeId: 'ocean',
  imageSlots: PITCH_IMAGES,
  create(options = {}) {
    const img = images(PITCH_IMAGES, options, { product: 'Product screenshot' });
    return build(
      pitch,
      'Harborline',
      [
        {
          id: 'cover',
          title: options.title ?? 'Harborline',
          master: 'title',
          blocks: [{ type: 'heading', level: 2, text: 'Shipping, simplified' }],
        },
        {
          id: 'problem',
          title: 'The problem',
          master: 'section',
          notes: 'Tell one customer story before the numbers.',
          blocks: [
            { type: 'text', markdown: 'Freight teams still track containers in spreadsheets.' },
          ],
        },
        {
          id: 'solution',
          title: 'The solution',
          master: 'media-right',
          blocks: [
            {
              type: 'list',
              items: [
                { text: 'Live container map' },
                { text: 'Generated manifests' },
                { text: 'Alerts before delays' },
              ],
            },
            imageBlock(img.product as DeckTemplateImage),
          ],
        },
        {
          id: 'proof',
          title: 'Traction',
          master: 'content',
          blocks: [
            {
              type: 'stat',
              items: [
                { label: 'Pilot customers', value: '14' },
                { label: 'Containers tracked', value: '9,200' },
              ],
            },
          ],
        },
        {
          id: 'voice',
          title: 'Customer voice',
          master: 'quote',
          blocks: [
            {
              type: 'quote',
              quote: 'We stopped losing containers.',
              cite: 'Operations lead, Example Freight',
            },
          ],
        },
        {
          id: 'ask',
          title: 'The ask',
          master: 'closing',
          blocks: [
            { type: 'text', markdown: 'A pilot with your **Rotterdam** team this quarter.' },
          ],
        },
      ],
      options
    );
  },
};

const review: DeckTemplate = {
  id: 'review',
  label: 'Review',
  description: 'A sprint or project review: goals, what shipped, a demo, numbers and next work.',
  themeId: 'graphite',
  imageSlots: REVIEW_IMAGES,
  create(options = {}) {
    const img = images(REVIEW_IMAGES, options, { demo: 'Screenshot of the shipped feature' });
    return build(
      review,
      'Sprint review',
      [
        {
          id: 'cover',
          title: options.title ?? 'Sprint review',
          master: 'title',
          blocks: [{ type: 'heading', level: 2, text: 'Platform team · Sprint 42' }],
        },
        {
          id: 'goals',
          title: 'Sprint goals',
          master: 'content',
          notes: 'Say whether each goal was met before showing details.',
          blocks: [
            {
              type: 'checklist',
              items: [
                { id: 'export', label: 'Ship the billing export', checked: true },
                { id: 'latency', label: 'Cut p95 latency by 20%', checked: true },
                { id: 'docs', label: 'Publish the API guide', checked: false },
              ],
            },
          ],
        },
        {
          id: 'shipped',
          title: 'What shipped',
          master: 'two-column',
          blocks: [
            {
              type: 'columns',
              columns: [
                [{ type: 'text', markdown: '**Billing export** for every workspace.' }],
                [{ type: 'text', markdown: '**Faster search** across boards.' }],
              ],
            },
          ],
        },
        {
          id: 'demo',
          title: 'Demo',
          master: 'media-left',
          blocks: [
            imageBlock(img.demo as DeckTemplateImage, 'The export flow'),
            {
              type: 'code',
              lang: 'ts',
              code: "await exportInvoices({ month: '2026-10' });",
            },
          ],
        },
        {
          id: 'next',
          title: 'Next sprint',
          master: 'closing',
          blocks: [
            {
              type: 'list',
              items: [{ text: 'Publish the API guide' }, { text: 'Board permissions' }],
            },
          ],
        },
      ],
      options
    );
  },
};

export const DECK_TEMPLATES: Readonly<Record<DeckTemplateId, DeckTemplate>> = Object.freeze({
  report,
  pitch,
  review,
});

/** Build a starter deck. Throws a `TypeError` when the options make it invalid. */
export function createDeckFromTemplate(id: DeckTemplateId, options?: DeckTemplateOptions): Deck {
  const template = DECK_TEMPLATES[id];
  if (!template) throw new TypeError(`Unknown deck template: ${String(id)}`);
  return template.create(options);
}
