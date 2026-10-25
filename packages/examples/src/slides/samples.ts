import { type Deck, parseDeck } from '@texuli/slides/model';
import { createDeckFromTemplate, type DeckTemplateImage } from '@texuli/slides/templates';

/** One-pixel raster swatches stand in for photos (fictional decks, no network). */
const SWATCH = {
  teal: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPgK5nwHwADuAISVL3raQAAAABJRU5ErkJggg==',
  amber:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO4Wc72HwAF2QJWAddyIQAAAABJRU5ErkJggg==',
  slate:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNwD838DwAD8QIFo4kWdAAAAABJRU5ErkJggg==',
} as const;

const wide = (src: string, alt: string): DeckTemplateImage => ({
  src,
  alt,
  width: 1280,
  height: 720,
});

export const reportDeck = (): Deck =>
  createDeckFromTemplate('report', {
    images: { chart: wide(SWATCH.teal, 'Monthly revenue trend, fictional data') },
  });

export const pitchDeck = (): Deck =>
  createDeckFromTemplate('pitch', {
    images: { product: wide(SWATCH.amber, 'Harborline live container map') },
  });

export const reviewDeck = (): Deck =>
  createDeckFromTemplate('review', {
    images: { demo: wide(SWATCH.slate, 'Billing export dialog') },
  });

/** Media on every master region: media-left figure, media-right image, a body gallery. */
export function mediaDeck(): Deck {
  const parsed = parseDeck({
    meta: { title: 'Harbor tour', aspect: '16:9', themeRef: 'ocean' },
    masters: ['media-left', 'media-right', 'content'],
    slides: [
      {
        id: 'dock',
        title: 'The dock',
        master: 'media-left',
        blocks: [
          {
            type: 'figure',
            ...wide(SWATCH.teal, 'Cranes over the east dock'),
            caption: 'East dock at shift change',
          },
          { type: 'text', markdown: 'Twelve cranes, **one** shift, no idle berths.' },
        ],
      },
      {
        id: 'yard',
        title: 'The yard',
        master: 'media-right',
        blocks: [
          {
            type: 'list',
            items: [{ text: 'Containers by lane' }, { text: 'Reefers on shore power' }],
          },
          { type: 'image', ...wide(SWATCH.amber, 'Container yard from above') },
        ],
      },
      {
        id: 'gallery',
        title: 'Around the port',
        master: 'content',
        blocks: [
          {
            type: 'gallery',
            columns: 3,
            items: [
              {
                ...wide(SWATCH.teal, 'Pilot boat leaving the harbor mouth'),
                caption: 'Pilot boat',
              },
              { ...wide(SWATCH.amber, 'Gantry crane over a container stack'), caption: 'Gantry' },
              { ...wide(SWATCH.slate, 'Freight wagons on the rail spur'), caption: 'Rail spur' },
            ],
          },
        ],
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message);
  return parsed.deck;
}

/**
 * Reveal steps: a list revealing item by item from step 1, a struck-through
 * line at step 2 and a callout at step 4. Shown at step 2 of 4.
 */
export function fragmentsDeck(): Deck {
  const parsed = parseDeck({
    meta: { title: 'Launch review', aspect: '16:9', themeRef: 'ocean' },
    slides: [
      { id: 'opening', title: 'Launch review', blocks: [] },
      {
        id: 'plan',
        title: 'Launch plan',
        notes: 'Reveal one stage at a time; strike the old plan before the date.',
        blocks: [
          { type: 'heading', level: 3, text: 'Three stages' },
          {
            type: 'list',
            ordered: true,
            step: 1,
            reveal: 'fade-up',
            items: [
              { text: 'Pilot with two teams' },
              { text: 'Open the beta' },
              { text: 'General availability' },
            ],
          },
          { type: 'text', markdown: 'Launch in a single region.', reveal: 'strike', step: 2 },
          { type: 'callout', tone: 'info', step: 4, body: 'The beta opens on 2026-11-02.' },
        ],
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message ?? 'Invalid fragments deck');
  return parsed.deck;
}

/**
 * Slot masters: dividers split blocks into a title footer, two columns with a
 * footer, and a quote with its attribution.
 */
export function slotMastersDeck(): Deck {
  const parsed = parseDeck({
    meta: { title: 'Quarter in review', aspect: '16:9', themeRef: 'graphite' },
    masters: ['title', 'two-column', 'quote', 'closing'],
    slides: [
      {
        id: 'cover',
        title: 'Quarter in review',
        master: 'title',
        blocks: [
          { type: 'heading', level: 3, text: 'Example Co. · Q3' },
          { type: 'divider' },
          { type: 'text', markdown: 'Fictional figures for illustration.' },
        ],
      },
      {
        id: 'compare',
        title: 'Before and after',
        master: 'two-column',
        blocks: [
          { type: 'heading', level: 3, text: 'Last quarter' },
          { type: 'list', items: [{ text: 'Manual exports' }, { text: 'Weekly reports' }] },
          { type: 'divider' },
          { type: 'heading', level: 3, text: 'This quarter' },
          { type: 'list', items: [{ text: 'Scheduled exports' }, { text: 'Live dashboards' }] },
          { type: 'divider' },
          { type: 'text', markdown: 'Source: example.com internal metrics.' },
        ],
      },
      {
        id: 'voice',
        title: 'Customer voice',
        master: 'quote',
        blocks: [
          { type: 'quote', quote: 'Reporting went from a day to a minute.' },
          { type: 'divider' },
          { type: 'text', markdown: 'Finance lead, Example Freight' },
        ],
      },
      {
        id: 'close',
        title: 'Thank you',
        master: 'closing',
        blocks: [
          { type: 'text', markdown: 'Questions welcome.' },
          { type: 'divider' },
          { type: 'text', markdown: 'slides@example.com' },
        ],
      },
    ],
  });
  if (!parsed.success) throw new Error(parsed.issues[0]?.message ?? 'Invalid slot masters deck');
  return parsed.deck;
}
