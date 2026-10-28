import type { DeckAction } from '@texuli/deck/engine';

/**
 * Inline SVG strokes (24 × 24 view box) for the deck controls, so no icon
 * package enters the stage bundle. `flip` icons mirror in right-to-left
 * decks, where the previous slide is on the right.
 */
export const DECK_CHROME_ICONS: Readonly<
  Partial<Record<DeckAction | 'fullscreen-on' | 'more', readonly string[]>>
> = Object.freeze({
  next: ['M5 12h14', 'm12 5 7 7-7 7'],
  prev: ['M19 12H5', 'm12 19-7-7 7-7'],
  first: ['M7 5v14', 'M19 12H9', 'm13 8-4 4 4 4'],
  last: ['M17 5v14', 'M5 12h10', 'm11 8 4 4-4 4'],
  jump: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  overview: ['M3 3h8v8H3z', 'M13 3h8v8h-8z', 'M3 13h8v8H3z', 'M13 13h8v8h-8z'],
  fullscreen: [
    'M8 3H5a2 2 0 0 0-2 2v3',
    'M16 3h3a2 2 0 0 1 2 2v3',
    'M8 21H5a2 2 0 0 1-2-2v-3',
    'M16 21h3a2 2 0 0 0 2-2v-3',
  ],
  'fullscreen-on': [
    'M8 3v3a2 2 0 0 1-2 2H3',
    'M21 8h-3a2 2 0 0 1-2-2V3',
    'M3 16h3a2 2 0 0 1 2 2v3',
    'M16 21v-3a2 2 0 0 1 2-2h3',
  ],
  presenter: ['M3 4h18v12H3z', 'M12 16v5', 'm8 21 4-5 4 5'],
  blackout: [
    'm3 3 18 18',
    'M10.6 10.6a2 2 0 0 0 2.8 2.8',
    'M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.3 4.2 9 7-.3 1.1-.9 2.2-1.8 3.2',
    'M6.2 6.2C4.1 7.5 2.7 9.7 2 12c.4 1.5 1.5 3.2 3.6 4.7A10.5 10.5 0 0 0 12 19',
  ],
  laser: ['m5 3 14 10-7 1-3 7L5 3z'],
  'copy-link': [
    'M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 2.9l-1.7 1.7',
    'M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7',
  ],
  print: [
    'M6 9V3h12v6',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v7H6z',
  ],
  help: ['M2 6h20v12H2z', 'M6 10h.01', 'M10 10h.01', 'M14 10h.01', 'M18 10h.01', 'M7 14h10'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
});

/** Icons that point along the reading direction. */
export const DECK_CHROME_FLIPPED_ICONS: ReadonlySet<string> = new Set([
  'next',
  'prev',
  'first',
  'last',
]);
