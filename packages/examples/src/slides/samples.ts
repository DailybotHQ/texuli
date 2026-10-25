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
